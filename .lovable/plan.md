
# Move Logo to Main Header and Add Hamburger to Sidebar

## What We're Changing

### Main Screen Header (LandingPage.tsx)
- Remove the `SideMenuTrigger` hamburger button (lines 180-189)
- Keep the `LogoLink` that's already there (line 190)
- The logo will just be a link to home, not a toggle

### Sidebar Header (DesktopSideMenu.tsx)
- Remove the `LogoLink` from the sidebar header
- Add a hamburger (`Menu`) button that toggles collapsed/expanded state
- The hamburger button stays fixed in the same position whether collapsed or expanded

## File Changes

### 1. src/components/LandingPage.tsx

**Remove the SideMenuTrigger and its toggle logic (lines 179-189):**
```tsx
// Before:
<div className="flex items-center gap-4">
  {/* Side Menu Trigger - Desktop Only, Far Left - Toggles collapsed state */}
  <SideMenuTrigger onClick={() => {
    // On desktop: toggle collapsed state (never fully close)
    if (window.innerWidth >= 768) {
      setSidebarCollapsed(!sidebarCollapsed);
      if (!sideMenuOpen) setSideMenuOpen(true);
    } else {
      // On mobile: toggle visibility
      setSideMenuOpen(!sideMenuOpen);
    }
  }} />
  <LogoLink className="h-12 sm:h-14" />

// After:
<div className="flex items-center gap-4">
  <LogoLink className="h-12 sm:h-14" />
```

Also remove the unused `SideMenuTrigger` import from line 12.

### 2. src/components/DesktopSideMenu.tsx

**Replace LogoLink in sidebar header with a hamburger button (lines 127-138):**
```tsx
// Before:
<div className="flex items-center justify-between p-4 border-b border-border">
  {!collapsed && <LogoLink className="h-8" onClick={onToggle} />}
  {collapsed && (
    <div className="w-full flex justify-center">
      <LogoLink className="h-6" onClick={onToggle} />
    </div>
  )}
  {/* Mobile: X to close completely */}
  <Button variant="ghost" size="icon" onClick={onToggle} className="md:hidden">
    <X className="h-5 w-5" />
  </Button>
</div>

// After:
<div className="flex items-center justify-between p-4 border-b border-border">
  {/* Desktop: Hamburger menu to toggle collapsed state - stays fixed */}
  <Button 
    variant="ghost" 
    size="icon" 
    onClick={handleCollapseToggle}
    className="hidden md:flex h-10 w-10"
  >
    <Menu className="h-5 w-5" />
  </Button>
  {/* Mobile: X to close completely */}
  <Button variant="ghost" size="icon" onClick={onToggle} className="md:hidden">
    <X className="h-5 w-5" />
  </Button>
</div>
```

Remove the `LogoLink` import since it's no longer used in this file.

## Visual Result

```text
┌─────────────────────────────────────────────────┐
│ MAIN HEADER                                     │
│ [Logo]  Games  How It Works     [Balance] [Dep] │
└─────────────────────────────────────────────────┘

┌────────┐                                         
│ SIDEBAR│ (Collapsed - icons only)
│ [☰]    │ ← Hamburger stays here
│        │
│ [🏠]   │
│ [🎮]   │
│ [♟️]   │
└────────┘

┌─────────────────┐
│ SIDEBAR         │ (Expanded)
│ [☰]             │ ← Same hamburger, same spot
│                 │
│ [🏠] Home       │
│ [🎮] Games      │
│ [♟️] Play Chess │
└─────────────────┘
```

## Summary
- Logo stays on the main header (link to home only)
- Hamburger button added to sidebar header (toggles collapsed/expanded)
- Hamburger button position is fixed regardless of sidebar state
