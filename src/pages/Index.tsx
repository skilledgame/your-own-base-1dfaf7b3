import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/LandingPage';
import { GameView } from '@/components/GameView';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserDataStore } from '@/stores/userDataStore';
import { UsernameCreationModal } from '@/components/UsernameCreationModal';

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPrivileged } = useUserRole();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  // Use individual selectors to prevent infinite re-renders
  const profile = useUserDataStore(state => state.profile);
  const cachedSkilledCoins = useUserDataStore(state => state.cachedSkilledCoins);
  const refreshUserData = useUserDataStore(state => state.refresh);
  const skilledCoins = profile?.skilled_coins ?? cachedSkilledCoins ?? 0;
  
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

  // Check if user needs to create a username after login
  useEffect(() => {
    if (isAuthReady && isAuthenticated && user && !hasCheckedUsername) {
      // Only prompt on first sign-in (new user)
      const createdAt = user.created_at ? new Date(user.created_at).getTime() : null;
      const lastSignInAt = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : null;
      const isNewUser =
        createdAt !== null &&
        lastSignInAt !== null &&
        Math.abs(lastSignInAt - createdAt) < 5 * 60 * 1000;

      if (!isNewUser) {
        setHasCheckedUsername(true);
        return;
      }

      // User is logged in and new, check if they have a username
      const checkUsername = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        // Only check if display_name exists and is not empty
        // If user already has a username, don't prompt them
        const displayName = data?.display_name;
        const needsUsername = !displayName || displayName.trim() === '';
        
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

  // REMOVED: fetchBalance for bot game - now uses centralized store
  // Balance is already loaded via userDataStore in App.tsx

  const handleJoinGame = (playerName: string) => {
    // Navigate to chess home for WebSocket matchmaking
    navigate('/chess');
  };

  const handleGoHome = () => {
    setShowBotGame(false);
  };

  const handleBotBalanceChange = (newBalance: number) => {
    // Balance changes are now handled by centralized store
    // This callback is for compatibility but actual updates come via Realtime
  };

  const handleUsernameComplete = (username: string) => {
    setShowUsernameModal(false);
    // Refresh user data to get the updated username
    refreshUserData();
  };

  // Show bot game view
  if (showBotGame) {
    return (
      <GameView
        balance={skilledCoins ?? 0}
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
