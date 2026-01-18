import { Tile } from './shared/types';
import { BOARD_SIZE, getBoardLayout } from './shared/constants';

type Board = (Tile | null)[][];
type Move = { r: number, c: number, tile: Tile }[];

const LAYOUT = getBoardLayout();

interface ScoredWord {
    word: string;
    points: number;
}

export const calculateMoveScore = (board: Board, move: Move): { score: number, words: ScoredWord[] } => {
    let totalScore = 0;
    const words: ScoredWord[] = [];
    const newTilesMap = new Map<string, Tile>();
    move.forEach(m => newTilesMap.set(`${m.r},${m.c}`, m.tile));

    // Helper to get tile at pos (either on board or in current move)
    const getTile = (r: number, c: number): Tile | null => {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
        if (newTilesMap.has(`${r},${c}`)) return newTilesMap.get(`${r},${c}`)!;
        return board[r][c];
    };

    // Determine orientation
    const isRow = move.length > 1 ? move[0].r === move[1].r : true; // Default to row for single tile unless... well single tile needs check both
    const isCol = move.length > 1 ? move[0].c === move[1].c : false;

    // Helper to scan a line
    const scanLine = (r: number, c: number, dr: number, dc: number): { wordStr: string, points: number, tiles: { r: number, c: number }[] } | null => {
        let min = isRow || dr === 0 ? c : r; // simple index for sorting
        // backtrack
        let currR = r;
        let currC = c;
        while (getTile(currR - dr, currC - dc)) {
            currR -= dr;
            currC -= dc;
        }

        const tilesInWord: { r: number, c: number, tile: Tile, isNew: boolean }[] = [];
        let wordStr = '';

        // Scan forward
        while (getTile(currR, currC)) {
            const t = getTile(currR, currC)!;
            const isNew = newTilesMap.has(`${currR},${currC}`);
            tilesInWord.push({ r: currR, c: currC, tile: t, isNew });
            wordStr += t.letter;
            currR += dr;
            currC += dc;
        }

        if (tilesInWord.length < 2) return null; // Single letters don't count as words (unless it's the very first move? No, always 2+)

        // Calculate Score
        let wordScore = 0;
        let wordMultiplier = 1;

        tilesInWord.forEach(({ r, c, tile, isNew }) => {
            let letterPoints = tile.points;
            if (isNew) {
                const mult = LAYOUT[r][c];
                if (mult === 'DL') letterPoints *= 2;
                if (mult === 'TL') letterPoints *= 3;
                if (mult === 'QL') letterPoints *= 4;

                if (mult === 'DW') wordMultiplier *= 2;
                if (mult === 'TW') wordMultiplier *= 3;
                if (mult === 'QW') wordMultiplier *= 4;
            }
            wordScore += letterPoints;
        });

        return { wordStr, points: wordScore * wordMultiplier, tiles: tilesInWord.map(t => ({ r: t.r, c: t.c })) };
    };

    // 1. Find Primary Word
    // Use the first tile of the move as a seed
    // If single tile, we need to check both directions, but the logic below handles "cross checking" effectively.
    // However, if single tile, one direction forms the "main" word and the other "cross".
    // Let's explicitly try to form a word along the move's axis.

    let mainWordFound = false;

    // For single tile, we default isRow=true, so we scan horizontal.
    // If that returns null (length < 2), we know horizontal didn't form a word.

    const direction = isCol ? [1, 0] : [0, 1]; // dr, dc

    const mainScan = scanLine(move[0].r, move[0].c, direction[0], direction[1]);
    if (mainScan) {
        words.push({ word: mainScan.wordStr, points: mainScan.points });
        totalScore += mainScan.points;
        mainWordFound = true;
    }

    // 2. Find Cross Words
    // Iterate through every placed tile and scan in the perpendicular direction
    const perpDr = direction[1]; // Swap 0,1 -> 1,0
    const perpDc = direction[0]; // Swap 1,0 -> 0,1 (Wait. 0,1 -> 1,0. 1,0 -> 0,1. Correct)

    move.forEach(m => {
        const crossScan = scanLine(m.r, m.c, perpDr, perpDc);
        if (crossScan) {
            words.push({ word: crossScan.wordStr, points: crossScan.points });
            totalScore += crossScan.points;
        }
    });

    // EDGE CASE: Single tile placement might fail to find "mainScan" if the word was actually vertical (and we guessed Row).
    // If move.length === 1 and mainScan is null, we might have missed the "main" vertical word.
    // But the "cross word" check above (iterating through every tile) would catch the perpendicular word anyway.
    // So if move.length === 1: isRow=true, dir=[0,1]. mainScan checks horizontal. 
    // Computed crossScan checks vertical.
    // So we cover both.

    // Bonus for using all 7 tiles (Bingo)
    if (move.length === 7) {
        totalScore += 50;
    }

    return { score: totalScore, words };
};
