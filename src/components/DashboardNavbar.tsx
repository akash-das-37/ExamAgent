"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrainCircuit, Bell, User, LogOut, Globe, GraduationCap, Calendar, Mail, ChevronDown } from "lucide-react";
import { Button } from "./ui/Button";
import { createClient } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

export function DashboardNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("UserProfile")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (data) {
          setProfile({
            ...data,
            fullName: user.user_metadata.full_name || "Student",
          });
        }
      }
    }
    getProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <nav className="border-b border-white/5 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/dashboard")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center shadow-lg shadow-accent-purple/10">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <span className="font-bold tracking-tight text-xl">ExamMind AI</span>
        </div>

        <div className="flex items-center gap-6">
          <button className="text-white/40 hover:text-white transition-colors relative p-2">
            <Bell className="w-6 h-6" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-accent-purple rounded-full border-2 border-background" />
          </button>
          
          <div className="h-8 w-[1px] bg-white/10" />
          
          <Link href="/dashboard/profile">
            <div className="flex items-center gap-4 group cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{profile?.fullName || "Loading..."}</p>
                <p className="text-xs text-white/40">{profile?.course || "..."} • {profile?.stream || "..."}</p>
              </div>
              <div className="w-12 h-12 rounded-full glass border border-white/10 flex items-center justify-center group-hover:border-accent-purple/50 transition-all overflow-hidden bg-white/5 shadow-inner">
                <User className="w-6 h-6 text-white/60" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}

