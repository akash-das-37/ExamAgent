import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { subjects, daysLeft, studyHours } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an expert academic study planner for technical students. 
      The student has the following core subjects: ${subjects}.
      They have ${daysLeft} days left until their exams and can study ${studyHours} hours per day.

      Your task is to generate a highly optimized study plan. 
      Please respond ONLY with a valid JSON object matching the following structure:
      {
        "readinessScore": number (0-100 based on the time left vs workload),
        "priorityTopics": [
          { "name": "Topic Name", "priority": "High|Medium|Low", "reason": "Brief reason why" }
        ],
        "schedule": [
          { "day": number, "tasks": ["Task 1", "Task 2"] }
        ]
      }
      Do not include markdown blocks like \`\`\`json. Just output the raw JSON object.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Clean up response if it contains markdown formatting
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(cleanedText);

    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: "Failed to generate plan: " + error.message }, { status: 500 });
  }
}

