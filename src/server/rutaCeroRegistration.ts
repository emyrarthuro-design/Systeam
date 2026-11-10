import type { Express, Request } from 'express';
import type admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';

const path = '/api/ruta-cero/registration';
export const RUTA_CERO_GHL_TAG = 'rc-sales-pago-aprobado';

class RegistrationError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function configuration() {
  const token = process.env.RUTA_CERO_GHL_TOKEN;
  const locationId = process.env.RUTA_CERO_GHL_LOCATION_ID;
  if (!token || !locationId) throw new RegistrationError(503, 'El registro aún no está disponible. Intenta más tarde.');
  return { token, locationId };
}

export async function findApprovedContact(email: string, request: typeof fetch = fetch) {
  const { token, locationId } = configuration();
  let response: globalThis.Response;
  try {
    response = await request('https://services.leadconnectorhq.com/contacts/search', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Version: '2021-07-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, page: 1, pageLimit: 2, filters: [{ field: 'email', operator: 'eq', value: email }] }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error'
    });
  } catch {
    throw new RegistrationError(503, 'No pudimos comprobar tu inscripción. Intenta nuevamente en unos minutos.');
  }
  if (!response.ok) throw new RegistrationError(503, 'No pudimos comprobar tu inscripción. Intenta nuevamente en unos minutos.');
  let result: { contacts?: Array<{ id?: string; email?: string; locationId?: string; tags?: unknown }>; total?: number };
  try { result = await response.json(); }
  catch { throw new RegistrationError(503, 'No pudimos comprobar tu inscripción. Intenta nuevamente en unos minutos.'); }
  if (!Array.isArray(result?.contacts)) throw new RegistrationError(503, 'No pudimos comprobar tu inscripción. Intenta nuevamente en unos minutos.');
  const [contact] = result.contacts;
  if (result.contacts.length !== 1 || (result.total !== undefined && result.total !== 1) ||
    typeof contact?.id !== 'string' || !contact.id || typeof contact.email !== 'string' || contact.email.trim().toLowerCase() !== email ||
    contact.locationId !== locationId || !Array.isArray(contact.tags) || !contact.tags.includes(RUTA_CERO_GHL_TAG)) {
    throw new RegistrationError(403, 'No encontramos una inscripción aprobada para este correo. Usa el correo de tu compra o contacta al equipo de Ruta Cero.');
  }
  return { contactId: contact.id, locationId };
}

type RegistrationDeps = {
  getFirebaseAdmin: () => admin.app.App;
  databaseId: string;
  getFirestoreForApp?: (app: admin.app.App, databaseId: string) => ReturnType<typeof getFirestore>;
  registrationFetch?: typeof fetch;
};

export function registerRutaCeroRegistration(app: Express, deps: RegistrationDeps) {
  app.use(path, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  app.get(path, (_req, res) => {
    res.json({ enabled: Boolean(process.env.RUTA_CERO_GHL_TOKEN && process.env.RUTA_CERO_GHL_LOCATION_ID) });
  });
  const limit = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
  app.post(path + '/activate', limit, async (req: Request, res) => {
    try {
      const sdk = deps.getFirebaseAdmin();
      const header = req.get('authorization');
      if (!header?.startsWith('Bearer ')) throw new RegistrationError(401, 'Inicia sesión para activar tu acceso.');
      let identity;
      try { identity = await sdk.auth().verifyIdToken(header.slice(7), true); }
      catch { throw new RegistrationError(401, 'Inicia sesión nuevamente para activar tu acceso.'); }
      const email = identity.email?.trim().toLowerCase();
      if (!identity.email_verified || !email) throw new RegistrationError(403, 'Verifica tu correo antes de activar tu acceso.');
      const name = req.body?.fullName;
      if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 120)) {
        throw new RegistrationError(400, 'Ingresa tu nombre, de hasta 120 caracteres.');
      }
      const { contactId, locationId } = await findApprovedContact(email, deps.registrationFetch);
      const db = deps.getFirestoreForApp ? deps.getFirestoreForApp(sdk, deps.databaseId) : getFirestore(sdk, deps.databaseId);
      const profile = db.collection('users').doc(identity.uid);
      const enrollment = db.collection('rutaCeroEnrollments').doc(identity.uid);
      await db.runTransaction(async tx => {
        const [profileSnapshot, enrollmentSnapshot] = await Promise.all([tx.get(profile), tx.get(enrollment)]);
        const existing = enrollmentSnapshot.data();
        if (enrollmentSnapshot.exists && existing?.active !== true) {
          throw new RegistrationError(403, 'El equipo debe revisar la activación de tu cuenta. Contacta a Ruta Cero.');
        }
        if (!profileSnapshot.exists) {
          tx.create(profile, { uid: identity.uid, email, fullName: name?.trim() || identity.name || 'Estudiante',
            country: 'No especificado', role: 'student', createdAt: new Date().toISOString(), diagnosticStatus: 'not_started' });
        }
        if (!enrollmentSnapshot.exists) {
          tx.create(enrollment, { uid: identity.uid, email, active: true, program: 'ruta-cero',
            source: 'gohighlevel', contactId, locationId, validatedTag: RUTA_CERO_GHL_TAG,
            createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        }
      });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof RegistrationError) { res.status(error.status).json({ error: error.message }); return; }
      console.error('[RUTA-CERO REGISTRATION] Activation failed.');
      res.status(500).json({ error: 'No pudimos activar tu acceso. Intenta nuevamente.' });
    }
  });
}
