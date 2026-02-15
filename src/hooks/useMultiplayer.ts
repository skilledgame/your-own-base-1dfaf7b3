import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

interface Player {
  id: string;
  name: string;
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
  const { isAdmin } = useUserRole();
  
  // Refs for cleanup
  const gameChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load player for authenticated user
  const loadPlayer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return null;
    }

    // Use players table
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      setIsLoading(false);
      return null;
    }

    if (data) {
      const playerData: Player = {
        id: data.id,
        name: data.name,
        user_id: data.user_id,
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
      // Only show for admin users
      if (isAdmin) {
        toast.error('Please sign in to play');
      }
      return null;
    }

    // Check if player already exists
    const existing = await loadPlayer();
    if (existing) {
      return existing;
    }

    // Create players entry (no credits field - uses profiles.skilled_coins)
    const { data, error } = await supabase
      .from('players')
      .insert({ name, user_id: user.id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Player already exists, load it
        return await loadPlayer();
      }
      // Only show for admin users
      if (isAdmin) {
        toast.error('Failed to create player');
      }
      return null;
    }

    const playerData: Player = {
      id: data.id,
      name: data.name,
      user_id: data.user_id,
    };
    setPlayer(playerData);
    return playerData;
  };

  // Create a lobby (open game waiting for opponent)
  const createLobby = async (playerId: string, wager: number, gameType: string = 'chess', lobbyCode?: string) => {
    
    try {
      const response = await supabase.functions.invoke('create-lobby', {
        body: { wager, gameType, lobbyCode }
      });

      if (response.error) {
        // Only show for admin users
        if (isAdmin) {
          toast.error('Failed to create lobby');
        }
        return null;
      }

      const data = response.data;

      if (data?.game) {
        setCurrentGame(data.game);
        // Only show for admin users
        if (isAdmin) {
          toast.success('Lobby created! Waiting for opponent...');
        }
        return data.game;
      }

      return null;
    } catch (error) {
      // Only show for admin users
      if (isAdmin) {
        toast.error('Failed to create lobby');
      }
      return null;
    }
  };

  // Join an existing lobby
  const joinLobby = async (lobbyCode: string) => {
    
    try {
      const response = await supabase.functions.invoke('join-lobby', {
        body: { lobbyCode }
      });

      if (response.error) {
        // Only show for admin users
        if (isAdmin) {
          toast.error(response.error.message || 'Failed to join lobby');
        }
        return null;
      }

      const data = response.data;

      if (data?.error) {
        // Only show for admin users
        if (isAdmin) {
          toast.error(data.error);
        }
        return null;
      }

      if (data?.game) {
        setCurrentGame(data.game);
        if (data.opponent) {
          setOpponent(data.opponent);
        }
        // Only show for admin users
        if (isAdmin) {
          toast.success('Joined lobby!');
        }
        return data.game;
      }

      return null;
    } catch (error) {
      // Only show for admin users
      if (isAdmin) {
        toast.error('Failed to join lobby');
      }
      return null;
    }
  };

  // Load a game by ID (used after WebSocket matchmaking)
  const loadGame = async (gameId: string) => {
    
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    const game: Game = {
      id: data.id,
      white_player_id: data.white_player_id,
      black_player_id: data.black_player_id,
      wager: data.wager,
      fen: data.fen,
      white_time: data.white_time,
      black_time: data.black_time,
      current_turn: data.current_turn,
      status: data.status,
      winner_id: data.winner_id,
      game_type: data.game_type,
    };
    
    setCurrentGame(game);
    return game;
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

    // Subscribe to game updates
    gameChannelRef.current = supabase
      .channel(`game-${currentGame.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${currentGame.id}` }, (payload) => {
        const updated = payload.new as any;
        setCurrentGame(prev => prev ? { ...prev, ...updated } : null);
      })
      .subscribe();

    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
        gameChannelRef.current = null;
      }
    };
  // ONLY depend on currentGame.id — loadPlayer and player.id were causing
  // unnecessary unsubscribe/resubscribe cycles on every auth state change.
  }, [currentGame?.id]);

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
    
    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', currentGame.id);
    
    if (error) {
    }
    setCurrentGame(prev => prev ? { ...prev, ...updates } : null);
  };

  // End game via secure backend function
  const endGame = async (winnerId: string | null, reason: string) => {
    if (!currentGame || !player) return;

    try {
      const response = await supabase.functions.invoke('end-game', {
        body: {
          gameId: currentGame.id,
          winnerId: winnerId || null,
          reason
        }
      });

      if (response.error) {
        // Only show for admin users
        if (isAdmin) {
          toast.error('Failed to end game');
        }
        return;
      }

      // Balance will be updated via realtime subscription to profiles.skilled_coins
    } catch (error) {
      // Only show for admin users
      if (isAdmin) {
        toast.error('Failed to end game');
      }
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
