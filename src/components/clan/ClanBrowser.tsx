import { useState } from 'react';
import { Search, Users, Trophy, ArrowRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import type { Clan } from '@/stores/clanStore';

interface ClanBrowserProps {
  onSearch: (query: string) => Promise<Clan[]>;
  onJoin: (clanId: string) => Promise<void>;
}

export function ClanBrowser({ onSearch, onJoin }: ClanBrowserProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Clan[]>([]);
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const clans = await onSearch(query.trim());
      setResults(clans);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleJoin = async (clanId: string) => {
    setJoining(clanId);
    try {
      await onJoin(clanId);
      toast.success('Joined clan!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join clan');
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search clans..."
            className="pl-9 bg-muted border-0"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {results.length === 0 && !searching && query.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No clans found</p>
        </div>
      )}

      <div className="space-y-2">
        {results.map((clan) => (
          <Card key={clan.id} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {clan.name[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-foreground text-sm truncate block">{clan.name}</span>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {clan.member_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> {clan.total_trophies.toLocaleString()}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleJoin(clan.id)}
                disabled={joining === clan.id}
                className="shrink-0"
              >
                {joining === clan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Join <ArrowRight className="w-3 h-3 ml-1" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
