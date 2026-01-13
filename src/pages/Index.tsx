import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/LandingPage';
import { GameView } from '@/components/GameView';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPrivileged } = useUserRole();
  
  // Use Supabase for player data (no longer for chess matchmaking)
  const {
    player,
    createPlayer,
    loadPlayer,
  } = useMultiplayer();

  const [showBotGame, setShowBotGame] = useState(false);
  const [botGameBalance, setBotGameBalance] = useState(0);

  // Handle navigation state for bot games
  useEffect(() => {
    const state = location.state as { 
      startBotGame?: boolean; 
      gameSlug?: string;
    } | null;
    
    if (state?.startBotGame && state?.gameSlug === 'chess') {
      setShowBotGame(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // Fetch user balance for bot game
  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('skilled_coins')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data) {
          setBotGameBalance(data.skilled_coins);
        }
      }
    };
    if (showBotGame) {
      fetchBalance();
    }
  }, [showBotGame]);

  const handleJoinGame = (playerName: string) => {
    // Navigate to quick play for WebSocket matchmaking
    navigate('/quick-play');
  };

  const handleGoHome = () => {
    setShowBotGame(false);
  };

  const handleBotBalanceChange = (newBalance: number) => {
    setBotGameBalance(newBalance);
  };

  // Show bot game view
  if (showBotGame) {
    return (
      <GameView
        balance={botGameBalance}
        onBalanceChange={handleBotBalanceChange}
        onBack={handleGoHome}
        isFreePlay={true}
      />
    );
  }

  return (
    <LandingPage onJoinGame={handleJoinGame} isSearching={false} />
  );
};

export default Index;
