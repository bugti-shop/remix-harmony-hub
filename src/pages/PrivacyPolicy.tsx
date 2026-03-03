import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 rounded-lg hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Privacy Policy</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8 pb-24">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Privacy Policy</h2>
          <p className="text-muted-foreground text-sm">Last updated: February 21, 2026</p>
          <a
            href="https://docs.google.com/document/d/1YY5k6mXOKJtiZjEb9ws6Aq7UQbStGy-I/edit?usp=drivesdk&ouid=105643538765333343845&rtpof=true&sd=true"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-primary underline"
          >
            View hosted Privacy Policy ↗
          </a>
        </div>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">1. Introduction</h3>
          <p className="text-muted-foreground leading-relaxed">
            Welcome to Npd ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "Service").
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By using the Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">2. Information We Collect</h3>
          <h4 className="font-medium">2.1 Information You Provide</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Account information (name, email address) when you create an account</li>
            <li>Notes, tasks, and other content you create within the app</li>
            <li>Preferences and settings you configure</li>
            <li>Feedback, support requests, and correspondence you send to us</li>
            <li>Payment information when you subscribe to premium features (processed by third-party payment providers)</li>
          </ul>

          <h4 className="font-medium mt-4">2.2 Information Collected Automatically</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Device information (device type, operating system, unique device identifiers)</li>
            <li>Usage data (features used, interaction patterns, crash reports)</li>
            <li>Log data (access times, pages viewed, app performance data)</li>
          </ul>

          <h4 className="font-medium mt-4">2.3 Information from Third Parties</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>Google account information if you use Google Sign-In</li>
            <li>Google Drive data if you enable cloud sync</li>
            <li>Calendar data if you enable system calendar synchronization</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">3. How We Use Your Information</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li>To provide, maintain, and improve the Service</li>
            <li>To personalize your experience and deliver relevant content</li>
            <li>To process transactions and manage subscriptions</li>
            <li>To send notifications, reminders, and alerts you've configured</li>
            <li>To sync your data across devices when you enable cloud sync</li>
            <li>To provide customer support and respond to your requests</li>
            <li>To monitor usage patterns and improve app performance</li>
            <li>To detect, prevent, and address technical issues and security threats</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">4. Data Storage and Security</h3>
          <p className="text-muted-foreground leading-relaxed">
            Your notes, tasks, and personal data are primarily stored locally on your device using secure storage mechanisms. When you enable cloud sync via Google Drive, your data is encrypted during transit and stored according to Google's security standards.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We implement appropriate technical and organizational security measures to protect your personal information, including encryption, secure access controls, and regular security assessments. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">5. Data Sharing and Disclosure</h3>
          <p className="text-muted-foreground leading-relaxed">We do not sell your personal information. We may share your information in the following circumstances:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>Service Providers:</strong> Third-party services that help us operate the app (e.g., cloud storage, payment processing)</li>
            <li><strong>Legal Requirements:</strong> When required by law, subpoena, or government request</li>
            <li><strong>Safety:</strong> To protect the rights, property, or safety of our users or the public</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            <li><strong>With Your Consent:</strong> When you explicitly authorize data sharing</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">6. Third-Party Services</h3>
          <p className="text-muted-foreground leading-relaxed">Our app integrates with the following third-party services:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>Google Drive:</strong> For cloud synchronization of your data</li>
            <li><strong>Google Sign-In:</strong> For authentication</li>
            <li><strong>RevenueCat:</strong> For subscription and payment management</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Each third-party service has its own privacy policy governing the use of your information. We encourage you to review their respective privacy policies.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">7. Your Rights and Choices</h3>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
            <li><strong>Access:</strong> You can access and review your personal data within the app at any time</li>
            <li><strong>Correction:</strong> You can update or correct your information through the app settings</li>
            <li><strong>Deletion:</strong> You can delete your account and associated data by contacting us</li>
            <li><strong>Export:</strong> You can export your notes and tasks in various formats (PDF, DOCX, Markdown)</li>
            <li><strong>Opt-Out:</strong> You can disable notifications and cloud sync at any time</li>
            <li><strong>Data Portability:</strong> You can request a copy of your data in a machine-readable format</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">8. Children's Privacy</h3>
          <p className="text-muted-foreground leading-relaxed">
            Our Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal data from a child under 13, we will take steps to delete that information promptly.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">9. Data Retention</h3>
          <p className="text-muted-foreground leading-relaxed">
            We retain your personal information for as long as your account is active or as needed to provide you with the Service. Local data remains on your device until you delete the app or clear app data. Cloud-synced data is retained until you delete it or deactivate cloud sync. We may retain certain information as required by law or for legitimate business purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">10. International Data Transfers</h3>
          <p className="text-muted-foreground leading-relaxed">
            Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">11. Changes to This Policy</h3>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy within the app and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-semibold">12. Contact Us</h3>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="text-muted-foreground">
            Email: bugtishop@gmail.com
          </p>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
