import { Footer } from "@/components/footer";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-[#ffffff]">
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-medium tracking-tight text-[#ffffff] mb-6">
            Privacy Policy
          </h1>
          <p className="text-[#71717A] text-sm leading-relaxed mb-6">
            Last updated: 31 October 2026
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            1. Introduction
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            SourceSignal (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is committed to
            protecting your privacy. This Privacy Policy explains how we collect,
            use, and protect your personal information when you use our website and
            services.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            2. Information We Collect
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We may collect personal information that you provide directly to us,
            such as your name, email address, organisation name, and billing
            information when you create an account or purchase a subscription.
          </p>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We also automatically collect certain information about your use of the
            Service, including IP addresses, browser type, pages visited, and
            interaction data, through cookies and similar tracking technologies as
            described in our Cookie Banner.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            3. How We Use Your Information
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside text-[#71717A] text-sm mt-2 mb-4">
            <li>Provide, operate, and maintain our Service</li>
            <li>Improve, personalise, and expand our Service</li>
            <li>Communicate with you, including for customer service</li>
            <li>Send you marketing and promotional communications</li>
            <li>Prevent, detect, and investigate potentially illegal activities</li>
          </ul>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            4. Sharing Your Information
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We do not sell or rent your personal information to third parties. We
            may share your information with service providers who perform services
            on our behalf, such as payment processing (Stripe), email delivery, and
            data hosting. These service providers are permitted to use your data
            only as necessary to perform services for us.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            5. Data Storage and Security
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            Your personal information is stored securely in our database. We
            implement appropriate technical and organisational measures to protect
            your personal information against unauthorised access, alteration,
            disclosure, or destruction, including encryption of data in transit and
            at rest, access controls, and regular security reviews.
          </p>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            No method of transmission over the internet or method of electronic
            storage is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            6. Data Retention
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We retain your personal information for as long as necessary to fulfil
            the purposes for which it was collected, including for the purposes of
            enforcing our agreements, resolving disputes, and complying with legal
            obligations. When you request deletion, we will delete your personal
            data unless we are required to retain it by law.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            7. Your Rights (UK GDPR)
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-[#71717A] text-sm mt-2 mb-4">
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate or incomplete personal information</li>
            <li>Delete your personal information (the &ldquo;right to be
            forgotten&rdquo;)</li>
            <li>Object to or restrict our processing of your data</li>
            <li>Receive your personal information in a portable format</li>
            <li>Withdraw consent at any time, where processing is based on consent</li>
          </ul>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            To exercise these rights, or to request deletion of your account and
            all associated data, please contact us at privacy@sourcesignal.example.
            We will respond to requests within one month.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            8. Cookies and Tracking Technologies
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We use cookies and similar tracking technologies to track activity on
            our Service and hold certain information. Cookies are files with a
            small amount of data that may include an anonymous unique identifier.
            You may refuse to accept cookies by activating the setting on your
            browser that allows you to refuse the setting of cookies. However, if
            you select this setting you may be unable to access certain parts of
            our Service. For more information, see our Cookie Banner on the
            website.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            9. Security
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            We implement appropriate technical and organisational measures to
            protect your personal information against unauthorised access,
            alteration, disclosure, or destruction. These measures include
            encryption of data in transit using TLS, access controls, and regular
            security reviews. However, no method of transmission over the internet
            is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-lg font-medium text-[#ffffff] mt-6 mb-3">
            10. International Data Transfers
          </h2>
          <p className="text-[#71717A] text-sm leading-relaxed mb-4">
            Your personal information may be transferred to, stored, and processed
            in countries other than the United Kingdom, including the United States
            (e.g., via Stripe for payment processing). Where we transfer your data
            outside the UK, we ensure appropriate safeguards are in place, such as
            standard contractual clauses or reliance on adequacy decisions.
          </p>

          <p className="text-[#71717A] text-sm mt-8">
            Contact us at privacy@sourcesignal.example with any questions.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}