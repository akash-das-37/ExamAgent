const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const models = ["gemini-pro", "gemini-1.5-flash", "gemini-1.5-pro"];
  
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m }, { apiVersion: "v1" });
      const result = await model.generateContent("test");
      console.log(`${m} works on v1`);
    } catch (e) {
      console.error(`${m} failed on v1:`, e.message);
    }
  }
}

listModels();
