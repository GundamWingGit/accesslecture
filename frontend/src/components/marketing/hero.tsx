"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const outputItems = [
  { label: "Captions", color: "text-green-400" },
  { label: "Transcript", color: "text-green-400" },
  { label: "Audio Desc.", color: "text-green-400" },
  { label: "Slides (14)", color: "text-amber-400" },
  { label: "Report", color: "text-green-400" },
  { label: "Certificate", color: "text-green-400" },
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-600 dark:text-amber-400 mb-6">
              <ShieldAlert className="w-3.5 h-3.5" />
              ADA TITLE II — COMPLIANCE DEADLINE IN EFFECT
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6 font-display">
              Your lectures{" "}
              <span className="gradient-text">aren&apos;t compliant</span>{" "}
              yet.
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl mb-8">
              Upload any lecture recording. Get back captions, a full transcript,
              audio descriptions, extracted slides, a compliance report, and a
              downloadable WCAG certificate — in under 5 minutes.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link
                href="/dashboard"
                className="btn-gradient px-7 py-3 text-base font-medium rounded-xl shadow-lg inline-flex items-center gap-2"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="glass px-6 py-3 text-base font-medium rounded-xl inline-flex items-center gap-2 hover:bg-foreground/5 transition-colors"
              >
                See How It Works
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              No credit card required · WCAG 2.1 AA · Section 508 · ADA Title II · EAA
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative hidden lg:block"
          >
            <div className="glass rounded-2xl p-6 shadow-2xl">
              {/* Video with live AI annotations */}
              <div className="rounded-xl bg-black/20 aspect-video flex items-center justify-center mb-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
                <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>

                {/* AI audio description badge — this is the differentiator */}
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="absolute top-3 right-3"
                >
                  <div className="glass-subtle rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-blue-400 border border-blue-400/20">
                    🎙 &quot;Graph shows upward trend&quot;
                  </div>
                </motion.div>

                {/* Slide extracted badge */}
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                  className="absolute top-3 left-3"
                >
                  <div className="glass-subtle rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-amber-400 border border-amber-400/20">
                    📊 Slide captured
                  </div>
                </motion.div>

                {/* Caption overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="glass-subtle rounded-lg px-3 py-2 text-xs font-mono">
                    <span className="text-primary/70">[00:04:12]</span>{" "}
                    <span className="text-foreground/80">
                      &quot;As you can see on the graph—&quot;
                    </span>
                  </div>
                </div>
              </div>

              {/* Output package summary */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">ECS 150 — Lecture 12</span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-green-500 font-medium">98% Compliant</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {outputItems.map((item) => (
                    <div
                      key={item.label}
                      className="glass-subtle rounded-lg px-2 py-1.5 flex items-center gap-1.5"
                    >
                      <span className={`text-[10px] font-bold ${item.color}`}>✓</span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.label}
                      </span>
                    </div>
                  ))}
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
