/**
 * AuthDebugPanel - Shows auth state for debugging
 * 
 * Only visible when:
 * - URL contains ?debug=1
 * - OR import.meta.env.DEV is true
 * 
 * Shows:
 * - isAuthReady
 * - user.id / email
 * - session.expires_at
 * - localStorage status
 * - lastAuthEvent
 * - Hard Reset button
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthStorageInfo } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Bug, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AuthDebugPanel() {
  const { 
    user, 
    session, 
    isAuthReady, 
    authError, 
    isAuthenticated,
    role,
    lastAuthEvent,
    hardReset,
  } = useAuth();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ exists: false, size: 0 });
  
  // Check if debug mode is enabled
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug') === '1';
    const isDev = import.meta.env.DEV;
    
    setIsVisible(debugParam || isDev);
  }, []);
  
  // Update storage info
  useEffect(() => {
    const updateStorageInfo = () => {
      setStorageInfo(getAuthStorageInfo());
    };
    
    updateStorageInfo();
    
    // Update periodically
    const interval = setInterval(updateStorageInfo, 2000);
    return () => clearInterval(interval);
  }, []);
  
  if (!isVisible) return null;
  
  const formatExpiry = (expiresAt?: number) => {
    if (!expiresAt) return 'N/A';
    const date = new Date(expiresAt * 1000);
    const now = Date.now();
    const diffMs = expiresAt * 1000 - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMs < 0) return `Expired ${Math.abs(diffMins)}m ago`;
    return `${date.toLocaleTimeString()} (${diffMins}m)`;
  };
  
  const shortId = user?.id ? user.id.substring(0, 8) : 'N/A';
  
  return (
    <div 
      className={cn(
        "fixed bottom-20 md:bottom-4 right-4 z-[100] bg-card border border-border rounded-lg shadow-xl",
        "text-xs font-mono max-w-xs transition-all duration-200",
        isCollapsed ? "w-auto" : "w-72"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bug className="w-3 h-3 text-yellow-500" />
          <span className="font-semibold text-foreground">Auth Debug</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5"
            onClick={() => setIsVisible(false)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-2">
          {/* Status indicators */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isAuthReady ? "bg-green-500" : "bg-yellow-500 animate-pulse"
              )} />
              <span className="text-muted-foreground">Ready:</span>
              <span className="text-foreground">{isAuthReady ? 'Yes' : 'No'}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isAuthenticated ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-muted-foreground">Auth:</span>
              <span className="text-foreground">{isAuthenticated ? 'Yes' : 'No'}</span>
            </div>
          </div>
          
          {/* User info */}
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <span className="text-foreground">{shortId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="text-foreground truncate max-w-[140px]">
                {user?.email || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role:</span>
              <span className={cn(
                "text-foreground",
                role === 'admin' && "text-purple-400",
                role === 'moderator' && "text-blue-400"
              )}>
                {role}
              </span>
            </div>
          </div>
          
          {/* Session info */}
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expires:</span>
              <span className="text-foreground">{formatExpiry(session?.expires_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Event:</span>
              <span className={cn(
                "text-foreground",
                lastAuthEvent === 'SIGNED_IN' && "text-green-400",
                lastAuthEvent === 'SIGNED_OUT' && "text-red-400",
                lastAuthEvent === 'BOOTSTRAP_COMPLETE' && "text-blue-400"
              )}>
                {lastAuthEvent || 'N/A'}
              </span>
            </div>
          </div>
          
          {/* Storage info */}
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage:</span>
              <span className={cn(
                "text-foreground",
                storageInfo.exists ? "text-green-400" : "text-red-400"
              )}>
                {storageInfo.exists ? `${storageInfo.size} bytes` : 'Empty'}
              </span>
            </div>
          </div>
          
          {/* Error */}
          {authError && (
            <div className="pt-2 border-t border-border">
              <span className="text-red-400">Error: {authError}</span>
            </div>
          )}
          
          {/* Hard Reset Button */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={hardReset}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Hard Reset (Sign Out + Clear Storage)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
