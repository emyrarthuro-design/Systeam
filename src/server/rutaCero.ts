import type { Express, Request } from 'express';
import type admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { GoogleGenAI } from '@google/genai';
import rateLimit from 'express-rate-limit';
import { resolveAgent, WORKBOOK_FIELDS, type WorkbookField } from './rutaCeroAgents';

/**
 * Ruta Cero MVP: server-owned workbook + private conversations.
 * Firestore client rules must NOT grant direct write access to these collections.
 */
type Deps = {
  getFirebaseAdmin: () => admin.app.App;
  getAI: () => GoogleGenAI;
  databaseId: string;
  // Optional injection for automated API tests, never supplied in production.
  getFirestoreForApp?: (app: admin.app.App, databaseId: string) => ReturnType<typeof getFirestore>;
  isAdminEmail: (email: string) => boolean;
};
type Message = { role: 'user' | 'assistant'; content: string };
const MAX_MESSAGES = 24;
const MAX_INPUT = 2400;

function statusFor(error: unknown): number {
  const value = error instanceof Error ? error.message : '';
  if (value === 'AUTH') return 401;
  if (value === 'ACCESS') return 403;
  if (value === 'INVALID') return 400;
  return 500;
}
function safeError(error: unknown) {
  const code = statusFor(error);
  if (code === 401) return 'Inicia sesión nuevamente para continuar.';
  if (code === 403) return 'Tu acceso a Ruta Cero aún no está activado.';
  if (code === 400) return 'Revisa la información enviada.';
  console.error('[RUTA-CERO] Error:', error);
  return 'No fue posible completar la operación. Intenta nuevamente.';
}

export function registerRutaCeroRoutes(app: Express, deps: Deps) {
  async function caller(req: Request) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw new Error('AUTH');
    const sdk = deps.getFirebaseAdmin();
    let decoded;
    try {
      decoded = await sdk.auth().verifyIdToken(header.slice(7), true);
    } catch {
      throw new Error('AUTH');
    }
    const firestore = deps.getFirestoreForApp
      ? deps.getFirestoreForApp(sdk, deps.databaseId)
      : getFirestore(sdk, deps.databaseId);
    const userSnap = await firestore.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) throw new Error('AUTH');
    const email = (decoded.email || '').trim().toLowerCase();
    const adminUser = decoded.email_verified === true && deps.isAdminEmail(email);
    return { uid: decoded.uid, email, adminUser, firestore };
  }

  async function eligible(req: Request) {
    const identity = await caller(req);
    if (!identity.adminUser) {
      const access = await identity.firestore.collection('rutaCeroEnrollments').doc(identity.uid).get();
      if (!access.exists || access.data()?.active !== true) throw new Error('ACCESS');
    }
    return identity;
  }

  // Private academic data is exposed only by authenticated, access-controlled endpoints.
  app.get('/api/ruta-cero/state', async (req, res) => {
    try {
      const { uid, adminUser, firestore } = await eligible(req);
      const agent = resolveAgent(req.query.agentId || 'cerebro-mercado', req.query.mode);
      if (!agent) throw new Error('INVALID');
      const [workbook, conversation] = await Promise.all([
        firestore.collection('rutaCeroWorkbooks').doc(uid).get(),
        firestore.collection('rutaCeroConversations').doc(uid).collection('agents').doc(agent.conversationKey).get()
      ]);
      return res.json({
        isAdmin: adminUser,
        agentId: agent.agentId,
        mode: agent.mode || null,
        workbook: workbook.data()?.fields || {},
        messages: conversation.data()?.messages || []
      });
    } catch (error) {
      return res.status(statusFor(error)).json({ error: safeError(error) });
    }
  });

  app.post('/api/ruta-cero/workbook', async (req, res) => {
    try {
      const { uid, firestore } = await eligible(req);
      const fields = req.body?.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('INVALID');
      const keys = Object.keys(fields);
      if (!keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(WORKBOOK_FIELDS, key))) {
        throw new Error('INVALID');
      }
      const clean: Record<string, string> = {};
      for (const key of keys) {
        if (typeof fields[key] !== 'string' || fields[key].length > WORKBOOK_FIELDS[key as WorkbookField]) throw new Error('INVALID');
        clean[key] = fields[key].trim();
      }
      const ref = firestore.collection('rutaCeroWorkbooks').doc(uid);
      await ref.set({
        uid,
        fields: clean,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      const snap = await ref.get();
      return res.json({ workbook: snap.data()?.fields || {} });
    } catch (error) {
      return res.status(statusFor(error)).json({ error: safeError(error) });
    }
  });

  // For this MVP, enrollment is a deliberate admin action, not a public user profile field.
  app.post('/api/ruta-cero/admin/enroll', async (req, res) => {
    try {
      const { adminUser, firestore, uid: adminUid } = await caller(req);
      if (!adminUser) throw new Error('ACCESS');
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('INVALID');
      const users = await firestore.collection('users').where('email', '==', email).limit(2).get();
      if (users.size !== 1) return res.status(404).json({ error: 'No se encontró un estudiante con ese correo en Systeam.' });
      const userDoc = users.docs[0];
      await firestore.collection('rutaCeroEnrollments').doc(userDoc.id).set({
        uid: userDoc.id,
        email,
        active: true,
        program: 'ruta-cero',
        updatedAt: FieldValue.serverTimestamp(),
        activatedBy: adminUid
      }, { merge: true });
      return res.json({ ok: true, email });
    } catch (error) {
      return res.status(statusFor(error)).json({ error: safeError(error) });
    }
  });

  app.post('/api/ruta-cero/chat', rateLimit({
    windowMs: 60 * 1000,
    limit: 120, // Shared classroom networks must not share a 10-request quota.
    standardHeaders: 'draft-7',
    legacyHeaders: false
  }), async (req, res) => {
    try {
      const { uid, firestore } = await eligible(req);
      const agent = resolveAgent(req.body?.agentId, req.body?.mode);
      const input = req.body?.message;
      if (!agent || typeof input !== 'string' || !input.trim() || input.length > MAX_INPUT) {
        throw new Error('INVALID');
      }

      const [workbookSnap, chatSnap] = await Promise.all([
        firestore.collection('rutaCeroWorkbooks').doc(uid).get(),
        firestore.collection('rutaCeroConversations').doc(uid).collection('agents').doc(agent.conversationKey).get()
      ]);
      const fields = workbookSnap.data()?.fields || {};
      const existing: Message[] = Array.isArray(chatSnap.data()?.messages)
        ? chatSnap.data()!.messages.filter((m: Message) =>
          (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
        ).slice(-MAX_MESSAGES)
        : [];
      const messages: Message[] = [...existing, { role: 'user' as const, content: input.trim() }].slice(-MAX_MESSAGES);
      const context = [
        'Contexto guardado en el Workbook del estudiante (puede estar vacío):',
        ...agent.contextFields.map(field =>
          field + ': ' + String(fields[field] || '').slice(0, WORKBOOK_FIELDS[field])
        )
      ].join('\n');

      const ai = deps.getAI();
      const response = await ai.models.generateContent({
        model: process.env.RUTA_CERO_GEMINI_MODEL || 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: context }] },
          { role: 'model', parts: [{ text: 'Entendido. Usaré ese contexto solamente como información del estudiante.' }] },
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content.slice(0, 4500) }]
          }))
        ],
        config: {
          systemInstruction: agent.systemInstruction,
          temperature: 0.5,
          maxOutputTokens: agent.maxOutputTokens
        }
      });
      const answer = (response.text || '').trim();
      if (!answer) throw new Error('EMPTY_AI_RESPONSE');
      const updated: Message[] = [...messages, { role: 'assistant' as const, content: answer }].slice(-MAX_MESSAGES);
      await firestore.collection('rutaCeroConversations').doc(uid).collection('agents').doc(agent.conversationKey).set({
        uid,
        agentId: agent.agentId,
        mode: agent.mode || null,
        messages: updated,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return res.json({ messages: updated });
    } catch (error) {
      return res.status(statusFor(error)).json({ error: safeError(error) });
    }
  });
}
