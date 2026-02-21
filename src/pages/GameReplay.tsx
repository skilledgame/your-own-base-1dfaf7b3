/**
 * Game Replay Page
 * 
 * Chess.com-style move-by-move replay of completed games.
 * Route: /game/replay/:gameId
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Chess, Move } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { CapturedPieces } from '@/components/CapturedPieces';
import { Button } from '@/components/ui/button';
import { LogoLink } from '@/components/LogoLink';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculateCapturedPieces, calculateMaterialAdvantage } from '@/lib/chessMaterial';
import {
  ArrowLeft,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  Film,
  Trophy,
  XCircle,
  Minus,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameData {
  id: string;
  pgn: string;
  fen: string;
  status: string;
  wager: number;
  winner_id: string | null;
  white_player_id: string;
  black_player_id: string;
  created_at: string;
  white_name: string;
  black_name: string;
  white_user_id: string | null;
  black_user_id: string | null;
}

const GameReplay = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Game data
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Replay state
  const [allMoves, setAllMoves] = useState<Move[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
  const [chess] = useState(() => new Chess());
  const [localFen, setLocalFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [isCheck, setIsCheck] = useState(false);
  const [flipped, setFlipped] = useState(false);

  // Auto-play
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms per move
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // Move list scroll ref
  const moveListRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<HTMLButtonElement>(null);

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      if (!gameId) {
        setError('No game ID provided');
        setLoading(false);
        return;
      }

      try {
        // Fetch game with player info
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('id, pgn, fen, status, wager, winner_id, white_player_id, black_player_id, created_at')
          .eq('id', gameId)
          .maybeSingle();

        if (gameError || !game) {
          setError('Game not found');
          setLoading(false);
          return;
        }

        if (!game.pgn) {
          setError('No replay data available for this game');
          setLoading(false);
          return;
        }

        // Fetch player names from players -> profiles
        const [whitePlayerRes, blackPlayerRes] = await Promise.all([
          supabase.from('players').select('user_id, name').eq('id', game.white_player_id).maybeSingle(),
          supabase.from('players').select('user_id, name').eq('id', game.black_player_id).maybeSingle(),
        ]);

        const whiteUserId = whitePlayerRes.data?.user_id || null;
        const blackUserId = blackPlayerRes.data?.user_id || null;

        // Fetch display names from profiles
        let whiteName = whitePlayerRes.data?.name || 'White';
        let blackName = blackPlayerRes.data?.name || 'Black';

        if (whiteUserId || blackUserId) {
          const profilePromises = [];
          if (whiteUserId) {
            profilePromises.push(
              supabase.from('profiles').select('display_name, user_id').eq('user_id', whiteUserId).maybeSingle()
            );
          }
          if (blackUserId) {
            profilePromises.push(
              supabase.from('profiles').select('display_name, user_id').eq('user_id', blackUserId).maybeSingle()
            );
          }
          const profileResults = await Promise.all(profilePromises);
          let idx = 0;
          if (whiteUserId) {
            whiteName = profileResults[idx]?.data?.display_name || whiteName;
            idx++;
          }
          if (blackUserId) {
            blackName = profileResults[idx]?.data?.display_name || blackName;
          }
        }

        const gameData: GameData = {
          id: game.id,
          pgn: game.pgn,
          fen: game.fen,
          status: game.status,
          wager: game.wager,
          winner_id: game.winner_id,
          white_player_id: game.white_player_id,
          black_player_id: game.black_player_id,
          created_at: game.created_at,
          white_name: whiteName,
          black_name: blackName,
          white_user_id: whiteUserId,
          black_user_id: blackUserId,
        };

        setGameData(gameData);

        // Parse PGN and extract moves
        const replayChess = new Chess();
        replayChess.loadPgn(game.pgn);
        const moves = replayChess.history({ verbose: true });
        setAllMoves(moves);

        // Default board orientation: show from current user's perspective
        if (user?.id && blackUserId === user.id) {
          setFlipped(true);
        }

      } catch (err) {
        console.error('Failed to fetch game:', err);
        setError('Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [gameId, user?.id]);

  // Navigate to a specific move index
  const goToMove = useCallback((index: number) => {
    const targetIndex = Math.max(-1, Math.min(index, allMoves.length - 1));
    
    // Reset chess to starting position
    chess.reset();

    // Apply moves up to target index
    for (let i = 0; i <= targetIndex; i++) {
      chess.move(allMoves[i]);
    }

    setCurrentMoveIndex(targetIndex);
    setLocalFen(chess.fen());
    setIsCheck(chess.isCheck());

    if (targetIndex >= 0) {
      setLastMove({ from: allMoves[targetIndex].from, to: allMoves[targetIndex].to });
    } else {
      setLastMove(null);
    }
  }, [chess, allMoves]);

  // Navigation functions
  const goToStart = useCallback(() => {
    setIsPlaying(false);
    goToMove(-1);
  }, [goToMove]);

  const goToPrev = useCallback(() => {
    setIsPlaying(false);
    goToMove(currentMoveIndex - 1);
  }, [goToMove, currentMoveIndex]);

  const goToNext = useCallback(() => {
    goToMove(currentMoveIndex + 1);
  }, [goToMove, currentMoveIndex]);

  const goToEnd = useCallback(() => {
    setIsPlaying(false);
    goToMove(allMoves.length - 1);
  }, [goToMove, allMoves.length]);

  const toggleAutoPlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying && currentMoveIndex < allMoves.length - 1) {
      autoPlayRef.current = setTimeout(() => {
        goToNext();
      }, playSpeed);
    } else if (isPlaying && currentMoveIndex >= allMoves.length - 1) {
      setIsPlaying(false);
    }

    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [isPlaying, currentMoveIndex, allMoves.length, playSpeed, goToNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentMoveIndex < allMoves.length - 1) goToNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStart();
      } else if (e.key === 'End') {
        e.preventDefault();
        goToEnd();
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleAutoPlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext, goToStart, goToEnd, toggleAutoPlay, currentMoveIndex, allMoves.length]);

  // Scroll active move into view
  useEffect(() => {
    if (activeMoveRef.current && moveListRef.current) {
      activeMoveRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentMoveIndex]);

  // Compute captured pieces and material advantage
  const capturedPieces = useMemo(() => calculateCapturedPieces(chess), [localFen]);
  const materialAdvantage = useMemo(() => calculateMaterialAdvantage(chess), [localFen]);

  // Determine game result for display
  const gameResult = useMemo(() => {
    if (!gameData) return null;
    if (gameData.winner_id === gameData.white_player_id) return { winner: 'white', label: 'White wins' };
    if (gameData.winner_id === gameData.black_player_id) return { winner: 'black', label: 'Black wins' };
    if (gameData.status === 'finished') return { winner: 'draw', label: 'Draw' };
    return null;
  }, [gameData]);

  // Determine if current user played this game and their result
  const userResult = useMemo(() => {
    if (!gameData || !user?.id) return null;
    const isWhite = gameData.white_user_id === user.id;
    const isBlack = gameData.black_user_id === user.id;
    if (!isWhite && !isBlack) return null;

    if (!gameResult) return null;
    if (gameResult.winner === 'draw') return 'draw';
    if (gameResult.winner === 'white' && isWhite) return 'win';
    if (gameResult.winner === 'black' && isBlack) return 'win';
    return 'loss';
  }, [gameData, user?.id, gameResult]);

  // Build move pairs for display (move number, white move, black move)
  const movePairs = useMemo(() => {
    const pairs: { number: number; white: { san: string; index: number } | null; black: { san: string; index: number } | null }[] = [];
    for (let i = 0; i < allMoves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: { san: allMoves[i].san, index: i },
        black: i + 1 < allMoves.length ? { san: allMoves[i + 1].san, index: i + 1 } : null,
      });
    }
    return pairs;
  }, [allMoves]);

  // No-op move handler for read-only board
  const noopMove = useCallback(() => false, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error || !gameData) {
    return (
      <div className="min-h-screen bg-background">
        <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/game-history">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
              <LogoLink className="h-10" />
            </div>
          </div>
        </header>
        <main className="pt-24 pb-12 px-4 flex flex-col items-center justify-center">
          <Film className="w-12 h-12 mb-4 text-muted-foreground/50" />
          <p className="text-lg font-medium text-foreground mb-2">{error || 'Game not found'}</p>
          <Button asChild className="mt-4">
            <Link to="/game-history">Back to History</Link>
          </Button>
        </main>
      </div>
    );
  }

  const isAtStart = currentMoveIndex === -1;
  const isAtEnd = currentMoveIndex === allMoves.length - 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/game-history">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <LogoLink className="h-10" />
          </div>
          {/* Replay badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-full">
            <Film className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Replay</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-20 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
            {/* Left: Board Section */}
            <div className="flex flex-col items-center gap-3 w-full lg:w-auto">

              {/* Top player info (opponent from perspective) */}
              <div className="w-full max-w-[384px] sm:max-w-[448px] md:max-w-[512px]">
                <PlayerBar
                  name={flipped ? gameData.white_name : gameData.black_name}
                  color={flipped ? 'w' : 'b'}
                  isWinner={
                    gameResult?.winner === (flipped ? 'white' : 'black')
                  }
                  capturedPieces={flipped ? capturedPieces.white : capturedPieces.black}
                  materialAdvantage={
                    flipped
                      ? (materialAdvantage.difference > 0 ? materialAdvantage.difference : undefined)
                      : (-materialAdvantage.difference > 0 ? -materialAdvantage.difference : undefined)
                  }
                />
              </div>

              {/* Chess Board */}
              <ChessBoard
                game={chess}
                onMove={noopMove}
                isPlayerTurn={false}
                lastMove={lastMove}
                isCheck={isCheck}
                flipped={flipped}
                isGameOver={true}
                enablePremove={false}
              />

              {/* Bottom player info (current perspective) */}
              <div className="w-full max-w-[384px] sm:max-w-[448px] md:max-w-[512px]">
                <PlayerBar
                  name={flipped ? gameData.black_name : gameData.white_name}
                  color={flipped ? 'b' : 'w'}
                  isWinner={
                    gameResult?.winner === (flipped ? 'black' : 'white')
                  }
                  capturedPieces={flipped ? capturedPieces.black : capturedPieces.white}
                  materialAdvantage={
                    flipped
                      ? (-materialAdvantage.difference > 0 ? -materialAdvantage.difference : undefined)
                      : (materialAdvantage.difference > 0 ? materialAdvantage.difference : undefined)
                  }
                />
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToStart}
                  disabled={isAtStart}
                  className="h-10 w-10"
                  title="First move (Home)"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToPrev}
                  disabled={isAtStart}
                  className="h-10 w-10"
                  title="Previous move (Left arrow)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant={isPlaying ? "default" : "outline"}
                  size="icon"
                  onClick={toggleAutoPlay}
                  disabled={isAtEnd}
                  className="h-10 w-10"
                  title="Auto-play (Space)"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToNext}
                  disabled={isAtEnd}
                  className="h-10 w-10"
                  title="Next move (Right arrow)"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goToEnd}
                  disabled={isAtEnd}
                  className="h-10 w-10"
                  title="Last move (End)"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>

                <div className="w-px h-8 bg-border mx-1" />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFlipped(f => !f)}
                  className="h-10 w-10"
                  title="Flip board"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Speed controls */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Speed:</span>
                {[
                  { label: '0.5x', ms: 2000 },
                  { label: '1x', ms: 1000 },
                  { label: '2x', ms: 500 },
                  { label: '4x', ms: 250 },
                ].map((speed) => (
                  <button
                    key={speed.label}
                    onClick={() => setPlaySpeed(speed.ms)}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      playSpeed === speed.ms
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                    )}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Move List Panel */}
            <div className="w-full lg:w-72 flex-shrink-0">
              {/* Game result banner */}
              <div className={cn(
                "rounded-xl px-4 py-3 mb-4 border flex items-center gap-3",
                userResult === 'win' && "bg-emerald-500/10 border-emerald-500/30",
                userResult === 'loss' && "bg-red-500/10 border-red-500/30",
                userResult === 'draw' && "bg-slate-500/10 border-slate-500/30",
                !userResult && "bg-secondary border-border",
              )}>
                {gameResult?.winner === 'white' && <Trophy className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                {gameResult?.winner === 'black' && <Trophy className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                {gameResult?.winner === 'draw' && <Minus className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                <div>
                  <p className="font-semibold text-sm text-foreground">{gameResult?.label || 'Game Over'}</p>
                  <p className="text-xs text-muted-foreground">{allMoves.length} moves</p>
                </div>
              </div>

              {/* Move list */}
              <div className="bg-card rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-secondary/50">
                  <h3 className="text-sm font-semibold text-foreground">Moves</h3>
                </div>
                <div
                  ref={moveListRef}
                  className="max-h-[400px] overflow-y-auto divide-y divide-border/50"
                >
                  {movePairs.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No moves to display
                    </div>
                  )}
                  {movePairs.map((pair) => (
                    <div key={pair.number} className="flex items-stretch text-sm">
                      {/* Move number */}
                      <div className="w-10 flex-shrink-0 flex items-center justify-center text-muted-foreground font-mono text-xs bg-secondary/30">
                        {pair.number}.
                      </div>
                      {/* White move */}
                      <button
                        ref={pair.white && currentMoveIndex === pair.white.index ? activeMoveRef : undefined}
                        onClick={() => pair.white && goToMove(pair.white.index)}
                        className={cn(
                          "flex-1 px-3 py-2 text-left font-mono transition-colors hover:bg-secondary/50",
                          pair.white && currentMoveIndex === pair.white.index && "bg-primary/20 text-primary font-bold"
                        )}
                      >
                        {pair.white?.san || ''}
                      </button>
                      {/* Black move */}
                      <button
                        ref={pair.black && currentMoveIndex === pair.black.index ? activeMoveRef : undefined}
                        onClick={() => pair.black && goToMove(pair.black.index)}
                        className={cn(
                          "flex-1 px-3 py-2 text-left font-mono transition-colors hover:bg-secondary/50",
                          pair.black && currentMoveIndex === pair.black.index && "bg-primary/20 text-primary font-bold"
                        )}
                      >
                        {pair.black?.san || ''}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Move counter */}
              <div className="mt-3 text-center text-xs text-muted-foreground">
                Move {currentMoveIndex + 1} of {allMoves.length}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

/** Small player info bar shown above/below the board */
function PlayerBar({
  name,
  color,
  isWinner,
  capturedPieces,
  materialAdvantage,
}: {
  name: string;
  color: 'w' | 'b';
  isWinner: boolean;
  capturedPieces: import('chess.js').PieceSymbol[];
  materialAdvantage?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-secondary/50 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={cn(
            "w-3 h-3 rounded-sm flex-shrink-0 border",
            color === 'w' ? "bg-white border-white/50" : "bg-gray-800 border-gray-600"
          )}
        />
        <span className="font-semibold text-sm truncate">{name}</span>
        {isWinner && <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
      </div>
      <CapturedPieces
        pieces={capturedPieces}
        color={color === 'w' ? 'white' : 'black'}
        materialAdvantage={materialAdvantage}
      />
    </div>
  );
}

export default GameReplay;
