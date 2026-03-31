"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying it out",
    features: [
      "3 lectures per month",
      "AI captioning & transcription",
      "Accessibility scoring",
      "VTT & SRT export",
      "Built-in caption editor",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For power users and institutions",
    features: [
      "Unlimited lectures",
      "Priority AI processing",
      "Bulk export & batch upload",
      "Advanced analytics",
      "Priority support",
      "Custom branding (coming soon)",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
];

export function PricingPreview() {
  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Simple, <span className="gradient-text">transparent</span> pricing
          </h2>
          <p className="text-muted-foreground text-lg">
            Start free. Upgrade when you need more. No hidden fees.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`rounded-2xl p-8 relative ${
                plan.highlighted
                  ? "glass border border-primary/20 shadow-lg shadow-primary/5"
                  : "glass"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {plan.description}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className={`block text-center py-3 px-6 rounded-xl text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? "btn-gradient shadow-md"
                    : "glass hover:bg-white/10"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          No credit card required for the free plan. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
