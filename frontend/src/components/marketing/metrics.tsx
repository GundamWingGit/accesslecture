"use client";

import { motion } from "framer-motion";

const stats = [
  {
    value: "99%+",
    label: "Caption accuracy",
    note: "Gemini AI, not cheap ASR",
  },
  {
    value: "<5 min",
    label: "Average processing time",
    note: "Not hours. Not days.",
  },
  {
    value: "0",
    label: "Manual steps required",
    note: "Upload once. We handle the rest.",
  },
  {
    value: "4",
    label: "Compliance standards met",
    note: "WCAG · 508 · ADA · EAA",
  },
];

export function Metrics() {
  return (
    <section className="py-8 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="section-rule mb-12" />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/40 glass rounded-2xl overflow-hidden"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="px-8 py-10 flex flex-col gap-2"
            >
              <p className="text-5xl sm:text-6xl font-black tracking-tight gradient-text tabular-nums">
                {stat.value}
              </p>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {stat.label}
              </p>
              <p className="text-xs text-muted-foreground">{stat.note}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="section-rule mt-12" />
      </div>
    </section>
  );
}
