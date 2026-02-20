/**
 * API Tab - API Keys for developers
 */

import { useState } from 'react';
import { Key, Copy, Eye, EyeOff, RefreshCw, Code, ExternalLink, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function APITab() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey] = useState('sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const maskedKey = apiKey.slice(0, 7) + '•'.repeat(24) + apiKey.slice(-4);

  return (
    <div className="space-y-6">
      {/* API Overview */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <Code className="w-6 h-6 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Skilled API</CardTitle>
              <CardDescription>Build integrations with our platform</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Access your game data, stats, and integrate Skilled into your own applications.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="border-border hover:bg-muted">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Documentation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">API Key</CardTitle>
                <CardDescription>Your secret API key for authentication</CardDescription>
              </div>
            </div>
            <Badge className="bg-accent/20 text-accent border-accent/30">
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Secret Key</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  value={showApiKey ? apiKey : maskedKey}
                  readOnly
                  className="pr-20 bg-muted/50 border-border font-mono text-sm"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(apiKey)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Shield className="w-5 h-5 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-500/90">
              Keep your API key secret. Never expose it in client-side code or public repositories.
            </p>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" className="border-border hover:bg-muted">
              <RefreshCw className="w-4 h-4 mr-2" />
              Regenerate Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">API Usage</CardTitle>
          <CardDescription>Your current billing period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">Requests Today</p>
            </div>
            <div className="p-4 rounded-md bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">This Month</p>
            </div>
            <div className="p-4 rounded-md bg-accent/10 border border-accent/20 text-center md:col-span-1 col-span-2">
              <p className="text-2xl font-bold text-accent">∞</p>
              <p className="text-xs text-muted-foreground mt-1">Rate Limit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Webhooks</CardTitle>
              <CardDescription>Receive real-time event notifications</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              Coming Soon
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-8 rounded-md border border-dashed border-border text-center">
            <Code className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Configure webhooks to receive game events, match results, and more.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
