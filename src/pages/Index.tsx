import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/LandingPage';
import { GameView } from '@/components/GameView';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileStore } from '@/stores/profileStore';
import { UsernameCreationModal } from '@/components/UsernameCreationModal';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPrivileged } = useUserRole();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const { profile, fetchProfile } = useProfileStore();
  
  // Username modal state
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [hasCheckedUsername, setHasCheckedUsername] = useState(false);
  
  // Use Supabase for player data (no longer for chess matchmaking)
  const {
    player,
    createPlayer,
    loadPlayer,
  } = useMultiplayer();

  const [showBotGame, setShowBotGame] = useState(false);
  const [botGameBalance, setBotGameBalance] = useState(0);

  // Check if user needs to create a username after login
  useEffect(() => {
    if (isAuthReady && isAuthenticated && user && !hasCheckedUsername) {
      // User is logged in, check if they have a username
      const checkUsername = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        // Check if display_name is null, empty, or looks like an email prefix
        const displayName = data?.display_name;
        const needsUsername = !displayName || 
          displayName.trim() === '' || 
          displayName === user.email?.split('@')[0];
        
        if (needsUsername) {
          setShowUsernameModal(true);
        }
        setHasCheckedUsername(true);
      };
      
      checkUsername();
    }
  }, [isAuthReady, isAuthenticated, user, hasCheckedUsername]);

  // Reset check when user changes
  useEffect(() => {
    if (!isAuthenticated) {
      setHasCheckedUsername(false);
      setShowUsernameModal(false);
    }
  }, [isAuthenticated]);

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

  const handleUsernameComplete = (username: string) => {
    setShowUsernameModal(false);
    // Refresh profile to get the updated username
    if (user) {
      fetchProfile(user.id);
    }
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
    <>
      <LandingPage onJoinGame={handleJoinGame} isSearching={false} />
      
      {/* Username Creation Modal */}
      {user && (
        <UsernameCreationModal
          isOpen={showUsernameModal}
          userId={user.id}
          onComplete={handleUsernameComplete}
        />
      )}
    </>
  );
};

export default Index;
