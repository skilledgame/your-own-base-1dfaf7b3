import { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface CreateClanFormProps {
  onCreate: (name: string, description?: string) => Promise<string>;
}

export function CreateClanForm({ onCreate }: CreateClanFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 3) {
      toast.error('Clan name must be at least 3 characters');
      return;
    }

    setLoading(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined);
      toast.success(`Clan "${name.trim()}" created!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create clan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Create a Clan</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Clan Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter clan name..."
              maxLength={30}
              className="bg-muted border-0"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your clan..."
              maxLength={200}
              className="bg-muted border-0"
            />
          </div>
          <Button type="submit" disabled={loading || name.trim().length < 3} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
            Create Clan
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
