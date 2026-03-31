"use client";

import { GraduationCap, Building2, Video } from "lucide-react";
import { motion } from "framer-motion";

const cases = [
  {
    icon: GraduationCap,
    title: "Higher Education",
    description:
      "Professors upload after class, download compliant captions before posting to Canvas or Blackboard. Disability services teams stay ahead of accommodation requests.",
  },
  {
    icon: Building2,
    title: "Corporate Training",
    description:
      "L&D teams make all training videos accessible at scale without breaking the budget. Meet internal compliance mandates effortlessly.",
  },
  {
    icon: Video,
    title: "Content Creators",
    description:
      "YouTubers and course creators add professional, accurate captions instantly. Boost SEO, reach global audiences, and meet platform requirements.",
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Built for <span className="gradient-text">every educator</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Whether you teach 30 students or train 30,000 employees,
            AccessLecture scales with you.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass rounded-2xl p-8 hover:bg-white/[0.06] transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5">
                <c.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-3">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {c.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
