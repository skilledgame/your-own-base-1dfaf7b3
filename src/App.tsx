import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AuthLoadingScreen } from "@/components/AuthLoadingScreen";
import { AuthDebugPanel } from "@/components/AuthDebugPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import Auth from "./pages/Auth";
import Deposit from "./pages/Deposit";
import GameStart from "./pages/GameStart";
import ChessLobby from "./pages/ChessLobby";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Profile from "./pages/Profile";
import Compete from "./pages/Compete";
import Search from "./pages/Search";
import Withdraw from "./pages/Withdraw";
import Leaderboard from "./pages/Leaderboard";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import QuickPlay from "./pages/QuickPlay";
import LiveGame from "./pages/LiveGame";
import Affiliate from "./pages/Affiliate";
import { useEnsureUser } from "./hooks/useEnsureUser";
import { useEffect } from "react";
import { useBalanceStore } from "./stores/balanceStore";

// STEP 1: Global error handlers to catch unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[Global Error Handler]', event.error);
    console.error('[Global Error Handler] Stack:', event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global Unhandled Rejection]', event.reason);
    if (event.reason instanceof Error) {
      console.error('[Global Unhandled Rejection] Stack:', event.reason.stack);
    }
  });
}

// Create a stable QueryClient instance outside the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Reduce refetches
      retry: 1,
    },
  },
});

// Wrapper that handles auth-ready gate and initializations
function AppWithAuth({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const { fetchBalance, subscribeToBalance, reset } = useBalanceStore();
  
  // Run ensure-user after auth is ready
  useEnsureUser();
  
  // Set up balance subscription when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchBalance(user.id);
      subscribeToBalance(user.id);
    } else if (isAuthReady && !isAuthenticated) {
      // Only reset if auth is ready and user is definitely logged out
      reset();
    }
  }, [isAuthenticated, isAuthReady, user?.id, fetchBalance, subscribeToBalance, reset]);
  
  // Show loading screen until auth is ready
  if (!isAuthReady) {
    return <AuthLoadingScreen />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/compete" element={<Compete />} />
              <Route path="/search" element={<Search />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/quick-play" element={<QuickPlay />} />
              <Route path="/game/live/:gameId" element={<LiveGame />} />
              <Route path="/affiliate" element={<Affiliate />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
              {/* Debug panel - only visible with ?debug=1 or in dev */}
              <AuthDebugPanel />
            </AppWithAuth>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
