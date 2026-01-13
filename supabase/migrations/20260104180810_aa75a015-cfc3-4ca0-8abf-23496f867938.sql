-- Players table - stores player sessions and credits
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for players (no auth required for this game)
CREATE POLICY "Anyone can create players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can update players" ON public.players FOR UPDATE USING (true);

-- Matchmaking queue
CREATE TABLE public.matchmaking_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  wager INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_id)
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join queue" ON public.matchmaking_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read queue" ON public.matchmaking_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can leave queue" ON public.matchmaking_queue FOR DELETE USING (true);

-- Active games
CREATE TABLE public.games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  white_player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  black_player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  wager INTEGER NOT NULL,
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  white_time INTEGER NOT NULL DEFAULT 60,
  black_time INTEGER NOT NULL DEFAULT 60,
  current_turn TEXT NOT NULL DEFAULT 'w',
  status TEXT NOT NULL DEFAULT 'active',
  winner_id UUID REFERENCES public.players(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create games" ON public.games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Anyone can update games" ON public.games FOR UPDATE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;