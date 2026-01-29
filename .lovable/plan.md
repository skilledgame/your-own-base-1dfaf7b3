

# Wallet Modal Redesign Plan

## Overview
Transform the current separate deposit/withdraw pages into a unified modal overlay (like the Rainbet reference image) that appears on top of the current page. The modal will have four tabs: **Deposit**, **Withdrawal**, **Gift**, and **Redeem**.

---

## What Will Change

### User Experience
- Clicking "Deposit" from the header (or anywhere) will **no longer navigate to a new page**
- Instead, a **modal overlay** will appear on top of the current page (homepage visible in background)
- Users can switch between Deposit, Withdrawal, Gift, and Redeem tabs without leaving the modal
- Clicking outside the modal or the X button closes it and returns to the page they were on

### Visual Design (Inspired by Rainbet Reference)
- Dark modal with `slate-900` background
- Rounded corners with subtle border
- Semi-transparent backdrop overlay (`bg-black/60`)
- Tab buttons at the top (Deposit | Withdrawal | Gift | Redeem)
- Active tab highlighted with primary color
- Close button in top-right corner

---

## Implementation Steps

### 1. Create WalletModal Component
**New file: `src/components/WalletModal.tsx`**

A new modal component that:
- Uses Radix Dialog for accessibility and overlay behavior
- Contains 4 tabs managed by internal state
- Accepts an `open` prop and `onOpenChange` callback
- Can be opened from anywhere in the app

```text
┌─────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════╗  │
│  ║  [Deposit] [Withdrawal] [Gift] [Redeem]   X ║  │
│  ╠═══════════════════════════════════════════╣  │
│  ║                                            ║  │
│  ║     Tab content rendered here              ║  │
│  ║     (amount selection, crypto options,     ║  │
│  ║      payment details, etc.)                ║  │
│  ║                                            ║  │
│  ╚═══════════════════════════════════════════╝  │
│                                                  │
│          (Homepage visible in background)        │
└─────────────────────────────────────────────────┘
```

### 2. Create Tab Content Components
**New files for each tab:**

- **`src/components/wallet/DepositTab.tsx`**: Move deposit logic from current `Deposit.tsx`
  - Amount selection grid (10, 25, 50, 100, 250, 500 USD)
  - Crypto selection (BTC, ETH, USDT, etc.)
  - QR code and payment details display
  
- **`src/components/wallet/WithdrawalTab.tsx`**: Move withdrawal logic from current `Withdraw.tsx`
  - Amount input
  - Wallet address input
  - Crypto method selection
  
- **`src/components/wallet/GiftTab.tsx`**: New feature
  - Send Skilled Coins to another user
  - Search/select recipient by username
  - Enter amount and optional message
  
- **`src/components/wallet/RedeemTab.tsx`**: New feature
  - Enter promo/gift codes
  - Redeem bonuses or promotional offers

### 3. Create Wallet Context/State
**New file: `src/contexts/WalletModalContext.tsx`**

A React context that:
- Manages modal open/closed state globally
- Allows opening to a specific tab (e.g., `openWallet('deposit')`)
- Can be accessed from any component

```typescript
interface WalletModalContextType {
  isOpen: boolean;
  activeTab: 'deposit' | 'withdrawal' | 'gift' | 'redeem';
  openWallet: (tab?: string) => void;
  closeWallet: () => void;
}
```

### 4. Update Trigger Points
**Modify these files to use the modal instead of navigation:**

- **`src/components/BalanceDepositPill.tsx`**: 
  - Change `<Link to="/deposit">` to `onClick={() => openWallet('deposit')}`
  
- **`src/components/UserDropdown.tsx`**: 
  - "Cashier" menu item opens modal instead of navigating
  
- **`src/components/LandingPage.tsx`**: 
  - Mobile balance display opens modal on click
  
- **Other places with deposit links**: Update to use modal

### 5. Update App.tsx
- Wrap app with `WalletModalProvider`
- Add `<WalletModal />` component to render at root level
- Keep routes for direct URL access (`/deposit`, `/withdraw`) that auto-open the modal

### 6. Handle Direct URL Access
Keep the existing routes but modify them to:
- Redirect to home with modal open
- Or render the page with modal auto-opened on top

---

## Technical Details

### Modal Structure
```tsx
<Dialog open={isOpen} onOpenChange={closeWallet}>
  <DialogContent className="max-w-lg bg-slate-900 border-slate-700">
    {/* Tab Navigation */}
    <div className="flex gap-2 border-b border-slate-700 pb-4">
      <TabButton active={tab === 'deposit'}>Deposit</TabButton>
      <TabButton active={tab === 'withdrawal'}>Withdrawal</TabButton>
      <TabButton active={tab === 'gift'}>Gift</TabButton>
      <TabButton active={tab === 'redeem'}>Redeem</TabButton>
    </div>
    
    {/* Tab Content */}
    {tab === 'deposit' && <DepositTab />}
    {tab === 'withdrawal' && <WithdrawalTab />}
    {tab === 'gift' && <GiftTab />}
    {tab === 'redeem' && <RedeemTab />}
  </DialogContent>
</Dialog>
```

### Files to Create
1. `src/contexts/WalletModalContext.tsx` - Global modal state
2. `src/components/WalletModal.tsx` - Main modal component
3. `src/components/wallet/DepositTab.tsx` - Deposit content
4. `src/components/wallet/WithdrawalTab.tsx` - Withdrawal content
5. `src/components/wallet/GiftTab.tsx` - Gift feature
6. `src/components/wallet/RedeemTab.tsx` - Redeem feature

### Files to Modify
1. `src/App.tsx` - Add provider and modal
2. `src/components/BalanceDepositPill.tsx` - Use modal trigger
3. `src/components/UserDropdown.tsx` - Use modal trigger
4. `src/components/LandingPage.tsx` - Mobile deposit trigger
5. `src/pages/Deposit.tsx` - Redirect to home with modal open (optional: keep for SEO)
6. `src/pages/Withdraw.tsx` - Similar redirect handling

---

## Gift & Redeem Features (New)

### Gift Tab
- Search for users by username/email
- Enter amount to send
- Optional message
- Confirm transaction
- Note: Requires backend work (edge function for secure transfer)

### Redeem Tab  
- Input field for promo codes
- "Redeem" button
- Display success/error messages
- Note: Requires backend table for promo codes

---

## Summary
This redesign creates a unified, modal-based wallet experience that keeps users on their current page while managing all financial transactions. The four-tab structure (Deposit, Withdrawal, Gift, Redeem) provides a comprehensive wallet interface inspired by the Rainbet design.

