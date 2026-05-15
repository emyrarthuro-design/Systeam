import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({
  model: "gemini-3.1-pro-preview",
  contents: "hello",
  config: { systemInstruction: "be nice" }
}).then(r => console.log("SUCCESS")).catch(e => console.error("ERROR SDK:", e.message));
