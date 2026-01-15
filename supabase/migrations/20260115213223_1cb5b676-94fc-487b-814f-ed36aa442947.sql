-- Create payment_internals table
CREATE TABLE public.payment_internals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ipn_callback_url text,
  order_id text NOT NULL,
  pay_address text,
  payment_id text NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.crypto_transactions(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.payment_internals ENABLE ROW LEVEL SECURITY;

-- RLS policy: Only service role can access (internal use only)
CREATE POLICY "Service role only" ON public.payment_internals
  FOR ALL USING (false);

-- Add missing foreign keys to games table
ALTER TABLE public.games
  ADD CONSTRAINT games_black_player_id_fkey 
  FOREIGN KEY (black_player_id) REFERENCES public.players(id);

ALTER TABLE public.games
  ADD CONSTRAINT games_white_player_id_fkey 
  FOREIGN KEY (white_player_id) REFERENCES public.players(id);