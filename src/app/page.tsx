"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Shield, BrainCircuit, Rocket } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full z-50">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center shadow-lg shadow-accent-purple/20">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">ExamMind AI</span>
        </div>
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-white/60">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#about" className="hover:text-white transition-colors">About</Link>
          <Link href="/auth/login" className="hover:text-white transition-colors">Login</Link>
          <Button variant="primary" size="sm" className="rounded-full px-6">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent-purple/5 rounded-full blur-[120px] -z-10" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-accent-blue/5 rounded-full blur-[100px] -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl"
        >
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-accent-purple text-xs font-medium mb-6 backdrop-blur-md">
            <Sparkles className="w-3 h-3" />
            <span>AI-Powered Study Planning</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            Stop Guessing What to <br />
            <span className="bg-gradient-to-r from-accent-purple via-accent-blue to-accent-cyan bg-clip-text text-transparent">
              Study for Exams.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            Let AI analyze your syllabus and past papers to tell you what actually matters. 
            Personalized study plans generated in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/login">
              <Button size="lg" className="rounded-full w-full sm:w-auto px-10 group">
                Start Planning Now
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full mt-32 px-4"
        >
          {[
            { icon: Shield, title: "Secure Data", desc: "Your files and progress are encrypted and private." },
            { icon: BrainCircuit, title: "Smart Priority", desc: "Our engine detects high-yield topics automatically." },
            { icon: Rocket, title: "Fast Execution", desc: "Go from syllabus to study plan in under 60 seconds." }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-2xl glass-morphism border-white/5 hover:border-white/10 transition-all group">
              <feature.icon className="w-8 h-8 text-accent-purple mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-white/40 text-sm font-light leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center text-white/20 text-xs tracking-widest uppercase">
        © 2026 ExamMind AI • Powered by Advanced Agentic Intelligence
      </footer>
    </div>
  );
}
