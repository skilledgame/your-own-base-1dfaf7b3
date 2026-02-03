import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Swords, Trophy, Clock, ChevronRight, Gamepad2, 
  RefreshCcw, CheckCircle2, XCircle, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import skilledLogo from '@/assets/skilled-logo.png';
import { formatDistanceToNow } from 'date-fns';

interface Match {
  id: string;
  status: string;
  wager: number;
  created_at: string;
  updated_at: string;
  winner_id: string | null;
  isWhite: boolean;
  opponentName?: string;
}

export default function Compete() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [completedMatches, setCompletedMatches] = useState<Match[]>([]);
  const [isInQueue, setIsInQueue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sideMenuOpen, setSideMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session.user);
      
      // Get player ID
      const { data: playerData } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (playerData && playerData.id) {
        setPlayerId(playerData.id);
        await fetchMatches(playerData.id);
        await checkQueueStatus(playerData.id);
      }
      
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchMatches = async (pId: string) => {
    // Get all games for this player
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`white_player_id.eq.${pId},black_player_id.eq.${pId}`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (games) {
      const matchesWithDetails = await Promise.all(
        games.map(async (game) => {
          const isWhite = game.white_player_id === pId;
          const opponentId = isWhite ? game.black_player_id : game.white_player_id;
          
          // Get opponent name
          const { data: opponent } = await supabase
            .from('players')
            .select('name')
            .eq('id', opponentId)
            .maybeSingle();

          return {
            ...game,
            isWhite,
            opponentName: opponent?.name || 'Unknown'
          };
        })
      );

      setActiveMatches(matchesWithDetails.filter(m => m.status === 'active' || m.status === 'waiting'));
      setCompletedMatches(matchesWithDetails.filter(m => m.status === 'completed').slice(0, 10));
    }
  };

  const checkQueueStatus = async (pId: string) => {
    const { data } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('player_id', pId)
      .maybeSingle();
    
    setIsInQueue(!!data);
  };

  const handlePlayAgain = () => {
    navigate('/chess');
  };

  const getMatchResult = (match: Match) => {
    if (!match.winner_id || !playerId) return 'draw';
    const isWhiteWinner = match.winner_id === (match.isWhite ? playerId : null);
    return match.winner_id === playerId ? 'win' : 'loss';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Desktop Side Menu */}
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />
      
      {/* Overlay for mobile */}
      {sideMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <img src={skilledLogo} alt="Skilled" className="h-8 w-auto" />
          <h1 className="text-lg font-semibold">Compete</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Queue Status */}
        {isInQueue && (
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-primary animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Finding Opponent...</p>
                  <p className="text-sm text-muted-foreground">You're in the matchmaking queue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Matches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary" />
              Active Matches
            </h2>
            <Badge variant="secondary">{activeMatches.length}</Badge>
          </div>

          {activeMatches.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">No active matches</p>
                <Button onClick={handlePlayAgain} className="bg-primary text-primary-foreground">
                  Start a Match
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeMatches.map((match) => (
                <Card key={match.id} className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/chess`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-xl">{match.isWhite ? '♔' : '♚'}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">vs {match.opponentName}</p>
                          <p className="text-sm text-muted-foreground">
                            {match.wager} coins • {match.isWhite ? 'White' : 'Black'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Matches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Matches
            </h2>
          </div>

          {completedMatches.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No completed matches yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {completedMatches.map((match) => {
                const result = getMatchResult(match);
                return (
                  <Card key={match.id} className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            result === 'win' ? 'bg-emerald-500/20' : 
                            result === 'loss' ? 'bg-red-500/20' : 'bg-muted'
                          }`}>
                            {result === 'win' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : result === 'loss' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <Trophy className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">vs {match.opponentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(match.updated_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={result === 'win' ? 'default' : 'secondary'} className={
                            result === 'win' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                            result === 'loss' ? 'bg-red-500/20 text-red-500 border-red-500/30' : ''
                          }>
                            {result === 'win' ? `+${match.wager * 2}` : result === 'loss' ? `-${match.wager}` : 'Draw'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Play Again CTA */}
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <Trophy className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">Ready for another match?</h3>
            <p className="text-sm text-muted-foreground mb-4">Jump back into the action</p>
            <Button onClick={handlePlayAgain} className="bg-primary text-primary-foreground">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Play Again
            </Button>
          </CardContent>
        </Card>
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
