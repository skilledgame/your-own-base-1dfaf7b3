import { useState } from 'react';
import {
  Coins,
  Crown,
  Sparkles,
  Zap,
  Star,
  Check,
  AlertTriangle,
  Palette,
  UserCircle,
  Rocket,
  Shield,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price: number;
  coins: number;
  icon: React.ElementType;
  color: string;        // tailwind accent color class
  gradient: string;     // card header gradient
  glowClass: string;    // subtle glow on hover
  badge?: string;       // optional badge text
  perks: string[];
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 17.99,
    coins: 2000,
    icon: Zap,
    color: 'text-blue-400',
    gradient: 'from-blue-600/80 to-indigo-700/80',
    glowClass: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]',
    perks: [
      '2,000 Skilled Coins per month',
      'Custom avatar — changes monthly',
      'Custom name color — changes monthly',
      'Support the platform',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 34.99,
    coins: 4000,
    icon: Crown,
    color: 'text-purple-400',
    gradient: 'from-purple-600/80 to-fuchsia-700/80',
    glowClass: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
    badge: 'Popular',
    perks: [
      '4,000 Skilled Coins per month',
      'Exclusive custom avatar — changes monthly',
      'Exclusive custom name color — changes monthly',
      'Priority support',
      'Pro badge on profile',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 59.99,
    coins: 7000,
    icon: Rocket,
    color: 'text-amber-400',
    gradient: 'from-amber-500/80 to-orange-600/80',
    glowClass: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    badge: 'Best Value',
    perks: [
      '7,000 Skilled Coins per month',
      'Premium custom avatar — changes monthly',
      'Premium custom name color — changes monthly',
      'Priority support',
      'Elite badge on profile',
      'Early access to new features',
    ],
  },
];

export function SubscriptionsTab() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pb-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Choose Your Plan</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Subscribe monthly to receive Skilled Coins, a custom avatar, and a unique name color that refreshes every month.
        </p>
      </div>

      {/* Crypto withdrawal warning */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-300">Crypto withdrawals only</p>
          <p className="text-xs text-amber-200/70 mt-0.5">
            Skilled Coins can only be withdrawn as cryptocurrency. Make sure you have a compatible crypto wallet before subscribing.
          </p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.id;

          return (
            <Card
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={cn(
                'relative cursor-pointer transition-all duration-300 border bg-card overflow-hidden group',
                plan.glowClass,
                isSelected
                  ? 'border-primary ring-2 ring-primary/30 scale-[1.02]'
                  : 'border-border hover:border-border/80 hover:scale-[1.01]',
              )}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border-0',
                      plan.id === 'pro'
                        ? 'bg-purple-500 text-white'
                        : 'bg-amber-500 text-black',
                    )}
                  >
                    {plan.badge}
                  </Badge>
                </div>
              )}

              {/* Gradient header stripe */}
              <div className={cn('h-1.5 w-full bg-gradient-to-r', plan.gradient)} />

              <CardContent className="p-5 space-y-5">
                {/* Plan icon + name */}
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br',
                      plan.gradient,
                    )}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">Monthly subscription</p>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                {/* Coins highlight */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
                  <Coins className="w-5 h-5 text-yellow-500 shrink-0" />
                  <span className="font-semibold text-sm">
                    <span className={plan.color}>{plan.coins.toLocaleString()}</span>{' '}
                    <span className="text-muted-foreground font-normal">Skilled Coins</span>
                  </span>
                </div>

                {/* Monthly avatar + color highlight */}
                <div className="flex gap-2">
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/30 border border-border/50 px-2.5 py-1.5 flex-1">
                    <UserCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      Monthly avatar
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-muted/30 border border-border/50 px-2.5 py-1.5 flex-1">
                    <Palette className="w-4 h-4 text-pink-400 shrink-0" />
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      Monthly color
                    </span>
                  </div>
                </div>

                {/* Perks list */}
                <ul className="space-y-2">
                  {plan.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.color)} />
                      <span className="text-muted-foreground">{perk}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                <Button
                  className={cn(
                    'w-full font-semibold transition-all duration-200',
                    isSelected
                      ? 'bg-primary hover:bg-primary/90'
                      : 'bg-muted/60 hover:bg-muted text-foreground border border-border',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan(plan.id);
                  }}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Selected
                    </>
                  ) : (
                    'Select Plan'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Subscribe button (disabled placeholder) */}
      {selectedPlan && (
        <div className="flex flex-col items-center gap-3 pt-2 animate-in fade-in-0 slide-in-from-bottom-3 duration-300">
          <Button
            size="lg"
            disabled
            className="w-full sm:w-auto px-10 py-6 text-base font-bold bg-gradient-to-r from-primary to-purple-600 opacity-70 cursor-not-allowed"
          >
            <Shield className="w-5 h-5 mr-2" />
            Subscribe with Stripe — Coming Soon
          </Button>
          <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Payments will be securely processed via Stripe
          </p>
        </div>
      )}

      {/* Bottom info */}
      <div className="rounded-lg border border-border bg-card/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">How it works</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1.5 ml-6 list-disc">
          <li>Skilled Coins are credited to your account at the start of each billing cycle.</li>
          <li>Your exclusive avatar and name color automatically refresh every month.</li>
          <li>Credits can only be withdrawn as cryptocurrency to your personal wallet.</li>
          <li>You can cancel your subscription at any time — no lock-in.</li>
        </ul>
      </div>
    </div>
  );
}
