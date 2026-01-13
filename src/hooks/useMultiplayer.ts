import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  credits: number;
  user_id: string;
}

interface Game {
  id: string;
  white_player_id: string;
  black_player_id: string;
  wager: number;
  fen: string;
  white_time: number;
  black_time: number;
  current_turn: string;
  status: string;
  winner_id: string | null;
  game_type: string;
}

export const useMultiplayer = () => {
  const [player, setPlayer] = useState<Player | null>(null);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [opponent, setOpponent] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup
  const gameChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load player for authenticated user - uses user_balances as fallback
  const loadPlayer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return null;
    }

    // Use user_balances table which exists in schema
    const { data, error } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading player:', error);
      setIsLoading(false);
      return null;
    }

    if (data) {
      // Map user_balances to Player interface
      const playerData: Player = {
        id: String(data.id),
        name: user.email?.split('@')[0] || 'Player',
        credits: data.balance || 0,
        user_id: data.user_id || user.id,
      };
      setPlayer(playerData);
      setIsLoading(false);
      return playerData;
    }
    
    setIsLoading(false);
    return null;
  }, []);

  // Create player for authenticated user
  const createPlayer = async (name: string): Promise<Player | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to play');
      return null;
    }

    // Check if player already exists
    const existing = await loadPlayer();
    if (existing) {
      return existing;
    }

    // Create user_balances entry
    const { data, error } = await supabase
      .from('user_balances')
      .insert({ balance: 1000, user_id: user.id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Player already exists, load it
        return await loadPlayer();
      }
      toast.error('Failed to create player');
      console.error(error);
      return null;
    }

    const playerData: Player = {
      id: String(data.id),
      name,
      credits: data.balance || 1000,
      user_id: data.user_id || user.id,
    };
    setPlayer(playerData);
    return playerData;
  };

  // Create a lobby (open game waiting for opponent)
  const createLobby = async (playerId: string, wager: number, gameType: string = 'chess', lobbyCode?: string) => {
    console.log('[useMultiplayer] Creating lobby for player:', playerId);
    
    try {
      const response = await supabase.functions.invoke('create-lobby', {
        body: { wager, gameType, lobbyCode }
      });

      if (response.error) {
        console.error('[useMultiplayer] Create lobby error:', response.error);
        toast.error('Failed to create lobby');
        return null;
      }

      const data = response.data;
      console.log('[useMultiplayer] Lobby created:', data);

      if (data?.game) {
        setCurrentGame(data.game);
        toast.success('Lobby created! Waiting for opponent...');
        return data.game;
      }

      return null;
    } catch (error) {
      console.error('[useMultiplayer] Create lobby error:', error);
      toast.error('Failed to create lobby');
      return null;
    }
  };

  // Join an existing lobby
  const joinLobby = async (lobbyCode: string) => {
    console.log('[useMultiplayer] Joining lobby:', lobbyCode);
    
    try {
      const response = await supabase.functions.invoke('join-lobby', {
        body: { lobbyCode }
      });

      if (response.error) {
        console.error('[useMultiplayer] Join lobby error:', response.error);
        toast.error(response.error.message || 'Failed to join lobby');
        return null;
      }

      const data = response.data;
      console.log('[useMultiplayer] Joined lobby:', data);

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      if (data?.game) {
        setCurrentGame(data.game);
        if (data.opponent) {
          setOpponent(data.opponent);
        }
        toast.success('Joined lobby!');
        return data.game;
      }

      return null;
    } catch (error) {
      console.error('[useMultiplayer] Join lobby error:', error);
      toast.error('Failed to join lobby');
      return null;
    }
  };

  // Load a game by ID (used after WebSocket matchmaking)
  const loadGame = async (gameId: string) => {
    console.log('[useMultiplayer] Loading game:', gameId);
    
    // Games table doesn't exist yet - return mock game for now
    // This will be replaced when games table is created
    const mockGame: Game = {
      id: gameId,
      white_player_id: '',
      black_player_id: '',
      wager: 0,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      white_time: 600,
      black_time: 600,
      current_turn: 'w',
      status: 'active',
      winner_id: null,
      game_type: 'chess',
    };
    
    setCurrentGame(mockGame);
    return mockGame;
  };

  // Listen for game updates (moves, time, status, and opponent joining lobby)
  useEffect(() => {
    if (!currentGame) {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
        gameChannelRef.current = null;
      }
      return;
    }

    // Game updates disabled until games table exists
    console.log('[useMultiplayer] Game update listener skipped - games table not available');

    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
        gameChannelRef.current = null;
      }
    };
  }, [currentGame?.id, loadPlayer, player?.id]);

  // Load player on mount and auth changes
  useEffect(() => {
    loadPlayer();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadPlayer();
    });

    return () => subscription.unsubscribe();
  }, [loadPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
      }
    };
  }, []);

  // Update game state (only move-related updates)
  const updateGame = async (updates: Partial<Game>) => {
    if (!currentGame) return;
    
    // Games table doesn't exist - just update local state
    setCurrentGame(prev => prev ? { ...prev, ...updates } : null);
  };

  // End game via secure backend function
  const endGame = async (winnerId: string | null, reason: string) => {
    if (!currentGame || !player) return;

    try {
      console.log('[useMultiplayer] Ending game:', currentGame.id, 'winner:', winnerId);
      const response = await supabase.functions.invoke('end-game', {
        body: {
          gameId: currentGame.id,
          winnerId: winnerId || null,
          reason
        }
      });

      if (response.error) {
        console.error('Failed to end game:', response.error);
        toast.error('Failed to end game');
        return;
      }

      // Refresh player data to get updated credits
      await loadPlayer();
    } catch (error) {
      console.error('Error ending game:', error);
      toast.error('Failed to end game');
    }
  };

  const resetGame = () => {
    setCurrentGame(null);
    setOpponent(null);
    setError(null);
  };

  return {
    player,
    currentGame,
    opponent,
    isLoading,
    error,
    createPlayer,
    loadPlayer,
    loadGame,
    createLobby,
    joinLobby,
    updateGame,
    endGame,
    resetGame,
    setCurrentGame,
    setOpponent,
  };
};
