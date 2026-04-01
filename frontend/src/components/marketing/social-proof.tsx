"use client";

import { motion } from "framer-motion";
import {
  Captions,
  FileText,
  Mic,
  Monitor,
  PenTool,
  BarChart2,
  Download,
  Search,
  LayoutPanelTop,
  Award,
} from "lucide-react";

const deliverables = [
  {
    icon: Captions,
    name: "Closed Captions",
    note: "Verbatim · punctuated · speaker-labeled",
    tier: "Required",
    tierClass: "text-blue-400 bg-blue-500/10",
    iconClass: "text-blue-400",
    iconBg: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: FileText,
    name: "Full Transcript",
    note: "Timestamped & screen-reader ready",
    tier: "Required",
    tierClass: "text-blue-400 bg-blue-500/10",
    iconClass: "text-blue-400",
    iconBg: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: Mic,
    name: "Audio Descriptions",
    note: "Visual context competitors skip",
    tier: "Required",
    tierClass: "text-blue-400 bg-blue-500/10",
    iconClass: "text-blue-400",
    iconBg: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: Monitor,
    name: "Accessible Player",
    note: "Keyboard nav · screen reader labels",
    tier: "Required",
    tierClass: "text-blue-400 bg-blue-500/10",
    iconClass: "text-blue-400",
    iconBg: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: PenTool,
    name: "Caption Editor",
    note: "Timeline editing + confidence highlights",
    tier: "Competitive",
    tierClass: "text-violet-400 bg-violet-500/10",
    iconClass: "text-violet-400",
    iconBg: "from-violet-500/20 to-violet-500/5",
  },
  {
    icon: BarChart2,
    name: "Compliance Report",
    note: "WCAG checklist + accuracy score",
    tier: "Competitive",
    tierClass: "text-violet-400 bg-violet-500/10",
    iconClass: "text-violet-400",
    iconBg: "from-violet-500/20 to-violet-500/5",
  },
  {
    icon: Download,
    name: "All Export Formats",
    note: "SRT · VTT · TXT · PDF",
    tier: "Competitive",
    tierClass: "text-violet-400 bg-violet-500/10",
    iconClass: "text-violet-400",
    iconBg: "from-violet-500/20 to-violet-500/5",
  },
  {
    icon: Search,
    name: "Searchable Content",
    note: "Click any word → jump to timestamp",
    tier: "Competitive",
    tierClass: "text-violet-400 bg-violet-500/10",
    iconClass: "text-violet-400",
    iconBg: "from-violet-500/20 to-violet-500/5",
  },
  {
    icon: LayoutPanelTop,
    name: "Slide Extraction",
    note: "Visuals synced with your transcript",
    tier: "Advanced",
    tierClass: "text-amber-400 bg-amber-500/10",
    iconClass: "text-amber-400",
    iconBg: "from-amber-500/20 to-amber-500/5",
  },
  {
    icon: Award,
    name: "Compliance Certificate",
    note: "Downloadable WCAG 2.1 AA cert",
    tier: "Advanced",
    tierClass: "text-amber-400 bg-amber-500/10",
    iconClass: "text-amber-400",
    iconBg: "from-amber-500/20 to-amber-500/5",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export function SocialProof() {
  return (
    <section className="py-24 border-y border-border/50 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.015] to-transparent pointer-events-none" />

      {/* Oversized background numeral — premium design detail */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="text-[22rem] font-black text-foreground/[0.018] leading-none tracking-tighter">
          10
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle text-xs font-medium text-muted-foreground mb-6 tracking-wide">
            THE COMPLETE ACCESSIBLE LECTURE PACKAGE
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-display">
            One upload.{" "}
            <span className="gradient-text">Ten deliverables.</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Most captioning services stop at #1. AccessLecture delivers the
            complete compliance package — everything auditors check for,
            everything students need, everything legal requires.
          </p>
        </motion.div>

        {/* Tier legend */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-5 mb-12"
        >
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="text-muted-foreground">Baseline compliance</span>
          </span>
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
            <span className="text-muted-foreground">Competitive edge</span>
          </span>
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-muted-foreground">Category-winning</span>
          </span>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          {deliverables.map((d) => (
            <motion.div
              key={d.name}
              variants={item}
              className="glass rounded-2xl p-5 hover:bg-foreground/[0.03] transition-all hover:scale-[1.02] group cursor-default"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-br ${d.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}
                >
                  <d.icon className={`w-4 h-4 ${d.iconClass}`} />
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.tierClass} whitespace-nowrap`}
                >
                  {d.tier}
                </span>
              </div>
              <p className="text-sm font-semibold mb-1 leading-tight">{d.name}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {d.note}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center text-sm text-muted-foreground mt-10"
        >
          Traditional captioning services deliver{" "}
          <strong className="text-foreground">1 of 10</strong>.{" "}
          AccessLecture delivers{" "}
          <strong className="gradient-text font-semibold">all ten</strong>.
        </motion.p>
      </div>
    </section>
  );
}
