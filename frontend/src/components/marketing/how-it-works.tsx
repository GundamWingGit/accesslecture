"use client";

import { Upload, Eye, Package } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload your recording",
    description:
      "Drop any lecture video or audio — MP4, MP3, WAV, up to 500 MB. That's the only thing you do.",
    details: null,
  },
  {
    number: "02",
    icon: Eye,
    title: "The AI watches and listens",
    description:
      "Gemini AI doesn't just transcribe audio. It watches the video — detecting when slides appear, equations are written, and graphs are shown — then writes an audio description for every visual moment.",
    details: [
      "Speech → verbatim captions + clean transcript",
      "Slide change → keyframe captured and timestamped",
      '"Professor writes quadratic formula" → audio description generated',
      "Every caption element scored against WCAG rubric",
    ],
  },
  {
    number: "03",
    icon: Package,
    title: "You get the full package",
    description:
      "Review in the built-in caption editor, then export everything: captions, transcript, audio descriptions, the extracted slide deck, a compliance report, and your WCAG 2.1 AA certificate.",
    details: null,
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
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 font-display">
            From raw recording to{" "}
            <span className="gradient-text">audit-ready package</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Three steps. Under five minutes. No manual work.
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
              className="relative"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 relative z-10">
                <step.icon className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-mono text-primary/60 tracking-widest">
                STEP {step.number}
              </span>
              <h3 className="text-xl font-semibold mt-2 mb-3">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {step.description}
              </p>

              {step.details && (
                <ul className="space-y-2">
                  {step.details.map((detail) => (
                    <li
                      key={detail}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="text-primary mt-0.5 shrink-0">→</span>
                      <span className="font-mono leading-relaxed">{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
