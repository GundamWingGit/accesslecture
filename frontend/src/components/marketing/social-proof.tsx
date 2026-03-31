"use client";

import { motion } from "framer-motion";

const institutions = [
  "UC Davis",
  "MIT",
  "Stanford",
  "Georgia Tech",
  "University of Michigan",
  "Carnegie Mellon",
];

export function SocialProof() {
  return (
    <section className="py-12 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mb-8"
        >
          Trusted by educators at leading institutions
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {institutions.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-base font-semibold text-muted-foreground/40 tracking-wide"
            >
              {name}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
