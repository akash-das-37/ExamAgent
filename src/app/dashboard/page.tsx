"use client";
import React, { useState, useEffect, useRef } from "react";
import { DashboardNavbar } from "@/components/DashboardNavbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { createClient } from "@/lib/supabase";
import {
  usePriorityTopics, useStudyPlan, useUploadedFiles, useExams, useStudySessions,
  calculateReadiness, getNextExamCountdown, aggregateDailyProgress,
  type PriorityTopic, type StudyPlanItem
} from "@/hooks/useRealtimeData";
import {
  Clock, Target, BarChart3, Sparkles, Flame, ChevronRight, ChevronDown,
  MessageCircle, TrendingUp, FileText, Upload, Loader2, CheckCircle2,
  LayoutDashboard, BookOpen, AlertTriangle, Trash2, X, ArrowRight, Calendar, Brain
} from "lucide-react";

const sidebarItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "syllabus", label: "Your Syllabus", icon: BookOpen },
  { id: "pyqs", label: "PYQs", icon: FileText },
  { id: "plan", label: "Study Plan", icon: Calendar },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userName, setUserName] = useState("Student");
  const [userId, setUserId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syllabusFileRef = useRef<HTMLInputElement>(null);
  const [isSyllabusUploading, setIsSyllabusUploading] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [pyqModal, setPyqModal] = useState<{ open: boolean; subject: string | null }>({ open: false, subject: null });
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [expandedPlanSubjects, setExpandedPlanSubjects] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  const { data: topics, loading: topicsLoading, refetch: refetchTopics } = usePriorityTopics();
  const { data: planItems, loading: planLoading } = useStudyPlan();
  const { data: files, loading: filesLoading } = useUploadedFiles();
  const { data: exams } = useExams();
  const { data: sessions } = useStudySessions(7);

  const readiness = calculateReadiness(topics);
  const countdown = getNextExamCountdown(exams);
  const dailyProgress = aggregateDailyProgress(sessions, 7);
  const maxMinutes = Math.max(...dailyProgress.map(d => d.minutes), 1);
  const todayPlan = planItems.filter(p => p.plan_date === new Date().toISOString().split("T")[0]);
  const topPriority = topics.find(t => t.priority === "High");

  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        setUserId(user.id);
        if (user.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name.split(" ")[0]);
        }
      }
    }
    getUser();
  }, []);

  const showToast = (type: string, text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleGeneratePlan = async () => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const { data: profile } = await supabase.from("UserProfile").select("*").eq("id", userId).single();
      const res = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, subjects: profile?.stream || "General", daysLeft: countdown?.days || 7, studyHours: 4,
        }),
      });
      const data = await res.json();
      if (data.ui_message) showToast("success", data.ui_message);
      else if (data.error) showToast("error", data.error);
    } catch { showToast("error", "Failed to generate plan."); }
    setIsGenerating(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const subject = pyqModal.subject;
    setPyqModal({ open: false, subject: null });
    setIsUploading(true);
    try {
      const filePath = `${userId}/pyq/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("pyq-uploads").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("pyq-uploads").getPublicUrl(filePath);
      const { data: fileRecord } = await supabase.from("uploaded_files").insert({
        user_id: userId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        file_type: "pyq",
        subject: subject,
        analysis_status: "pending",
      }).select().single();
      if (fileRecord) {
        fetch("/api/ai/analyze-document", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: fileRecord.id, userId, fileName: file.name, subject }),
        }).then(r => r.json()).then(d => { if (d.ui_message) showToast("success", d.ui_message); });
      }
      showToast("success", `Uploaded "${file.name}" for ${subject || "General"}. Analyzing...`);
    } catch (err: any) { showToast("error", "Upload failed: " + err.message); }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    if (!userId) return;
    setIsDeletingFile(fileId);
    try {
      // Remove from storage
      try {
        const url = new URL(fileUrl);
        const idx = url.pathname.indexOf("/pyq-uploads/");
        if (idx >= 0) {
          const storagePath = url.pathname.slice(idx + "/pyq-uploads/".length);
          await supabase.storage.from("pyq-uploads").remove([storagePath]);
        }
      } catch {}
      // Remove from DB
      await supabase.from("uploaded_files").delete().eq("id", fileId).eq("user_id", userId);
      showToast("success", "File deleted.");
    } catch (err: any) { showToast("error", "Delete failed: " + err.message); }
    setIsDeletingFile(null);
  };

  const handleToggleStatus = async (item: StudyPlanItem) => {
    const nextStatus = item.status === "Pending" ? "In Progress" : item.status === "In Progress" ? "Done" : "Pending";
    await supabase.from("study_plan").update({ status: nextStatus }).eq("id", item.id);
  };


  const handleBrainAnalyze = async () => {
    if (!userId) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze-pyq-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.ui_message) showToast("success", data.ui_message);
      else if (data.error) showToast("error", data.error);
      refetchTopics();
    } catch { showToast("error", "Brain analysis failed."); }
    setIsAnalyzing(false);
  };

  const handleSyncSyllabus = async () => {
    if (!userId) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/sync-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.ui_message) showToast("success", data.ui_message);
      else if (data.error) showToast("error", data.error);
      await refetchTopics();
    } catch { showToast("error", "Failed to sync syllabus."); }
    setIsGenerating(false);
  };

  const handleSyllabusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setIsSyllabusUploading(true);
    try {
      // Delete previous syllabus files from DB and storage
      const { data: oldFiles } = await supabase
        .from("uploaded_files")
        .select("id, file_url")
        .eq("user_id", userId)
        .eq("file_type", "syllabus");
      if (oldFiles && oldFiles.length > 0) {
        // Remove from storage
        const storagePaths = oldFiles
          .map((f: { file_url: string }) => {
            try {
              const url = new URL(f.file_url);
              const idx = url.pathname.indexOf("/pyq-uploads/");
              return idx >= 0 ? url.pathname.slice(idx + "/pyq-uploads/".length) : null;
            } catch { return null; }
          })
          .filter(Boolean) as string[];
        if (storagePaths.length > 0) {
          await supabase.storage.from("pyq-uploads").remove(storagePaths);
        }
        // Remove from DB
        await supabase
          .from("uploaded_files")
          .delete()
          .eq("user_id", userId)
          .eq("file_type", "syllabus");
      }

      const ext = file.name.split(".").pop();
      const filePath = `${userId}/syllabus/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("pyq-uploads").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("pyq-uploads").getPublicUrl(filePath);
      await supabase.from("uploaded_files").insert({
        user_id: userId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: "syllabus",
        analysis_status: "pending",
      });
      showToast("success", `Uploaded "${file.name}" — Syncing syllabus...`);
      // Await AI analysis so button stays in syncing state
      const { data: inserted } = await supabase.from("uploaded_files").select("id").eq("user_id", userId).eq("file_name", file.name).order("created_at", { ascending: false }).limit(1).single();
      if (inserted) {
        const res = await fetch("/api/ai/analyze-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: inserted.id, userId, fileName: file.name, fileType: "syllabus" }),
        });
        const data = await res.json();
        if (data.ui_message) showToast("success", data.ui_message);
        else if (data.error) showToast("error", data.error);
        await refetchTopics();
      }
    } catch (err: any) {
      showToast("error", err.message || "Upload failed.");
    }
    setIsSyllabusUploading(false);
    if (syllabusFileRef.current) syllabusFileRef.current.value = "";
  };

  const strokeDashoffset = 364.4 - (364.4 * readiness) / 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <DashboardNavbar />
      
      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/5 bg-white/[0.01] backdrop-blur-xl hidden lg:flex flex-col py-8 px-4 gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                activeTab === item.id 
                  ? "bg-accent-purple/10 text-accent-purple shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]" 
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.02]"
              }`}
            >
              <item.icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                activeTab === item.id ? "text-accent-purple" : ""
              }`} />
              <span className="font-medium text-sm">{item.label}</span>
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-purple shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                />
              )}
            </button>
          ))}
          
          <div className="mt-auto p-4">
            <Card className="p-4 bg-accent-blue/5 border-accent-blue/10">
              <p className="text-[10px] uppercase tracking-widest text-accent-blue font-bold mb-1">Pro Tip</p>
              <p className="text-[10px] text-white/40 leading-relaxed">Upload more PYQs to improve AI accuracy.</p>
            </Card>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
            {/* Toast */}
            <AnimatePresence>
              {toast && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className={`fixed top-24 right-6 z-50 px-6 py-3 rounded-xl text-sm font-medium backdrop-blur-xl border ${
                    toast.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>{toast.text}</motion.div>
              )}
            </AnimatePresence>

            {activeTab === "dashboard" && (
              <div className="space-y-8">
                {/* Hero */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 p-8 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-white/[0.03] to-transparent">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="64" cy="64" r="58" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                        <motion.circle cx="64" cy="64" r="58" fill="transparent" stroke="url(#gradient)" strokeWidth="8"
                          strokeDasharray="364.4" initial={{ strokeDashoffset: 364.4 }}
                          animate={{ strokeDashoffset }} transition={{ duration: 1.5, ease: "easeOut" }}
                          className="drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                        <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#22d3ee" />
                        </linearGradient></defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span key={readiness} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-3xl font-bold">{readiness}%</motion.span>
                        <span className="text-[10px] text-white/40 uppercase tracking-widest">Ready</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left space-y-4">
                      <div>
                        <h1 className="text-2xl font-bold mb-1">Hello, {userName}! 👋</h1>
                        <p className="text-white/40 font-light">
                          {countdown ? (<>Your <span className="text-white/80">{countdown.subject}</span> exam is in <span className="text-accent-purple font-medium">{countdown.days} days</span>.</>) : "Add an exam to start your countdown."}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center md:justify-start gap-4">
                        {sessions.length > 0 && (
                          <div className="px-4 py-2 rounded-xl glass border-white/5 flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" /><span className="text-sm font-medium">{sessions.length} Sessions</span>
                          </div>
                        )}
                        {topPriority && (
                          <div className="px-4 py-2 rounded-xl glass border-white/5 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-accent-cyan" /><span className="text-sm font-medium">Top: {topPriority.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button className="rounded-full px-8 shadow-xl" onClick={handleGeneratePlan} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Study Now<ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Card>

                  <Card className="p-8 flex flex-col justify-between overflow-hidden group">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-white/40">Exam Countdown</h3>
                        <Clock className="w-4 h-4 text-accent-purple" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: countdown ? String(countdown.days).padStart(2, "0") : "--", label: "Days" },
                          { val: countdown ? String(countdown.hours).padStart(2, "0") : "--", label: "Hours" },
                          { val: countdown ? String(countdown.mins).padStart(2, "0") : "--", label: "Mins" },
                        ].map((t, i) => (
                          <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/5">
                            <span className="text-2xl font-bold">{t.val}</span>
                            <span className="text-[8px] uppercase text-white/30">{t.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" className="w-full mt-6 text-xs border border-white/5 rounded-xl hover:bg-white/5">View Schedule</Button>
                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent-purple/20 rounded-full blur-[40px] group-hover:bg-accent-purple/30 transition-all" />
                  </Card>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div className="lg:col-span-3 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Priority Topics — Live */}
                      <Card className="p-8">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold flex items-center gap-2"><Target className="w-5 h-5 text-accent-blue" />Priority Topics</h3>
                          <span className="text-[10px] text-white/20 uppercase">Live from AI</span>
                        </div>
                        <LayoutGroup>
                          <div className="space-y-4">
                            {topicsLoading ? (
                              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/20" /></div>
                            ) : topics.length === 0 ? (
                              <p className="text-xs text-white/30 text-center py-8">Upload a PYQ to generate topics automatically.</p>
                            ) : (
                              topics.map((topic) => (
                                <motion.div layout key={topic.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-white/80">{topic.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                      topic.priority === "High" ? "bg-red-500/10 text-red-400" :
                                      topic.priority === "Medium" ? "bg-orange-500/10 text-orange-400" : "bg-green-500/10 text-green-400"
                                    }`}>{topic.priority}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${topic.progress}%` }} transition={{ duration: 0.8 }}
                                      className={`h-full ${topic.priority === "High" ? "bg-accent-purple" : "bg-accent-blue"}`} />
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </div>
                        </LayoutGroup>
                      </Card>

                      {/* Daily Progress — Live */}
                      <Card className="p-8 relative">
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-accent-cyan" />Daily Progress</h3>
                        </div>
                        <div className="h-[180px] flex items-end justify-between gap-2 px-2">
                          {dailyProgress.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                              <motion.div initial={{ height: 0 }} animate={{ height: `${maxMinutes > 0 ? (d.minutes / maxMinutes) * 100 : 0}%` }}
                                className="w-full bg-gradient-to-t from-accent-blue/20 to-accent-cyan/60 rounded-t-md hover:to-accent-cyan transition-all min-h-[4px]" />
                              <span className="text-[8px] text-white/20">{d.day}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>

                    {/* Study Plan — Live */}
                    <Card className="p-8">
                      <div className="flex justify-between items-center mb-8">
                        <div><h3 className="text-lg font-bold">Your Daily Study Plan</h3>
                          <p className="text-xs text-white/40">Optimized by ExamMind AI for maximum retention.</p></div>
                        <Button variant="secondary" size="sm" className="rounded-full border-white/10" onClick={handleGeneratePlan} disabled={isGenerating}>
                          {isGenerating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2 text-accent-purple" />}
                          Regenerate
                        </Button>
                      </div>
                      <div className="space-y-6">
                        {planLoading ? (
                          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/20" /></div>
                        ) : todayPlan.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-xs text-white/30 mb-4">No plan for today. Click "Regenerate" to create one!</p>
                          </div>
                        ) : (
                          todayPlan.map((item, i) => (
                            <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-6 group">
                              <div className="text-[10px] text-white/30 w-16 pt-1 font-mono">{item.scheduled_time}</div>
                              <div className="flex-1 pb-6 border-l border-white/5 pl-6 relative">
                                <div className={`absolute top-1.5 -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-background ${
                                  item.status === "Done" ? "bg-green-500" : item.status === "In Progress" ? "bg-accent-purple" : "bg-white/10"
                                }`} />
                                <div onClick={() => handleToggleStatus(item)}
                                  className="p-4 rounded-xl glass border-white/5 group-hover:border-white/10 transition-all flex items-center justify-between cursor-pointer">
                                  <div>
                                    <p className={`text-sm font-medium ${item.status === "Done" ? "text-white/40 line-through" : ""}`}>{item.task}</p>
                                    <span className="text-[10px] text-accent-cyan/60 uppercase tracking-tighter">{item.category}</span>
                                  </div>
                                  {item.status === "Done" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <ChevronRight className="w-4 h-4 text-white/20" />}
                                </div>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-8">
                    <Card className="p-6 bg-accent-purple/5 border-accent-purple/20">
                      <h3 className="font-bold mb-4 flex items-center gap-2"><MessageCircle className="w-4 h-4" />AI Assistant</h3>
                      <div className="space-y-3 mb-4">
                        <div className="bg-white/5 p-3 rounded-xl rounded-bl-none text-xs text-white/60">
                          Hey {userName}! {topPriority ? `Focus on "${topPriority.name}" today — it's your top priority.` : "Upload a PYQ to get personalized recommendations!"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input placeholder="Ask anything..." className="h-10 text-xs" />
                        <Button size="sm" className="h-10 w-10 p-0 rounded-lg"><ArrowRight className="w-4 h-4" /></Button>
                      </div>
                    </Card>

                    {/* Uploaded PYQs — Live */}
                    <Card className="p-6">
                      <h3 className="font-bold mb-4 flex items-center gap-2"><FileText className="w-4 h-4" />Uploaded PYQs</h3>
                      <div className="space-y-3">
                        {files.filter(f => f.file_type !== "syllabus").map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                            <span className="text-xs text-white/60 group-hover:text-white transition-colors truncate flex-1">{file.file_name}</span>
                            {file.analysis_status === "processing" ? <Loader2 className="w-3 h-3 animate-spin text-accent-purple" /> :
                             file.analysis_status === "completed" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                             <ChevronRight className="w-3 h-3 text-white/20" />}
                          </div>
                        ))}
                        <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileUpload} />
                        <Button variant="secondary" className="w-full text-[10px] uppercase tracking-widest border-dashed border-white/20 bg-transparent"
                          onClick={() => setPyqModal({ open: true, subject: null })} disabled={isUploading}>
                          {isUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Upload className="w-3 h-3 mr-2" />}
                          Upload PYQ
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-6 bg-red-500/5 border-red-500/20 overflow-hidden relative">
                      <div className="relative z-10">
                        <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2"><Flame className="w-4 h-4" />Stress Mode</h3>
                        <p className="text-[10px] text-white/40 mb-4 leading-relaxed">Only 24h left? Toggle Stress Mode for a hyper-focused crash strategy.</p>
                        <Button variant="secondary" className="w-full bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20">Activate</Button>
                      </div>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-[30px]" />
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "syllabus" && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Your Academic Syllabus</h2>
                    <p className="text-white/40 font-light">Comprehensive list of topics extracted from your academic profile and PYQs.</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" className="rounded-full" onClick={() => syllabusFileRef.current?.click()} disabled={isSyllabusUploading || isGenerating}>
                        {isSyllabusUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                        {isSyllabusUploading ? "Syncing..." : "Upload Syllabus"}
                      </Button>
                      <input ref={syllabusFileRef} type="file" className="hidden" onChange={handleSyllabusUpload} />
                      <Button className="rounded-full shadow-lg" onClick={handleSyncSyllabus} disabled={isGenerating || isSyllabusUploading}>
                        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        {isGenerating ? "Syncing..." : "AI Syllabus Sync"}
                      </Button>
                    </div>
                    <p className="text-[10px] text-yellow-500/70 flex items-center gap-1 max-w-xs text-right">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      AI-generated syllabus may be inaccurate. Your college website may not be up to date.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(
                    topics.reduce((acc, topic) => {
                      const sub = topic.subject || "General";
                      if (!acc[sub]) acc[sub] = [];
                      acc[sub].push(topic);
                      return acc;
                    }, {} as Record<string, PriorityTopic[]>)
                  ).sort((a, b) => {
                    // Sort subjects by credit points (highest first)
                    const credA = a[1][0]?.credits || 0;
                    const credB = b[1][0]?.credits || 0;
                    return credB - credA;
                  }).map(([subject, subTopics]) => {
                    const isSubjectOpen = expandedSubjects[subject] || false;
                    const subjectHasPyq = files.some(f => f.subject === subject && f.file_type !== "syllabus");

                    // Group topics by module
                    const moduleMap = subTopics.reduce((acc, t) => {
                      const mod = t.module || "General Topics";
                      if (!acc[mod]) acc[mod] = [];
                      acc[mod].push(t);
                      return acc;
                    }, {} as Record<string, PriorityTopic[]>);
                    const moduleEntries = Object.entries(moduleMap).sort((a, b) => {
                      // Extract module number — supports both Arabic (1,2,3) and Roman (I,II,III,IV,V)
                      const romanMap: Record<string, number> = { I:1, II:2, III:3, IV:4, V:5, VI:6, VII:7, VIII:8 };
                      const getNum = (s: string) => {
                        const arabic = s.match(/Module[\s-]*(\d+)/i);
                        if (arabic) return parseInt(arabic[1]);
                        const roman = s.match(/Module[\s-]*(I{1,3}V?|IV|VI{0,3}|V)/i);
                        if (roman) return romanMap[roman[1].toUpperCase()] || 999;
                        return 999;
                      };
                      if (!subjectHasPyq) return getNum(a[0]) - getNum(b[0]);
                      const highA = a[1].filter(t => t.priority === "High").length;
                      const highB = b[1].filter(t => t.priority === "High").length;
                      return highB - highA;
                    });

                    return (
                      <div key={subject} className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.02]">
                        {/* Subject Header */}
                        <button
                          onClick={() => setExpandedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }))}
                          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors text-left"
                        >
                          <motion.div animate={{ rotate: isSubjectOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="w-4 h-4 text-white/40" />
                          </motion.div>
                          <BookOpen className="w-4 h-4 text-accent-purple" />
                          <span className="flex-1 font-semibold text-white/90">{subject}</span>
                          <div className="flex items-center gap-2">
                            {subTopics[0]?.credits && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/10 text-accent-purple font-mono">{subTopics[0].credits} cr</span>
                            )}
                            <span className="text-[10px] text-white/30">{moduleEntries.length} modules · {subTopics.length} topics</span>
                          </div>
                        </button>

                        {/* Modules — collapsible */}
                        <AnimatePresence>
                          {isSubjectOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="border-t border-white/5 px-3 pb-3 pt-2 space-y-1">
                                {moduleEntries.map(([moduleName, modTopics]) => {
                                  const modKey = `${subject}::${moduleName}`;
                                  const isModuleOpen = expandedSubjects[modKey] || false;
                                  const highCount = modTopics.filter(t => t.priority === "High").length;
                                  const medCount = modTopics.filter(t => t.priority === "Medium").length;
                                  const lowCount = modTopics.filter(t => t.priority === "Low").length;

                                  return (
                                    <div key={modKey} className="rounded-lg overflow-hidden">
                                      {/* Module Header */}
                                      <button
                                        onClick={() => setExpandedSubjects(prev => ({ ...prev, [modKey]: !prev[modKey] }))}
                                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 transition-colors text-left rounded-lg"
                                      >
                                        <motion.div animate={{ rotate: isModuleOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                                          <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                                        </motion.div>
                                        <span className="flex-1 text-sm text-white/70 font-medium">{moduleName}</span>
                                        <div className="flex items-center gap-1.5">
                                          {subjectHasPyq ? (
                                            <>
                                              {highCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{highCount} High</span>}
                                              {medCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">{medCount} Med</span>}
                                              {lowCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">{lowCount} Low</span>}
                                            </>
                                          ) : (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">L · {modTopics.length}</span>
                                          )}
                                          <span className="text-[9px] text-white/25">{modTopics.length}</span>
                                        </div>
                                      </button>

                                      {/* Topics inside module */}
                                      <AnimatePresence>
                                        {isModuleOpen && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="pl-9 pr-4 pb-2 space-y-0.5">
                                              {modTopics.map((topic, idx) => (
                                                <div key={topic.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors group">
                                                  <span className="text-[9px] text-white/15 font-mono w-4">{idx + 1}.</span>
                                                  <span className="flex-1 text-xs text-white/60 group-hover:text-white/80 transition-colors">{topic.name}</span>
                                                  {subjectHasPyq ? (
                                                    <span className={`text-[8px] px-1 py-0.5 rounded shrink-0 ${
                                                      topic.priority === "High" ? "bg-red-500/10 text-red-400" :
                                                      topic.priority === "Medium" ? "bg-orange-500/10 text-orange-400" : "bg-green-500/10 text-green-400"
                                                    }`}>{topic.priority}</span>
                                                  ) : (
                                                    <span className="text-[8px] px-1 py-0.5 rounded shrink-0 bg-blue-500/10 text-blue-400" title="Lecture-based (upload PYQ for exam priority)">L</span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {topics.length === 0 && (
                    <Card className="p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-white/10 bg-transparent">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-white/20" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">No syllabus data yet</h3>
                        <p className="text-sm text-white/40 max-w-md">Upload your syllabus PDF or click AI Syllabus Sync to get started.</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {activeTab === "pyqs" && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Past Year Papers</h2>
                    <p className="text-white/40 font-light">Manage and analyze your uploaded examination papers.</p>
                  </div>
                  <Button onClick={() => setPyqModal({ open: true, subject: null })} disabled={isUploading}>
                    {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload New PYQ
                  </Button>
                </div>

                {/* Group PYQs by subject */}
                {(() => {
                  const pyqFiles = files.filter(f => f.file_type !== "syllabus");
                  // Group by subject field, fallback to "General"
                  const grouped = pyqFiles.reduce((acc, f) => {
                    const sub = (f as any).subject || "General";
                    if (!acc[sub]) acc[sub] = [];
                    acc[sub].push(f);
                    return acc;
                  }, {} as Record<string, typeof pyqFiles>);

                  if (pyqFiles.length === 0) {
                    return (
                      <Card
                        onClick={() => setPyqModal({ open: true, subject: null })}
                        className="p-12 border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-accent-purple/30 transition-all group"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent-purple/10 group-hover:text-accent-purple transition-all">
                          <Upload className="w-7 h-7" />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold mb-1">No PYQs uploaded yet</p>
                          <p className="text-xs text-white/30">Upload past year papers to get AI-powered priority analysis</p>
                        </div>
                      </Card>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {Object.entries(grouped).map(([subject, subFiles]) => (
                        <div key={subject}>
                          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5" />{subject}
                            <span className="text-white/20 font-normal normal-case tracking-normal">({subFiles.length} file{subFiles.length !== 1 ? "s" : ""})</span>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {subFiles.map((file) => (
                              <Card key={file.id} className="p-5 hover:border-accent-purple/30 transition-all group relative">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="p-2.5 rounded-xl bg-accent-purple/10 text-accent-purple group-hover:scale-110 transition-transform">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-widest ${
                                      file.analysis_status === "completed" ? "bg-green-500/10 text-green-400" :
                                      file.analysis_status === "processing" ? "bg-accent-purple/10 text-accent-purple" :
                                      "bg-white/5 text-white/30"
                                    }`}>
                                      {file.analysis_status}
                                    </div>
                                    <button
                                      onClick={() => handleDeleteFile(file.id, file.file_url)}
                                      disabled={isDeletingFile === file.id}
                                      className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                      title="Delete this file"
                                    >
                                      {isDeletingFile === file.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>
                                <h3 className="font-semibold text-white/90 mb-1 truncate text-sm">{file.file_name}</h3>
                                <p className="text-[10px] text-white/20 mb-4 uppercase tracking-widest">
                                  {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : "Size Unknown"} · {new Date(file.created_at).toLocaleDateString()}
                                </p>
                                <Button variant="ghost" className="w-full text-[10px] uppercase tracking-widest h-8 border border-white/5 hover:bg-white/5" onClick={() => window.open(file.file_url)}>View</Button>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Add more button */}
                      <button
                        onClick={() => setPyqModal({ open: true, subject: null })}
                        className="flex items-center gap-2 text-xs text-white/30 hover:text-accent-purple transition-colors px-2"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload another PYQ
                      </button>
                    </div>
                  );
                })()}

                <input ref={fileInputRef} type="file" accept="*" className="hidden" onChange={handleFileUpload} />
              </div>
            )}

            {activeTab === "plan" && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Study Plan</h2>
                    <p className="text-white/40 font-light">Your personalized learning path for the upcoming exams.</p>
                  </div>
                  <Button onClick={handleGeneratePlan} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {isGenerating ? "Generating..." : "Generate New Plan"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left: Summary & Calendar View */}
                  <div className="space-y-6">
                    <Card className="p-6 bg-accent-purple/5 border-accent-purple/20">
                      <h3 className="font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-accent-purple">
                        <Calendar className="w-4 h-4" /> Weekly Outlook
                      </h3>
                      <div className="grid grid-cols-7 gap-1">
                        {['S','M','T','W','T','F','S'].map((d, i) => (
                          <div key={i} className="text-[10px] text-center text-white/20 py-1">{d}</div>
                        ))}
                        {Array.from({ length: 14 }).map((_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() + (i - 2));
                          const isToday = i === 2;
                          const hasTasks = planItems.some(p => p.plan_date === date.toISOString().split('T')[0]);
                          return (
                            <div key={i} className={`aspect-square flex flex-col items-center justify-center rounded-lg border text-[10px] relative transition-all ${
                              isToday ? 'bg-accent-purple border-accent-purple text-white' : 
                              hasTasks ? 'bg-accent-purple/10 border-accent-purple/20 text-white/60' :
                              'bg-white/5 border-white/5 text-white/20'
                            }`}>
                              {date.getDate()}
                              {hasTasks && !isToday && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent-purple" />}
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    <Card className="p-6">
                      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-white/40">Status Overview</h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Completed', count: planItems.filter(p => p.status === 'Done').length, color: 'bg-green-500' },
                          { label: 'In Progress', count: planItems.filter(p => p.status === 'In Progress').length, color: 'bg-accent-purple' },
                          { label: 'Upcoming', count: planItems.filter(p => p.status === 'Pending').length, color: 'bg-white/10' },
                        ].map((s, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${s.color}`} />
                              <span className="text-xs text-white/60">{s.label}</span>
                            </div>
                            <span className="text-xs font-bold">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Right: Detailed Plan List */}
                  <div className="lg:col-span-2">
                    <Card className="p-8">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-bold">Upcoming Tasks</h3>
                        <div className="flex gap-2">
                           <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/40 uppercase tracking-widest border border-white/5">
                             Sorted by Date
                           </span>
                        </div>
                      </div>

                      <div className="space-y-8 relative before:absolute before:left-8 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                        {planLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent-purple" /></div>
                        ) : planItems.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Sparkles className="w-8 h-8 text-white/10" />
                            </div>
                            <p className="text-sm text-white/30">No tasks generated. Click the button above to start your journey!</p>
                          </div>
                        ) : (
                          // Sort plan items by date and time
                          [...planItems]
                            .sort((a, b) => {
                              const dateA = new Date(a.plan_date + 'T' + (a.scheduled_time || '00:00')).getTime();
                              const dateB = new Date(b.plan_date + 'T' + (b.scheduled_time || '00:00')).getTime();
                              return dateA - dateB;
                            })
                            .map((item, i) => {
                              const isToday = item.plan_date === new Date().toISOString().split('T')[0];
                              return (
                                <motion.div key={item.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-6 group">
                                  <div className="flex flex-col items-center w-16 shrink-0 pt-1">
                                    <span className={`text-[10px] font-bold ${isToday ? 'text-accent-purple' : 'text-white/20'}`}>
                                      {isToday ? 'TODAY' : new Date(item.plan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span className="text-[10px] text-white/40 font-mono mt-1">{item.scheduled_time}</span>
                                  </div>

                                  <div className="flex-1 pb-8 relative">
                                    <div className={`absolute top-2 -left-[31px] z-10 w-3 h-3 rounded-full border-2 border-background shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                                      item.status === "Done" ? "bg-green-500" : item.status === "In Progress" ? "bg-accent-purple" : "bg-white/10"
                                    }`} />
                                    
                                    <div 
                                      onClick={() => handleToggleStatus(item)}
                                      className="p-5 rounded-2xl glass border-white/5 group-hover:border-white/20 transition-all flex items-center justify-between cursor-pointer group/item hover:bg-white/[0.02]"
                                    >
                                      <div className="space-y-1">
                                        <p className={`text-sm font-semibold tracking-tight ${item.status === "Done" ? "text-white/30 line-through" : "text-white/90"}`}>{item.task}</p>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan font-bold uppercase tracking-tighter">{item.category}</span>
                                          {item.subject && <span className="text-[9px] text-white/30 truncate max-w-[150px]">for {item.subject}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {item.status === "Done" ? (
                                          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-500" /></div>
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"><ChevronRight className="w-4 h-4 text-white/40" /></div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* PYQ Subject Selector Modal */}
      <AnimatePresence>
        {pyqModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setPyqModal({ open: false, subject: null }); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md bg-surface border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold">Upload PYQ</h3>
                  <p className="text-xs text-white/40 mt-0.5">Select the subject this paper belongs to</p>
                </div>
                <button onClick={() => setPyqModal({ open: false, subject: null })} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Subject list from syllabus */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-5">
                {topics.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-6">No syllabus subjects found.<br/>Sync your syllabus first to pick a subject.</p>
                ) : (
                  Array.from(new Set(topics.map(t => t.subject).filter(Boolean))).map(subject => (
                    <button
                      key={subject}
                      onClick={() => setPyqModal(prev => ({ ...prev, subject: subject! }))}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                        pyqModal.subject === subject
                          ? "border-accent-purple bg-accent-purple/10 text-white"
                          : "border-white/5 bg-white/[0.02] hover:bg-white/5 text-white/70"
                      }`}
                    >
                      <BookOpen className={`w-4 h-4 shrink-0 ${pyqModal.subject === subject ? "text-accent-purple" : "text-white/30"}`} />
                      <span className="text-sm font-medium">{subject}</span>
                      {pyqModal.subject === subject && <CheckCircle2 className="w-4 h-4 text-accent-purple ml-auto" />}
                    </button>
                  ))
                )}
              </div>

              <Button
                className="w-full"
                disabled={!pyqModal.subject || isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {pyqModal.subject ? `Upload for "${pyqModal.subject}"` : "Select a subject first"}
              </Button>
              <p className="text-[10px] text-white/20 text-center mt-2">Accepts PDF, JPG, DOCX, and all other file types</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-r from-accent-purple to-accent-blue shadow-2xl shadow-accent-purple/40 flex items-center justify-center text-white z-50">
        <Sparkles className="w-8 h-8" />
      </motion.button>
    </div>
  );
}
