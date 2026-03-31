import { Hero } from "@/components/marketing/hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Comparison } from "@/components/marketing/comparison";
import { Compliance } from "@/components/marketing/compliance";
import { UseCases } from "@/components/marketing/use-cases";
import { PricingPreview } from "@/components/marketing/pricing-preview";
import { CTA } from "@/components/marketing/cta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <Comparison />
      <Compliance />
      <UseCases />
      <PricingPreview />
      <CTA />
    </>
  );
}
