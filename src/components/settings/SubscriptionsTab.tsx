import { CreditCard, Crown, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SubscriptionsTab() {
  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">Current Plan</CardTitle>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Free
                </Badge>
              </div>
              <CardDescription>Manage your subscription plan</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Subscription plans are coming soon. Stay tuned for premium features!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans Placeholder */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Available Plans</CardTitle>
          <CardDescription>Choose the plan that works best for you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Free Plan */}
            <div className="rounded-md border-2 border-accent/50 bg-accent/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Free</h3>
                <Badge className="bg-accent/20 text-accent border-accent/30 hover:bg-accent/20">Current</Badge>
              </div>
              <p className="text-2xl font-bold mb-1">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mb-4">Basic access to all games</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Access to all games
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Standard support
                </li>
              </ul>
            </div>

            {/* Premium Plan */}
            <div className="rounded-md border border-border bg-muted/10 p-5 opacity-60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Premium</h3>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">Coming Soon</Badge>
              </div>
              <p className="text-2xl font-bold mb-1">TBD<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mb-4">Enhanced features & perks</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  Everything in Free
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  Exclusive avatars & badges
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  Priority support
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
