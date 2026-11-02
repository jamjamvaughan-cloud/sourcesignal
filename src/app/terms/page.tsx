import { Footer } from "@/components/footer";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-[#ffffff]">
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-medium tracking-tight text-[#ffffff] mb-6">
            Terms of Service
          </h1>
          <p className="text-[#71717A] text-sm leading-relaxed mb-6">
            Last updated: 31 October 2026
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            1. Acceptance of Terms
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            By accessing and using SourceSignal (&ldquo;the Service&rdquo;), you agree
            to be bound by these Terms of Service. If you do not agree, you may not
            use the Service. Your use of the Service is also subject to our Privacy
            Policy.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            2. Use of the Service
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            You may use the Service only for lawful purposes and in accordance with
            these Terms. You agree not to use the Service for any purpose that is
            unlawful or prohibited by these Terms. You are solely responsible for
            your use of the Service and for any consequences arising from decisions
            made based on information accessed through SourceSignal.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            3. User Accounts
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            You may be required to register an account with us. You agree to provide
            accurate, current, and complete information during registration and to
            update such information to keep it accurate, current, and complete. You
            are responsible for maintaining the confidentiality of your account
            credentials and for all activities that occur under your account.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            4. Subscription and Billing
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            SourceSignal offers a Free plan and a Pro plan (&pound;99/month).
            Subscriptions are billed monthly in advance via Stripe. All subscription
            fees are non-refundable once a billing cycle has started. You may cancel
            your subscription at any time through your account settings or by
            contacting support; cancellation will take effect at the end of the
            current billing period. We do not provide refunds or credits for partial
            months of service.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            5. As-Is Data Disclaimer
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            SourceSignal aggregates public and multi-source procurement data from
            government portals, transparency registers, and other permitted sources.
            All intelligence, signals, tender alerts, market velocity scores,
            competitive density assessments, and sector momentum indicators are
            provided &ldquo;as-is&rdquo; for informational purposes only.
          </p>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We do not guarantee the accuracy, completeness, timeliness, or
            reliability of any opportunity, signal, or data point presented through
            the Service. SourceSignal does not verify every data point against the
            original source notice, and procurement deadlines, values, buyers, and
            statuses may change without notice.
          </p>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            You acknowledge and agree that SourceSignal shall not be liable if you
            rely on any signal, alert, or data point and consequently miss a tender
            deadline, lose a contract bid, incur costs, or suffer any other loss or
            damage. You are solely responsible for verifying all opportunity
            details directly with the issuing authority before making any business
            decision.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            6. Data and Intellectual Property
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            All content on the SourceSignal platform, including but not limited to
            text, graphics, logos, images, and software, is the property of
            SourceSignal or its licensors and is protected by copyright and other
            intellectual property laws. You may not reproduce, distribute, or
            commercially exploit any content from the Service without our express
            written permission.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            7. Limitation of Liability
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            To the maximum extent permitted by law, SourceSignal shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising out of or relating to your use of the Service,
            including but not limited to loss of profits, revenue, data, or use,
            even if we have been advised of the possibility of such damages. Our
            aggregate liability shall not exceed the amount you have paid to us for
            the Service in the twelve (12) months preceding the claim.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            8. Termination
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            SourceSignal may terminate or suspend your account and access to the
            Service at any time, without notice, for any reason, including breach
            of these Terms. Upon termination, your right to use the Service will
            immediately cease.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            9. Governing Law
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            These Terms shall be governed by and construed in accordance with the
            laws of England and Wales, and you submit to the exclusive jurisdiction
            of the courts of England and Wales.
          </p>

          <p className="text-[#71717A] text-sm mt-8">
            Contact us at legal@sourcesignal.example with any questions.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}