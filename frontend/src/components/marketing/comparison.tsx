"use client";

import { Check, X } from "lucide-react";
import { motion } from "framer-motion";

const rows = [
  {
    feature: "Cost per Minute",
    us: "$0.20 – $0.50",
    them: "$3.50 – $4.50",
  },
  {
    feature: "Turnaround Time",
    us: "Minutes",
    them: "Hours to Days",
  },
  {
    feature: "Workflow",
    us: "AI-first automation",
    them: "Human-heavy manual process",
  },
  {
    feature: "Output",
    us: "Full accessible package",
    them: "Captions only",
  },
  {
    feature: "Accessibility Scoring",
    us: true,
    them: false,
  },
  {
    feature: "Built-in Caption Editor",
    us: true,
    them: false,
  },
  {
    feature: "Scale to Unlimited Lectures",
    us: true,
    them: false,
  },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="w-5 h-5 text-green-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-red-400/60 mx-auto" />
    );
  }
  return <span>{value}</span>;
}

export function Comparison() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Why <span className="gradient-text">AccessLecture</span>?
          </h2>
          <p className="text-muted-foreground text-lg">
            See how AI-first accessibility compares to traditional captioning services.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted-foreground p-4 w-1/3">
                  Feature
                </th>
                <th className="text-center text-sm font-semibold p-4 w-1/3">
                  <span className="gradient-text">AccessLecture</span>
                </th>
                <th className="text-center text-sm font-medium text-muted-foreground p-4 w-1/3">
                  Traditional Services
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={i < rows.length - 1 ? "border-b border-border/50" : ""}
                >
                  <td className="text-sm p-4 text-muted-foreground">
                    {row.feature}
                  </td>
                  <td className="text-sm p-4 text-center font-medium text-foreground">
                    <CellValue value={row.us} />
                  </td>
                  <td className="text-sm p-4 text-center text-muted-foreground">
                    <CellValue value={row.them} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
