import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function downloadFile(fileUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(fileUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buffer = await res.arrayBuffer();
    return {
      base64: Buffer.from(buffer).toString("base64"),
      mimeType: contentType.split(";")[0].trim(),
    };
  } catch {
    return null;
  }
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    webp: "image/webp", gif: "image/gif", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain", csv: "text/csv",
  };
  return map[ext] || "application/octet-stream";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    // 1. Fetch all uploaded PYQ files for this user
    const { data: pyqFiles } = await supabase
      .from("uploaded_files")
      .select("*")
      .eq("user_id", userId)
      .neq("file_type", "syllabus");

    if (!pyqFiles || pyqFiles.length === 0) {
      return NextResponse.json({
        ui_message: "No PYQ files found. Upload some past year papers first!",
      });
    }

    // 2. Fetch current syllabus topics
    const { data: syllabusTopics } = await supabase
      .from("priority_topics")
      .select("*")
      .eq("user_id", userId);

    if (!syllabusTopics || syllabusTopics.length === 0) {
      return NextResponse.json({
        ui_message: "No syllabus data found. Sync your syllabus first!",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    // 3. Group PYQs by subject
    const pyqsBySubject: Record<string, typeof pyqFiles> = {};
    for (const f of pyqFiles) {
      const sub = f.subject || "General";
      if (!pyqsBySubject[sub]) pyqsBySubject[sub] = [];
      pyqsBySubject[sub].push(f);
    }

    // 4. For each subject, download and analyze all PYQs together
    let totalUpdated = 0;

    for (const [subject, subjectPyqs] of Object.entries(pyqsBySubject)) {
      // Get syllabus topics for this subject
      const subjectTopics = syllabusTopics.filter(t => t.subject === subject);
      if (subjectTopics.length === 0) continue;

      // Download all PYQ files for this subject
      const fileContents: Array<{ fileName: string; base64: string; mimeType: string }> = [];
      for (const pyq of subjectPyqs) {
        const fileData = await downloadFile(pyq.file_url);
        if (fileData && fileData.base64.length > 0) {
          fileContents.push({
            fileName: pyq.file_name,
            base64: fileData.base64,
            mimeType: fileData.mimeType.includes("octet") ? getMimeType(pyq.file_name) : fileData.mimeType,
          });
        }
      }

      // Build the Gemini prompt with all PYQs + syllabus topics
      const syllabusContext = subjectTopics.map(t => ({
        id: t.id,
        name: t.name,
        module: t.module,
        currentPriority: t.priority,
      }));

      const prompt = `You are an expert exam preparation analyst. Analyze ALL the past year question papers below for the subject "${subject}".

SYLLABUS TOPICS (these are the topics from the student's syllabus):
${JSON.stringify(syllabusContext, null, 2)}

You have ${fileContents.length} past year papers for this subject. Analyze them carefully and determine:

1. **Repetition**: Which topics appear repeatedly across multiple papers? Topics appearing in 3+ papers = High, 2 papers = Medium, 1 paper = Low.
2. **Marks Weightage**: Topics that carry higher marks (long answer questions, 10+ marks) get boosted priority.
3. **Recency**: Topics from more recent papers get a slight priority boost.

For EACH syllabus topic above, assign a priority (High/Medium/Low) based on your analysis.

RULES:
- Match PYQ questions to the closest syllabus topic by concept/name.
- A topic repeatedly tested across years with high marks = "High"
- A topic tested once or with low marks = "Low" 
- Everything else = "Medium"
- If a topic never appeared in any PYQ, set it to "Low"

Respond with a JSON object:
{
  "analysis": [
    { 
      "id": "topic-uuid-from-syllabus", 
      "name": "topic name",
      "priority": "High|Medium|Low", 
      "repetitions": 3,
      "avgMarks": 10,
      "reason": "Brief reason" 
    }
  ],
  "summary": "Brief overall analysis summary"
}`;

      // Build parts array: all file contents + the prompt
      const parts: any[] = [];
      for (const fc of fileContents) {
        parts.push({
          inlineData: { mimeType: fc.mimeType, data: fc.base64 },
        });
      }
      parts.push({ text: prompt });

      try {
        const result = await model.generateContent(parts);
        const text = result.response.text();
        let analysis: any;
        try {
          analysis = JSON.parse(text);
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) continue;
          analysis = JSON.parse(jsonMatch[0]);
        }

        // 5. Update priority_topics with the analysis results
        if (analysis.analysis && Array.isArray(analysis.analysis)) {
          for (const item of analysis.analysis) {
            if (!item.id || !item.priority) continue;
            const { error } = await supabase
              .from("priority_topics")
              .update({
                priority: item.priority,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id)
              .eq("user_id", userId);
            if (!error) totalUpdated++;
          }
        }
      } catch (err: any) {
        console.error(`Error analyzing PYQs for subject ${subject}:`, err.message);
        // Continue with other subjects even if one fails
      }
    }

    return NextResponse.json({
      next_action: "pyq_brain_complete",
      ui_message: `Brain analysis complete! Updated priorities for ${totalUpdated} topics across ${Object.keys(pyqsBySubject).length} subjects.`,
      updatedCount: totalUpdated,
    });
  } catch (error: any) {
    console.error("PYQ Brain Analysis Error:", error);
    return NextResponse.json(
      { error: "Brain analysis failed: " + error.message },
      { status: 500 }
    );
  }
}
