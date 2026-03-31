import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "AccessLecture privacy policy — how we handle your data.",
};

export default function PrivacyPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: March 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">
              1. Information We Collect
            </h2>
            <div className="glass rounded-2xl p-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">Account Information:</strong>{" "}
                When you create an account, we collect your email address and
                display name.
              </p>
              <p>
                <strong className="text-foreground">Uploaded Content:</strong>{" "}
                Lecture recordings you upload are processed by our AI pipeline
                and stored securely. You retain full ownership of your content.
              </p>
              <p>
                <strong className="text-foreground">Usage Data:</strong> We
                collect anonymous usage analytics to improve our service,
                including page views and feature usage.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              2. How We Use Your Data
            </h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                Your data is used solely to provide the AccessLecture service:
                generating captions, transcripts, and accessibility scores. We
                do not sell your data to third parties. Uploaded lecture content
                is processed through Google Gemini AI and is subject to
                Google&apos;s data processing terms.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Storage</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                Your data is stored securely using Supabase (PostgreSQL +
                cloud storage) with row-level security policies. All data is
                encrypted in transit (TLS) and at rest. You can delete your
                account and all associated data at any time from your profile
                settings.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Your Rights</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                You have the right to access, correct, or delete your personal
                data. You may export your data at any time. To exercise these
                rights, contact us at{" "}
                <a
                  href="mailto:privacy@accesslecture.com"
                  className="text-primary hover:underline"
                >
                  privacy@accesslecture.com
                </a>
                .
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Contact</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                For privacy-related questions, email{" "}
                <a
                  href="mailto:privacy@accesslecture.com"
                  className="text-primary hover:underline"
                >
                  privacy@accesslecture.com
                </a>
                .
              </p>
            </div>
          </section>
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
