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
    question: "Can I play for free?",
    answer:
      "Yes! Every new player gets 3 free plays for each game. After that, you can continue practicing in free mode or compete for Skilled Coins against other players.",
  },
  {
    question: "How are winners decided?",
    answer:
      "Winners are determined by the rules of each game. In Chess, checkmate or resignation decides the winner. In arcade games, the higher score wins. There are no random elements or house edges.",
  },
  {
    question: "What games are skill-based?",
    answer:
      "All games on Skilled are skill-based. This includes classic strategy games like Chess, Checkers, and Go, as well as arcade games like Snake and Tetris where reflexes and decision-making determine success.",
  },
  {
    question: "Is crypto required to play?",
    answer:
      "No, crypto is not required to play. You can enjoy free plays without depositing. However, to compete for prizes and earn Skilled Coins, you'll need to deposit using one of our supported cryptocurrencies.",
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
