import { Tile } from './shared/types';
import { BOARD_SIZE, BoardMultiplier } from './shared/constants';

type Board = (Tile | null)[][];
type Move = { r: number, c: number, tile: Tile }[];

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    words?: { word: string, score: number }[]; // Main word + cross words
    mainWord?: string;
    points?: number;
}

// Check if a cell is within bounds
const inBounds = (r: number, c: number) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

export const validateMove = (board: Board, move: Move, isFirstMove: boolean): { isValid: boolean, error?: string } => {
    if (move.length === 0) return { isValid: false, error: 'No tiles placed' };

    // 1. Check Linearity (all in one row or one column)
    const rows = new Set(move.map(m => m.r));
    const cols = new Set(move.map(m => m.c));

    const isRow = rows.size === 1;
    const isCol = cols.size === 1;

    if (!isRow && !isCol) return { isValid: false, error: 'Tiles must be in a single row or column' };

    // 2. Check Overlap (cannot place on existing tile) - Client handles this usually, but double check
    for (const m of move) {
        if (!inBounds(m.r, m.c)) return { isValid: false, error: 'Tile out of bounds' };
        if (board[m.r][m.c]) return { isValid: false, error: 'Tile validation error: Space occupied' };
    }

    // 3. Check Connectivity & Gaps
    // Sort move for easier gap checking
    const sortedMove = [...move].sort((a, b) => isRow ? a.c - b.c : a.r - b.r);

    // Check for gaps filled by existing tiles
    const start = isRow ? sortedMove[0].c : sortedMove[0].r;
    const end = isRow ? sortedMove[sortedMove.length - 1].c : sortedMove[sortedMove.length - 1].r;
    const fixedCoord = isRow ? sortedMove[0].r : sortedMove[0].c;

    let connectedToExisting = false;

    // Iterate from start to end of the placed range
    for (let i = start; i <= end; i++) {
        const r = isRow ? fixedCoord : i;
        const c = isRow ? i : fixedCoord;

        const placedTile = move.find(m => m.r === r && m.c === c);
        const existingTile = board[r][c];

        if (!placedTile && !existingTile) {
            return { isValid: false, error: 'Gap in placed word' };
        }

        if (existingTile) connectedToExisting = true;
    }

    // 4. First Move Rule OR Connection Rule
    if (isFirstMove) {
        // Center is 10,10
        const touchCenter = move.some(m => m.r === 10 && m.c === 10);
        if (!touchCenter) return { isValid: false, error: 'First move must touch the center (Star)' };
        if (move.length < 2) return { isValid: false, error: 'First move must be at least 2 letters' };
    } else {
        // Must connect to an existing tile (neighboring) IF we didn't bridge any existing tiles
        // If we bridged existing tiles (connectedToExisting=true), we are good.
        // If not, we must verify at least one placed tile touches an existing tile.

        if (!connectedToExisting) {
            let touchesExisting = false;
            const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

            for (const m of move) {
                for (const [dr, dc] of directions) {
                    const nr = m.r + dr;
                    const nc = m.c + dc;
                    if (inBounds(nr, nc) && board[nr][nc]) {
                        touchesExisting = true;
                        break;
                    }
                }
                if (touchesExisting) break;
            }
            if (!touchesExisting) return { isValid: false, error: 'Move must connect to existing tiles' };
        }
    }

    return { isValid: true };
};
