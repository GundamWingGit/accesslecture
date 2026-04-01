"use client";

import Link from "next/link";
import { Play, Sparkles, Zap, Clock, Package } from "lucide-react";
import { motion } from "framer-motion";

const stats = [
  { icon: Zap, label: "99%+ Accuracy", delay: 0.3 },
  { icon: Package, label: "10 Deliverables", delay: 0.5 },
  { icon: Clock, label: "Minutes, Not Days", delay: 0.7 },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle text-xs font-medium text-primary mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              THE FUTURE OF ACCESSIBLE EDUCATION
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6 font-display">
              Your lectures, now{" "}
              <span className="gradient-text">universally</span>{" "}
              accessible.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl mb-8">
              Transform any lecture recording into compliant captions, searchable
              transcripts, and structured notes in minutes — not days.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="btn-gradient px-7 py-3 text-base font-medium rounded-xl shadow-lg inline-flex items-center gap-2"
              >
                Get Started Free
              </Link>
              <a
                href="#how-it-works"
                className="glass px-6 py-3 text-base font-medium rounded-xl inline-flex items-center gap-2 hover:bg-foreground/5 transition-colors"
              >
                <Play className="w-4 h-4" />
                See How It Works
              </a>
            </div>

            <div className="flex flex-wrap gap-4 mt-10">
              {stats.map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: stat.delay, ease: "easeOut" }}
                  className="glass-subtle px-4 py-2.5 rounded-xl flex items-center gap-2"
                >
                  <stat.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{stat.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative hidden lg:block"
          >
            <div className="glass rounded-2xl p-6 shadow-2xl">
              <div className="rounded-xl bg-black/20 aspect-video flex items-center justify-center mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
                <div className="w-16 h-16 rounded-full glass flex items-center justify-center">
                  <Play className="w-7 h-7 text-primary ml-1" />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="glass-subtle rounded-lg px-3 py-2 text-xs font-mono">
                    <span className="text-primary/70">[00:01:23]</span>{" "}
                    <span className="text-foreground/80">
                      &quot;Welcome to ECS 150. Today we&apos;ll cover...&quot;
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ECS 150 — Lecture 12</span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-green-500 font-medium">98% Accessible</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="glass-subtle rounded-lg px-2.5 py-1 text-[10px] font-medium">
                    WCAG 2.1 AA
                  </div>
                  <div className="glass-subtle rounded-lg px-2.5 py-1 text-[10px] font-medium">
                    Section 508
                  </div>
                  <div className="glass-subtle rounded-lg px-2.5 py-1 text-[10px] font-medium">
                    .VTT Ready
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
