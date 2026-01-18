/**
 * Captured Pieces Display Component
 * Shows captured pieces with material advantage indicator
 */

import { memo } from 'react';
import { PieceSymbol } from 'chess.js';
import { PIECE_SYMBOLS_SMALL, PIECE_VALUES } from '@/lib/chessConstants';
import { cn } from '@/lib/utils';

interface CapturedPiecesProps {
  pieces: PieceSymbol[];
  color: 'white' | 'black';
  materialAdvantage?: number;  // Positive if this player is ahead
}

export const CapturedPieces = memo(({ pieces, color, materialAdvantage }: CapturedPiecesProps) => {
  // Sort by value (highest first)
  const sortedPieces = [...pieces].sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);
  
  return (
    <div className="flex items-center gap-1 min-h-[24px]">
      {/* Captured pieces display */}
      <div className="flex items-center -space-x-1">
        {sortedPieces.map((piece, index) => (
          <span 
            key={`${piece}-${index}`}
            className={cn(
              "text-lg select-none",
              color === 'white' ? "text-foreground/80" : "text-muted-foreground"
            )}
            title={getPieceName(piece)}
          >
            {PIECE_SYMBOLS_SMALL[piece]}
          </span>
        ))}
      </div>
      
      {/* Material advantage indicator */}
      {materialAdvantage !== undefined && materialAdvantage > 0 && (
        <span className="text-sm font-bold text-primary ml-2">
          +{materialAdvantage}
        </span>
      )}
    </div>
  );
});

CapturedPieces.displayName = 'CapturedPieces';

function getPieceName(piece: PieceSymbol): string {
  const names: Record<PieceSymbol, string> = {
    p: 'Pawn',
    n: 'Knight',
    b: 'Bishop',
    r: 'Rook',
    q: 'Queen',
    k: 'King',
  };
  return names[piece];
}
