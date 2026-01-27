-- Fix security: Block anonymous access to profiles table
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Fix security: Block anonymous access to crypto_transactions table  
CREATE POLICY "Block anonymous access to crypto_transactions"
ON public.crypto_transactions
FOR SELECT
TO anon
USING (false);