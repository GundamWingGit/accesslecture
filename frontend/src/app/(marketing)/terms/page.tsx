import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "AccessLecture terms of service — the rules for using our platform.",
};

export default function TermsPage() {
  return (
    <div className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          Last updated: March 2026
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                By creating an account or using AccessLecture, you agree to
                these Terms of Service. If you do not agree, do not use the
                service.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              2. Service Description
            </h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                AccessLecture provides AI-powered lecture accessibility tools
                including captioning, transcription, accessibility scoring, and
                file export. The service is provided &quot;as is&quot; and we
                continuously improve accuracy and features.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Your Content</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                You retain all ownership rights to content you upload. By
                uploading, you grant AccessLecture a limited license to process
                your content through our AI pipeline solely for the purpose of
                providing the service. We do not use your content for training
                AI models.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                You agree not to: upload content you do not have rights to;
                attempt to reverse-engineer the service; use the service for
                unlawful purposes; or abuse the platform in any way that
                degrades the experience for other users.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              5. Billing and Cancellation
            </h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                Free accounts have usage limits as described on the Pricing
                page. Paid subscriptions are billed monthly through Stripe. You
                can cancel anytime from your account settings — your access
                continues until the end of the billing period.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              6. Limitation of Liability
            </h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                AccessLecture is provided &quot;as is&quot; without warranty.
                AI-generated captions should be reviewed before use in
                compliance-critical contexts. We are not liable for any
                damages arising from the use of our service.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
            <div className="glass rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
              <p>
                Questions about these terms? Email{" "}
                <a
                  href="mailto:legal@accesslecture.com"
                  className="text-primary hover:underline"
                >
                  legal@accesslecture.com
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
