import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WalletModalProvider } from "@/contexts/WalletModalContext";
import { AuthDebugPanel } from "@/components/AuthDebugPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GameErrorBoundary } from "@/components/GameErrorBoundary";
import { WalletModal } from "@/components/WalletModal";
import { ScrollToTop } from "@/components/ScrollToTop";
import { FullScreenLoaderOverlay } from "@/components/FullScreenLoaderOverlay";
import { useUILoadingStore } from "@/stores/uiLoadingStore";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import Auth from "./pages/Auth";
import Deposit from "./pages/Deposit";
import GameStart from "./pages/GameStart";
import ChessLobby from "./pages/ChessLobby";
import ChessHome from "./pages/ChessHome";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Compete from "./pages/Compete";
import Search from "./pages/Search";
import Withdraw from "./pages/Withdraw";
import Leaderboard from "./pages/Leaderboard";
import GameHistory from "./pages/GameHistory";
import GameReplay from "./pages/GameReplay";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import LiveGame from "./pages/LiveGame";
import PrivateGameLobby from "./pages/PrivateGameLobby";
import Affiliate from "./pages/Affiliate";
import VIP from "./pages/VIP";
import Friends from "./pages/Friends";
import Clan from "./pages/Clan";
import ClanLeaderboard from "./pages/ClanLeaderboard";
import { useEnsureUser } from "./hooks/useEnsureUser";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserDataStore } from "./stores/userDataStore";
import { useFriendStore } from "./stores/friendStore";
import { usePresenceStore } from "./stores/presenceStore";
import { supabase } from "@/integrations/supabase/client";

// Create a stable QueryClient instance outside the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Reduce refetches
      refetchOnReconnect: false, // Don't refetch on reconnect
      retry: 1,
    },
  },
});

// Wrapper that handles auth-ready gate, MFA enforcement, and initializations
function AppWithAuth({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Use individual selectors to prevent infinite re-renders
  const initializeUserData = useUserDataStore(state => state.initialize);
  const resetUserData = useUserDataStore(state => state.reset);
  const { showLoading, hideLoading } = useUILoadingStore();
  const [mfaChecked, setMfaChecked] = useState(false);
  
  // Run ensure-user after auth is ready
  useEnsureUser();

  // Track page views and active visitors for admin analytics
  usePageAnalytics();

  // Ensure theme is initialized globally (default to dark)
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const shouldBeDark = stored ? stored === 'dark' : true;
    document.documentElement.classList.toggle('dark', shouldBeDark);
    if (!stored) {
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  // MFA enforcement: redirect to /auth if user needs MFA verification
  // - TOTP users: enforced via AAL level (aal1 -> aal2)
  // - Email 2FA users: enforced via sessionStorage flag
  // - No 2FA users: allowed through (2FA is optional)
  // - OAuth users (Google): always skip
  useEffect(() => {
    if (!isAuthReady || !isAuthenticated) {
      setMfaChecked(true);
      return;
    }

    // Don't check MFA if already on auth page or public pages
    const publicPaths = ['/auth', '/terms', '/privacy', '/how-it-works'];
    if (publicPaths.includes(location.pathname)) {
      setMfaChecked(true);
      return;
    }

    // Skip MFA for OAuth users (Google, etc.) — they don't need 2FA
    const provider = user?.app_metadata?.provider;
    if (provider && provider !== 'email') {
      setMfaChecked(true);
      return;
    }

    const checkMFA = async () => {
      try {
        // Check email-based 2FA first — if verified this session, user is good
        // (even if they also have TOTP enrolled, email 2FA is a valid alternative)
        const emailMfaVerified = sessionStorage.getItem('email_2fa_verified') === 'true';
        const mfaMethod = user?.user_metadata?.mfa_method;

        if (mfaMethod === 'email' && emailMfaVerified) {
          // Email 2FA already verified this session — allow through
          setMfaChecked(true);
          return;
        }

        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error) {
          setMfaChecked(true);
          return;
        }

        // If user has TOTP MFA factors but hasn't verified yet (aal1 -> aal2 needed)
        if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
          navigate('/auth', { replace: true });
          return;
        }

        // Check for email-based 2FA preference (not yet verified)
        if (mfaMethod === 'email' && !emailMfaVerified) {
          navigate('/auth', { replace: true });
          return;
        }

        // No 2FA enrolled or already verified — allow through
      } catch {
        // If MFA check fails, don't block the user
      } finally {
        setMfaChecked(true);
      }
    };

    checkMFA();
  }, [isAuthReady, isAuthenticated, user, location.pathname, navigate]);
  
  // Initialize centralized user data store when authenticated
  // This replaces separate balance and profile store initialization
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      initializeUserData(user.id);
      // Initialize friend store and presence tracking
      useFriendStore.getState().initialize(user.id);
      usePresenceStore.getState().initialize(user.id);
    } else if (isAuthReady && !isAuthenticated) {
      // Only reset if auth is ready and user is definitely logged out
      resetUserData();
      useFriendStore.getState().reset();
      usePresenceStore.getState().reset();
    }
  }, [isAuthenticated, isAuthReady, user?.id, initializeUserData, resetUserData]);
  
  // Show global loading overlay until auth is ready
  useEffect(() => {
    if (!isAuthReady) {
      showLoading("Loading session...");
    } else {
      hideLoading();
    }
  }, [isAuthReady, showLoading, hideLoading]);

  // Don't render children until auth is ready — overlay handles the visual
  if (!isAuthReady || !mfaChecked) {
    return null;
  }
  
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletModalProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <BrowserRouter>
                <ScrollToTop />
                <AppWithAuth>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/how-it-works" element={<HowItWorks />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/deposit" element={<Deposit />} />
                      <Route path="/withdraw" element={<Withdraw />} />
                      <Route path="/games/:gameSlug" element={<GameStart />} />
                      <Route path="/chess-lobby" element={<ChessLobby />} />
                      <Route path="/chess" element={<ChessHome />} />
                      <Route path="/terms" element={<TermsAndConditions />} />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/stats" element={<Stats />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/compete" element={<Compete />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/game-history" element={<GameHistory />} />
                      <Route path="/game/replay/:gameId" element={<GameReplay />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/game/lobby/:roomId" element={<PrivateGameLobby />} />
                      <Route path="/game/live/:gameId" element={
                        <GameErrorBoundary>
                          <LiveGame />
                        </GameErrorBoundary>
                      } />
                      <Route path="/affiliate" element={<Affiliate />} />
                      <Route path="/vip" element={<VIP />} />
                      <Route path="/friends" element={<Friends />} />
                      <Route path="/clan" element={<Clan />} />
                      <Route path="/clan/leaderboard" element={<ClanLeaderboard />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </ErrorBoundary>
                  {/* Wallet Modal - renders at root level */}
                  <WalletModal />
                  {/* Debug panel - only visible with ?debug=1 or in dev */}
                  <AuthDebugPanel />
                </AppWithAuth>
                {/* Global loading overlay — OUTSIDE AppWithAuth so it renders during auth loading */}
                <FullScreenLoaderOverlay />
              </BrowserRouter>
            </ThemeProvider>
          </TooltipProvider>
        </WalletModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
