"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Github, Mail, ShieldCheck, AlertCircle } from "lucide-react";
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

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    collegeUrl: "",
    course: "",
    stream: "",
    otherStream: "",
    semester: "",
    admissionYear: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const finalStream = formData.stream === "Other" ? formData.otherStream : formData.stream;

    if (!formData.course || !finalStream) {
      setError("Please select both Course Type and Stream.");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          college_url: formData.collegeUrl,
          course: formData.course,
          stream: finalStream,
          semester: formData.semester,
          admission_year: formData.admissionYear,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      // Show success message or redirect
      router.push("/auth/verify-email");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-[10%] right-[10%] w-80 h-80 bg-accent-blue/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-accent-cyan/10 rounded-full blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg mt-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent mb-2">
            Join ExamMind AI
          </h1>
          <p className="text-white/40 font-light">
            Start your journey towards effortless academic excellence.
          </p>
        </div>

        <Card className="relative z-10 p-6 md:p-8">
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

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Full Name"
              name="fullName"
              placeholder="John Doe"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
            <Input
              label="College Website URL"
              name="collegeUrl"
              placeholder="university.edu"
              type="text"
              value={formData.collegeUrl}
              onChange={handleChange}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Course Type"
                name="course"
                value={formData.course}
                onChange={handleChange}
                options={COURSE_OPTIONS}
                required
              />
              <Select
                label="Stream"
                name="stream"
                value={formData.stream}
                onChange={handleChange}
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
                    name="otherStream"
                    placeholder="e.g. Aeronautical Engineering"
                    value={formData.otherStream}
                    onChange={handleChange}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Admission Year"
                name="admissionYear"
                placeholder="e.g. 2023"
                type="text"
                value={formData.admissionYear}
                onChange={handleChange}
                required
              />
              <Input
                label="Current Semester"
                name="semester"
                placeholder="e.g. 5"
                type="text"
                value={formData.semester}
                onChange={handleChange}
                required
              />
            </div>
            <Input
              label="Email Address"
              name="email"
              placeholder="john@example.edu"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Password"
                name="password"
                placeholder="••••••••"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <Input
                label="Set Password"
                name="confirmPassword"
                placeholder="••••••••"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <div className="flex items-start space-x-2 px-1 py-2">
              <input type="checkbox" required className="mt-1 w-4 h-4 rounded border-white/10 bg-white/5 accent-accent-purple" />
              <p className="text-xs text-white/40 leading-relaxed">
                By creating an account, I agree to the{" "}
                <Link href="/terms" className="text-accent-cyan hover:underline">Terms of Service</Link> and{" "}
                <Link href="/privacy" className="text-accent-cyan hover:underline">Privacy Policy</Link>.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#131314] px-2 text-white/30">Already using AI?</span>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <Button type="button" variant="secondary" className="flex-1">
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
              <Button type="button" variant="secondary" className="flex-1">
                <Mail className="w-4 h-4 mr-2" />
                Google
              </Button>
            </div>
          </form>

          <div className="mt-8 flex justify-center items-center space-x-2 text-white/20">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest">End-to-End Secure Analytics</span>
          </div>
        </Card>

        <p className="mt-8 text-center text-sm text-white/40">
          Already a member?{" "}
          <Link href="/auth/login" className="text-accent-purple hover:text-accent-purple/80 transition-colors font-medium">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
