"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-accent-purple/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <Card className="p-10">
          <div className="w-20 h-20 bg-accent-purple/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-accent-purple" />
          </div>
          
          <h1 className="text-3xl font-bold mb-4">Check your email</h1>
          <p className="text-white/40 mb-8 font-light leading-relaxed">
            We've sent a verification link to your email address. 
            Please click the link to activate your account.
          </p>

          <div className="space-y-4">
            <Link href="/auth/login" className="block">
              <Button variant="primary" className="w-full">
                I've verified my email
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
