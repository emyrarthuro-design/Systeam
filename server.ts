import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("your-api-key") || apiKey.includes("undefined")) {
    throw new Error("El API Key no está configurado (está vacío o tiene un valor de prueba). Por favor, ve a las opciones de Settings de AI Studio, busca los 'Secrets' y cambia/agrega GEMINI_API_KEY con tu clave real de AI Studio, y recarga la página.");
  }
  return new GoogleGenAI({ apiKey });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
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
