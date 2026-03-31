"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Zap,
  Building2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface PricingPageProps {
  onBack: () => void;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic captioning",
    features: [
      "3 lectures per month",
      "VTT & SRT export",
      "AI transcription & cleanup",
      "Confidence highlighting",
      "Review confirmation",
    ],
    cta: "Current Plan",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/month",
    description: "Unlimited captioning for professionals",
    features: [
      "Unlimited lectures",
      "All export formats",
      "Canvas LMS package export",
      "Priority processing",
      "Batch speaker rename",
      "Full compliance reports",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    id: "institution",
    name: "Institution",
    price: "Custom",
    period: "",
    description: "For universities & organizations",
    features: [
      "Everything in Pro",
      "SSO / SAML integration",
      "Bulk upload API",
      "Dedicated support",
      "Custom compliance templates",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function PricingPage({ onBack }: PricingPageProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const { data: billingStatus } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api.billing.status(),
    retry: false,
  });

  const currentPlan = billingStatus?.plan ?? "free";

  const handleUpgrade = async () => {
    setLoading("pro");
    try {
      const { url } = await api.billing.createCheckoutSession(
        window.location.href,
        window.location.href,
      );
      window.location.href = url;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create checkout session");
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading("manage");
    try {
      const { url } = await api.billing.createPortalSession(window.location.href);
      window.location.href = url;
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to open billing portal");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold gradient-text">Plans & Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Choose the plan that fits your needs
          </p>
        </div>
      </div>

      {billingStatus && currentPlan !== "free" && (
        <div className="glass rounded-2xl">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">
                Current plan: <Badge variant="default">{currentPlan}</Badge>
              </p>
              {billingStatus.current_period_end && (
                <p className="text-xs text-muted-foreground mt-1">
                  Renews {new Date(billingStatus.current_period_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleManage} disabled={loading === "manage"}>
              {loading === "manage" ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-1.5" />
              )}
              Manage Subscription
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const Icon = plan.id === "pro" ? Zap : plan.id === "institution" ? Building2 : null;

          return (
            <div
              key={plan.id}
              className={`relative glass rounded-2xl ${
                plan.highlighted
                  ? "glow-ring scale-[1.02]"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="px-3">Most Popular</Badge>
                </div>
              )}
              <div className="text-center p-5 pb-2">
                <h3 className="text-lg font-semibold flex items-center justify-center gap-1.5">
                  {Icon && <Icon className="w-4 h-4" />}
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold gradient-text">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </div>
              <div className="px-5 pb-5 space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.id === "free" ? (
                  <Button variant="outline" className="w-full" disabled={isCurrent}>
                    {isCurrent ? "Current Plan" : "Downgrade"}
                  </Button>
                ) : plan.id === "pro" ? (
                  <Button
                    className="w-full rounded-xl btn-gradient shadow-md"
                    onClick={handleUpgrade}
                    disabled={loading === "pro" || isCurrent}
                  >
                    {loading === "pro" ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : null}
                    {isCurrent ? "Current Plan" : plan.cta}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open("mailto:sales@accesslecture.com")}
                  >
                    Contact Sales
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
