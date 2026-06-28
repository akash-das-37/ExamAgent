"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { 
  School, 
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const COURSE_OPTIONS = [
  { label: "B.Tech", value: "B.Tech" },
  { label: "M.Tech", value: "M.Tech" },
  { label: "BCA", value: "BCA" },
  { label: "MCA", value: "MCA" },
  { label: "Diploma", value: "Diploma" },
  { label: "B.Sc", value: "B.Sc" },
  { label: "M.Sc", value: "M.Sc" },
];

const STREAM_OPTIONS = [
  { label: "Computer Science (CSE)", value: "CSE" },
  { label: "CS (AI & ML)", value: "CSE-AIML" },
  { label: "CS (Data Science)", value: "CSE-DS" },
  { label: "CS (Cyber Security)", value: "CSE-Cyber" },
  { label: "CS (IOT)", value: "CSE-IOT" },
  { label: "Information Technology (IT)", value: "IT" },
  { label: "Electronics (ECE)", value: "ECE" },
  { label: "Electrical Engineering (EE)", value: "EE" },
  { label: "Electrical & Electronics (EEE)", value: "EEE" },
  { label: "Mechanical Engineering (ME)", value: "ME" },
  { label: "Civil Engineering (CE)", value: "CE" },
  { label: "Chemical Engineering", value: "Chemical" },
  { label: "Biotech Engineering", value: "Biotech" },
  { label: "Aerospace Engineering", value: "Aerospace" },
  { label: "Other", value: "Other" },
];

export default function OnboardingPage() {
  const [formData, setFormData] = useState({
    collegeUrl: "",
    course: "",
    stream: "",
    otherStream: "",
    admissionYear: "",
    semester: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numErrors, setNumErrors] = useState<{ admissionYear?: string; semester?: string }>({});
  const [shakeFields, setShakeFields] = useState<{ admissionYear?: boolean; semester?: boolean }>({});

  const handleNumChange = (fieldName: "admissionYear" | "semester", value: string) => {
    if (/\D/.test(value)) {
      setNumErrors(prev => ({ ...prev, [fieldName]: "Only numbers are allowed" }));
      setShakeFields(prev => ({ ...prev, [fieldName]: true }));
      setTimeout(() => setShakeFields(prev => ({ ...prev, [fieldName]: false })), 400);
      setTimeout(() => setNumErrors(prev => ({ ...prev, [fieldName]: undefined })), 2500);
    }
    const cleanValue = value.replace(/\D/g, "");
    setFormData(prev => ({ ...prev, [fieldName]: cleanValue }));
  };

  const router = useRouter();
  const supabase = createClient();

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const finalStream = formData.stream === "Other" ? formData.otherStream : formData.stream;

    if (!formData.course || !finalStream) {
      setError("Please select both Course Type and Stream.");
      setIsLoading(false);
      return;
    }

    if (formData.password || formData.confirmPassword) {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user found.");

      // 1. Update user password if provided
      if (formData.password) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: formData.password });
        if (pwdError) throw pwdError;
      }

      // 2. Save Academic Profile
      const { error: profileError } = await supabase
        .from("UserProfile")
        .upsert({
          id: user.id,
          email: user.email,
          collegeUrl: formData.collegeUrl,
          course: formData.course,
          stream: finalStream,
          semester: formData.semester,
          batch: formData.admissionYear,
          onboardingDone: true,
          updatedAt: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // 3. Trigger Syllabus Sync (Background)
      fetch("/api/ai/sync-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      router.push("/dashboard");
    } catch (err: any) {
      console.error("Onboarding failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-[150px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-blue/5 rounded-full blur-[150px] -z-10" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent mb-2">
            Complete Your Student Profile
          </h1>
          <p className="text-white/40 text-sm font-light">
            Set up your academic details and security preferences to personalize your study engine.
          </p>
        </div>

        <Card className="p-6 md:p-8 relative z-10">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleComplete} className="space-y-4">
            <Input 
              label="College Website URL" 
              placeholder="university.edu" 
              value={formData.collegeUrl}
              onChange={(e) => setFormData({ ...formData, collegeUrl: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Course Type"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                options={COURSE_OPTIONS}
                required
              />
              <Select
                label="Stream"
                value={formData.stream}
                onChange={(e) => setFormData({ ...formData, stream: e.target.value })}
                options={STREAM_OPTIONS}
                required
              />
            </div>

            <AnimatePresence>
              {formData.stream === "Other" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Input
                    label="Specify Stream"
                    placeholder="e.g. Aeronautical Engineering"
                    value={formData.otherStream}
                    onChange={(e) => setFormData({ ...formData, otherStream: e.target.value })}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div animate={shakeFields.admissionYear ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
                <Input 
                  label="Admission Year" 
                  placeholder="e.g. 2023" 
                  inputMode="numeric"
                  value={formData.admissionYear}
                  onChange={(e) => handleNumChange("admissionYear", e.target.value)}
                  error={numErrors.admissionYear}
                  required
                />
              </motion.div>
              <motion.div animate={shakeFields.semester ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
                <Input 
                  label="Current Semester" 
                  placeholder="e.g. 5" 
                  inputMode="numeric"
                  value={formData.semester}
                  onChange={(e) => handleNumChange("semester", e.target.value)}
                  error={numErrors.semester}
                  required
                />
              </motion.div>
            </div>

            {/* Password Setup Section */}
            <div className="pt-4 border-t border-white/5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group">
                  <Input
                    label="Password"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[38px] text-white/30 hover:text-white/60 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative group">
                  <Input
                    label="Set Password"
                    placeholder="••••••••"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-[38px] text-white/30 hover:text-white/60 transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Complete Registration
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 flex justify-center items-center space-x-2 text-white/20">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest">End-to-End Secure Analytics</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
