import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Downloads a file from its URL and returns { base64, mimeType }.
 */
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

/**
 * Maps common file extensions to MIME types for Gemini.
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    csv: "text/csv",
  };
  return map[ext] || "application/octet-stream";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileId, userId, fileName, fileType } = body;

    if (!fileId || !userId) {
      return NextResponse.json({ error: "Missing fileId or userId" }, { status: 400 });
    }

    const isSyllabus = fileType === "syllabus";

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

    // 3. Get the file URL from the database
    const { data: fileRecord } = await supabase
      .from("uploaded_files")
      .select("file_url")
      .eq("id", fileId)
      .single();

    // 4. Try to download the actual file content
    let fileData: { base64: string; mimeType: string } | null = null;
    if (fileRecord?.file_url) {
      fileData = await downloadFile(fileRecord.file_url);
    }

    let analysis: any;

    if (fileData && fileData.base64.length > 0) {
      // ---- ACTUAL FILE CONTENT AVAILABLE ----
      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: { responseMimeType: "application/json" },
      });

      const prompt = isSyllabus
        ? `You are reading an uploaded syllabus document: "${fileName}".

Extract ALL subjects → their modules/units → every individual topic/concept INSIDE each module.

IMPORTANT:
- Extract each individual concept as a SEPARATE topic, not the module title.
- If Module 1 says "Concepts of data, Abstract Data Type, Classification of Data Structures, Algorithm analysis"
  then output each one as a separate topic.

Respond with a JSON object:
{
  "subjects": [
    {
      "subject": "Subject Name",
      "modules": [
        {
          "module": "Module 1: Title",
          "topics": [
            { "name": "Individual concept name", "priority": "High" }
          ]
        }
      ]
    }
  ]
}

Set priority: "High" for core topics, "Medium" for standard, "Low" for optional.`
        : `You are analyzing an uploaded past year question paper (PYQ): "${fileName}".

Read the actual content of this document and extract all topics/concepts that are tested.
Use EXACT topic names as they appear in the questions.

Respond with a JSON object:
{
  "subject": "The subject name",
  "topics": [
    { "name": "Topic Name", "priority": "High|Medium|Low", "reason": "Why this priority" }
  ]
}

Assign "High" to frequently tested topics, "Medium" to standard ones, "Low" to rarely tested ones.`;

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: fileData.mimeType.includes("octet")
              ? getMimeType(fileName)
              : fileData.mimeType,
            data: fileData.base64,
          },
        },
        { text: prompt },
      ]);

      const text = result.response.text();
      try {
        analysis = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI did not return valid JSON.");
        analysis = JSON.parse(jsonMatch[0]);
      }
    } else {
      // ---- FALLBACK: filename-only analysis ----
      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: { responseMimeType: "application/json" },
      });

      const prompt = `You are an expert academic study analyzer. A student has uploaded a document with the filename: "${fileName}".
Based on this filename and common academic patterns, extract the most likely topics.
Respond with a JSON object:
{
  "subject": "The subject name",
  "topics": [
    { "name": "Topic Name", "priority": "High|Medium|Low", "reason": "Why this priority" }
  ]
}
Extract at least 4-6 topics.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      try {
        analysis = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI did not return valid JSON.");
        analysis = JSON.parse(jsonMatch[0]);
      }
    }

    // 5. Update the file record with extracted topics
    await supabase
      .from("uploaded_files")
      .update({
        analysis_status: "completed",
        extracted_topics: analysis,
      })
      .eq("id", fileId);

    // 6. Normalize response and insert topics
    const source = isSyllabus ? "Syllabus Upload" : "pyq_analysis";
    let insertedCount = 0;

    // If syllabus upload, clear previous syllabus upload topics first
    if (isSyllabus) {
      await supabase
        .from("priority_topics")
        .delete()
        .eq("user_id", userId)
        .eq("source", "Syllabus Upload");
    }

    // Handle 3-level format (subjects > modules > topics)
    const subjectsList = analysis.subjects
      ? analysis.subjects
      : analysis.subject
        ? [{ subject: analysis.subject, topics: analysis.topics, modules: analysis.modules }]
        : [];

    for (const subj of subjectsList) {
      // 3-level: modules > topics
      if (subj.modules && Array.isArray(subj.modules)) {
        for (const mod of subj.modules) {
          if (!mod.topics || !Array.isArray(mod.topics)) continue;
          for (const topic of mod.topics) {
            await supabase.from("priority_topics").insert({
              user_id: userId,
              name: topic.name,
              priority: topic.priority || "Medium",
              subject: subj.subject,
              module: mod.module,
              source,
              progress: 0,
            });
            insertedCount++;
          }
        }
      }
      // Flat: topics only
      else if (subj.topics && Array.isArray(subj.topics)) {
        for (const topic of subj.topics) {
          if (!isSyllabus) {
            const { data: existing } = await supabase
              .from("priority_topics")
              .select("id")
              .eq("user_id", userId)
              .eq("name", topic.name)
              .single();
            if (existing) continue;
          }
          await supabase.from("priority_topics").insert({
            user_id: userId,
            name: topic.name,
            priority: topic.priority || "Medium",
            subject: subj.subject,
            module: null,
            source,
            progress: 0,
          });
          insertedCount++;
        }
      }
    }

    return NextResponse.json({
      next_action: "topics_extracted",
      db_update_payload: { fileId, topicsCount: insertedCount },
      ui_message: `Extracted ${insertedCount} topics from "${fileName}"`,
    });
  } catch (error: any) {
    console.error("Document Analysis Error:", error);
    return NextResponse.json(
      { error: "Analysis failed: " + error.message },
      { status: 500 }
    );
  }
}
