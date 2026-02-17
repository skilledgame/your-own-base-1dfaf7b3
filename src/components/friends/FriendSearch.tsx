import { useState } from 'react';
import { Search, UserPlus, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SearchResult {
  user_id: string;
  display_name: string;
  chess_elo: number;
  clan_name: string | null;
}

interface FriendSearchProps {
  onSendRequest: (userId: string) => Promise<void>;
  existingFriendIds: string[];
}

export function FriendSearch({ onSendRequest, existingFriendIds }: FriendSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 2) return;

    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('search_users', { query: query.trim() });
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await onSendRequest(userId);
      setSentRequests(prev => new Set(prev).add(userId));
      toast.success('Friend request sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send request');
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
            onKeyDown={handleKeyDown}
            placeholder="Search by display name..."
            className="pl-9 bg-muted border-0"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching || query.trim().length < 2}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {results.length === 0 && !searching && query.length >= 2 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No players found</p>
        </div>
      )}

      <div className="space-y-2">
        {results.map((user) => {
          const isFriend = existingFriendIds.includes(user.user_id);
          const requestSent = sentRequests.has(user.user_id);

          return (
            <Card key={user.user_id} className="bg-card border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {user.display_name?.[0]?.toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm truncate">
                      {user.display_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.chess_elo} ELO</span>
                  </div>
                  {user.clan_name && (
                    <span className="text-[10px] text-muted-foreground">{user.clan_name}</span>
                  )}
                </div>

                {isFriend ? (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Friends
                  </span>
                ) : requestSent ? (
                  <span className="text-xs text-muted-foreground">Sent</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendRequest(user.user_id)}
                    className="shrink-0"
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
