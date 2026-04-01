"use client";

import { motion } from "framer-motion";
import {
  PenTool,
  LayoutPanelTop,
  BarChart2,
  Check,
  Clock,
  Captions,
  FileImage,
  Award,
  AlertCircle,
} from "lucide-react";

const spotlights = [
  {
    id: "editor",
    eyebrow: "CAPTION EDITOR",
    icon: PenTool,
    title: "Human oversight. Machine speed.",
    description:
      "AI does the heavy lifting. You stay in control. The built-in timeline editor lets you click any caption to edit it, highlights low-confidence segments in amber, and flags compliance issues inline — so your team can review a 90-minute lecture in minutes, not hours.",
    bullets: [
      "Click any word in the transcript to jump to that moment",
      "Confidence highlighting shows where the AI is uncertain",
      "Non-speech sounds auto-labeled: [laughter], [music playing]",
      "Speaker identification across multiple voices",
    ],
    visual: (
      <div className="glass rounded-2xl p-5 space-y-3 font-mono text-xs">
        <div className="flex items-center gap-2 mb-4">
          <Captions className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold font-sans">Caption Editor</span>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-green-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Live review
          </div>
        </div>

        {/* Timeline rows */}
        {[
          { time: "00:01:14", text: "Welcome to Operating Systems.", conf: "high", flag: false },
          { time: "00:01:18", text: "Today we'll cover process scheduling—", conf: "high", flag: false },
          { time: "00:01:23", text: "specifcally the round-robin algorythm.", conf: "low", flag: true },
          { time: "00:01:31", text: "[slide change]", conf: "high", flag: false, meta: true },
          { time: "00:01:34", text: "So the key insight here is—", conf: "high", flag: false },
        ].map((row) => (
          <div
            key={row.time}
            className={`flex gap-3 items-start px-2 py-1.5 rounded-lg transition-colors ${
              row.conf === "low"
                ? "bg-amber-500/10 border border-amber-500/20"
                : row.meta
                ? "bg-primary/5 border border-primary/10"
                : "hover:bg-foreground/5"
            }`}
          >
            <span className="text-primary/50 shrink-0 w-14">{row.time}</span>
            <span
              className={
                row.conf === "low"
                  ? "text-amber-400 underline decoration-dotted"
                  : row.meta
                  ? "text-primary/60 italic"
                  : "text-foreground/80"
              }
            >
              {row.text}
            </span>
            {row.flag && (
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5 ml-auto" />
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-muted-foreground">
          <span>3 issues flagged</span>
          <span className="text-green-500">94% accuracy</span>
        </div>
      </div>
    ),
    flip: false,
  },
  {
    id: "slides",
    eyebrow: "SLIDE & VISUAL EXTRACTION",
    icon: LayoutPanelTop,
    title: "Your lecture becomes a course asset.",
    description:
      "Every time a slide appears, AccessLecture captures it, timestamps it, and links it to the exact line in the transcript where the professor started discussing it. The result isn't just captions — it's a structured, navigable study guide your students can actually use.",
    bullets: [
      "AI detects every slide transition and keyframe automatically",
      "Each slide linked to its transcript timestamp",
      "Equations, charts, and diagrams flagged for audio description",
      "Export as a formatted slide deck synced with your transcript PDF",
    ],
    visual: (
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <FileImage className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">Extracted Slides</span>
          <span className="ml-auto text-xs text-muted-foreground">14 captured</span>
        </div>

        {/* Slide grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Slide 1", time: "00:00:45", hasDesc: false },
            { label: "Slide 5", time: "00:04:12", hasDesc: true },
            { label: "Slide 8", time: "00:07:31", hasDesc: true },
          ].map((slide) => (
            <div key={slide.label} className="glass-subtle rounded-lg overflow-hidden">
              <div className="aspect-video bg-gradient-to-br from-primary/10 to-amber-500/5 flex items-center justify-center relative">
                <LayoutPanelTop className="w-5 h-5 text-primary/30" />
                {slide.hasDesc && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-400" title="Audio description generated" />
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-medium">{slide.label}</p>
                <p className="text-[9px] text-muted-foreground font-mono">{slide.time}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Audio description example */}
        <div className="glass-subtle rounded-xl p-3 border border-blue-400/20">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded bg-blue-400/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[9px] text-blue-400 font-bold">AD</span>
            </div>
            <div>
              <p className="text-[10px] font-medium text-blue-400 mb-0.5">
                Audio description — Slide 5
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed font-mono">
                &quot;Bar chart shows CPU utilization rising from 40% to 95% between timestamps 2s and 18s.&quot;
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
    flip: true,
  },
  {
    id: "compliance",
    eyebrow: "COMPLIANCE REPORT + CERTIFICATE",
    icon: BarChart2,
    title: "Audit-ready before the auditor calls.",
    description:
      "Every lecture gets a machine-generated WCAG compliance report with a per-element checklist, accuracy score, and specific fixes for every flagged issue. When you're done, download a compliance certificate — the document your legal team, your accreditor, and your disability services office actually wants.",
    bullets: [
      "WCAG 2.1 AA checklist with pass/fail per element",
      "Specific fix suggestions for every flagged issue",
      "Accuracy score backed by AI confidence data",
      "Downloadable certificate: 'This lecture meets WCAG 2.1 AA'",
    ],
    visual: (
      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Compliance Report</span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeDasharray="94 100"
                strokeLinecap="round"
                className="text-green-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-green-500">
              94%
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">WCAG 2.1 AA</p>
            <p className="text-xs text-muted-foreground">2 issues · 1 warning</p>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-1.5">
          {[
            { item: "Captions present", pass: true },
            { item: "Captions verbatim", pass: true },
            { item: "Non-speech labeled", pass: true },
            { item: "Transcript available", pass: true },
            { item: "Audio descriptions", pass: false, note: "2 slides missing" },
          ].map((row) => (
            <div key={row.item} className="flex items-center gap-2 text-xs">
              {row.pass ? (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className={row.pass ? "text-muted-foreground" : "text-foreground"}>
                {row.item}
              </span>
              {row.note && (
                <span className="text-amber-400 text-[10px] ml-auto">{row.note}</span>
              )}
            </div>
          ))}
        </div>

        {/* Certificate badge */}
        <div className="glass-subtle rounded-xl p-3 border border-primary/20 flex items-center gap-3">
          <Award className="w-8 h-8 text-primary shrink-0" />
          <div>
            <p className="text-xs font-semibold">Compliance Certificate</p>
            <p className="text-[10px] text-muted-foreground">
              WCAG 2.1 AA · ECS 150 Lecture 12 · Ready to download
            </p>
          </div>
          <Clock className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
        </div>
      </div>
    ),
    flip: false,
  },
];

export function FeatureSpotlights() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-20"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-display">
            Built beyond{" "}
            <span className="gradient-text">basic captioning</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Three capabilities that no other captioning service offers. Each one
            matters to your auditors, your students, and your legal team.
          </p>
        </motion.div>

        <div className="space-y-32">
          {spotlights.map((spot, i) => (
            <motion.div
              key={spot.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                spot.flip ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              {/* Text */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-subtle text-xs font-semibold text-muted-foreground tracking-widest mb-5">
                  <spot.icon className="w-3.5 h-3.5" />
                  {spot.eyebrow}
                </div>
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.1] mb-5 font-display">
                  {spot.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-7">
                  {spot.description}
                </p>
                <ul className="space-y-3">
                  {spot.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="relative">
                {spot.visual}
                {/* Ambient glow */}
                <div className="absolute -inset-8 bg-primary/5 rounded-3xl blur-3xl -z-10 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
