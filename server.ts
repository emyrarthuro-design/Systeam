import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import rateLimit from 'express-rate-limit';

// Read config for database ID
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

let adminApp: admin.app.App | null = null;

// IMPORTANTE: Mantener esta lista sincronizada con src/lib/admins.ts
// y con firestore.rules. Hardcodeado aquí porque el backend Node 
// no puede importar TypeScript del frontend sin builds extra.
const SUPER_ADMIN_EMAILS = ['emyr.arthuro@gmail.com'];
const ADMIN_EMAILS = ['info@emyrarthuro.com'];

function getFirebaseAdmin(): admin.app.App {
  if (adminApp) return adminApp;
  
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson || serviceAccountJson === 'MY_FIREBASE_SERVICE_ACCOUNT_JSON') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured in environment');
  }
  
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  
  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  return adminApp;
}

async function verifyAdminCaller(req: express.Request): Promise<{
  uid: string;
  email: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED: Missing or malformed Authorization header');
  }
  
  const idToken = authHeader.substring(7);
  const adminInstance = getFirebaseAdmin();
  const decoded = await adminInstance.auth().verifyIdToken(idToken);
  
  const email = (decoded.email || '').toLowerCase();
  
  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email);
  const isAdmin = isSuperAdmin || ADMIN_EMAILS.includes(email);
  
  if (!isAdmin) {
    throw new Error('FORBIDDEN: Caller is not admin');
  }
  
  return { uid: decoded.uid, email, isSuperAdmin, isAdmin };
}

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("your-api-key") || apiKey.includes("undefined")) {
    throw new Error("El API Key no está configurado (está vacío o tiene un valor de prueba). Por favor, ve a las opciones de Settings de AI Studio, busca los 'Secrets' y cambia/agrega GEMINI_API_KEY con tu clave real de AI Studio, y recarga la página.");
  }
  return new GoogleGenAI({ apiKey });
};

const invitationValidationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    error: 'Demasiados intentos. Espera un minuto antes de volver a intentar.',
    retryAfter: 60
  },
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || 'unknown';
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/invitations/test-all', async (req, res) => {
    try {
      const adminInstance = getFirebaseAdmin();
      const firestore = getFirestore(adminInstance, databaseId);
      const snap = await firestore.collection('invitations').get();
      const numInvitations = snap.size;
      const all = snap.docs.map(d => ({id: d.id, email: d.data().email}));
      return res.json({ size: numInvitations, invitations: all, databaseId });
    } catch(err: any) {
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/invitations/validate', invitationValidationLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email requerido" });
      }

      const adminInstance = getFirebaseAdmin();
      const firestore = getFirestore(adminInstance, databaseId);
      
      console.log(`[VALIDATE-INVITATIONS] Querying email: ${email.toLowerCase().trim()} in db: ${databaseId}`);

      const invSnap = await firestore.collection('invitations')
        .where('email', '==', email.toLowerCase().trim())
        .get();

      console.log(`[VALIDATE-INVITATIONS] Results found: ${invSnap.size}`);

      if (invSnap.empty) {
        return res.status(404).json({ error: "not_found" });
      }

      const invDoc = invSnap.docs[0];
      const invData = { id: invDoc.id, ...invDoc.data() };
      
      return res.status(200).json({ invitation: invData });
    } catch (err: any) {
      console.error("[VALIDATE-INVITATION] Error:", err);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  app.post('/api/invitations/activate', async (req, res) => {
    try {
      // NOTE: No caller verification required because anyone can activate an invitation they own, 
      // but maybe we can just verify the user's token so they can only activate their own invitation.
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      const idToken = authHeader.substring(7);
      const adminInstance = getFirebaseAdmin();
      const decoded = await adminInstance.auth().verifyIdToken(idToken);

      const { invitationId } = req.body;
      if (!invitationId) {
        return res.status(400).json({ error: "invitationId requerido" });
      }

      // We enforce that the invitation belongs to the authenticated user's email
      const firestore = getFirestore(adminInstance, databaseId);
      const invDocRef = firestore.collection('invitations').doc(invitationId);
      const invSnap = await invDocRef.get();
      
      if (!invSnap.exists) {
        return res.status(404).json({ error: "Invitación no encontrada" });
      }
      
      const invData = invSnap.data()!;
      if (invData.email.toLowerCase() !== decoded.email?.toLowerCase()) {
        return res.status(403).json({ error: "No puedes activar una invitación que no te pertenece" });
      }

      await invDocRef.update({
        status: 'activated',
        activatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[ACTIVATE-INVITATION] Error:", err);
      return res.status(500).json({ error: "Error interno" });
    }
  });

  // API endpoints
  app.post("/api/admin/delete-user", async (req, res) => {
    try {
      console.log("[DELETE-USER] Request received for target:", req.body.targetEmail);
      const caller = await verifyAdminCaller(req);
      console.log(`[DELETE-USER] Caller verified: ${caller.email} (super_admin: ${caller.isSuperAdmin})`);

      const { targetUid, targetEmail, confirmationName } = req.body;
      if (!targetUid || !targetEmail || !confirmationName) {
        return res.status(400).json({ error: "Missing targetUid, targetEmail or confirmationName" });
      }

      const normTargetEmail = targetEmail.toLowerCase();
      
      if (SUPER_ADMIN_EMAILS.includes(normTargetEmail)) {
        return res.status(403).json({ error: "Cannot delete super admin" });
      }
      if (ADMIN_EMAILS.includes(normTargetEmail) && !caller.isSuperAdmin) {
         return res.status(403).json({ error: "Only super_admin can delete admins" });
      }
      if (targetUid === caller.uid) {
         return res.status(403).json({ error: "Cannot delete yourself" });
      }

      const adminInstance = getFirebaseAdmin();
      const firestore = getFirestore(adminInstance, databaseId);

      const userDocRef = firestore.collection('users').doc(targetUid);
      const userDocSnap = await userDocRef.get();
      if (!userDocSnap.exists) {
        return res.status(404).json({ error: "User profile not found in database" });
      }

      const userData = userDocSnap.data()!;
      if ((userData.email || '').toLowerCase() !== normTargetEmail) {
        return res.status(400).json({ error: "Email mismatch — refresh and retry" });
      }

      // Both target.fullName and target.name could be used
      const targetName = (userData.fullName || userData.name || '').toLowerCase().trim();
      if (targetName !== confirmationName.toLowerCase().trim()) {
         return res.status(400).json({ error: "Confirmation name does not match" });
      }

      console.log("[DELETE-USER] Protections passed for target:", targetEmail);

      let diagnosticsArchived = 0;
      let invitationsDeleted = 0;
      let authAccountDeleted = false;
      const errors: string[] = [];

      // i) Archive diagnostics
      try {
        const diagnosticsSnapshot = await firestore.collection('diagnostics').where('uid', '==', targetUid).get();
        for (const doc of diagnosticsSnapshot.docs) {
          const archivedData = {
            ...doc.data(),
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            archivedBy: caller.uid,
            archivedByEmail: caller.email,
            reason: 'user_deleted'
          };
          await firestore.collection('diagnostics_archived').doc(doc.id).set(archivedData);
          await doc.ref.delete();
          diagnosticsArchived++;
        }
        console.log(`[DELETE-USER] Archived ${diagnosticsArchived} diagnostics`);
      } catch (err: any) {
        errors.push(`Diagnostics archive error: ${err.message}`);
        console.error("Diagnostics archive error:", err);
      }

      // ii) Delete invitations
      try {
        const invitationsSnapshot = await firestore.collection('invitations').where('email', '==', normTargetEmail).get();
        for (const doc of invitationsSnapshot.docs) {
           await doc.ref.delete();
           invitationsDeleted++;
        }
        console.log(`[DELETE-USER] Deleted ${invitationsDeleted} invitations`);
      } catch (err: any) {
         errors.push(`Invitations delete error: ${err.message}`);
         console.error("Invitations delete error:", err);
      }

      // iii) Delete user profile
      try {
        await userDocRef.delete();
        console.log("[DELETE-USER] Deleted user profile");
      } catch (err: any) {
         errors.push(`User profile delete error: ${err.message}`);
         console.error("User profile delete error:", err);
      }

      // iv) Delete Auth account
      try {
        await adminInstance.auth().deleteUser(targetUid);
         authAccountDeleted = true;
         console.log("[DELETE-USER] Deleted Auth account");
      } catch (err: any) {
         if (err.code === 'auth/user-not-found') {
            console.log("[DELETE-USER] Auth account already didn't exist");
            authAccountDeleted = true; // functionally deleted
         } else {
            console.error("Auth delete error:", err);
            errors.push(`Auth account delete error: ${err.message}`);
         }
      }

      // v) Audit log
      let auditLogId = '';
      try {
        const auditLogRef = await firestore.collection('audit_log').add({
           action: 'delete_user',
           targetUid,
           targetEmail,
           targetName: userData.fullName || userData.name || null,
           performedBy: caller.uid,
           performedByEmail: caller.email,
           performedAt: admin.firestore.FieldValue.serverTimestamp(),
           diagnosticsArchived,
           invitationsDeleted,
           authAccountDeleted,
           errors
        });
        auditLogId = auditLogRef.id;
        console.log("[DELETE-USER] Audit log written");
      } catch (err: any) {
         console.error("Audit log error:", err);
      }

      res.status(200).json({
        success: true,
        summary: {
           diagnosticsArchived,
           invitationsDeleted,
           authAccountDeleted,
           auditLogId
        }
      });
    } catch (err: any) {
      if (err.message?.startsWith('UNAUTHORIZED') || err.message?.startsWith('FORBIDDEN')) {
         return res.status(403).json({ error: err.message });
      }
      console.error("[DELETE-USER] Unhandled error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { variables, affinityRank, textAnswers } = req.body;
      
      if (!variables || !affinityRank || !textAnswers) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const systemInstruction = `Eres un mentor experto de SysTeam. Tienes los scores de las 8 variables, el ranking de afinidades por perfil y todas las respuestas abiertas del alumno.
Tu tarea: validar el perfil sugerido por la Capa 2 y construir un razonamiento diagnóstico completo.

Reglas:
- NO usar lenguaje victimizante ni endulzar
- NO clasificar la personalidad, sí identificar el cuello de botella
- Las recomendaciones siempre máximo 3
- Citar al menos 2 respuestas textuales como evidencia

Estructura de la devolución personalizada:
- Tono SysTeam (tú, cercano, directo, estratégico).
- 250-350 palabras.
- Cita textualmente al menos 2 respuestas del alumno.
- Empieza siempre con: "Según tus respuestas, tu perfil predominante hoy es [X], con un componente secundario de [Y]. Esto significa que…"
- Cierra siempre con: "No vamos a construir tu marca desde la urgencia, la copia o el miedo. Vamos a construirla desde tu identidad real."

Devuelve la información estrictamente en el JSON solicitado.`;

      const prompt = `
Variables del alumno (Capa 1):
${JSON.stringify(variables, null, 2)}

Ranking de afinidad (Capa 2):
${JSON.stringify(affinityRank, null, 2)}

Respuestas del alumno (crudo):
${textAnswers}
`;

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              perfil_predominante: { type: Type.STRING },
              perfil_secundario: { type: Type.STRING },
              afinidad_predominante: { type: Type.NUMBER },
              razonamiento: {
                type: Type.OBJECT,
                properties: {
                  diagnostico_central: { type: Type.STRING },
                  evidencias: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        observacion: { type: Type.STRING },
                        cita_alumno: { type: Type.STRING },
                        bloque: { type: Type.NUMBER }
                      }
                    }
                  },
                  contradicciones: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  por_que_este_perfil_y_no_otro: { type: Type.STRING }
                }
              },
              variables_scores: {
                 type: Type.OBJECT,
                 properties: {
                   AE: { type: Type.NUMBER },
                   SE: { type: Type.NUMBER },
                   CI: { type: Type.NUMBER },
                   CA: { type: Type.NUMBER },
                   CO: { type: Type.NUMBER },
                   CC: { type: Type.NUMBER },
                   SV: { type: Type.NUMBER },
                   ES: { type: Type.NUMBER }
                 }
              },
              bloqueo_principal: { type: Type.STRING },
              oportunidad_principal: { type: Type.STRING },
              creencia_limitante_principal: { type: Type.STRING },
              prioridad_incubadora: { type: Type.STRING },
              primera_accion_sugerida: { type: Type.STRING },
              recomendaciones: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              devolucion_personalizada: { type: Type.STRING },
              nota_interna: {
                type: Type.OBJECT,
                properties: {
                  observaciones_crudas: { type: Type.STRING },
                  banderas_rojas: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  contradicciones_detectadas: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  nivel_honestidad_percibida: { type: Type.STRING },
                  urgencia_intervencion: { type: Type.STRING },
                  enfoque_mentoria_primera_sesion: { type: Type.STRING },
                  preguntas_para_indagar: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const jsonString = response.text?.trim() || "{}";
      const resultObj = JSON.parse(jsonString);
      
      res.json(resultObj);

    } catch (err: any) {
      console.error("Error in /api/analyze:", err);
      res.status(500).json({ error: "Failed to analyze data", details: err.message });
    }
  });

  app.post("/api/improve-text", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Missing or invalid 'text' field" });
      }

      const systemInstruction = `Eres un editor de texto. Recibirás una transcripción de voz que puede contener muletillas, repeticiones y falta de puntuación. Tu tarea: limpiar el texto manteniendo EXACTAMENTE el mismo significado y la voz personal del autor. NO agregues ideas que no estén. NO cambies el tono. Solo: corrige puntuación, elimina muletillas como 'este', 'osea', 'eh', arregla repeticiones obvias y mejora la legibilidad. Devuelve solo el texto limpio sin comentarios.`;

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: text,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      res.json({ text: response.text?.trim() || text });

    } catch (err: any) {
      console.error("Error in /api/improve-text:", err);
      res.status(500).json({ error: "Failed to improve text", details: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn("WARNING: dist directory not found. Please run 'npm run build'.");
    }
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
