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
  Clock, Target, BarChart3, Sparkles, Flame, ChevronRight,
  MessageCircle, TrendingUp, FileText, Upload, Loader2, CheckCircle2,
  LayoutDashboard, BookOpen
} from "lucide-react";

const sidebarItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "syllabus", label: "Your Syllabus", icon: BookOpen },
  { id: "pyqs", label: "PYQs", icon: FileText },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userName, setUserName] = useState("Student");
  const [userId, setUserId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const { data: topics, loading: topicsLoading } = usePriorityTopics();
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
    setIsUploading(true);
    try {
      const filePath = `${userId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("pyq-uploads").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("pyq-uploads").getPublicUrl(filePath);
      const { data: fileRecord } = await supabase.from("uploaded_files").insert({
        user_id: userId, file_name: file.name, file_url: urlData.publicUrl, file_size: file.size,
      }).select().single();
      if (fileRecord) {
        fetch("/api/ai/analyze-document", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: fileRecord.id, userId, fileName: file.name }),
        }).then(r => r.json()).then(d => { if (d.ui_message) showToast("success", d.ui_message); });
      }
      showToast("success", `Uploaded ${file.name}. Analyzing...`);
    } catch (err: any) { showToast("error", "Upload failed: " + err.message); }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleToggleStatus = async (item: StudyPlanItem) => {
    const nextStatus = item.status === "Pending" ? "In Progress" : item.status === "In Progress" ? "Done" : "Pending";
    await supabase.from("study_plan").update({ status: nextStatus }).eq("id", item.id);
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
                        {files.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                            <span className="text-xs text-white/60 group-hover:text-white transition-colors truncate flex-1">{file.file_name}</span>
                            {file.analysis_status === "processing" ? <Loader2 className="w-3 h-3 animate-spin text-accent-purple" /> :
                             file.analysis_status === "completed" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                             <ChevronRight className="w-3 h-3 text-white/20" />}
                          </div>
                        ))}
                        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
                        <Button variant="secondary" className="w-full text-[10px] uppercase tracking-widest border-dashed border-white/20 bg-transparent"
                          onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Your Academic Syllabus</h2>
                    <p className="text-white/40 font-light">Comprehensive list of topics extracted from your academic profile and PYQs.</p>
                  </div>
                  <Button className="rounded-full shadow-lg">
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Syllabus Sync
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {Object.entries(
                    topics.reduce((acc, topic) => {
                      const sub = topic.subject || "General";
                      if (!acc[sub]) acc[sub] = [];
                      acc[sub].push(topic);
                      return acc;
                    }, {} as Record<string, PriorityTopic[]>)
                  ).map(([subject, subTopics]) => (
                    <Card key={subject} className="p-8 border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white/90">{subject}</h3>
                        <div className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                          {subTopics.length} Topics
                        </div>
                      </div>
                      <div className="space-y-4">
                        {subTopics.map((topic) => (
                          <div key={topic.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-all group">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{topic.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                topic.priority === "High" ? "bg-red-500/10 text-red-400" :
                                topic.priority === "Medium" ? "bg-orange-500/10 text-orange-400" : "bg-green-500/10 text-green-400"
                              }`}>{topic.priority}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${topic.progress}%` }} className="h-full bg-accent-purple" />
                              </div>
                              <span className="text-[10px] text-white/20 font-mono">{topic.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}

                  {topics.length === 0 && (
                    <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center space-y-4 border-dashed border-white/10 bg-transparent">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-white/20" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-1">No syllabus data yet</h3>
                        <p className="text-sm text-white/40 max-w-md">Upload Past Year Papers (PYQs) or link your college portal to extract your academic syllabus automatically.</p>
                      </div>
                      <Button variant="secondary" onClick={() => setActiveTab("pyqs")}>Go to PYQs</Button>
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
                  <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload New PYQ
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {files.map((file) => (
                    <Card key={file.id} className="p-6 hover:border-accent-purple/30 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl bg-accent-purple/10 text-accent-purple group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-widest ${
                          file.analysis_status === "completed" ? "bg-green-500/10 text-green-400" :
                          file.analysis_status === "processing" ? "bg-accent-purple/10 text-accent-purple" :
                          "bg-white/5 text-white/30"
                        }`}>
                          {file.analysis_status}
                        </div>
                      </div>
                      <h3 className="font-semibold text-white/90 mb-1 truncate">{file.file_name}</h3>
                      <p className="text-[10px] text-white/20 mb-6 uppercase tracking-widest">
                        {file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : "Size Unknown"} • {new Date(file.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="ghost" className="flex-1 text-[10px] uppercase tracking-widest h-9 border border-white/5 hover:bg-white/5" onClick={() => window.open(file.file_url)}>View</Button>
                        <Button variant="secondary" className="flex-1 text-[10px] uppercase tracking-widest h-9">Analyze</Button>
                      </div>
                    </Card>
                  ))}

                  <Card 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-6 border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-accent-purple/30 transition-all group min-h-[220px]"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent-purple/10 group-hover:text-accent-purple transition-all">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-white/20 uppercase tracking-widest group-hover:text-white transition-all">Upload Paper</span>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-r from-accent-purple to-accent-blue shadow-2xl shadow-accent-purple/40 flex items-center justify-center text-white z-50">
        <Sparkles className="w-8 h-8" />
      </motion.button>
    </div>
  );
}

function ArrowRight(props: any) {
  return (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>);
}
