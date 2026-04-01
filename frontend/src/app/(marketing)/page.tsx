import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeatureSpotlights } from "@/components/marketing/feature-spotlights";
import { Metrics } from "@/components/marketing/metrics";
import { SocialProof } from "@/components/marketing/social-proof";
import { Comparison } from "@/components/marketing/comparison";
import { Compliance } from "@/components/marketing/compliance";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { CTA } from "@/components/marketing/cta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <FeatureSpotlights />
      <Metrics />
      <SocialProof />
      <Comparison />
      <Compliance />
      <PricingPreview />
      <CTA />
    </>
  );
}
