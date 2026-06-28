"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-background">
      <div className="w-full max-w-md text-center">
        <Card className="p-8 space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Authentication Failed</h1>
            <p className="text-sm text-white/50 leading-relaxed">
              We couldn't verify your account credentials. This can happen if the authorization code expired or was canceled.
            </p>
          </div>
          <Link href="/auth/login" className="block">
            <Button className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Login
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
