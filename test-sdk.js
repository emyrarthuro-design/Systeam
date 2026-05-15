import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({});
ai.models.generateContent({
  model: "gemini-3.1-pro-preview",
  contents: "hello"
}).then(r => console.log("SUCCESS")).catch(e => console.error("ERROR SDK:", e));
