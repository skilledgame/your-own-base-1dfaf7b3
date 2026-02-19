import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Coins, Swords, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WagerModalProps {
  balance: number;
  onStartGame: (wager: number) => void;
  onClose?: () => void;
  isPrivileged?: boolean;
}

const PRESET_WAGERS = [50, 100, 500, 1000];
const MIN_WAGER = 50;
const MAX_WAGER = 100000;

export const WagerModal = ({ balance, onStartGame, onClose, isPrivileged }: WagerModalProps) => {
  const [selectedWager, setSelectedWager] = useState<number>(50);
  const [customWager, setCustomWager] = useState<string>('');
  const [error, setError] = useState<string>('');

  const effectiveWager = customWager ? parseInt(customWager) || 0 : selectedWager;

  const validateWager = (wager: number): string => {
    if (wager < MIN_WAGER) return `Minimum wager is ${MIN_WAGER} coins`;
    if (wager > MAX_WAGER) return `Maximum wager is ${MAX_WAGER.toLocaleString()} coins`;
    if (!isPrivileged && wager > balance) return 'Insufficient balance';
    return '';
  };

  const handleStartGame = () => {
    const validationError = validateWager(effectiveWager);
    if (validationError) {
      setError(validationError);
      return;
    }
    onStartGame(effectiveWager);
  };
  const canStart = effectiveWager >= MIN_WAGER && effectiveWager <= MAX_WAGER && (isPrivileged || effectiveWager <= balance);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full animate-scale-in shadow-xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Swords className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Place Your Wager
          </h2>
          <p className="text-muted-foreground text-sm">
            Win and double your tokens. Lose and they're gone.
          </p>
        </div>

        {/* Balance Display */}
        <div className={cn(
          "flex items-center justify-center gap-2 mb-6 p-3 rounded-lg",
          "bg-secondary"
        )}>
          <Coins className="w-5 h-5 text-gold" />
          <span className="text-muted-foreground">Balance:</span>
          <span className="font-bold text-gold text-xl">{balance}</span>
        </div>

        {/* Preset Wagers */}
        <div className="grid grid-cols-4 gap-2 mb-4">
  {PRESET_WAGERS.map((wager) => (
            <button
              key={wager}
              onClick={() => {
                setSelectedWager(wager);
                setCustomWager('');
                setError('');
              }}
              disabled={!isPrivileged && wager > balance}
              className={cn(
                "py-3 px-2 rounded-lg font-semibold text-lg transition-all duration-200",
                "border-2",
                selectedWager === wager && !customWager
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:border-primary/50",
                !isPrivileged && wager > balance && "opacity-50 cursor-not-allowed"
              )}
            >
              {wager}
            </button>
          ))}
        </div>

        {/* Custom Wager */}
        <div className="mb-6">
          <label className="block text-sm text-muted-foreground mb-2">Custom Amount (50 - 100,000)</label>
          <input
            type="number"
            value={customWager}
            onChange={(e) => {
              setCustomWager(e.target.value);
              setError('');
            }}
            placeholder="Enter amount..."
            min={MIN_WAGER}
            max={MAX_WAGER}
            className={cn(
              "w-full px-4 py-3 bg-secondary border rounded-lg text-lg text-foreground focus:outline-none transition-colors",
              error ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"
            )}
          />
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Potential Win */}
        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg mb-6">
          <span className="text-primary flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Potential Win
          </span>
          <span className="font-bold text-2xl text-primary">
            +{effectiveWager}
          </span>
        </div>

        {/* Start Button */}
        <Button
          className="w-full h-12 text-lg font-semibold"
          onClick={handleStartGame}
          disabled={!canStart}
        >
          <Swords className="w-5 h-5 mr-2" />
          Find Match
          {isPrivileged && <span className="ml-2 text-xs opacity-70">(Mod)</span>}
        </Button>

        {/* Game Info */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          1 minute + 3 seconds per move • Real players
        </p>
      </div>
    </div>
  );
};