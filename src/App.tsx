import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import { useEnsureUser } from "./hooks/useEnsureUser";
import { useEffect } from "react";
import { useBalanceStore } from "./stores/balanceStore";
import { useAuth } from "./contexts/AuthContext";

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

// Wrapper to run the ensure-user hook and balance subscription at app level
function AppWithAuth({ children }: { children: React.ReactNode }) {
  useEnsureUser();
  
  // Set up balance subscription when authenticated
  const { user, isAuthenticated } = useAuth();
  const { fetchBalance, subscribeToBalance, reset } = useBalanceStore();
  
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchBalance(user.id);
      subscribeToBalance(user.id);
    } else {
      reset();
    }
  }, [isAuthenticated, user?.id, fetchBalance, subscribeToBalance, reset]);
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppWithAuth>
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppWithAuth>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
