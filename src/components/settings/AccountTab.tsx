/**
 * Account Tab - Email, Phone, Display Name settings
 */

import { useState, useEffect } from 'react';
import { Mail, Phone, User, Check, Loader2, Edit2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function AccountTab() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user?.id) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update display name');
    } else {
      toast.success('Display name updated!');
      setIsEditingName(false);
      fetchProfile();
    }
    setSaving(false);
  };

  const emailVerified = user?.email_confirmed_at != null;

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">Email</CardTitle>
            {emailVerified ? (
              <Badge className="bg-accent/20 text-accent border-accent/30 hover:bg-accent/20">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                Unverified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Email Address</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={user?.email || ''}
                  disabled
                  className="pl-10 bg-muted/50 border-border text-foreground"
                />
              </div>
            </div>
          </div>
          
          {!emailVerified && (
            <div className="flex justify-end">
              <Button 
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => toast.info('Verification email sent!')}
              >
                Confirm Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phone Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Phone Number</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Mobile Number</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Add your phone number"
                  disabled
                  className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <Button variant="outline" className="border-border hover:bg-muted">
                Add
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Add a phone number for enhanced account security and faster recovery.
          </p>
        </CardContent>
      </Card>

      {/* Display Name Section */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Display Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Username</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isEditingName}
                  placeholder="Enter display name"
                  className={`pl-10 border-border ${isEditingName ? 'bg-background' : 'bg-muted/50'} text-foreground`}
                />
              </div>
              {isEditingName ? (
                <Button 
                  onClick={handleSaveDisplayName}
                  disabled={saving}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditingName(true)}
                  className="border-border hover:bg-muted"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This is how other players will see you in games and leaderboards.
          </p>
        </CardContent>
      </Card>

      {/* Account Created */}
      <Card className="border-border bg-card">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Member since</span>
            <span className="text-foreground font-medium">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }) : 'Unknown'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
