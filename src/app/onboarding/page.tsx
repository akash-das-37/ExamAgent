"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { 
  School, 
  BookOpen, 
  Clock, 
  Upload, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  CheckCircle2
} from "lucide-react";

const steps = [
  { id: 1, title: "Academic Profile", icon: School },
  { id: 2, title: "Syllabus Details", icon: BookOpen },
  { id: 3, title: "Study Schedule", icon: Clock },
  { id: 4, title: "PYQ Upload", icon: Upload },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    collegeUrl: "",
    semester: "",
    branch: "",
    subjects: "",
    examDate: "",
    daysLeft: "",
    studyHours: "4",
  });
  const router = useRouter();

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleComplete = () => {
    // TODO: Save to Supabase
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-[150px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-blue/5 rounded-full blur-[150px] -z-10" />

      <div className="w-full max-w-2xl">
        {/* Progress Stepper */}
        <div className="flex items-center justify-between mb-12 relative px-4">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -z-10 -translate-y-1/2" />
          {steps.map((step) => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                currentStep >= step.id 
                  ? "bg-accent-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]" 
                  : "bg-white/5 text-white/20 border border-white/10"
              }`}>
                {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-medium ${
                currentStep >= step.id ? "text-white/80" : "text-white/20"
              }`}>
                {step.title}
              </span>
            </div>
          ))}
        </div>

        <Card className="p-8 md:p-12 min-h-[450px] flex flex-col">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Tell us about your college</h2>
                  <p className="text-white/40 text-sm font-light">We use this to fetch the most relevant syllabus data.</p>
                </div>
                <Input 
                  label="College Website URL" 
                  placeholder="https://myuniversity.ac.in" 
                  value={formData.collegeUrl}
                  onChange={(e) => setFormData({...formData, collegeUrl: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Semester" 
                    placeholder="e.g. 5th" 
                    value={formData.semester}
                    onChange={(e) => setFormData({...formData, semester: e.target.value})}
                  />
                  <Input 
                    label="Branch / Stream" 
                    placeholder="e.g. CSE" 
                    value={formData.branch}
                    onChange={(e) => setFormData({...formData, branch: e.target.value})}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Syllabus Details</h2>
                  <p className="text-white/40 text-sm font-light">List your core subjects for this semester.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60 ml-1">Core Subjects</label>
                  <textarea 
                    className="w-full min-h-[120px] rounded-lg glass border-white/10 bg-white/5 p-4 text-white focus:outline-none focus:ring-1 focus:ring-accent-purple/50 placeholder:text-white/20"
                    placeholder="Enter subjects separated by commas (e.g. OS, DBMS, Networking)"
                    value={formData.subjects}
                    onChange={(e) => setFormData({...formData, subjects: e.target.value})}
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Your Strategy</h2>
                  <p className="text-white/40 text-sm font-light">Help us calculate your study velocity.</p>
                </div>
                <Input 
                  label="Days Left for Exams" 
                  type="number" 
                  placeholder="e.g. 15" 
                  value={formData.daysLeft}
                  onChange={(e) => setFormData({...formData, daysLeft: e.target.value})}
                />
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white/60 ml-1">Daily Study Hours: {formData.studyHours}h</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="16" 
                    step="1"
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-purple"
                    value={formData.studyHours}
                    onChange={(e) => setFormData({...formData, studyHours: e.target.value})}
                  />
                  <div className="flex justify-between text-[10px] text-white/20 uppercase tracking-tighter">
                    <span>Chill (1h)</span>
                    <span>Pro (8h)</span>
                    <span>Stress Mode (16h)</span>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-accent-cyan/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-accent-cyan/20">
                    <Upload className="w-8 h-8 text-accent-cyan" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Upload PYQs</h2>
                  <p className="text-white/40 text-sm font-light mb-8">Upload past year papers to detect recurring patterns.</p>
                  
                  <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer group">
                    <p className="text-sm text-white/30 group-hover:text-white/50">Drag & drop your PDFs here, or <span className="text-accent-cyan">browse files</span></p>
                    <p className="text-[10px] text-white/10 mt-2 uppercase tracking-widest">Max 10MB per file</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-12 pt-8 border-t border-white/5">
            <Button 
              variant="ghost" 
              onClick={prevStep} 
              disabled={currentStep === 1}
              className={currentStep === 1 ? "opacity-0" : ""}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            {currentStep < steps.length ? (
              <Button onClick={nextStep}>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} className="px-10">
                <Sparkles className="w-4 h-4 mr-2" />
                Finish Setup
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
