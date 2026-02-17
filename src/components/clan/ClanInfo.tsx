import { Shield, Users, Trophy, LogOut, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Clan } from '@/stores/clanStore';

interface ClanInfoProps {
  clan: Clan;
  isLeader: boolean;
  onLeave: () => void;
  leaving: boolean;
}

export function ClanInfo({ clan, isLeader, onLeave, leaving }: ClanInfoProps) {
  return (
    <Card className="bg-gradient-to-br from-card to-primary/5 border-border overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-12 translate-x-12" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{clan.name}</h2>
              {isLeader && (
                <Badge variant="secondary" className="text-[10px]">Leader</Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
            onClick={onLeave}
            disabled={leaving}
          >
            {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 mr-1" />}
            Leave
          </Button>
        </div>

        {clan.description && (
          <p className="text-sm text-muted-foreground mb-4">{clan.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
            <Users className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-sm font-bold text-foreground">{clan.member_count}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Trophies</p>
              <p className="text-sm font-bold text-foreground">{clan.total_trophies.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
