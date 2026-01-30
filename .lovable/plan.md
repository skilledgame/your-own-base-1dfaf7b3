

## Fix: Use the Correct Image Asset

### The Problem

The `OnlineModeCard.tsx` component imports `chess-rook-character.png`:
```tsx
import rookCharacter from '@/assets/chess-rook-character.png';
```

But the recent image updates were made to `online-chess-card.png` - a completely different file that's not being used. That's why you saw no changes.

### The Solution

**Option A: Update the correct PNG file**
- Generate a new `chess-rook-character.png` with:
  - Same rook (no cross, no crown)
  - Dark blue background (#0f2536) instead of the light blue
  - Eyes subtly integrated into the rook surface
  - Transparent or matching background so it blends with the card

**Option B: Switch to the other image**
- Change the import in `OnlineModeCard.tsx` to use `online-chess-card.png` instead
- But this would require restructuring since that image was designed as a full card with text baked in

### Recommended Approach

**Option A** is cleaner - update `chess-rook-character.png` properly so the eyes overlay works correctly on top of it.

### What Will Be Changed

| File | Change |
|------|--------|
| `src/assets/chess-rook-character.png` | Replace with rook on dark blue (#0f2536) background, integrated eye sockets |

### Technical Note

The animated eyes in the code will overlay on top of the rook image at position `top: 26%`. The rook image itself should NOT have eyes - they're rendered by the React code for the animation effect.

