-- ============================================
-- ExamMind AI: Antigravity Orchestrator Schema
-- ============================================

-- 1. Exams: tracks upcoming exams
CREATE TABLE IF NOT EXISTS exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  exam_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Priority Topics: AI-ranked study topics
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

-- 3. Study Plan: daily AI-generated tasks
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

-- 4. Study Sessions: time-tracking logs
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

-- 5. Uploaded Files: PYQ document tracking
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

-- ============================================
-- Row Level Security Policies
-- ============================================

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE priority_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Exams policies
CREATE POLICY "Users manage own exams" ON exams
  FOR ALL USING (auth.uid() = user_id);

-- Priority Topics policies
CREATE POLICY "Users manage own topics" ON priority_topics
  FOR ALL USING (auth.uid() = user_id);

-- Study Plan policies
CREATE POLICY "Users manage own plans" ON study_plan
  FOR ALL USING (auth.uid() = user_id);

-- Study Sessions policies
CREATE POLICY "Users manage own sessions" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Uploaded Files policies
CREATE POLICY "Users manage own files" ON uploaded_files
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Enable Realtime for live dashboard updates
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE priority_topics;
ALTER PUBLICATION supabase_realtime ADD TABLE study_plan;
ALTER PUBLICATION supabase_realtime ADD TABLE uploaded_files;

-- ============================================
-- Storage Bucket for PYQ uploads
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pyq-uploads',
  'pyq-uploads',
  false,
  10485760,
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own folder
CREATE POLICY "Users upload own PYQs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pyq-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own PYQs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pyq-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own PYQs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pyq-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
