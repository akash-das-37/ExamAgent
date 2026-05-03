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
    const { userId, subjects, daysLeft, studyHours } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json({ error: "Gemini API key is not configured on the server." }, { status: 500 });
    }

    // Fetch existing priority topics and sessions for context
    let topicsContext = "";
    let sessionsContext = "";

    if (userId) {
      const { data: topics } = await supabase
        .from("priority_topics")
        .select("name, priority, progress, subject")
        .eq("user_id", userId);

      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("duration_minutes, difficulty_rating, session_date")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (topics && topics.length > 0) {
        topicsContext = `\n\nThe student already has these priority topics analyzed from PYQ papers:\n${JSON.stringify(topics)}`;
      }
      if (sessions && sessions.length > 0) {
        sessionsContext = `\n\nRecent study sessions:\n${JSON.stringify(sessions)}`;
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an expert academic study planner for technical students. 
      The student has the following core subjects: ${subjects}.
      They have ${daysLeft} days left until their exams and can study ${studyHours} hours per day.
      ${topicsContext}
      ${sessionsContext}

      Your task is to generate a highly optimized daily study plan for TODAY.
      
      Please respond ONLY with a valid JSON object matching the following structure:
      {
        "readinessScore": number (0-100 based on the time left vs workload),
        "priorityTopics": [
          { "name": "Topic Name", "priority": "High|Medium|Low", "reason": "Brief reason why" }
        ],
        "todaysPlan": [
          { "time": "HH:MM AM/PM", "task": "Task description", "category": "Revision|Practice|Assessment|New Topic" }
        ]
      }
      
      Generate 4-6 tasks for today's plan, spaced throughout the day.
      Do not include markdown blocks like \`\`\`json. Just output the raw JSON object.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(cleanedText);

    // If userId is provided, save the plan to the database
    if (userId && plan.todaysPlan) {
      // Clear today's existing plan
      const today = new Date().toISOString().split("T")[0];
      await supabase
        .from("study_plan")
        .delete()
        .eq("user_id", userId)
        .eq("plan_date", today);

      // Insert new plan items
      const planItems = plan.todaysPlan.map((item: any) => ({
        user_id: userId,
        task: item.task,
        category: item.category,
        scheduled_time: item.time,
        status: "Pending",
        plan_date: today,
      }));

      await supabase.from("study_plan").insert(planItems);

      // Update priority topics if they don't exist yet
      if (plan.priorityTopics) {
        for (const topic of plan.priorityTopics) {
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
              source: "ai_generated",
              progress: 0,
            });
          }
        }
      }
    }

    return NextResponse.json({
      ...plan,
      next_action: "plan_generated",
      ui_message: `Study plan for today generated with ${plan.todaysPlan?.length || 0} tasks.`,
    });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: "Failed to generate plan: " + error.message }, { status: 500 });
  }
}
