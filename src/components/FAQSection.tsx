import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqItems = [
  {
    question: "Is Skilled gambling?",
    answer:
      "No. Skilled is a skill-based gaming platform. Unlike gambling, outcomes are determined entirely by player skill and strategy, not luck or chance. Every game relies on your abilities, practice, and decision-making.",
  },
  {
    question: "How do Skilled Coins work?",
    answer:
      "Skilled Coins are in-platform tokens used to participate in games, matches, and tournaments on Skilled. Players can acquire Skilled Coins by purchasing them on the platform or through other available methods, and may also sell or withdraw them where supported. Coins are used to access skill-based competitions and features, but they do not influence game outcomes, which are determined entirely by player skill and performance. Skilled Coins are used within the Skilled ecosystem and are designed to support competitive play, progression, and rewards.",
  },
  {
    question: "How is Skilled different from gambling sites?",
    answer:
      "Skilled is fundamentally different from gambling sites because all outcomes are determined solely by player skill, strategy, and decision-making—not luck or chance. Unlike gambling, where random chance and betting against the house or other players are central, Skilled offers games where success depends entirely on your abilities and performance. There is no house edge or games of chance involved. Skilled focuses on competitive, fair play—much like esports or traditional skill-based games such as chess—ensuring that the best player wins based on merit alone.",
  },
  {
    question: "How do you prevent cheating or abuse?",
    answer:
      "At Skilled, maintaining a fair and competitive environment is our top priority. We use a combination of automated anti-cheat systems, real-time monitoring, and player reporting to detect and prevent cheating or abusive behavior. Our platform continuously analyzes gameplay patterns to identify suspicious activity, and any confirmed violations result in penalties, including warnings, temporary suspensions, or permanent bans. We also regularly update our security measures to stay ahead of new threats, ensuring all players can compete on a level playing field based solely on skill.",
  },
  {
    question: "What happens if a player disconnects?",
    answer:
      "If a player disconnects during a game, Skilled’s system will try to reconnect them automatically within a short time. If the player cannot rejoin, the match may be paused briefly or ended according to the specific game’s rules. In many cases, the disconnected player may forfeit the match, and the opponent will be declared the winner based on skill and progress at the time of disconnection. This approach helps keep gameplay fair and ensures a good experience for all players.",
  },
  {
    question: "Can I play against friends?",
    answer:
      "Yes! Skilled lets you challenge your friends to one-on-one matches and compete in tournaments together. You can invite friends directly through the platform and set up games with custom rules. Playing against people you know is a great way to practice, improve your skills, and enjoy competitive fun in a trusted environment.",
  },
];

export const FAQSection = () => {
  return (
    <section id="faq" className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <HelpCircle className="w-6 h-6 text-primary" />
          <h2 className="text-2xl sm:text-3xl font-bold">Still Have Questions?</h2>
        </div>

        {/* Accordion */}
        <Accordion type="single" collapsible className="space-y-3">
          {faqItems.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card border border-border rounded-xl px-5 data-[state=open]:border-primary/50 transition-colors"
            >
              <AccordionTrigger className="text-left font-semibold py-5 hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
