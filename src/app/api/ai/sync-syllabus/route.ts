import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Helper: fetch a URL and return its text content.
 * Tries the main page first, then common syllabus PDF paths.
 */
async function fetchCollegeContent(collegeUrl: string, stream: string): Promise<string> {
  const urls: string[] = [];

  // Normalize base URL
  let base = collegeUrl.trim().replace(/\/+$/, "");
  if (!base.startsWith("http")) base = "https://" + base;

  // Try common syllabus PDF/page patterns for Indian colleges
  const streamSlug = stream.toLowerCase().replace(/[^a-z]/g, "");
  urls.push(
    `${base}/pdf/${streamSlug.toUpperCase()}_R23.pdf`,
    `${base}/pdf/${streamSlug.toUpperCase()}_syllabus.pdf`,
    `${base}/curriculum-syllabus.php`,
    `${base}/syllabus`,
    `${base}/academics/syllabus`,
    base,
  );

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 ExamMind-Bot/1.0" },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/pdf")) {
        // For PDFs: download as bytes and pass to Gemini via inline data
        const buffer = await res.arrayBuffer();
        return `__PDF__${url}__${Buffer.from(buffer).toString("base64")}`;
      }

      // For HTML pages
      const html = await res.text();
      // Strip tags, keep text content (rough but effective)
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 200) {
        return `Source: ${url}\n\n${text.slice(0, 15000)}`;
      }
    } catch {
      // Try next URL
    }
  }

  return "";
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const supabase = await createServerSupabaseClient();

    // 1. Get User Profile
    const { data: profile, error: profileError } = await supabase
      .from("UserProfile")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const { collegeUrl, course, stream, semester } = profile;

    // 2. Check if user has already uploaded a syllabus file — use it as the primary source
    let uploadedPdfBase64: string | null = null;
    let uploadedFileName: string | null = null;
    const { data: syllabusFile } = await supabase
      .from("uploaded_files")
      .select("file_url, file_name")
      .eq("user_id", userId)
      .eq("file_type", "syllabus")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (syllabusFile?.file_url) {
      try {
        const res = await fetch(syllabusFile.file_url, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          uploadedPdfBase64 = Buffer.from(buffer).toString("base64");
          uploadedFileName = syllabusFile.file_name;
        }
      } catch { /* fall through to website scraping */ }
    }

    // 3. Build Gemini request — prioritize uploaded file > college website > general knowledge
    let result;

    if (uploadedPdfBase64) {
      // PRIORITY 1: User uploaded their own syllabus file — most accurate source
      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: { responseMimeType: "application/json" },
      });

      const mimeType = (uploadedFileName || "").toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/png";

      result = await model.generateContent([
        {
          inlineData: { mimeType, data: uploadedPdfBase64 },
        },
        {
          text: `You are reading a university syllabus document: "${uploadedFileName}".
The student is in ${course}, ${stream}, Semester ${semester}.

Your task: Extract ALL theory subjects → their modules/units → every individual topic/concept listed INSIDE each module.

IMPORTANT RULES:
- Each module has a list of detailed topics/concepts. Extract EACH concept as a separate topic.
- Do NOT use the module title as a topic. Extract the actual content topics listed under each module.
- Use the EXACT names from the document.

For example, if the syllabus says:
"Module 1: Introduction - Concepts of data, Abstract Data Type, Classification of Data Structures, Algorithm analysis, Big Oh notation"
Then output:
{
  "module": "Module 1: Introduction",
  "topics": [
    { "name": "Concepts of data and information", "priority": "Medium" },
    { "name": "Concept of Abstract Data Type", "priority": "High" },
    { "name": "Classification of Data Structures", "priority": "High" },
    { "name": "Algorithm analysis - time and space complexity", "priority": "High" },
    { "name": "Asymptotic notations - Big Oh, Omega, Theta", "priority": "High" }
  ]
}

Respond with a JSON array:
[
  {
    "subject": "Subject Name (with code if available)",
    "credits": 3,
    "modules": [
      {
        "module": "Module N: Title",
        "topics": [
          { "name": "Individual concept/topic name", "priority": "High|Medium|Low" }
        ]
      }
    ]
  }
]

IMPORTANT: Include the "credits" field with the credit points/hours for each subject (usually 1-4). Extract this from the document if available.
Set priority: "High" for core/frequently tested topics, "Medium" for standard, "Low" for optional.`,
        },
      ]);
    } else {
      // PRIORITY 2 & 3: Try college website, then general knowledge
      const siteContent = await fetchCollegeContent(collegeUrl || "", stream || "CSE");

      if (siteContent.startsWith("__PDF__")) {
        // We got a PDF from the college website
        const parts = siteContent.split("__");
        const pdfBase64 = parts[parts.length - 1];
        const pdfUrl = parts[2];

        const model = genAI.getGenerativeModel({
          model: "gemini-flash-latest",
          generationConfig: { responseMimeType: "application/json" },
        });

        result = await model.generateContent([
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: `You are reading a real university syllabus PDF (from ${pdfUrl}).
The student is in ${course}, ${stream}, Semester ${semester}.

Extract ALL theory subjects with their modules/units AND specific topics inside each module.
Use the EXACT names as written. Do NOT invent any data.

Respond with a JSON array:
[
  {
    "subject": "Subject Name",
    "modules": [
      {
        "module": "Module 1: Title",
        "topics": [
          { "name": "Specific topic", "priority": "High" }
        ]
      }
    ]
  }
]

Each module MUST list its individual topics. Set priority based on importance.`,
          },
        ]);
      } else {
        // HTML text or nothing — use text-based approach
        const model = genAI.getGenerativeModel({
          model: "gemini-flash-latest",
          generationConfig: { responseMimeType: "application/json" },
        });

        const contextBlock = siteContent
          ? `Here is actual content scraped from the college website:\n---\n${siteContent}\n---\n\nExtract the syllabus from this real data. Use the EXACT subject and topic names as they appear.`
          : `The college website (${collegeUrl}) could not be reached. Use your knowledge of the MAKAUT/WBUT curriculum for ${stream} Semester ${semester} to provide the standard syllabus. Be as accurate as possible.`;

        result = await model.generateContent(
          `You are an expert academic assistant.
The student is at ${collegeUrl}, enrolled in ${course}, ${stream}, Semester ${semester}.

${contextBlock}

Extract ALL theory subjects with their modules/units AND specific topics inside each module.
Do NOT invent data — only use scraped content or well-known MAKAUT curriculum.

Respond with a JSON array:
[
  {
    "subject": "Subject Name",
    "modules": [
      {
        "module": "Module 1: Title",
        "topics": [
          { "name": "Specific topic", "priority": "High" }
        ]
      }
    ]
  }
]

Each module MUST list its individual topics. Set priority based on importance.`
        );
      }
    }

    const text = result.response.text();

    // Robust JSON extraction
    let syllabusData;
    try {
      syllabusData = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("AI did not return valid syllabus JSON.");
      syllabusData = JSON.parse(jsonMatch[0]);
    }

    // 4. Delete previous AI-synced topics before inserting fresh ones
    await supabase
      .from("priority_topics")
      .delete()
      .eq("user_id", userId)
      .eq("source", "AI Syllabus Sync");

    // 5. Save new topics to priority_topics (with module info)
    const insertData = syllabusData.flatMap((s: any) => {
      // Support both new 3-level format (modules > topics) and legacy flat format
      if (s.modules && Array.isArray(s.modules)) {
        return s.modules.flatMap((m: any) =>
          (m.topics || []).map((t: any) => ({
            user_id: userId,
            name: t.name,
            subject: s.subject,
            module: m.module,
            credits: s.credits || null,
            priority: t.priority || "Medium",
            progress: 0,
            source: "AI Syllabus Sync",
            updated_at: new Date().toISOString(),
          }))
        );
      }
      // Fallback: flat topics without modules
      return (s.topics || []).map((t: any) => ({
        user_id: userId,
        name: t.name,
        subject: s.subject,
        module: null,
        credits: s.credits || null,
        priority: t.priority || "Medium",
        progress: 0,
        source: "AI Syllabus Sync",
        updated_at: new Date().toISOString(),
      }));
    });

    const { error: insertError } = await supabase
      .from("priority_topics")
      .insert(insertData);

    if (insertError) throw insertError;

    // 6. Update SyllabusCache
    await supabase.from("SyllabusCache").upsert({
      email: profile.email,
      data: syllabusData,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      ui_message: `Synced ${insertData.length} topics across ${syllabusData.length} subjects for ${stream} Sem ${semester}!`,
      data: syllabusData,
    });
  } catch (error: any) {
    console.error("Syllabus Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
