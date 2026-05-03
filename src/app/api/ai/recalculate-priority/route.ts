import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 1. Fetch current topics and recent sessions
    const { data: topics } = await supabase
      .from("priority_topics")
      .select("*")
      .eq("user_id", userId);

    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!topics || topics.length === 0) {
      return NextResponse.json({
        next_action: "no_topics",
        ui_message: "No topics to recalculate. Upload a PYQ first!",
      });
    }

    // 2. Set up Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Ask Gemini to re-rank based on study patterns
    const prompt = `
      You are an intelligent study priority optimizer. Based on the student's study data, recalculate topic priorities.

      Current Topics:
      ${JSON.stringify(topics.map(t => ({
        id: t.id,
        name: t.name,
        priority: t.priority,
        progress: t.progress,
        subject: t.subject,
      })))}

      Recent Study Sessions:
      ${JSON.stringify((sessions || []).map(s => ({
        topic_id: s.topic_id,
        duration: s.duration_minutes,
        difficulty: s.difficulty_rating,
        date: s.session_date,
      })))}

      Rules:
      - Topics the student struggled with (high difficulty, low duration) should move UP in priority.
      - Topics with high progress (>80%) can move DOWN unless they are critical exam topics.
      - Topics with zero study sessions should be flagged as "High" priority.

      Respond ONLY with a valid JSON array:
      [
        { "id": "topic-uuid", "priority": "High|Medium|Low", "reason": "Brief reason" }
      ]
      
      Do not include markdown formatting. Just output the raw JSON.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const updates = JSON.parse(cleanedText);

    // 4. Apply updates to the database
    let updatedCount = 0;
    for (const update of updates) {
      const { error } = await supabase
        .from("priority_topics")
        .update({ priority: update.priority, updated_at: new Date().toISOString() })
        .eq("id", update.id)
        .eq("user_id", userId);

      if (!error) updatedCount++;
    }

    return NextResponse.json({
      next_action: "priorities_recalculated",
      db_update_payload: { updatedCount },
      ui_message: `Recalculated priorities for ${updatedCount} topics.`,
    });
  } catch (error: any) {
    console.error("Priority Recalculation Error:", error);
    return NextResponse.json(
      { error: "Recalculation failed: " + error.message },
      { status: 500 }
    );
  }
}
