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
import SpectateGame from "./pages/SpectateGame";
import Rewards from "./pages/Rewards";
import { useEnsureUser } from "./hooks/useEnsureUser";
import { usePageAnalytics } from "./hooks/usePageAnalytics";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserDataStore } from "./stores/userDataStore";
import { useFriendStore } from "./stores/friendStore";
import { usePresenceStore } from "./stores/presenceStore";
import { supabase } from "@/integrations/supabase/client";
import { isMfaVerified, setMfaVerified } from "@/lib/mfaStorage";
import { LanguageProvider, stripLangPrefix } from "@/contexts/LanguageContext";
import React from "react";

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

  // MFA enforcement: redirect to /auth if user needs MFA verification.
  // 
  // CRITICAL: This runs ONCE after auth bootstrap, NOT on every route change.
  // Once mfaChecked is true, it stays true for the lifetime of this mount.
  // MFA is only required at sign-in time (persisted via localStorage for 30 days).
  //
  // - If isMfaVerified() is true → skip all checks (covers TOTP + email)
  // - OAuth users (Google): always skip
  // - No 2FA configured: always skip
  useEffect(() => {
    // Already checked — don't re-run on route changes or token refreshes
    if (mfaChecked) return;

    if (!isAuthReady) return;

    if (!isAuthenticated) {
      setMfaChecked(true);
      return;
    }

    // Skip MFA for OAuth users (Google, etc.) — they don't need 2FA
    const provider = user?.app_metadata?.provider;
    if (provider && provider !== 'email') {
      setMfaChecked(true);
      return;
    }

    // Check persistent MFA flag — covers BOTH email and TOTP verification.
    // This flag is set after successful MFA at sign-in and lasts 30 days.
    if (isMfaVerified()) {
      setMfaChecked(true);
      return;
    }

    const checkMFA = async () => {
      try {
        const publicPaths = ['/auth', '/terms', '/privacy', '/how-it-works'];
        const strippedPath = stripLangPrefix(location.pathname);
        if (publicPaths.includes(strippedPath)) {
          setMfaChecked(true);
          return;
        }

        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error) {
          // If MFA check fails, don't block the user
          setMfaChecked(true);
          return;
        }

        // If user has TOTP MFA factors but hasn't verified yet (aal1 -> aal2 needed)
        if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
          navigate('/auth', { replace: true });
          return;
        }

        // If session is already at aal2, backfill the persistent flag
        // (handles users who verified TOTP before the flag code existed)
        if (data.currentLevel === 'aal2') {
          setMfaVerified('totp');
        }

        // Email-based 2FA is ONLY enforced during the login flow
        // (in Auth.tsx handleEmailSubmit). It should NOT force-redirect
        // on page load — the user already has an active session.
        // Only Supabase-native TOTP MFA (AAL levels) is enforced here.
      } catch {
        // If MFA check fails, don't block the user
      } finally {
        setMfaChecked(true);
      }
    };

    checkMFA();
  }, [isAuthReady, isAuthenticated, user, mfaChecked, location.pathname, navigate]);
  
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

const LANG_PREFIXES = ['', '/es', '/hi'];

function generateRoutes(prefix: string) {
  return (
    <React.Fragment key={prefix || 'en'}>
      <Route path={`${prefix}/`} element={<Index />} />
      <Route path={`${prefix}/how-it-works`} element={<HowItWorks />} />
      <Route path={`${prefix}/auth`} element={<Auth />} />
      <Route path={`${prefix}/deposit`} element={<Deposit />} />
      <Route path={`${prefix}/withdraw`} element={<Withdraw />} />
      <Route path={`${prefix}/games/:gameSlug`} element={<GameStart />} />
      <Route path={`${prefix}/chess-lobby`} element={<ChessLobby />} />
      <Route path={`${prefix}/chess`} element={<ChessHome />} />
      <Route path={`${prefix}/terms`} element={<TermsAndConditions />} />
      <Route path={`${prefix}/privacy`} element={<PrivacyPolicy />} />
      <Route path={`${prefix}/stats`} element={<Stats />} />
      <Route path={`${prefix}/settings`} element={<Settings />} />
      <Route path={`${prefix}/compete`} element={<Compete />} />
      <Route path={`${prefix}/search`} element={<Search />} />
      <Route path={`${prefix}/leaderboard`} element={<Leaderboard />} />
      <Route path={`${prefix}/game-history`} element={<GameHistory />} />
      <Route path={`${prefix}/game/replay/:gameId`} element={<GameReplay />} />
      <Route path={`${prefix}/admin`} element={<Admin />} />
      <Route path={`${prefix}/game/lobby/:roomId`} element={<PrivateGameLobby />} />
      <Route path={`${prefix}/game/live/:gameId`} element={
        <GameErrorBoundary>
          <LiveGame />
        </GameErrorBoundary>
      } />
      <Route path={`${prefix}/affiliate`} element={<Affiliate />} />
      <Route path={`${prefix}/vip`} element={<VIP />} />
      <Route path={`${prefix}/friends`} element={<Friends />} />
      <Route path={`${prefix}/clan`} element={<Clan />} />
      <Route path={`${prefix}/clan/leaderboard`} element={<ClanLeaderboard />} />
      <Route path={`${prefix}/game/spectate/:targetUserId`} element={<SpectateGame />} />
      <Route path={`${prefix}/rewards`} element={<Rewards />} />
    </React.Fragment>
  );
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
                <LanguageProvider>
                  <ScrollToTop />
                  <AppWithAuth>
                    <ErrorBoundary>
                      <Routes>
                        {LANG_PREFIXES.map(prefix => generateRoutes(prefix))}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </ErrorBoundary>
                    <WalletModal />
                    <AuthDebugPanel />
                  </AppWithAuth>
                  <FullScreenLoaderOverlay />
                </LanguageProvider>
              </BrowserRouter>
            </ThemeProvider>
          </TooltipProvider>
        </WalletModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
