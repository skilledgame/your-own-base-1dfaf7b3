/**
 * AuthModalContext - Global state for the auth modal (Rainbet-style popup)
 *
 * Allows opening the sign-in / sign-up modal from anywhere in the app
 * without navigating away from the current page.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type AuthModalMode = 'sign-in' | 'sign-up' | 'mfa-verify' | 'email-2fa-verify';

interface AuthModalContextType {
  isOpen: boolean;
  mode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

interface AuthModalProviderProps {
  children: ReactNode;
}

export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>('sign-up');

  const openAuthModal = useCallback((m: AuthModalMode = 'sign-up') => {
    setMode(m);
    setIsOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        mode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
