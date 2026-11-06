import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { registerRutaCeroRoutes } from '../src/server/rutaCero';

type RecordData = Record<string, any>;
type StubDoc = {
  exists: boolean;
  data: () => RecordData | undefined;
};
function buildStore() {
  const records = new Map<string, RecordData>([
    ['users/alpha', { uid: 'alpha', email: 'alpha@example.test', role: 'student' }],
    ['users/beta', { uid: 'beta', email: 'beta@example.test', role: 'student' }],
    ['users/admin', { uid: 'admin', email: 'verified-admin@example.test', role: 'admin' }],
    ['users/unverified', { uid: 'unverified', email: 'verified-admin@example.test', role: 'admin' }],
    ['rutaCeroEnrollments/alpha', { uid: 'alpha', active: true, program: 'ruta-cero' }]
  ]);
  const collection = (path: string): any => ({
    doc: (id: string): any => {
      const key = path + '/' + id;
      return {
        get: async (): Promise<StubDoc> => ({ exists: records.has(key), data: () => records.get(key) }),
        set: async (data: RecordData, opts?: { merge?: boolean }) => {
          const previous = records.get(key) || {};
          records.set(key, opts?.merge
            ? { ...previous, ...data, fields: { ...(previous.fields || {}), ...(data.fields || {}) } }
            : data);
        },
        collection: (segment: string) => collection(key + '/' + segment)
      };
    },
    where: (field: string, _operator: string, value: any) => ({
      limit: (n: number) => ({
        get: async () => {
          const docs = Array.from(records.entries())
            .filter(([key, data]) => key.startsWith(path + '/') &&
              key.slice(path.length + 1).indexOf('/') === -1 && data[field] === value)
            .slice(0, n)
            .map(([key, data]) => ({
              id: key.slice(path.length + 1),
              data: () => data
            }));
          return { docs, size: docs.length };
        }
      })
    })
  });
  return { records, db: { collection } };
}

test('Ruta Cero API protege acceso, Workbook, chat y activación por cuenta', async t => {
  const store = buildStore();
  const logins: Record<string, { uid: string; email: string; email_verified: boolean }> = {
    alpha: { uid: 'alpha', email: 'alpha@example.test', email_verified: false },
    beta: { uid: 'beta', email: 'beta@example.test', email_verified: false },
    admin: { uid: 'admin', email: 'verified-admin@example.test', email_verified: true },
    unverified: { uid: 'unverified', email: 'verified-admin@example.test', email_verified: false }
  };
  const aiCalls: unknown[] = [];
  const app = express();
  app.use(express.json());
  registerRutaCeroRoutes(app, {
    databaseId: '(test)',
    getFirebaseAdmin: () => ({
      auth: () => ({
        verifyIdToken: async (token: string) => {
          if (!logins[token]) throw new Error('Invalid token');
          return logins[token];
        }
      })
    }) as any,
    getFirestoreForApp: () => store.db as any,
    getAI: () => ({
      models: {
        generateContent: async (config: unknown) => {
          aiCalls.push(config);
          return { text: 'Podría diferenciarme ayudando a negocios con [problema] de una forma propia.' };
        }
      }
    }) as any,
    isAdminEmail: (email: string) => email === 'verified-admin@example.test'
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  });
  const port = (server.address() as AddressInfo).port;
  async function call(path: string, token?: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
    const res = await fetch(`http://127.0.0.1:${port}/api/ruta-cero/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return { status: res.status, payload: await res.json() };
  }

  await t.test('sin sesión devuelve 401', async () => {
    const result = await call('state');
    assert.equal(result.status, 401);
  });
  await t.test('sin inscripción devuelve 403 aunque tenga sesión', async () => {
    const result = await call('state', 'beta');
    assert.equal(result.status, 403);
  });
  await t.test('inscripción activa da acceso al Workbook propio', async () => {
    const a = await call('state', 'alpha');
    assert.equal(a.status, 200);
    assert.deepEqual(a.payload.workbook, {});
  });
  await t.test('rechaza campos ajenos y límites malformados', async () => {
    const x = await call('workbook', 'alpha', { fields: { role: 'super_admin' } });
    assert.equal(x.status, 400);
    const y = await call('workbook', 'alpha', { fields: { fortalezas: 'A'.repeat(1700) } });
    assert.equal(y.status, 400);
  });
  await t.test('guarda campo individual y persiste al volver a cargar', async () => {
    const posted = await call('workbook', 'alpha', { fields: { fortalezas: 'Comunicación, orden y estrategia' } });
    assert.equal(posted.status, 200);
    const state = await call('state', 'alpha');
    assert.equal(state.payload.workbook.fortalezas, 'Comunicación, orden y estrategia');
  });
  await t.test('chat usa IA e historial vinculado solo al estudiante', async () => {
    const chat = await call('chat', 'alpha', { agentId: 'cerebro-mercado', message: 'Sé organizar procesos' });
    assert.equal(chat.status, 200);
    assert.equal(chat.payload.messages.length, 2);
    assert.equal(chat.payload.messages[0].role, 'user');
    assert.equal(chat.payload.messages[1].role, 'assistant');
    assert.equal(aiCalls.length, 1);
    const state = await call('state', 'alpha');
    assert.equal(state.payload.messages.length, 2);
  });
  await t.test('no permite usar agentes todavía bloqueados', async () => {
    const x = await call('chat', 'alpha', { agentId: 'constructor-oferta', message: 'Ayúdame' });
    assert.equal(x.status, 400);
  });
  await t.test('un usuario no verificado no puede activar a terceros', async () => {
    const x = await call('admin/enroll', 'unverified', { email: 'beta@example.test' });
    assert.equal(x.status, 403);
  });
  await t.test('el administrador verificado activa otra cuenta', async () => {
    const before = await call('state', 'beta');
    assert.equal(before.status, 403);
    const activate = await call('admin/enroll', 'admin', { email: 'beta@example.test' });
    assert.equal(activate.status, 200);
    const after = await call('state', 'beta');
    assert.equal(after.status, 200);
    assert.deepEqual(after.payload.workbook, {});
    assert.deepEqual(after.payload.messages, []);
  });
});
