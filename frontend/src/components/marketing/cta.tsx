"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass rounded-3xl p-12 sm:p-16 text-center relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl" />

          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] mb-4 font-display">
              Stop delivering captions.{" "}
              <span className="gradient-text">Start delivering compliance.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Upload your first lecture and get back all ten deliverables — captions,
              transcript, compliance report, certificate, and more. Free to start,
              no credit card required.
            </p>
            <Link
              href="/dashboard"
              className="btn-gradient px-8 py-3.5 text-base font-medium rounded-xl shadow-lg inline-flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
