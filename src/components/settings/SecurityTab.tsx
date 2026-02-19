/**
 * Security Tab - Active Sessions & Danger Zone
 * 
 * Password and MFA settings have been moved to AccountTab.
 */

import { Smartphone, LogOut, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function SecurityTab() {
  const { signOut } = useAuth();

  const handleSignOutAllDevices = async () => {
    await signOut();
    toast.success('Signed out from all devices');
  };

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card className="border-border bg-card">
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

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <CardTitle className="text-lg font-semibold text-destructive">Danger Zone</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
