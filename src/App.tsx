import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
