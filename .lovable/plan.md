

## Fix Battle Royale Card: Bigger Bishop + Brighter Yellow

### What Went Wrong
The previous image generation attempts failed to properly save/update the `chess-rook-battle.png` file. The component still references the old asset.

### What I'll Do

**1. Regenerate the Asset (`src/assets/chess-rook-battle.png`)**
- Create a **large realistic ivory bishop** matching your reference image style
- Make it **bigger** - filling ~85% of the vertical frame, centered
- Use a **brighter golden yellow background** (shifting from the current brownish `#78350f` to a more saturated bright yellow like `#ca8a04`)
- Include dramatic spotlight floor lighting and subtle reflections

**2. Update the Component (`src/components/chess/BattleRoyaleModeCard.tsx`)**
| Line | Current | Updated |
|------|---------|---------|
| 2 | "rook piece" | "bishop piece" |
| 7 | `rookCharacter` import | `bishopCharacter` import |
| 49 | `background: '#78350f'` | `background: '#b45309'` (brighter yellow) |
| 55 | "Rook Character" comment | "Bishop Character" |
| 57 | `src={rookCharacter}` | `src={bishopCharacter}` |
| 58 | alt="Battle Royale Mode Rook" | alt="Battle Royale Mode Bishop" |

### Visual Specification
- **Piece**: Realistic 3D ivory bishop (classical Staunton style like your knight reference)
- **Size**: Large, filling ~85% of vertical frame
- **Background**: Bright saturated golden yellow
- **Lighting**: Dramatic spotlight with floor reflections

