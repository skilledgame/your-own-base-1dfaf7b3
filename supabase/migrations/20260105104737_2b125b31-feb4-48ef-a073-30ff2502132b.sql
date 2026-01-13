-- 1. Remove email from profiles table (it's already in auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 2. Create a separate server-only table for sensitive payment data
-- Move sensitive fields to a new table that users cannot access
CREATE TABLE IF NOT EXISTS public.payment_internals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.crypto_transactions(id) ON DELETE CASCADE,
  ipn_callback_url text,
  pay_address text,
  payment_id text NOT NULL,
  order_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but with NO policies (only service role can access)
ALTER TABLE public.payment_internals ENABLE ROW LEVEL SECURITY;

-- Migrate existing data
INSERT INTO public.payment_internals (transaction_id, ipn_callback_url, pay_address, payment_id, order_id)
SELECT id, ipn_callback_url, pay_address, payment_id, order_id FROM public.crypto_transactions
ON CONFLICT DO NOTHING;

-- Remove sensitive columns from crypto_transactions
ALTER TABLE public.crypto_transactions DROP COLUMN IF EXISTS ipn_callback_url;
ALTER TABLE public.crypto_transactions DROP COLUMN IF EXISTS pay_address;

-- 3. Add explicit policies for operations that should be blocked

-- Players table: Allow user to delete their own account
CREATE POLICY "Users can delete own player" ON public.players
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Profiles table: Allow users to delete their profile
CREATE POLICY "Users can delete own profile" ON public.profiles
FOR DELETE TO authenticated
USING (auth.uid() = user_id);