import Link from "next/link";
import { Sparkles } from "lucide-react";

const footerSections = [
  {
    title: "Product",
    links: [
      { label: "AI Captioning", href: "#features" },
      { label: "Smart Transcripts", href: "#features" },
      { label: "Accessibility Scoring", href: "#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Higher Education", href: "#use-cases" },
      { label: "Corporate Training", href: "#use-cases" },
      { label: "Content Creators", href: "#use-cases" },
      { label: "Enterprise", href: "#use-cases" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { label: "WCAG 2.1 AA", href: "#compliance" },
      { label: "Section 508", href: "#compliance" },
      { label: "ADA Title II", href: "#compliance" },
      { label: "EAA / EN 301 549", href: "#compliance" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Contact", href: "/about#contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-base font-semibold gradient-text">
                AccessLecture
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI-powered lecture accessibility. Transform any recording into compliant captions, transcripts, and structured notes.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AccessLecture. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors">
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
