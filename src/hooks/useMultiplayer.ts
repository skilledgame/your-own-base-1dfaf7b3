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

  // Load player for authenticated user
  const loadPlayer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return null;
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading player:', error);
      setIsLoading(false);
      return null;
    }

    if (data) {
      setPlayer(data);
    }
    setIsLoading(false);
    return data;
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

    const { data, error } = await supabase
      .from('players')
      .insert({ name, credits: 1000, user_id: user.id })
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

    setPlayer(data);
    return data;
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
    
    try {
      const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !game) {
        console.error('[useMultiplayer] Failed to load game:', error);
        toast.error('Failed to load game');
        return null;
      }

      console.log('[useMultiplayer] Game loaded:', game);
      setCurrentGame(game);
      return game;
    } catch (error) {
      console.error('[useMultiplayer] Error loading game:', error);
      toast.error('Failed to load game');
      return null;
    }
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

    console.log('[useMultiplayer] Setting up game update listener:', currentGame.id);

    const channel = supabase
      .channel(`game-updates-${currentGame.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${currentGame.id}`,
        },
        async (payload) => {
          console.log('[useMultiplayer] Game updated:', payload);
          const updatedGame = payload.new as Game;
          const oldGame = payload.old as Game;
          
          setCurrentGame(updatedGame);
          
          // If game transitioned from waiting to active, someone joined!
          if (oldGame.status === 'waiting' && updatedGame.status === 'active') {
            console.log('[useMultiplayer] Opponent joined the lobby!');
            
            // Get opponent info
            const opponentId = updatedGame.white_player_id === player?.id 
              ? updatedGame.black_player_id 
              : updatedGame.white_player_id;

            const { data: opponentName } = await supabase
              .rpc('get_opponent_name', { p_player_id: opponentId });

            if (opponentName) {
              setOpponent({ id: opponentId, name: opponentName });
              toast.success(`${opponentName} joined! Game starting...`);
            } else {
              setOpponent({ id: opponentId, name: 'Opponent' });
              toast.success('Opponent joined! Game starting...');
            }
          }
          
          // If game finished, refresh player credits
          if (updatedGame.status === 'finished') {
            loadPlayer();
          }
        }
      )
      .subscribe((status) => {
        console.log('[useMultiplayer] Game channel status:', status);
      });

    gameChannelRef.current = channel;

    return () => {
      console.log('[useMultiplayer] Cleaning up game listener');
      supabase.removeChannel(channel);
      gameChannelRef.current = null;
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

    // Only allow updating game state (fen, turn, times) - not status or winner
    const safeUpdates: Partial<Game> = {};
    if (updates.fen !== undefined) safeUpdates.fen = updates.fen;
    if (updates.current_turn !== undefined) safeUpdates.current_turn = updates.current_turn;
    if (updates.white_time !== undefined) safeUpdates.white_time = updates.white_time;
    if (updates.black_time !== undefined) safeUpdates.black_time = updates.black_time;

    const { error } = await supabase
      .from('games')
      .update(safeUpdates)
      .eq('id', currentGame.id);

    if (error) {
      console.error('Failed to update game:', error);
    }
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
