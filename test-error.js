import { GoogleGenAI } from "@google/genai";
process.env.GEMINI_API_KEY = "";
try {
  const ai = new GoogleGenAI({ apiKey: "" });
  await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: "hello"
  });
} catch (e) {
  console.log("Empty API key error:", e.message);
}

try {
  const ai2 = new GoogleGenAI({ apiKey: "invalid_key_123" });
  await ai2.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: "hello"
  });
} catch (e) {
  console.log("Invalid API key error:", e.message);
}
