"use client";

import { useState } from "react";
import { Loader2, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSupabaseBrowser } from "@/lib/supabase";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = getSupabaseBrowser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm, or sign in if email confirmation is disabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">
            AccessLecture
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            AI-powered accessible captioning
          </p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">
              {isSignUp ? "Create Account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isSignUp
                ? "Start making lectures accessible."
                : "Sign in to continue."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                disabled={loading}
                autoComplete="email"
                className="flex h-11 w-full rounded-xl glass-subtle px-3.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:glow-ring disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                disabled={loading}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="flex h-11 w-full rounded-xl glass-subtle px-3.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:glow-ring disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-xl btn-gradient text-sm font-medium"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Need an account? Create one"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
          <Shield className="w-3.5 h-3.5" />
          <span>WCAG 2.1 AA &middot; Section 508 &middot; ADA Title II</span>
        </div>
      </div>
    </div>
  );
}
