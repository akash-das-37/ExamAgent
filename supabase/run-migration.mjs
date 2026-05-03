// Run this script to create the database tables
// Usage: node supabase/run-migration.mjs

const SUPABASE_URL = "https://dekyrymwwycgloffivmc.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = "sb_publishable_3eatBcrXGgVsJ4cVdl7XNA_xUWl5QhS";

// Use anon key if service key isn't set
const API_KEY = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;

const sql = `
-- 1. Exams table
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  exam_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Priority Topics table
CREATE TABLE IF NOT EXISTS priority_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('High','Medium','Low')) DEFAULT 'Medium',
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  subject TEXT,
  source TEXT DEFAULT 'manual',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Study Plan table
CREATE TABLE IF NOT EXISTS study_plan (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task TEXT NOT NULL,
  category TEXT,
  scheduled_time TEXT,
  status TEXT CHECK (status IN ('Pending','In Progress','Done')) DEFAULT 'Pending',
  plan_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Study Sessions table
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic_id UUID REFERENCES priority_topics(id) ON DELETE SET NULL,
  duration_minutes INT NOT NULL,
  difficulty_rating INT CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
  notes TEXT,
  session_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Uploaded Files table
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  analysis_status TEXT CHECK (analysis_status IN ('pending','processing','completed','failed')) DEFAULT 'pending',
  extracted_topics JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own exams') THEN
    CREATE POLICY "Users manage own exams" ON exams FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own topics') THEN
    CREATE POLICY "Users manage own topics" ON priority_topics FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own plans') THEN
    CREATE POLICY "Users manage own plans" ON study_plan FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own sessions') THEN
    CREATE POLICY "Users manage own sessions" ON study_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own files') THEN
    CREATE POLICY "Users manage own files" ON uploaded_files FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
`;

async function runMigration() {
  console.log("Running migration against Supabase...");
  
  const res = await fetch(\`\${SUPABASE_URL}/rest/v1/rpc/\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": API_KEY,
      "Authorization": \`Bearer \${API_KEY}\`,
    },
    body: JSON.stringify({ query: sql }),
  });

  // The REST API doesn't support raw SQL, so let's just print instructions
  console.log("");
  console.log("=== MANUAL STEP REQUIRED ===");
  console.log("Please run the SQL migration manually in the Supabase Dashboard:");
  console.log(\`1. Go to: \${SUPABASE_URL.replace('.co', '.com')}/project/dekyrymwwycgloffivmc/sql/new\`);
  console.log("2. Copy the SQL from: supabase/migrations/001_antigravity_schema.sql");
  console.log("3. Click 'Run'");
  console.log("");
  console.log("Alternatively, you can provide the SUPABASE_SERVICE_ROLE_KEY");
  console.log("environment variable and re-run this script.");
}

runMigration().catch(console.error);
