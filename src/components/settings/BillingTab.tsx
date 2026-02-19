import { CreditCard, Receipt, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function BillingTab() {
  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Payment Methods</CardTitle>
              <CardDescription>Manage your payment methods for subscriptions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
            <CreditCard className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No payment methods on file. Add a payment method when subscriptions become available.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Billing History</CardTitle>
              <CardDescription>View your past invoices and receipts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No billing history yet. Your invoices will appear here once you subscribe to a plan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
