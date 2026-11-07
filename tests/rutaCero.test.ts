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
    ['users/spoofed', { uid: 'spoofed', email: 'claimed@example.test', role: 'student' }],
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
            ? {
                ...previous,
                ...data,
                fields: { ...(previous.fields || {}), ...(data.fields || {}) },
                validatedOffers: { ...(previous.validatedOffers || {}), ...(data.validatedOffers || {}) }
              }
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
        },
        getUser: async (uid: string) => {
          const registered: Record<string, string> = {
            alpha: 'alpha@example.test',
            beta: 'beta@example.test',
            admin: 'verified-admin@example.test',
            unverified: 'verified-admin@example.test',
            spoofed: 'actual@example.test'
          };
          if (!registered[uid]) throw new Error('No such auth user');
          return { uid, email: registered[uid] };
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
  await t.test('Agente de Contenido usa avatar y pilares del Workbook', async () => {
    const saved = await call('workbook', 'alpha', {
      fields: { avatar: 'Freelancers con dificultad para organizar sus finanzas', pilares: 'Finanzas personales, presupuestos, ahorro' }
    });
    assert.equal(saved.status, 200);
    const response = await call('chat', 'alpha', {
      agentId: 'contenido', mode: 'pilares', message: 'Ayúdame con cuatro ideas por pilar'
    });
    assert.equal(response.status, 200);
    assert.equal(response.payload.messages.length, 2);
    const lastAI = aiCalls.at(-1) as any;
    assert.match(lastAI.config.systemInstruction, /EXACTAMENTE 4 ideas/);
    const firstContext = lastAI.contents[0].parts[0].text;
    assert.match(firstContext, /Freelancers con dificultad/);
    assert.match(firstContext, /Finanzas personales/);
  });
  await t.test('los modos de Contenido guardan conversaciones separadas entre sí', async () => {
    const pillars = await call('state?agentId=contenido&mode=pilares', 'alpha');
    assert.equal(pillars.status, 200);
    assert.equal(pillars.payload.messages.length, 2);
    const postsBefore = await call('state?agentId=contenido&mode=publicaciones', 'alpha');
    assert.equal(postsBefore.payload.messages.length, 0);
    const response = await call('chat', 'alpha', {
      agentId: 'contenido', mode: 'publicaciones', message: 'Quiero una bio para mi marca'
    });
    assert.equal(response.status, 200);
    const postsAfter = await call('state?agentId=contenido&mode=publicaciones', 'alpha');
    assert.equal(postsAfter.payload.messages.length, 2);
    const ninety = await call('state?agentId=contenido&mode=sistema90', 'alpha');
    assert.equal(ninety.payload.messages.length, 0);
    const market = await call('state', 'alpha');
    assert.equal(market.payload.messages.length, 2);
  });
  await t.test('agente de Contenido mantiene entregables compartidos en Workbook', async () => {
    const result = await call('workbook', 'alpha', {
      fields: { ideasContenido: 'EDUCA: Cómo organizar finanzas; CONECTA: Mi experiencia', publicaciones: 'BIO: Ayudo a freelancers a organizar sus finanzas.' }
    });
    assert.equal(result.status, 200);
    const state = await call('state?agentId=contenido&mode=sistema90', 'alpha');
    assert.match(state.payload.workbook.ideasContenido, /EDUCA/);
    assert.match(state.payload.workbook.publicaciones, /BIO/);
    assert.equal(state.payload.workbook.fortalezas, 'Comunicación, orden y estrategia');
  });
  await t.test('rechaza modo no reconocido, modo ausente y otro agente no implementado', async () => {
    assert.equal((await call('chat', 'alpha', { agentId: 'contenido', message: 'Hola' })).status, 400);
    assert.equal((await call('state?agentId=contenido&mode=cualquiera', 'alpha')).status, 400);
    assert.equal((await call('chat', 'alpha', { agentId: 'expansion', message: 'Hola' })).status, 400);
  });
  const lowOffer = {
    name: 'Finanzas sin caos',
    format: 'Taller online de 90 minutos',
    includes: 'Sesión y plantilla descargable',
    transformation: 'Un presupuesto mensual básico',
    bonus: 'Guía para empezar sin conocimientos previos',
    objection1: 'No tengo tiempo',
    response1: 'Puedes usar la plantilla después del taller',
    objection2: 'No sé de números',
    response2: 'Empezamos con ejemplos sencillos',
    price: 17
  };
  const nextOffer = {
    name: 'Programa Finanzas Claras',
    format: 'Acompañamiento en grupo',
    includes: 'Cuatro encuentros de trabajo',
    transformation: 'Crear un sistema de control mensual',
    reason: 'Pasa del presupuesto inicial a un hábito sostenible',
    price: 68
  };

  await t.test('no guarda ofertas sin Avatar y Ángulo de Oportunidad', async () => {
    const result = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'first', offer: lowOffer });
    assert.equal(result.status, 422);
    assert.match(result.payload.error, /Avatar/);
  });
  await t.test('el Workbook no permite saltarse la validación de precios', async () => {
    const result = await call('workbook', 'alpha', { fields: { ofertaLowTicket: 'Low Ticket: $5000' } });
    assert.equal(result.status, 400);
    const next = await call('workbook', 'alpha', { fields: { ofertaSiguienteNivel: 'Precio: $1' } });
    assert.equal(next.status, 400);
  });
  await t.test('rechaza Siguiente Nivel antes de validar Low Ticket', async () => {
    const result = await call('offers', 'alpha', { stage: 'siguienteNivel', offer: nextOffer });
    assert.equal(result.status, 422);
    assert.match(result.payload.error, /Low Ticket/);
  });
  await t.test('primera venta rechaza precio fuera de USD $7–27', async () => {
    await call('workbook', 'alpha', { fields: {
      avatar: 'Freelancers con dificultad para administrar ingresos',
      anguloOportunidad: 'Ayudo a freelancers a organizar sus finanzas con plantillas sencillas'
    } });
    for (const price of [0, 6.99, 27.01, 100, 17.123, NaN]) {
      const result = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'first', offer: { ...lowOffer, price } });
      assert.equal(result.status, 422, String(price));
    }
    const unknown = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'unknown', offer: lowOffer });
    assert.equal(unknown.status, 422);
  });
  await t.test('primera venta acepta USD $7 y $27 y guarda un resumen canónico', async () => {
    for (const price of [7, 27]) {
      const result = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'first', offer: { ...lowOffer, price } });
      assert.equal(result.status, 200);
      assert.equal(result.payload.offers.lowTicket.price, price);
      assert.match(result.payload.workbook.ofertaLowTicket, /LOW TICKET — OFERTA VALIDADA/);
    }
  });
  await t.test('Siguiente Nivel respeta múltiplo 3–10 y guarda solo después', async () => {
    const tooLow = await call('offers', 'alpha', { stage: 'siguienteNivel', offer: { ...nextOffer, price: 80.72 } });
    assert.equal(tooLow.status, 422); // 27 * 3 = 81
    const tooHigh = await call('offers', 'alpha', { stage: 'siguienteNivel', offer: { ...nextOffer, price: 270.01 } });
    assert.equal(tooHigh.status, 422);
    for (const price of [81, 270]) {
      const result = await call('offers', 'alpha', { stage: 'siguienteNivel', offer: { ...nextOffer, price } });
      assert.equal(result.status, 200);
      assert.equal(result.payload.offers.siguienteNivel.price, price);
      assert.equal(result.payload.offers.siguienteNivel.basedOnLowTicketPrice, 27);
    }
    const state = await call('state?agentId=oferta', 'alpha');
    assert.equal(state.status, 200);
    assert.match(state.payload.workbook.ofertaSiguienteNivel, /SIGUIENTE NIVEL — OFERTA VALIDADA/);
  });
  await t.test('reprecio de Low Ticket invalida Siguiente Nivel previamente aprobado', async () => {
    const revised = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'first', offer: { ...lowOffer, price: 17 } });
    assert.equal(revised.status, 200);
    assert.equal(revised.payload.offers.siguienteNivel, null);
    assert.equal(revised.payload.workbook.ofertaSiguienteNivel, '');
  });
  await t.test('vendedor experimentado respeta USD $27–100', async () => {
    for (const price of [26.99, 100.01]) {
      const result = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'experienced', offer: { ...lowOffer, price } });
      assert.equal(result.status, 422);
    }
    for (const price of [27, 100]) {
      const result = await call('offers', 'alpha', { stage: 'lowTicket', experience: 'experienced', offer: { ...lowOffer, price } });
      assert.equal(result.status, 200);
      assert.equal(result.payload.offers.lowTicket.experience, 'experienced');
    }
  });
  await t.test('Constructor de Oferta comparte los antecedentes pero no los mensajes de otros agentes', async () => {
    const response = await call('chat', 'alpha', { agentId: 'oferta', message: 'Estoy diseñando mi primer taller' });
    assert.equal(response.status, 200);
    assert.equal(response.payload.messages.length, 2);
    const state = await call('state?agentId=oferta', 'alpha');
    assert.equal(state.payload.messages.length, 2);
    assert.match(state.payload.workbook.ofertaLowTicket, /100.00 USD/);
    const market = await call('state', 'alpha');
    assert.equal(market.payload.messages.length, 2);
    const lastAI = aiCalls.at(-1) as any;
    assert.match(lastAI.config.systemInstruction, /entre USD \$7 y \$27/);
    assert.match(lastAI.contents[0].parts[0].text, /freelancers/i);
  });
  await t.test('no permite usar agentes todavía bloqueados', async () => {
    const x = await call('chat', 'alpha', { agentId: 'constructor-oferta', message: 'Ayúdame' });
    assert.equal(x.status, 400);
  });
  await t.test('un usuario no verificado no puede activar a terceros', async () => {
    const x = await call('admin/enroll', 'unverified', { email: 'beta@example.test' });
    assert.equal(x.status, 403);
  });
  await t.test('rechaza inscripción si el perfil manipula el correo de Firebase Auth', async () => {
    const forged = await call('admin/enroll', 'admin', { email: 'claimed@example.test' });
    assert.equal(forged.status, 409);
    assert.match(forged.payload.error, /no coincide/i);
    assert.equal(store.records.has('rutaCeroEnrollments/spoofed'), false);
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
