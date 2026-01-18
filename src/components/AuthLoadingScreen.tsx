/**
 * AuthLoadingScreen - Shown while auth is bootstrapping
 * 
 * Prevents the "half logged-in" state by blocking rendering
 * until isAuthReady is true.
 */

import { Loader2 } from 'lucide-react';
import skilledLogo from '@/assets/skilled-logo.png';

export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <img 
        src={skilledLogo} 
        alt="Skilled" 
        className="h-16 w-auto animate-pulse"
      />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading session...</span>
      </div>
    </div>
  );
}
