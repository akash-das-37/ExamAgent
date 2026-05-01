"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Mail, Globe, GraduationCap, Calendar, 
  BookOpen, Layers, Save, Lock, ArrowLeft,
  CheckCircle2, AlertCircle, Camera
} from "lucide-react";

import { Select } from "@/components/ui/Select";

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

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    collegeUrl: "",
    course: "",
    stream: "",
    otherStream: "",
    semester: "",
    admissionYear: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }

      setAvatarUrl(user.user_metadata.avatar_url || null);

      const { data } = await supabase
        .from("UserProfile")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        const isStandardStream = STREAM_OPTIONS.some(opt => opt.value === data.stream);
        setProfile(data);
        setFormData({
          fullName: user.user_metadata.full_name || "",
          collegeUrl: data.collegeUrl || "",
          course: data.course || "",
          stream: isStandardStream ? data.stream : "Other",
          otherStream: isStandardStream ? "" : data.stream,
          semester: data.semester || "",
          admissionYear: data.batch || "",
        });
      }
      setIsLoading(false);
    }
    loadProfile();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsSaving(true);
    
    // In a real app, you'd upload to Supabase Storage here
    // For now, we'll update the avatar_url in metadata with the base64 (or mock it)
    // Note: Large base64 strings might exceed metadata limits, but for small icons it's okay for a demo.
    // Ideally use: await supabase.storage.from('avatars').upload(...)
    
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: URL.createObjectURL(file) } // Mocking URL for now
    });

    if (error) {
      setMessage({ type: 'error', text: "Failed to update photo: " + error.message });
    } else {
      setMessage({ type: 'success', text: "Photo updated successfully!" });
    }
    setIsSaving(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const finalStream = formData.stream === "Other" ? formData.otherStream : formData.stream;

    // Update Auth Metadata
    await supabase.auth.updateUser({
      data: { full_name: formData.fullName }
    });

    // Update UserProfile table
    const { error } = await supabase
      .from("UserProfile")
      .update({
        collegeUrl: formData.collegeUrl,
        course: formData.course,
        stream: finalStream,
        semester: formData.semester,
        batch: formData.admissionYear,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: "Profile updated successfully!" });
    }
    setIsSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: "New passwords do not match." });
      setIsSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return;

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordData.currentPassword,
    });

    if (signInError) {
      setMessage({ type: 'error', text: "Current password is incorrect." });
      setIsSaving(false);
      return;
    }

    // Update to new password
    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: "Password changed successfully!" });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-accent-purple/30 border-t-accent-purple rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B]">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-purple/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-accent-blue/5 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-[10%] w-[20%] h-[20%] bg-accent-cyan/5 rounded-full blur-[80px] animate-pulse" />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <button 
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-white/30 hover:text-white transition-all group mb-4 text-sm font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors border border-white/5">
                <ArrowLeft className="w-4 h-4" />
              </div>
              Back to Dashboard
            </button>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">
              Profile Settings
            </h1>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60">System Online</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`mb-10 p-5 rounded-2xl flex items-center gap-4 border backdrop-blur-xl shadow-2xl ${
                message.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20 text-green-400 shadow-green-500/5' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-red-500/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                message.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <span className="text-sm font-semibold tracking-wide">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Avatar & Quick Info */}
          <div className="lg:col-span-4 space-y-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8 text-center relative overflow-hidden group border-white/10 hover:border-accent-purple/30 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-purple via-accent-blue to-accent-cyan opacity-50" />
                
                <div className="relative mb-8 inline-block">
                  <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-accent-purple via-accent-blue to-accent-cyan animate-spin-slow">
                    <div className="w-full h-full rounded-full bg-[#0A0A0B] p-1">
                      <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center overflow-hidden relative group/avatar">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-14 h-14 text-white/20 group-hover/avatar:text-white/40 transition-colors" />
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handlePhotoUpload}
                          />
                          <Camera className="w-6 h-6 text-white" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#0A0A0B] border-2 border-white/5 flex items-center justify-center text-accent-purple shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                <h2 className="text-2xl font-black mb-1 tracking-tight">{formData.fullName}</h2>
                <p className="text-sm text-white/30 font-medium mb-8">{profile?.email}</p>
                
                <Button 
                  variant="secondary" 
                  className="w-full rounded-xl bg-white/5 hover:bg-white/10 border-white/10 text-[10px] font-black tracking-widest py-4 group"
                  onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                >
                  <Camera className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  CHANGE PHOTO
                </Button>
              </Card>
            </motion.div>

            <Card className="p-6 border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4">Account Stats</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Joined</span>
                  <span className="text-xs font-bold text-white/80">May 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Exams Planned</span>
                  <span className="text-xs font-bold text-white/80">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Study Hours</span>
                  <span className="text-xs font-bold text-white/80">142h</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Edit Forms */}
          <div className="lg:col-span-8 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-10 border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-accent-blue/10 transition-all duration-700" />
                
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue shadow-[0_0_20px_rgba(0,210,255,0.1)] border border-accent-blue/20">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Academic Profile</h3>
                    <p className="text-xs text-white/30 font-medium">Keep your educational details updated for better AI planning.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input
                      label="Full Name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      required
                      className="bg-white/[0.02]"
                    />
                    <Input
                      label="College Website URL"
                      value={formData.collegeUrl}
                      onChange={(e) => setFormData({...formData, collegeUrl: e.target.value})}
                      required
                      className="bg-white/[0.02]"
                    />
                    <Select
                      label="Course Type"
                      value={formData.course}
                      onChange={(e) => setFormData({...formData, course: e.target.value})}
                      options={COURSE_OPTIONS}
                      required
                      className="bg-white/[0.02]"
                    />
                    <Select
                      label="Stream"
                      value={formData.stream}
                      onChange={(e) => setFormData({...formData, stream: e.target.value})}
                      options={STREAM_OPTIONS}
                      required
                      className="bg-white/[0.02]"
                    />
                  </div>

                  <AnimatePresence>
                    {formData.stream === "Other" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <Input
                          label="Specify Stream"
                          placeholder="e.g. Aeronautical Engineering"
                          value={formData.otherStream}
                          onChange={(e) => setFormData({...formData, otherStream: e.target.value})}
                          required
                          className="bg-accent-purple/[0.02] border-accent-purple/20"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input
                      label="Admission Year"
                      value={formData.admissionYear}
                      onChange={(e) => setFormData({...formData, admissionYear: e.target.value})}
                      required
                      className="bg-white/[0.02]"
                    />
                    <Input
                      label="Current Semester"
                      value={formData.semester}
                      onChange={(e) => setFormData({...formData, semester: e.target.value})}
                      required
                      className="bg-white/[0.02]"
                    />
                  </div>

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full sm:w-auto px-10 h-14 rounded-2xl shadow-xl shadow-accent-blue/20"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <div className="flex items-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                          <span>Saving...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Save className="w-5 h-5" />
                          <span className="font-bold">Save Changes</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-10 border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-64 h-64 bg-accent-purple/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-accent-purple/10 transition-all duration-700" />
                
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 rounded-2xl bg-accent-purple/10 flex items-center justify-center text-accent-purple shadow-[0_0_20px_rgba(168,85,247,0.1)] border border-accent-purple/20">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Security Settings</h3>
                    <p className="text-xs text-white/30 font-medium">Protect your account with a strong, unique password.</p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-8">
                  <div className="space-y-8">
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="••••••••"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      required
                      className="bg-white/[0.02]"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Input
                        label="New Password"
                        type="password"
                        placeholder="••••••••"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        required
                        className="bg-white/[0.02]"
                      />
                      <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="••••••••"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        required
                        className="bg-white/[0.02]"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      variant="secondary"
                      className="w-full sm:w-auto px-10 h-14 rounded-2xl hover:bg-white/10"
                      disabled={isSaving}
                    >
                      {isSaving ? "Updating..." : <span className="font-bold">Change Password</span>}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
