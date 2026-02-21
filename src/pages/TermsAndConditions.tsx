import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import skilledLogo from "@/assets/skilled-logo.png";
import { useSiteContent } from "@/hooks/useSiteContent";

const TermsAndConditions = () => {
  const { data, loading, hasContent } = useSiteContent('terms-and-conditions');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/95 backdrop-blur-sm sticky top-0 z-50">
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
        <h1 className="text-4xl font-bold mb-2">Terms and Conditions</h1>
        <p className="text-muted-foreground mb-8">
          Last updated: {hasContent && data?.updated_at
            ? new Date(data.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'January 5, 2025'}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : hasContent ? (
          <div
            className="prose prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: data!.content }}
          />
        ) : (
        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to Skilled ("Platform", "we", "us", or "our"). Skilled is a skill-based online gaming platform 
              that allows users to compete in games of skill, initially focusing on chess tournaments. By accessing 
              or using our Platform, you agree to be bound by these Terms and Conditions ("Terms"). Please read 
              them carefully before using our services.
            </p>
          </section>

          {/* Platform Description */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Platform Description</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Skilled is a skill-based gaming platform where users compete against each other in games that 
              require skill, strategy, and expertise. Our platform:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Offers competitive games based purely on player skill and ability</li>
              <li>Currently features chess as our primary game offering</li>
              <li>Uses a virtual credit system called "Skilled Coins" for gameplay</li>
              <li>Does not involve gambling, chance-based wagering, or games of luck</li>
              <li>Provides a fair and competitive environment for all players</li>
            </ul>
          </section>

          {/* Skilled Coins */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Skilled Coins and Virtual Credits</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Skilled Coins are virtual credits used within the Platform:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Skilled Coins have no real-world monetary value and cannot be exchanged for cash</li>
              <li>Skilled Coins are non-transferable between user accounts</li>
              <li>Users deposit funds to acquire Skilled Coins at the posted exchange rate</li>
              <li>Skilled Coins are used to participate in competitive matches on the Platform</li>
              <li><strong className="text-foreground">No withdrawal option is available</strong> — deposits are final and non-refundable except as required by law</li>
              <li>Skilled Coins earned through gameplay remain as platform credits only</li>
            </ul>
          </section>

          {/* Skill-Based Competition */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Skill-Based Competition</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We want to be absolutely clear about the nature of our platform:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>All games on Skilled are games of skill, not games of chance</li>
              <li>Game outcomes are determined by player ability, strategy, and decision-making</li>
              <li>No random number generators, dice rolls, or chance mechanics influence game results</li>
              <li>This is not gambling — the outcome depends entirely on player skill</li>
              <li>Players compete directly against each other, and the more skilled player wins</li>
            </ul>
          </section>

          {/* User Eligibility */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. User Eligibility and Accounts</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To use the Platform, you must:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Be at least 18 years of age or the legal age of majority in your jurisdiction</li>
              <li>Have the legal capacity to enter into a binding agreement</li>
              <li>Not be prohibited from using the Platform under applicable laws</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security and confidentiality of your account credentials</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You are responsible for all activities that occur under your account. You must immediately notify 
              us of any unauthorized use of your account or any other security breach.
            </p>
          </section>

          {/* User Conduct */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. User Conduct</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Users agree not to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Use cheating software, bots, or any form of automated play assistance</li>
              <li>Collude with other players to manipulate game outcomes</li>
              <li>Create multiple accounts or share accounts with others</li>
              <li>Exploit bugs, glitches, or vulnerabilities in the Platform</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Engage in any fraudulent or deceptive activities</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Circumvent or attempt to circumvent any security measures</li>
            </ul>
          </section>

          {/* Deposits and Payments */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Deposits, Payments, and Refunds</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Deposits:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mb-4">
              <li>Users may deposit funds using supported payment methods including cryptocurrency</li>
              <li>Deposits are converted to Skilled Coins at the current exchange rate</li>
              <li>Minimum and maximum deposit limits may apply</li>
              <li>All deposits are processed through our secure payment partners</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Refund Policy:</strong>
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>All deposits are final and non-refundable once converted to Skilled Coins</li>
              <li>Refunds may only be issued in cases of technical error or as required by law</li>
              <li>Skilled Coins cannot be withdrawn or converted back to real currency</li>
              <li>Unused Skilled Coins have no expiration date but cannot be cashed out</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content on the Platform, including but not limited to text, graphics, logos, icons, images, 
              audio clips, software, and the compilation thereof, is the exclusive property of Skilled or its 
              licensors and is protected by international copyright, trademark, and other intellectual property 
              laws. You may not copy, reproduce, modify, distribute, or create derivative works without our 
              prior written consent.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>The Platform is provided "as is" without warranties of any kind</li>
              <li>We do not guarantee uninterrupted or error-free service</li>
              <li>We are not liable for any indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed the amount you deposited in the past 12 months</li>
              <li>We are not responsible for losses due to user error, third-party actions, or force majeure</li>
            </ul>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed">
              We make no representations or warranties regarding the Platform's suitability for any purpose. 
              Playing competitive games involves risk, and you acknowledge that you may lose Skilled Coins 
              during gameplay. You accept sole responsibility for your gaming decisions. We do not guarantee 
              that you will win games or earn Skilled Coins.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Termination and Suspension</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We reserve the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Suspend or terminate accounts for violation of these Terms</li>
              <li>Remove or disable access to content that violates our policies</li>
              <li>Refuse service to any user at our sole discretion</li>
              <li>Forfeit Skilled Coins associated with accounts involved in fraud or cheating</li>
              <li>Report illegal activities to appropriate law enforcement authorities</li>
            </ul>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Dispute Resolution</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              In the event of any dispute arising from these Terms or your use of the Platform:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>You agree to first attempt to resolve the dispute through direct communication with us</li>
              <li>If direct resolution fails, disputes shall be resolved through binding arbitration</li>
              <li>Class action lawsuits and class-wide arbitration are waived</li>
              <li>Small claims court remains available for qualifying disputes</li>
            </ul>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of Norway, without 
              regard to its conflict of law provisions. Any legal proceedings arising from or relating to 
              these Terms or your use of the Platform shall be brought exclusively in the courts of Norway, 
              and you consent to the personal jurisdiction of such courts.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">14. Changes to These Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. When we do, we will post the revised Terms on this 
              page and update the "Last updated" date. Your continued use of the Platform after any changes 
              constitutes acceptance of the new Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">15. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms and Conditions, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-secondary rounded-lg">
              <p className="text-foreground font-medium">Skilled</p>
              <p className="text-muted-foreground">Email: legal@skilled.gg</p>
            </div>
          </section>
        </div>
        )}
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

export default TermsAndConditions;