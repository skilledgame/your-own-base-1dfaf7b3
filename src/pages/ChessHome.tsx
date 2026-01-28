/**
 * ChessHome - Fortnite-inspired Game Mode Selection
 * 
 * Three modes:
 * - Private (left): Host/Join with codes
 * - Online (center): Wager-based matchmaking
 * - Battle Royale (right): Coming soon
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogoLink } from '@/components/LogoLink';
import { ChessOnlineMode } from '@/components/chess/ChessOnlineMode';
import { ChessPrivateMode } from '@/components/chess/ChessPrivateMode';
import { 
  ArrowLeft, 
  Users, 
  Swords, 
  Crown,
  Lock,
  Wifi,
  Globe,
  UserPlus
} from 'lucide-react';

type GameMode = 'private' | 'online' | 'battle-royale';

interface ModeCardProps {
  mode: GameMode;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  chessPiece: string;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  isHovered: boolean;
  isSelected: boolean;
  comingSoon?: boolean;
  onHover: (mode: GameMode | null) => void;
  onClick: () => void;
}

const ModeCard = ({
  mode,
  title,
  subtitle,
  icon,
  chessPiece,
  gradientFrom,
  gradientTo,
  glowColor,
  isHovered,
  isSelected,
  comingSoon = false,
  onHover,
  onClick
}: ModeCardProps) => {
  const isActive = isHovered || isSelected;
  
  return (
    <div
      className={`
        relative flex-1 min-w-[200px] max-w-[400px] cursor-pointer
        transition-all duration-500 ease-out
        ${isActive ? 'flex-[1.3] z-20' : 'flex-1 z-10'}
        ${comingSoon ? 'opacity-70 cursor-not-allowed' : ''}
      `}
      onMouseEnter={() => !comingSoon && onHover(mode)}
      onMouseLeave={() => onHover(null)}
      onClick={() => !comingSoon && onClick()}
    >
      {/* Card Container */}
      <div
        className={`
          relative h-[380px] sm:h-[420px] md:h-[460px] rounded-2xl overflow-hidden
          border-2 transition-all duration-500
          ${isActive 
            ? `border-white/60 shadow-[0_0_60px_${glowColor}]` 
            : 'border-white/20 shadow-lg'}
          ${isSelected ? 'ring-4 ring-white/40' : ''}
        `}
        style={{
          background: `linear-gradient(180deg, ${gradientFrom}dd 0%, ${gradientTo}ee 100%)`,
          boxShadow: isActive ? `0 0 80px ${glowColor}, inset 0 0 60px ${glowColor}40` : undefined
        }}
      >
        {/* Background Pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, white 1px, transparent 1px)`,
            backgroundSize: '30px 30px'
          }}
        />

        {/* Chess Piece Visual */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className={`
              text-[80px] sm:text-[100px] md:text-[120px] transition-all duration-500
              select-none filter
              ${isActive ? 'scale-110 drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]' : 'scale-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]'}
            `}
            style={{
              textShadow: isActive 
                ? `0 0 60px ${glowColor}, 0 0 100px ${glowColor}` 
                : `0 0 30px ${glowColor}`
            }}
          >
            {chessPiece}
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Content */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-center space-y-4">
          {/* Mode Icon */}
          <div 
            className={`
              w-14 h-14 mx-auto rounded-xl flex items-center justify-center
              bg-white/10 backdrop-blur-sm border border-white/20
              transition-all duration-300
              ${isActive ? 'scale-110 bg-white/20' : ''}
            `}
          >
            {icon}
          </div>

          {/* Title */}
          <h2 
            className={`
              text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider
              text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]
              transition-all duration-300
              ${isActive ? 'scale-105' : ''}
            `}
          >
            {title}
          </h2>

          {/* Subtitle */}
          <p className="text-white/70 text-sm sm:text-base">
            {subtitle}
          </p>

          {/* Play Button (shows on hover/active) */}
          {!comingSoon && (
            <div 
              className={`
                transition-all duration-300 transform
                ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
              `}
            >
              <Button 
                size="lg"
                className="px-8 py-6 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white border-0 shadow-lg"
              >
                PLAY
              </Button>
            </div>
          )}

          {/* Coming Soon Badge */}
          {comingSoon && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 mx-auto w-fit">
              <Lock className="w-4 h-4 text-white/70" />
              <span className="text-white/70 text-sm font-semibold uppercase tracking-wider">
                Coming Soon
              </span>
            </div>
          )}
        </div>

        {/* Shine Effect */}
        <div 
          className={`
            absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent
            transition-opacity duration-500
            ${isActive ? 'opacity-100' : 'opacity-0'}
          `}
        />
      </div>
    </div>
  );
};

type SelectedMode = 'private' | 'online' | null;

export default function ChessHome() {
  const navigate = useNavigate();
  const [hoveredMode, setHoveredMode] = useState<GameMode | null>(null);
  const [selectedMode, setSelectedMode] = useState<SelectedMode>(null);

  // Animated tab title with cycling chess pieces
  useEffect(() => {
    const pieces = ['♟', '♞', '♝', '♜', '♛', '♚'];
    let index = 0;
    const originalTitle = document.title;
    
    const interval = setInterval(() => {
      document.title = `${pieces[index]} Chess | Skilled`;
      index = (index + 1) % pieces.length;
    }, 500);
    
    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, []);

  const handleModeSelect = (mode: GameMode) => {
    if (mode === 'battle-royale') return; // Coming soon
    setSelectedMode(mode);
  };

  const handleBack = () => {
    if (selectedMode) {
      setSelectedMode(null);
    } else {
      navigate('/');
    }
  };

  // Show sub-screens based on selected mode
  if (selectedMode === 'online') {
    return <ChessOnlineMode onBack={handleBack} />;
  }

  if (selectedMode === 'private') {
    return <ChessPrivateMode onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Subtle Animated Background - Toned down to match home page */}
      <div className="absolute inset-0">
        {/* Soft radial gradient background - desaturated */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(40, 55, 75, 0.25) 0%, transparent 70%)'
          }}
        />
        
        {/* Subtle glow orbs - reduced saturation and opacity */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-slate-500/8 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-slate-400/6 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-slate-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        {/* Subtle geometric lines - matching home page style */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent" />
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent" />
          <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-white to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 p-4 backdrop-blur-sm bg-black/20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <LogoLink className="h-10" />
            <div className="w-20" />
          </div>
        </header>

        {/* Title Section */}
        <div className="text-center pt-8 pb-4 px-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            SELECT A <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">GAME MODE</span>
          </h1>
          <p className="text-white/50 mt-2 text-lg">Choose how you want to play</p>
        </div>

        {/* Game Mode Cards */}
        <div className="flex-1 flex items-center justify-center px-4 pb-8">
          <div className="flex gap-4 sm:gap-6 md:gap-8 items-center justify-center max-w-6xl w-full">
            {/* Private Mode - Knight piece */}
            <ModeCard
              mode="private"
              title="Private"
              subtitle="Play with friends using room codes"
              icon={<UserPlus className="w-7 h-7 text-purple-400" />}
              chessPiece="♞"
              gradientFrom="#7c3aed"
              gradientTo="#2e1065"
              glowColor="rgba(124, 58, 237, 0.5)"
              isHovered={hoveredMode === 'private'}
              isSelected={selectedMode === 'private'}
              onHover={setHoveredMode}
              onClick={() => handleModeSelect('private')}
            />

            {/* Online Mode (Center - Main) - Queen piece */}
            <ModeCard
              mode="online"
              title="Online"
              subtitle="Compete for Skilled Coins"
              icon={<Globe className="w-7 h-7 text-blue-400" />}
              chessPiece="♛"
              gradientFrom="#0ea5e9"
              gradientTo="#0c4a6e"
              glowColor="rgba(14, 165, 233, 0.5)"
              isHovered={hoveredMode === 'online'}
              isSelected={selectedMode === 'online'}
              onHover={setHoveredMode}
              onClick={() => handleModeSelect('online')}
            />

            {/* Battle Royale Mode - Rook/Castle piece */}
            <ModeCard
              mode="battle-royale"
              title="Battle Royale"
              subtitle="Last player standing wins"
              icon={<Crown className="w-7 h-7 text-yellow-400" />}
              chessPiece="♜"
              gradientFrom="#f59e0b"
              gradientTo="#78350f"
              glowColor="rgba(245, 158, 11, 0.5)"
              isHovered={hoveredMode === 'battle-royale'}
              isSelected={selectedMode === 'battle-royale'}
              comingSoon={true}
              onHover={setHoveredMode}
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Footer hint */}
        <div className="text-center pb-6">
          <p className="text-white/30 text-sm">
            Hover over a mode to learn more
          </p>
        </div>
      </div>
    </div>
  );
}
