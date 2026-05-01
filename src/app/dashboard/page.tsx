"use client";

import React from "react";
import { DashboardNavbar } from "@/components/DashboardNavbar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion } from "framer-motion";
import { 
  Clock, 
  Target, 
  BarChart3, 
  Sparkles, 
  Flame, 
  ChevronRight,
  MessageCircle,
  TrendingUp,
  FileText
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNavbar />
      
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Hero Banner / Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 p-8 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-br from-white/[0.03] to-transparent">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-white/5"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  fill="transparent"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeDasharray="364.4"
                  strokeDashoffset="109.3"
                  className="drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">70%</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Ready</span>
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-2xl font-bold mb-1">Hello, Akash! 👋</h1>
                <p className="text-white/40 font-light">Your Operating Systems exam is in <span className="text-accent-purple font-medium">4 days</span>. You're ahead of 80% of your class.</p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="px-4 py-2 rounded-xl glass border-white/5 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">3 Day Streak</span>
                </div>
                <div className="px-4 py-2 rounded-xl glass border-white/5 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent-cyan" />
                  <span className="text-sm font-medium">Top Priority: Virtual Memory</span>
                </div>
              </div>
            </div>

            <Button className="rounded-full px-8 shadow-xl">
              Study Now
              <ChevronRight className="w-4 h-4 ml-2" />
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
                  { val: "04", label: "Days" },
                  { val: "12", label: "Hours" },
                  { val: "45", label: "Mins" },
                ].map((t, i) => (
                  <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-2xl font-bold">{t.val}</span>
                    <span className="text-[8px] uppercase text-white/30">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="ghost" className="w-full mt-6 text-xs border border-white/5 rounded-xl hover:bg-white/5">
              View Schedule
            </Button>
            {/* Ambient Background Glow */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent-purple/20 rounded-full blur-[40px] group-hover:bg-accent-purple/30 transition-all" />
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Progress & Importance */}
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <Target className="w-5 h-5 text-accent-blue" />
                    Priority Topics
                  </h3>
                  <span className="text-[10px] text-white/20 uppercase">By PYQ Weightage</span>
                </div>
                <div className="space-y-4">
                  {[
                    { name: "CPU Scheduling", weight: "High", progress: 90 },
                    { name: "Virtual Memory", weight: "High", progress: 30 },
                    { name: "Deadlocks", weight: "Medium", progress: 60 },
                    { name: "File Systems", weight: "Low", progress: 10 },
                  ].map((topic, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/80">{topic.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          topic.weight === 'High' ? 'bg-red-500/10 text-red-400' : 
                          topic.weight === 'Medium' ? 'bg-orange-500/10 text-orange-400' : 
                          'bg-green-500/10 text-green-400'
                        }`}>
                          {topic.weight}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${topic.progress}%` }}
                          className={`h-full ${
                            topic.weight === 'High' ? 'bg-accent-purple' : 'bg-accent-blue'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-8 relative">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-accent-cyan" />
                    Daily Progress
                  </h3>
                </div>
                <div className="h-[180px] flex items-end justify-between gap-2 px-2">
                  {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        className="w-full bg-gradient-to-t from-accent-blue/20 to-accent-cyan/60 rounded-t-md hover:to-accent-cyan transition-all"
                      />
                      <span className="text-[8px] text-white/20">Day {i+1}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Study Plan Timeline */}
            <Card className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-bold">Your Daily Study Plan</h3>
                  <p className="text-xs text-white/40">Optimized by ExamMind AI for maximum retention.</p>
                </div>
                <Button variant="secondary" size="sm" className="rounded-full border-white/10">
                  <Sparkles className="w-3 h-3 mr-2 text-accent-purple" />
                  Regenerate
                </Button>
              </div>

              <div className="space-y-6">
                {[
                  { time: "09:00 AM", task: "Review Virtual Memory Paging", category: "Revision", status: "Done" },
                  { time: "11:30 AM", task: "Practice Page Replacement Algorithms", category: "Practice", status: "In Progress" },
                  { time: "02:00 PM", task: "Solved 2023 PYQ - OS Set A", category: "Assessment", status: "Pending" },
                  { time: "04:30 PM", task: "Crash Revision: Disk Management", category: "New Topic", status: "Pending" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-6 group">
                    <div className="text-[10px] text-white/30 w-16 pt-1 font-mono">{item.time}</div>
                    <div className="flex-1 pb-6 border-l border-white/5 pl-6 relative">
                      <div className={`absolute top-1.5 -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-background ${
                        item.status === 'Done' ? 'bg-green-500' : item.status === 'In Progress' ? 'bg-accent-purple' : 'bg-white/10'
                      }`} />
                      <div className="p-4 rounded-xl glass border-white/5 group-hover:border-white/10 transition-all flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${item.status === 'Done' ? 'text-white/40 line-through' : ''}`}>
                            {item.task}
                          </p>
                          <span className="text-[10px] text-accent-cyan/60 uppercase tracking-tighter">{item.category}</span>
                        </div>
                        {item.status === 'Pending' && <ChevronRight className="w-4 h-4 text-white/20" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column: AI Assistant & Files */}
          <div className="space-y-8">
            <Card className="p-6 bg-accent-purple/5 border-accent-purple/20">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                AI Assistant
              </h3>
              <div className="space-y-3 mb-4">
                <div className="bg-white/5 p-3 rounded-xl rounded-bl-none text-xs text-white/60">
                  Hey Akash! I noticed you struggled with LRU Algorithm yesterday. Want a quick 2-min visual summary?
                </div>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Ask anything..." className="h-10 text-xs" />
                <Button size="sm" className="h-10 w-10 p-0 rounded-lg">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Uploaded PYQs
              </h3>
              <div className="space-y-3">
                {["OS_PYQ_2023.pdf", "OS_PYQ_2022.pdf"].map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                    <span className="text-xs text-white/60 group-hover:text-white transition-colors">{file}</span>
                    <ChevronRight className="w-3 h-3 text-white/20" />
                  </div>
                ))}
                <Button variant="secondary" className="w-full text-[10px] uppercase tracking-widest border-dashed border-white/20 bg-transparent">
                  Upload More
                </Button>
              </div>
            </Card>

            <Card className="p-6 bg-red-500/5 border-red-500/20 overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                  <Flame className="w-4 h-4" />
                  Stress Mode
                </h3>
                <p className="text-[10px] text-white/40 mb-4 leading-relaxed">Only 24h left? Toggle Stress Mode for a hyper-focused crash strategy.</p>
                <Button variant="secondary" className="w-full bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20">
                  Activate
                </Button>
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-[30px]" />
            </Card>
          </div>
        </div>
      </main>

      {/* Floating AI Chat Toggle */}
      <motion.button 
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-16 h-16 rounded-full bg-gradient-to-r from-accent-purple to-accent-blue shadow-2xl shadow-accent-purple/40 flex items-center justify-center text-white z-50"
      >
        <Sparkles className="w-8 h-8" />
      </motion.button>
    </div>
  );
}

function ArrowRight(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
