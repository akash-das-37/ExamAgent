"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────
export interface PriorityTopic {
  id: string;
  name: string;
  priority: "High" | "Medium" | "Low";
  progress: number;
  subject: string | null;
  source: string;
  updated_at: string;
}

export interface StudyPlanItem {
  id: string;
  task: string;
  category: string | null;
  scheduled_time: string | null;
  status: "Pending" | "In Progress" | "Done";
  plan_date: string;
}

export interface UploadedFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  analysis_status: "pending" | "processing" | "completed" | "failed";
  extracted_topics: any;
  created_at: string;
}

export interface Exam {
  id: string;
  subject: string;
  exam_date: string;
}

export interface StudySession {
  id: string;
  topic_id: string | null;
  duration_minutes: number;
  difficulty_rating: number | null;
  session_date: string;
}

// ─── Generic Realtime Hook ───────────────────────────────
function useRealtimeTable<T>(
  tableName: string,
  orderBy: string = "created_at",
  ascending: boolean = false
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    const { data: rows, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("user_id", user.id)
      .order(orderBy, { ascending });

    if (!error && rows) {
      setData(rows as T[]);
    }
    setLoading(false);
  }, [tableName, orderBy, ascending]);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes
    const channel: RealtimeChannel = supabase
      .channel(`realtime-${tableName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: tableName },
        () => {
          // Re-fetch on any change to keep data consistent
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}

// ─── Specific Hooks ──────────────────────────────────────

export function usePriorityTopics() {
  return useRealtimeTable<PriorityTopic>("priority_topics", "updated_at", false);
}

export function useStudyPlan(date?: string) {
  const result = useRealtimeTable<StudyPlanItem>("study_plan", "scheduled_time", true);
  
  // Filter by date if provided
  if (date) {
    return {
      ...result,
      data: result.data.filter((item) => item.plan_date === date),
    };
  }
  return result;
}

export function useUploadedFiles() {
  return useRealtimeTable<UploadedFile>("uploaded_files", "created_at", false);
}

export function useExams() {
  return useRealtimeTable<Exam>("exams", "exam_date", true);
}

export function useStudySessions(days: number = 7) {
  const result = useRealtimeTable<StudySession>("study_sessions", "session_date", false);
  
  // Filter to last N days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return {
    ...result,
    data: result.data.filter(
      (s) => new Date(s.session_date) >= cutoff
    ),
  };
}

// ─── Readiness Score Calculator ──────────────────────────
export function calculateReadiness(topics: PriorityTopic[]): number {
  if (topics.length === 0) return 0;

  const weights = { High: 3, Medium: 2, Low: 1 };
  let totalWeight = 0;
  let weightedProgress = 0;

  topics.forEach((topic) => {
    const w = weights[topic.priority] || 1;
    totalWeight += w;
    weightedProgress += topic.progress * w;
  });

  return Math.round(weightedProgress / totalWeight);
}

// ─── Exam Countdown Calculator ───────────────────────────
export function getNextExamCountdown(exams: Exam[]) {
  if (exams.length === 0) return null;

  const now = new Date();
  const upcoming = exams
    .map((e) => ({ ...e, date: new Date(e.exam_date) }))
    .filter((e) => e.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const diff = next.date.getTime() - now.getTime();

  return {
    subject: next.subject,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  };
}

// ─── Daily Progress Aggregator ───────────────────────────
export function aggregateDailyProgress(sessions: StudySession[], days: number = 7) {
  const result: { day: string; minutes: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    const dayMinutes = sessions
      .filter((s) => s.session_date === dateStr)
      .reduce((sum, s) => sum + s.duration_minutes, 0);

    result.push({ day: `Day ${days - i}`, minutes: dayMinutes });
  }

  return result;
}
