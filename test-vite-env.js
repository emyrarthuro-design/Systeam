import { loadEnv } from "vite";
const env = loadEnv("development", ".", "");
console.log("Vite loaded GEMINI_API_KEY as:", env.GEMINI_API_KEY);
console.log("Process GEMINI_API_KEY is:", process.env.GEMINI_API_KEY);
