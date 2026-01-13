import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import skilledLogo from "@/assets/skilled-logo.png";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="cursor-pointer">
            <img src={skilledLogo} alt="Skilled" className="h-8 w-auto" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 5, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Skilled ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your personal information when you use 
              our skill-based gaming platform ("Platform"). Please read this policy carefully to understand 
              our practices regarding your personal data.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium mb-3 text-foreground">2.1 Information You Provide</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information you voluntarily provide when using our Platform:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-6">
              <li><strong className="text-foreground">Account Information:</strong> Name, email address, username, and password</li>
              <li><strong className="text-foreground">Profile Information:</strong> Display name and gaming preferences</li>
              <li><strong className="text-foreground">Payment Information:</strong> Cryptocurrency wallet addresses and transaction details for deposits</li>
              <li><strong className="text-foreground">Communications:</strong> Messages you send to us for support or feedback</li>
            </ul>

            <h3 className="text-xl font-medium mb-3 text-foreground">2.2 Information Collected Automatically</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you access our Platform, we automatically collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong className="text-foreground">Usage Data:</strong> Pages visited, features used, game history, and session duration</li>
              <li><strong className="text-foreground">IP Address:</strong> Your internet protocol address for security and fraud prevention</li>
              <li><strong className="text-foreground">Log Data:</strong> Access times, referring URLs, and error logs</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the collected information for the following purposes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Service Provision:</strong> To create and manage your account, process transactions, and provide gameplay features</li>
              <li><strong className="text-foreground">Security:</strong> To detect and prevent fraud, cheating, and unauthorized access</li>
              <li><strong className="text-foreground">Communication:</strong> To send account updates, security alerts, and platform announcements</li>
              <li><strong className="text-foreground">Improvement:</strong> To analyze usage patterns and improve our Platform and services</li>
              <li><strong className="text-foreground">Legal Compliance:</strong> To comply with applicable laws and legal processes</li>
              <li><strong className="text-foreground">Customer Support:</strong> To respond to your inquiries and resolve issues</li>
            </ul>
          </section>

          {/* Cookies and Tracking */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies and similar tracking technologies to enhance your experience:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-4">
              <li><strong className="text-foreground">Essential Cookies:</strong> Required for the Platform to function properly (authentication, security)</li>
              <li><strong className="text-foreground">Analytics Cookies:</strong> Help us understand how users interact with our Platform</li>
              <li><strong className="text-foreground">Preference Cookies:</strong> Remember your settings and preferences (e.g., dark mode)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              You can manage cookie preferences through your browser settings. However, disabling certain 
              cookies may limit your ability to use some Platform features.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We work with trusted third-party service providers who may have access to your information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>
                <strong className="text-foreground">NOWPayments:</strong> Our cryptocurrency payment processor. When you make a deposit, 
                payment information is processed according to their privacy policy.
              </li>
              <li>
                <strong className="text-foreground">Google OAuth:</strong> If you sign in with Google, we receive basic profile 
                information (name, email, profile picture) according to Google's privacy policy.
              </li>
              <li>
                <strong className="text-foreground">Hosting and Infrastructure:</strong> Our platform is hosted on secure cloud 
                infrastructure that may process your data.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              These third parties are contractually obligated to protect your information and may only use 
              it for the specific services they provide to us.
            </p>
          </section>

          {/* Data Sharing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">With Your Consent:</strong> When you explicitly authorize us to share your information</li>
              <li><strong className="text-foreground">Service Providers:</strong> With trusted partners who assist in operating our Platform</li>
              <li><strong className="text-foreground">Legal Requirements:</strong> When required by law, regulation, or legal process</li>
              <li><strong className="text-foreground">Safety and Security:</strong> To protect the rights, safety, and property of Skilled, our users, or others</li>
              <li><strong className="text-foreground">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          {/* Data Security */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement robust security measures to protect your personal information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication systems</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls limiting employee access to personal data</li>
              <li>Incident response procedures for potential breaches</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              While we strive to protect your information, no system is completely secure. You are responsible 
              for maintaining the confidentiality of your account credentials.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide 
              services. We may retain certain information as required by law, for legitimate business purposes, 
              or to resolve disputes. When information is no longer needed, we securely delete or anonymize it.
            </p>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-foreground">Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong className="text-foreground">Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong className="text-foreground">Deletion:</strong> Request deletion of your personal data, subject to legal requirements</li>
              <li><strong className="text-foreground">Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong className="text-foreground">Objection:</strong> Object to certain processing of your personal data</li>
              <li><strong className="text-foreground">Restriction:</strong> Request restriction of processing in certain circumstances</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us using the information provided below. We will respond 
              to your request within the timeframe required by applicable law.
            </p>
          </section>

          {/* GDPR Compliance */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. GDPR and International Privacy Laws</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              For users in the European Economic Area (EEA), United Kingdom, and other jurisdictions with 
              similar privacy laws, we comply with the General Data Protection Regulation (GDPR) and other 
              applicable privacy regulations.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Legal Basis for Processing:</strong> We process your data based on:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Contractual necessity (to provide our services)</li>
              <li>Legitimate interests (security, fraud prevention, service improvement)</li>
              <li>Legal obligations (compliance with laws)</li>
              <li>Your consent (where applicable)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You have the right to lodge a complaint with a supervisory authority if you believe your rights 
              have been violated.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Platform is not intended for users under 18 years of age. We do not knowingly collect 
              personal information from children. If we become aware that we have collected data from a 
              child without parental consent, we will take steps to delete that information promptly.
            </p>
          </section>

          {/* Changes to Policy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or 
              applicable laws. When we make material changes, we will notify you by updating the "Last updated" 
              date and, where appropriate, provide additional notice (such as an email notification). We 
              encourage you to review this policy periodically.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data 
              practices, please contact us:
            </p>
            <div className="mt-4 p-4 bg-secondary rounded-lg">
              <p className="text-foreground font-medium">Skilled — Privacy Inquiries</p>
              <p className="text-muted-foreground">Email: privacy@skilled.gg</p>
              <p className="text-muted-foreground mt-2">
                For data subject access requests or other privacy-related inquiries, please include 
                "Privacy Request" in your email subject line.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="cursor-pointer">
            <img src={skilledLogo} alt="Skilled" className="h-7 w-auto opacity-70" />
          </Link>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;