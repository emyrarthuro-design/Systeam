import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import express, { type Express, type Request, type RequestHandler, type Response } from 'express';
import { FieldPath, FieldValue, type Firestore, type Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type admin from 'firebase-admin';
import rateLimit from 'express-rate-limit';
import { DELIVERABLE_EXTENSIONS, lessons, MAX_DELIVERABLE_BYTES } from '../rutaCeroCurriculum';

type Identity = { uid: string; email: string; emailVerified: boolean; adminUser: boolean; firestore: Firestore };
type Attachment = { name: string; objectName: string; size: number };
type ClassWork = {
  uid: string; lessonId: string; studentEmail: string; status: 'started' | 'submitted' | 'approved' | 'changes';
  version: number; link?: string; file?: Attachment; feedback?: string;
  startedAt?: Timestamp; submittedAt?: Timestamp; reviewedAt?: Timestamp;
};

const path = '/api/ruta-cero/learning';
const work = 'rutaCeroClassWork';
const teachers = 'rutaCeroTeachers';
const lessonIds = new Set(lessons.map(lesson => lesson.id));

class LearningError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function fail(res: Response, error: unknown) {
  if (res.headersSent) { res.destroy(); return; }
  if (error instanceof LearningError) { res.status(error.status).json({ error: error.message }); return; }
  const code = error instanceof Error ? error.message : '';
  if (code === 'AUTH') { res.status(401).json({ error: 'Inicia sesión para continuar.' }); return; }
  if (code === 'ACCESS') { res.status(403).json({ error: 'No tienes acceso a este recurso de Ruta Cero.' }); return; }
  console.error('[RUTA-CERO LEARNING]', error);
  res.status(500).json({ error: 'No se pudo completar la operación. Intenta nuevamente.' });
}

function route(fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return async (req, res) => { try { await fn(req, res); } catch (error) { fail(res, error); } };
}

function lessonId(value: string) {
  if (!lessonIds.has(value)) throw new LearningError(404, 'Clase no encontrada.');
  return value;
}

function safeLink(input: unknown) {
  if (typeof input !== 'string' || input.length > 2048) throw new LearningError(400, 'Ingresa un enlace HTTPS válido.');
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new LearningError(400, 'Ingresa un enlace HTTPS válido.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new LearningError(400, 'Ingresa un enlace HTTPS válido.');
  return url.href;
}

function serialize(id: string, data: ClassWork) {
  const { uid, lessonId, studentEmail, status, version, link, file, feedback, startedAt, submittedAt, reviewedAt } = data;
  return { id, uid, lessonId, studentEmail, status, version, link, feedback,
    startedAt: startedAt?.toDate().toISOString(), submittedAt: submittedAt?.toDate().toISOString(),
    reviewedAt: reviewedAt?.toDate().toISOString(), ...(file && { file: { name: file.name, size: file.size } }) };
}

function workId(value: string) {
  if (!/^[^/]{1,180}$/.test(value)) throw new LearningError(404, 'Entrega no encontrada.');
  return value;
}

export function registerLearningRoutes(app: Express, deps: {
  caller: (req: Request) => Promise<Identity>;
  eligible: (req: Request) => Promise<Identity>;
  getFirebaseAdmin: () => admin.app.App;
}) {
  app.use(path, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  function bucket() {
    const name = process.env.RUTA_CERO_DELIVERABLES_BUCKET;
    if (!name) throw new LearningError(503, 'La carga de archivos todavía no está habilitada. Puedes enviar un enlace.');
    return getStorage(deps.getFirebaseAdmin()).bucket(name);
  }
  async function canReview(identity: Identity) {
    if (identity.adminUser) return true;
    if (!identity.emailVerified) return false;
    const role = await identity.firestore.collection(teachers).doc(identity.uid).get();
    const data = role.data();
    return data?.active === true && data.email === identity.email;
  }
  const studentOnly: RequestHandler = async (req, res, next) => {
    try { res.locals.identity = await deps.eligible(req); next(); } catch (error) { fail(res, error); }
  };
  const writeLimit = rateLimit({ windowMs: 60_000, limit: 18, keyGenerator: (_req, res) => res.locals.identity.uid });
  const fileBody = express.raw({ type: 'application/octet-stream', limit: MAX_DELIVERABLE_BYTES, inflate: false });

  async function save(identity: Identity, lesson: string, submission?: { link: string } | { file: Attachment }) {
    const ref = identity.firestore.collection(work).doc(`${identity.uid}:${lesson}`);
    return identity.firestore.runTransaction(async tx => {
      const current = (await tx.get(ref)).data() as ClassWork | undefined;
      if (!submission && current) return undefined;
      if (current?.status === 'approved') throw new LearningError(409, 'Esta entrega ya fue aprobada.');
      const status = submission ? 'submitted' : 'started';
      const version = (current?.version || 0) + (submission ? 1 : 0);
      tx.set(ref, {
        uid: identity.uid, studentEmail: identity.email, lessonId: lesson, status, version,
        startedAt: current?.startedAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(submission && { ...submission, submittedAt: FieldValue.serverTimestamp() })
      });
      return current?.file;
    });
  }
  async function removeFile(file?: Attachment) {
    if (!file) return;
    try { await bucket().file(file.objectName).delete({ ignoreNotFound: true }); } catch (error: any) {
      console.error('[RUTA-CERO LEARNING] File cleanup:', error?.code);
    }
  }

  app.get(path, route(async (req, res) => {
    const identity = await deps.caller(req);
    const reviewer = await canReview(identity);
    let student = identity.adminUser;
    if (!student) student = (await identity.firestore.collection('rutaCeroEnrollments').doc(identity.uid).get()).data()?.active === true;
    if (!student && !reviewer) throw new Error('ACCESS');
    const own = student ? await identity.firestore.collection(work).where('uid', '==', identity.uid).get() : null;
    res.json({ student, reviewer, admin: identity.adminUser, filesEnabled: Boolean(process.env.RUTA_CERO_DELIVERABLES_BUCKET),
      progress: own?.docs.map(doc => serialize(doc.id, doc.data() as ClassWork)) || [] });
  }));

  app.put(path + '/classes/:lessonId', studentOnly, writeLimit, route(async (req, res) => {
    const identity: Identity = res.locals.identity;
    const lesson = lessonId(req.params.lessonId);
    const input = req.body;
    if (input?.action !== 'start' && input?.action !== 'submit') throw new LearningError(400, 'Acción no válida.');
    const old = await save(identity, lesson, input.action === 'submit' ? { link: safeLink(input.link) } : undefined);
    await removeFile(old);
    res.json({ ok: true });
  }));

  app.post(path + '/classes/:lessonId/file', studentOnly, writeLimit, (req, res, next) => {
    fileBody(req, res, error => {
      if (error?.type === 'entity.too.large') { res.status(413).json({ error: 'El archivo supera los 10 MB.' }); return; }
      if (error) { fail(res, error); return; }
      next();
    });
  }, route(async (req, res) => {
    const identity: Identity = res.locals.identity;
    const lesson = lessonId(req.params.lessonId);
    let name: string;
    try { name = decodeURIComponent(req.get('x-file-name') || '').replace(/[\\/\u0000-\u001f\u007f]/g, '_').trim(); }
    catch { throw new LearningError(400, 'Nombre de archivo no válido.'); }
    const extension = name.split('.').at(-1)?.toLowerCase();
    if (!Buffer.isBuffer(req.body) || !req.body.length || !name.includes('.') || name.length > 180 ||
      !DELIVERABLE_EXTENSIONS.some(value => value === extension)) {
      throw new LearningError(400, 'Selecciona un archivo válido de hasta 10 MB.');
    }
    const attachment = { name, size: req.body.length, objectName: `deliverables/${identity.uid}/${lesson}/${randomUUID()}` };
    const object = bucket().file(attachment.objectName);
    await object.save(req.body, { resumable: false, contentType: 'application/octet-stream', preconditionOpts: { ifGenerationMatch: 0 } });
    let old: Attachment | undefined;
    try { old = await save(identity, lesson, { file: attachment }); }
    catch (error) { await removeFile(attachment); throw error; }
    await removeFile(old);
    res.json({ ok: true });
  }));

  app.get(path + '/file/:id', route(async (req, res) => {
    const identity = await deps.caller(req);
    const reviewer = await canReview(identity);
    if (!reviewer) await deps.eligible(req);
    const item = (await identity.firestore.collection(work).doc(workId(req.params.id)).get()).data() as ClassWork | undefined;
    if (!item?.file || (!reviewer && item.uid !== identity.uid)) throw new LearningError(404, 'Archivo no encontrado.');
    if (req.query.version !== String(item.version)) throw new LearningError(409, 'La entrega cambió. Actualiza la lista antes de descargar.');
    res.attachment(item.file.name);
    res.type('application/octet-stream');
    res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff');
    await pipeline(bucket().file(item.file.objectName).createReadStream(), res);
  }));

  app.get(path + '/reviews', route(async (req, res) => {
    const identity = await deps.caller(req);
    if (!await canReview(identity)) throw new Error('ACCESS');
    const cursor = req.query.cursor;
    if (cursor !== undefined && (typeof cursor !== 'string' || !/^[^/]{1,180}$/.test(cursor))) throw new LearningError(400, 'Página no válida.');
    const ordered = identity.firestore.collection(work).orderBy(FieldPath.documentId());
    const page = await (typeof cursor === 'string' ? ordered.startAfter(cursor) : ordered).limit(51).get();
    const docs = page.docs.slice(0, 50);
    res.json({ progress: docs.map(doc => serialize(doc.id, doc.data() as ClassWork)),
      nextCursor: page.size > 50 ? docs.at(-1)?.id : null });
  }));

  app.put(path + '/reviews/:id', route(async (req, res) => {
    const identity = await deps.caller(req);
    if (!await canReview(identity)) throw new Error('ACCESS');
    const { status, version, feedback } = req.body || {};
    if (!['approved', 'changes'].includes(status) || !Number.isSafeInteger(version) ||
      typeof feedback !== 'string' || feedback.length > 2000 || (status === 'changes' && !feedback.trim())) {
      throw new LearningError(400, 'Indica el resultado y agrega un comentario si solicitas ajustes.');
    }
    const ref = identity.firestore.collection(work).doc(workId(req.params.id));
    await identity.firestore.runTransaction(async tx => {
      const current = (await tx.get(ref)).data() as ClassWork | undefined;
      if (!current || current.status !== 'submitted' || current.version !== version) {
        throw new LearningError(409, 'La entrega cambió. Actualiza la lista antes de revisar.');
      }
      tx.update(ref, { status, feedback: feedback.trim(), reviewedBy: identity.uid, reviewedAt: FieldValue.serverTimestamp() });
    });
    res.json({ ok: true });
  }));

  app.put(path + '/teachers', route(async (req, res) => {
    const identity = await deps.caller(req);
    if (!identity.adminUser) throw new Error('ACCESS');
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254 || typeof req.body?.active !== 'boolean') {
      throw new LearningError(400, 'Ingresa el correo de la cuenta del profesor.');
    }
    let user;
    try { user = await deps.getFirebaseAdmin().auth().getUserByEmail(email); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      throw new LearningError(404, 'El profesor debe tener una cuenta de Systeam.');
    }
    if (req.body.active && (!user.emailVerified || user.disabled ||
      !(await identity.firestore.collection('users').doc(user.uid).get()).exists)) {
      throw new LearningError(400, 'El profesor necesita una cuenta activa de Systeam con correo verificado.');
    }
    await identity.firestore.collection(teachers).doc(user.uid).set({
      email, active: req.body.active, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp()
    });
    res.json({ ok: true });
  }));
}
