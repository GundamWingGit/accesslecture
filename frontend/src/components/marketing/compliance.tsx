"use client";

import { ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const badges = [
  { label: "WCAG 2.1 AA", description: "Web Content Accessibility Guidelines" },
  { label: "Section 508", description: "Federal accessibility standards" },
  { label: "ADA Title II", description: "Americans with Disabilities Act" },
  { label: "EAA / EN 301 549", description: "European Accessibility Act" },
];

export function Compliance() {
  return (
    <section id="compliance" className="py-24 relative">
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
            Built for <span className="gradient-text">compliance</span> from day one
          </h2>
          <p className="text-muted-foreground text-lg">
            Every caption is scored, every issue flagged, every export audit-ready.
            Stay ahead of regulations without lifting a finger.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {badges.map((badge, i) => (
            <motion.div
              key={badge.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass rounded-2xl p-6 text-center hover:bg-foreground/[0.03] transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-base font-semibold mb-1">{badge.label}</h3>
              <p className="text-xs text-muted-foreground">{badge.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
