import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Use service-level client for API routes (reads auth from request)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileId, userId, fileName } = body;

    if (!fileId || !userId) {
      return NextResponse.json({ error: "Missing fileId or userId" }, { status: 400 });
    }

    // 1. Mark file as "processing"
    await supabase
      .from("uploaded_files")
      .update({ analysis_status: "processing" })
      .eq("id", fileId);

    // 2. Set up Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await supabase
        .from("uploaded_files")
        .update({ analysis_status: "failed" })
        .eq("id", fileId);
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Ask Gemini to extract topics from the file name and context
    // In a full implementation, you'd download and parse the PDF first
    const prompt = `
      You are an expert academic study analyzer. A student has uploaded a past year question paper (PYQ) with the filename: "${fileName}".
      
      Based on this filename and common academic patterns, extract the most likely topics covered in this exam paper.
      
      Respond ONLY with a valid JSON object:
      {
        "subject": "The subject name (e.g., Operating Systems)",
        "topics": [
          { "name": "Topic Name", "priority": "High|Medium|Low", "reason": "Why this priority" }
        ]
      }
      
      Extract at least 4-6 topics. Assign "High" priority to topics that typically appear most frequently in exams.
      Do not include markdown formatting. Just output the raw JSON.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(cleanedText);

    // 4. Update the file record with extracted topics
    await supabase
      .from("uploaded_files")
      .update({
        analysis_status: "completed",
        extracted_topics: analysis,
      })
      .eq("id", fileId);

    // 5. Insert extracted topics into priority_topics (avoid duplicates)
    if (analysis.topics && Array.isArray(analysis.topics)) {
      for (const topic of analysis.topics) {
        // Check if topic already exists for this user
        const { data: existing } = await supabase
          .from("priority_topics")
          .select("id")
          .eq("user_id", userId)
          .eq("name", topic.name)
          .single();

        if (!existing) {
          await supabase.from("priority_topics").insert({
            user_id: userId,
            name: topic.name,
            priority: topic.priority,
            subject: analysis.subject,
            source: "pyq_analysis",
            progress: 0,
          });
        }
      }
    }

    return NextResponse.json({
      next_action: "topics_extracted",
      db_update_payload: { fileId, topicsCount: analysis.topics?.length || 0 },
      ui_message: `Extracted ${analysis.topics?.length || 0} topics from ${fileName}`,
    });
  } catch (error: any) {
    console.error("Document Analysis Error:", error);
    return NextResponse.json(
      { error: "Analysis failed: " + error.message },
      { status: 500 }
    );
  }
}
