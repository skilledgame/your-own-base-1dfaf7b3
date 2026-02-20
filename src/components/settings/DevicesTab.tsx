/**
 * Devices Tab - Active Sessions
 */

import { Smartphone, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getRankFromTotalWagered } from '@/lib/rankSystem';
import { getRankBorderClass } from './ProfileTab';

export function DevicesTab() {
  const { signOut } = useAuth();
  const { totalWageredSc } = useProfile();
  const rankInfo = getRankFromTotalWagered(totalWageredSc);

  const handleSignOutAllDevices = async () => {
    await signOut();
    toast.success('Signed out from all devices');
  };

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card className={cn('border bg-card', getRankBorderClass(rankInfo.tierName))}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Active Sessions</CardTitle>
          <CardDescription>Manage your logged-in devices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-sm">Current Session</p>
                  <p className="text-xs text-muted-foreground">This device · Active now</p>
                </div>
              </div>
              <Badge className="bg-accent/20 text-accent border-0">Active</Badge>
            </div>
          </div>

          <Separator className="bg-border" />

          <Button
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOutAllDevices}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out All Devices
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
