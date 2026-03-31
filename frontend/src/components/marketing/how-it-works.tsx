"use client";

import { Upload, Cpu, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload",
    description:
      "Drop your lecture recording — video or audio, up to 500 MB. We accept MP4, MP3, WAV, and more.",
  },
  {
    number: "02",
    icon: Cpu,
    title: "AI Processes",
    description:
      "Gemini AI transcribes audio, identifies speakers, detects slide text, and scores accessibility — all automatically.",
  },
  {
    number: "03",
    icon: CheckCircle,
    title: "Review & Export",
    description:
      "Edit captions in the built-in professional editor, confirm compliance, and export compliant .VTT, .SRT, or transcript files.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Three steps to{" "}
            <span className="gradient-text">full compliance</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            From raw recording to accessible, audit-ready captions in minutes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-5 relative z-10">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-mono text-primary/60 tracking-widest">
                STEP {step.number}
              </span>
              <h3 className="text-xl font-semibold mt-2 mb-3">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
