import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Terms & Conditions</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8 pb-24">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Terms of Service</h2>
          <p className="text-muted-foreground text-sm">Last updated: February 16, 2026</p>
        </div>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">1. Acceptance of Terms</h3>
          <p className="text-muted-foreground leading-relaxed">
            By downloading, installing, or using the NotePad application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App. These Terms constitute a legally binding agreement between you and NotePad ("we," "our," or "us").
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">2. Description of Service</h3>
          <p className="text-muted-foreground leading-relaxed">
            NotePad is a productivity application that provides note-taking, task management, calendar integration, reminders, and related organizational tools. The Service includes both free and premium subscription-based features.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">3. User Accounts</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>You may use the App without creating an account for basic functionality</li>
            <li>Creating an account requires providing accurate and complete information</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials</li>
            <li>You are responsible for all activities that occur under your account</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
            <li>You must be at least 13 years old to create an account</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">4. Subscription and Payments</h3>
          <h4 className="font-medium">4.1 Free Features</h4>
          <p className="text-muted-foreground leading-relaxed">
            The App provides core note-taking and task management features at no cost.
          </p>

          <h4 className="font-medium mt-4">4.2 Premium Subscription</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Premium features are available through paid subscription plans</li>
            <li>Subscription fees are billed in advance on a recurring basis (monthly or annually)</li>
            <li>Payments are processed through the Apple App Store or Google Play Store</li>
            <li>Prices are subject to change with reasonable notice</li>
          </ul>

          <h4 className="font-medium mt-4">4.3 Cancellation and Refunds</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>You may cancel your subscription at any time through your device's app store</li>
            <li>Cancellation takes effect at the end of the current billing period</li>
            <li>No refunds will be provided for partial subscription periods</li>
            <li>Refund requests are subject to the policies of the respective app store</li>
          </ul>

          <h4 className="font-medium mt-4">4.4 Free Trials</h4>
          <p className="text-muted-foreground leading-relaxed">
            We may offer free trial periods for premium features. Unless you cancel before the trial ends, your subscription will automatically convert to a paid subscription at the applicable rate.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">5. User Content</h3>
          <h4 className="font-medium">5.1 Ownership</h4>
          <p className="text-muted-foreground leading-relaxed">
            You retain full ownership of all content you create, upload, or store within the App, including notes, tasks, images, audio recordings, and any other materials ("User Content").
          </p>

          <h4 className="font-medium mt-4">5.2 License</h4>
          <p className="text-muted-foreground leading-relaxed">
            By using the App, you grant us a limited, non-exclusive license to process, store, and transmit your User Content solely for the purpose of providing and improving the Service. This license terminates when you delete your content or account.
          </p>

          <h4 className="font-medium mt-4">5.3 Prohibited Content</h4>
          <p className="text-muted-foreground leading-relaxed">You agree not to use the App to store, share, or distribute content that:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Violates any applicable law or regulation</li>
            <li>Infringes on intellectual property rights of others</li>
            <li>Contains malware, viruses, or harmful code</li>
            <li>Is defamatory, obscene, or promotes illegal activities</li>
            <li>Harasses, threatens, or harms others</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">6. Intellectual Property</h3>
          <p className="text-muted-foreground leading-relaxed">
            The App, including its design, features, code, graphics, logos, and all related intellectual property, is owned by NotePad and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the App without our prior written consent.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">7. Acceptable Use</h3>
          <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Use the App for any unlawful purpose</li>
            <li>Attempt to reverse engineer, decompile, or disassemble the App</li>
            <li>Interfere with or disrupt the App's infrastructure or services</li>
            <li>Circumvent any security features or access controls</li>
            <li>Use automated systems to access the App without permission</li>
            <li>Impersonate another person or entity</li>
            <li>Use the App to send spam or unsolicited communications</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">8. Cloud Sync and Data</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Cloud sync is an optional feature that requires a Google account</li>
            <li>We are not responsible for data loss resulting from third-party service failures</li>
            <li>You are responsible for maintaining backups of your important data</li>
            <li>Sync conflicts will be resolved based on the most recent modification timestamp</li>
            <li>We do not guarantee uninterrupted access to cloud sync services</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">9. Third-Party Services</h3>
          <p className="text-muted-foreground leading-relaxed">
            The App integrates with third-party services including Google Drive, Google Sign-In, RevenueCat, and Mapbox. Your use of these services is subject to their respective terms of service and privacy policies. We are not responsible for the practices or content of third-party services.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">10. Disclaimers</h3>
          <p className="text-muted-foreground leading-relaxed">
            THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We do not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components. We do not guarantee the accuracy, completeness, or timeliness of any information provided through the App.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">11. Limitation of Liability</h3>
          <p className="text-muted-foreground leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL NOTEPAD, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Your access to or use of (or inability to access or use) the App</li>
            <li>Any conduct or content of any third party on the App</li>
            <li>Unauthorized access, use, or alteration of your content</li>
            <li>Data loss or corruption, including loss of notes or tasks</li>
            <li>Any bugs, viruses, or other errors in the App</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">12. Indemnification</h3>
          <p className="text-muted-foreground leading-relaxed">
            You agree to indemnify, defend, and hold harmless NotePad and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising out of or in connection with your use of the App, your violation of these Terms, or your violation of any rights of a third party.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">13. Termination</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>You may stop using the App and delete your account at any time</li>
            <li>We may suspend or terminate your access if you violate these Terms</li>
            <li>Upon termination, your right to use the App ceases immediately</li>
            <li>Data stored locally on your device will remain until you uninstall the App</li>
            <li>Provisions that by their nature should survive termination will remain in effect</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">14. Governing Law</h3>
          <p className="text-muted-foreground leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which NotePad operates, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the competent courts of that jurisdiction.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">15. Changes to Terms</h3>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to modify these Terms at any time. We will notify you of material changes by posting updated Terms within the App and updating the "Last updated" date. Your continued use of the App after changes constitutes acceptance of the revised Terms. If you do not agree to the new Terms, you should stop using the App.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">16. Severability</h3>
          <p className="text-muted-foreground leading-relaxed">
            If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">17. Contact Us</h3>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="text-muted-foreground">
            Email: support@notepad.app
          </p>
        </section>
      </main>
    </div>
  );
};

export default TermsAndConditions;
