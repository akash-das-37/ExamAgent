import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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

    const authenticatedClient = await createServerSupabaseClient();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    // 1. Fetch all uploaded PYQ files for this user
    const { data: pyqFiles } = await authenticatedClient
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
    const { data: syllabusTopics } = await authenticatedClient
      .from("priority_topics")
      .select("*")
      .eq("user_id", userId);

    if (!syllabusTopics || syllabusTopics.length === 0) {
      return NextResponse.json({
        ui_message: "No syllabus data found. Sync your syllabus first!",
      });
    }

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
      // Get syllabus topics for this subject using fuzzy matching
      const subjectTopics = syllabusTopics.filter(t => {
        const dbSub = (t.subject || "").toLowerCase().trim();
        const pyqSub = subject.toLowerCase().trim();
        return dbSub.includes(pyqSub) || pyqSub.includes(dbSub);
      });
      
      try {
        require("fs").writeFileSync("scratch/debug_topics.json", JSON.stringify({
          pyqSubject: subject,
          matchedTopics: subjectTopics.length,
          allSyllabusTopics: syllabusTopics.map(t => t.subject)
        }, null, 2));
      } catch(e) {}

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

      const prompt = `Act as a precision exam analyst. Analyze the attached PDFs.

Your Task:
Read through every single question in the attached exam papers. Match each question to the most relevant topic from the SYLLABUS TOPICS list below. Calculate the TOTAL marks for each topic across all papers.

Return ONLY a JSON object with an "analysis" array. Each item must have:
- "id": the exact UUID from the syllabus list
- "totalMarks": integer sum of marks for that topic (0 if not found)

Do NOT include any other fields. Do NOT include evidence or explanations.

SYLLABUS TOPICS:
${JSON.stringify(syllabusContext, null, 2)}`;

      // Build parts array: all file contents + the prompt
      const parts: any[] = [];
      for (const fc of fileContents) {
        parts.push({
          inlineData: { mimeType: fc.mimeType, data: fc.base64 },
        });
      }
      parts.push({ text: prompt });

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-flash-latest",
          generationConfig: { 
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                analysis: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      id: { type: SchemaType.STRING },
                      totalMarks: { type: SchemaType.INTEGER }
                    },
                    required: ["id", "totalMarks"]
                  }
                }
              },
              required: ["analysis"]
            }
          }
        });

        const result = await model.generateContent(parts);
        const text = result.response.text();
        let analysis: any;
        try {
          analysis = JSON.parse(text);
        } catch (e) {
          try {
            require("fs").writeFileSync("scratch/gemini_raw_output.txt", text);
          } catch(err) {}
          // Attempt to repair truncated JSON by closing open arrays/objects
          let repaired = text.trim();
          // Strip trailing incomplete object entries
          repaired = repaired.replace(/,\s*\{[^}]*$/, '');
          // Close any unclosed arrays and objects
          const openBraces = (repaired.match(/\{/g) || []).length;
          const closeBraces = (repaired.match(/\}/g) || []).length;
          const openBrackets = (repaired.match(/\[/g) || []).length;
          const closeBrackets = (repaired.match(/\]/g) || []).length;
          for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
          for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
          try {
            analysis = JSON.parse(repaired);
          } catch (parseErr: any) {
            throw new Error(`JSON Parse Error: ${parseErr.message}. Raw Text: ${text.substring(0, 500)}...`);
          }
        }

        // 5. Update priority_topics with the analysis results
        console.log("Gemini Output Analysis:", JSON.stringify(analysis, null, 2));
        try {
          require("fs").writeFileSync("scratch/gemini_output.json", JSON.stringify(analysis, null, 2));
        } catch(e) {}

        if (analysis.analysis && Array.isArray(analysis.analysis)) {
          for (const item of analysis.analysis) {
            if (!item.id || item.totalMarks === undefined) continue;
            const { error } = await authenticatedClient
              .from("priority_topics")
              .update({
                priority: item.totalMarks.toString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id)
              .eq("user_id", userId);
            
            if (error) {
              console.error("Supabase update error for topic ID", item.id, ":", error);
            } else {
              totalUpdated++;
            }
          }
        }
      } catch (err: any) {
        console.error(`Error analyzing PYQs for subject ${subject}:`, err.message);
        try {
          require("fs").writeFileSync("scratch/gemini_error.json", JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
        } catch(e) {}
      }
    }

    return NextResponse.json({
      next_action: "pyq_brain_complete",
      ui_message: `Brain analysis complete! Updated priorities for ${totalUpdated} topics across ${Object.keys(pyqsBySubject).length} subjects.`,
      updatedCount: totalUpdated,
      debugOutput: pyqsBySubject
    });
  } catch (error: any) {
    console.error("PYQ Brain Analysis Error:", error);
    return NextResponse.json(
      { error: "Brain analysis failed: " + error.message },
      { status: 500 }
    );
  }
}
