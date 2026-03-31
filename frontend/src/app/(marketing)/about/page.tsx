import Link from "next/link";
import { Sparkles, GraduationCap, ShieldCheck, Zap } from "lucide-react";

export const metadata = {
  title: "About",
  description:
    "AccessLecture is an AI-powered platform that transforms lecture recordings into fully accessible course assets.",
};

const values = [
  {
    icon: GraduationCap,
    title: "Education First",
    description:
      "We believe every student deserves equal access to learning materials, regardless of ability.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Built In",
    description:
      "Every feature is designed with WCAG 2.1, Section 508, and ADA compliance at its core.",
  },
  {
    icon: Zap,
    title: "AI-Powered Speed",
    description:
      "What used to take days and thousands of dollars now takes minutes at a fraction of the cost.",
  },
];

export default function AboutPage() {
  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle text-xs font-medium text-primary mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            OUR MISSION
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Making education{" "}
            <span className="gradient-text">accessible</span> for everyone
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            AccessLecture was built by educators and engineers who saw a broken
            system: lecture accessibility was slow, expensive, and often
            incomplete. We set out to change that with AI.
          </p>
        </div>

        <div className="glass rounded-2xl p-8 sm:p-12 mb-16">
          <h2 className="text-2xl font-bold mb-4">What We Do</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            AccessLecture is an AI-powered platform that transforms any lecture
            recording — video or audio — into a fully accessible course asset
            in minutes. We generate accurate, speaker-aware captions, clean
            transcripts, accessibility compliance scores, and export-ready
            files in VTT, SRT, and TXT formats.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Our built-in caption editor lets educators review and refine AI
            output before publishing. Every lecture is scored against WCAG 2.1
            AA, Section 508, and ADA Title II standards — so you always know
            exactly where you stand on compliance.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {values.map((value) => (
            <div
              key={value.title}
              className="glass rounded-2xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                <value.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>

        <div id="contact" className="glass rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Get in Touch</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Have questions, partnership inquiries, or feedback? We would love
            to hear from you.
          </p>
          <a
            href="mailto:contact@accesslecture.com"
            className="btn-gradient px-6 py-3 text-sm font-medium rounded-xl shadow-md inline-flex items-center"
          >
            contact@accesslecture.com
          </a>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
