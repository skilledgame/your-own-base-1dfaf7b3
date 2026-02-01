import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X, User, Sparkles } from 'lucide-react';
import { z } from 'zod';

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed');

interface UsernameCreationModalProps {
  isOpen: boolean;
  userId: string;
  onComplete: (username: string) => void;
}

export function UsernameCreationModal({ isOpen, userId, onComplete }: UsernameCreationModalProps) {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Debounced username check
  const checkUsernameAvailability = useCallback(async (name: string) => {
    if (!name || name.length < 3) {
      setIsAvailable(null);
      return;
    }

    // Validate format first
    try {
      usernameSchema.parse(name);
      setValidationError(null);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
        setIsAvailable(null);
        return;
      }
    }

    setIsChecking(true);
    
    try {
      // Check if username exists in profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', name)
        .neq('user_id', userId)
        .limit(1);

      if (error) {
        console.error('Error checking username:', error);
        setIsAvailable(null);
        return;
      }

      setIsAvailable(data.length === 0);
    } catch (error) {
      console.error('Username check failed:', error);
      setIsAvailable(null);
    } finally {
      setIsChecking(false);
    }
  }, [userId]);

  // Debounce the username check
  useEffect(() => {
    const trimmed = username.trim();
    
    if (!trimmed) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(trimmed);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [username, checkUsernameAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    
    // Final validation
    try {
      usernameSchema.parse(trimmedUsername);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setValidationError(error.errors[0].message);
        return;
      }
    }

    if (!isAvailable) {
      toast({
        variant: 'destructive',
        title: 'Username unavailable',
        description: 'Please choose a different username.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Update the profile with the new username
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmedUsername })
        .eq('user_id', userId);

      if (error) throw error;

      // Also update the players table if it exists
      await supabase
        .from('players')
        .update({ name: trimmedUsername })
        .eq('user_id', userId);

      toast({
        title: 'Username created!',
        description: `Welcome to Skilled, ${trimmedUsername}!`,
      });

      onComplete(trimmedUsername);
    } catch (error) {
      console.error('Error saving username:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save username',
        description: 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputBorderClass = () => {
    if (validationError) return 'border-destructive focus-visible:ring-destructive';
    if (isAvailable === true) return 'border-emerald-500 focus-visible:ring-emerald-500';
    if (isAvailable === false) return 'border-destructive focus-visible:ring-destructive';
    return '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl relative overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
              
              {/* Sparkle decorations */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl"
              />
              
              <div className="relative">
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', damping: 15 }}
                    className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-primary-foreground" />
                  </motion.div>
                  
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-foreground mb-2"
                  >
                    Choose Your Username
                  </motion.h1>
                  
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-muted-foreground"
                  >
                    This is how other players will see you
                  </motion.p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-2"
                  >
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter your gaming name"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`pl-10 pr-10 ${getInputBorderClass()}`}
                        maxLength={20}
                        autoFocus
                        disabled={isSubmitting}
                      />
                      
                      {/* Status indicator */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isChecking && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {!isChecking && isAvailable === true && !validationError && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 15 }}
                          >
                            <Check className="w-4 h-4 text-emerald-500" />
                          </motion.div>
                        )}
                        {!isChecking && (isAvailable === false || validationError) && username.length >= 3 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 15 }}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                    
                    {/* Validation messages */}
                    <AnimatePresence mode="wait">
                      {validationError && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-sm text-destructive"
                        >
                          {validationError}
                        </motion.p>
                      )}
                      {!validationError && isAvailable === false && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-sm text-destructive"
                        >
                          Username is already taken, please choose another.
                        </motion.p>
                      )}
                      {!validationError && isAvailable === true && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-sm text-emerald-500"
                        >
                          Username is available!
                        </motion.p>
                      )}
                    </AnimatePresence>
                    
                    <p className="text-xs text-muted-foreground">
                      3-20 characters. Letters, numbers, and underscores only.
                    </p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || !isAvailable || isChecking || !!validationError}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Continue'
                      )}
                    </Button>
                  </motion.div>
                </form>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}