import { PricingPreview } from "@/components/marketing/pricing-preview";
import { CTA } from "@/components/marketing/cta";

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for AccessLecture. Start free, upgrade when you need more.",
};

export default function PricingPage() {
  return (
    <>
      <div className="pt-12">
        <PricingPreview />
      </div>
      <CTA />
    </>
  );
}
