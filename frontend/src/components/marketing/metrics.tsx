"use client";

import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef } from "react";

function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 40, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, motionValue, value]);

  useEffect(() => {
    return spring.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent =
          prefix + Math.floor(v).toLocaleString() + suffix;
      }
    });
  }, [spring, prefix, suffix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}

const stats = [
  {
    value: 10,
    suffix: "",
    label: "Deliverables per lecture",
    note: "Where competitors give you one",
  },
  {
    value: 99,
    suffix: "%+",
    label: "Caption accuracy",
    note: "Gemini AI, not cheap ASR",
  },
  {
    value: 5,
    suffix: " min",
    label: "Average processing time",
    note: "Not hours. Not days.",
  },
  {
    value: 4,
    suffix: "",
    label: "Compliance standards met",
    note: "WCAG · 508 · ADA · EAA",
  },
];

export function Metrics() {
  return (
    <section className="py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="section-rule mb-16" />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/40 rounded-2xl overflow-hidden glass"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="px-8 py-10 bg-background/40 flex flex-col gap-2"
            >
              <p className="text-5xl sm:text-6xl font-black tracking-tight gradient-text tabular-nums">
                <AnimatedNumber
                  value={stat.value}
                  suffix={stat.suffix}
                />
              </p>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {stat.label}
              </p>
              <p className="text-xs text-muted-foreground">{stat.note}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="section-rule mt-16" />
      </div>
    </section>
  );
}
