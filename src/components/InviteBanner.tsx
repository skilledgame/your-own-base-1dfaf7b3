import { useState, useEffect } from 'react';
import { Gift, Clock, X } from 'lucide-react';

export const InviteBanner = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 2, hours: 0, minutes: 0, seconds: 0 });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Set expiry to 2 days from now (or from stored value)
    const storedExpiry = localStorage.getItem('inviteOfferExpiry');
    let expiryTime: number;
    
    if (storedExpiry) {
      expiryTime = parseInt(storedExpiry);
    } else {
      expiryTime = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2 days
      localStorage.setItem('inviteOfferExpiry', expiryTime.toString());
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = expiryTime - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  if (dismissed) return null;

  return (
    <div className="relative mt-20 sm:mt-24 bg-gradient-to-r from-primary via-purple-600 to-accent">
      <div className="bg-background/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm relative pr-10">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-foreground font-medium">
              Invite a friend and get <span className="text-accent font-bold">10 free tokens!</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">
              {timeLeft.days}d {timeLeft.hours.toString().padStart(2, '0')}h {timeLeft.minutes.toString().padStart(2, '0')}m {timeLeft.seconds.toString().padStart(2, '0')}s
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-background/50 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};
