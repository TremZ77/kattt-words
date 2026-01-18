import { Tile, GameState } from './shared/types';
import { BOARD_SIZE, getBoardLayout } from './shared/constants';
import { validateMove } from './validation';
import { calculateMoveScore } from './scoring';
import { isValidWord } from './dictionary';

const LAYOUT = getBoardLayout();

interface CandidateMove {
    word: string;
    score: number;
    move: { r: number, c: number, tile: Tile }[];
}

export class Bot {
    constructor(private id: string, private name: string) { }

    // Simple Greedy Algorithm
    // 1. Find all anchor points (squares adjacent to existing tiles)
    // 2. Or center if first move
    // 3. Try to form words using rack tiles
    // NOTE: A full Scrabble bot is complex (DAWG/GADDAG). This is a simplified "Best Effort" greedy bot.
    // It will try to place words from the dictionary that fit.

    // Simplification: We will just try to find *one* valid move.
    // Making a competitive bot requires a trie/gaddag structure which is heavy. 
    // We will try a very naive approach:
    // - Pick a random anchor.
    // - Try to fit a word from our "small" vocabulary? No, we have the full dictionary.
    // - We can't iterate 170k words.
    // - Strategy: Iterate over the rack permutations (limited length) and try to place them.

    // Better Strategy for "Fast" Bot:
    // - Look at the rack. Form all possible permutations of length 2-7.
    // - Filter those that are valid words.
    // - Try to place them at every anchor point in valid directions.

    // Helper to generate permutations of rack tiles (limited length for speed)
    private getPermutations(rack: Tile[], length: number): Tile[][] {
        if (length === 0) return [[]];
        const results: Tile[][] = [];
        rack.forEach((t, i) => {
            const remaining = [...rack];
            remaining.splice(i, 1);
            const subPerms = this.getPermutations(remaining, length - 1);
            subPerms.forEach(sub => results.push([t, ...sub]));
        });
        return results;
    }

    generateMove(gameState: GameState, rack: Tile[]): { r: number, c: number, tile: Tile }[] | null {
        const board = gameState.board;
        const isFirstMove = board[10][10] === null;

        // Try to find a word of length 2 to 5
        for (let len = 2; len <= 5; len++) {
            const perms = this.getPermutations(rack, len);

            for (const p of perms) {
                const wordStr = p.map(t => t.letter).join('');

                if (isFirstMove) {
                    // Try to play at center
                    // We need full word to be valid
                    if (!isValidWord(wordStr)) continue;

                    // Construct move starting at 10,10 horizontal
                    // Center must be covered. 
                    // Let's just start at 10,10
                    const move = p.map((t, i) => ({ r: 10, c: 10 + i, tile: t }));
                    // Validate
                    const validation = validateMove(board, move, true);
                    if (validation.isValid) return move;

                } else {
                    // Try to attach to an existing tile
                    // Find all occupied cells
                    const occupied: { r: number, c: number, tile: Tile }[] = [];
                    for (let r = 0; r < BOARD_SIZE; r++) {
                        for (let c = 0; c < BOARD_SIZE; c++) {
                            if (board[r][c]) occupied.push({ r, c, tile: board[r][c]! });
                        }
                    }

                    // Shuffle occupied to not always play top-left
                    const shuffledOccupied = occupied.sort(() => 0.5 - Math.random());

                    // Try to play our permutation PERPENDICULAR to an existing tile or EXTENDING it
                    // SIMPLIFICATION for speed:
                    // Just try to form a word using ONE board tile + our permutation
                    // e.g. Rack has [A, T], Board has [C]. We try to play [A, T] such that 'C' is involved.
                    // But we already pre-generated 'perms' from rack only.

                    // BETTER STRATEGY:
                    // Iterate occupied tiles. 
                    // Try to prepend/append our rack tiles to form a valid word.
                    // Too hard to check ALL permutations.

                    // FALLBACK SIMPLE STRATEGY:
                    // 1. Pick a random word from rack permutations (that is valid by itself).
                    // 2. Try to place it anywhere it touches a tile? 
                    //    No, we must check if the crossing words are valid too. `validateMove` does this!
                    // 3. So: Generate a valid word from rack. 
                    // 4. Try to place it at every valid starting position on board (horizontal/vertical).
                    //    If `validateMove` passes, WE ARE GOOD.

                    if (!isValidWord(wordStr)) continue;

                    // Try to place this valid word on the board
                    // Optimization: Only try positions near existing tiles (anchors)
                    // But essentially we just need to try (r,c) such that it connects.
                    // Let's iterate over `shuffledOccupied` and try to intersect.

                    for (const anchor of shuffledOccupied) {
                        // Try to go Horizontal through this anchor
                        // We have word P (length L). 
                        // Anchor is at (ar, ac).
                        // Try placing P such that P[k] overlaps Anchor? No, anchor is already there.
                        // We can't overwrite anchor.

                        // Try placing P such that it is Adjacent to Anchor?
                        // OR, try to create a word that *uses* the anchor letter.
                        // That requires rebuilding permutations including the anchor. Too complex for cheap bot.

                        // EASIEST: Just try to place the word P adjacent to the anchor.
                        // e.g. Anchor is at (10,10). Try placing P at (10, 11) (right of anchor) or (11, 10).

                        // Try Horizontal placement starting at anchor.c + 1
                        if (anchor.c + 1 < BOARD_SIZE) {
                            const moveRight = p.map((t, i) => ({ r: anchor.r, c: anchor.c + 1 + i, tile: t }));
                            if (validateMove(board, moveRight, false).isValid) return moveRight;
                        }

                        // Try Horizontal placing such that it ends at anchor.c - 1
                        if (anchor.c - 1 >= 0) {
                            const startC = anchor.c - p.length;
                            if (startC >= 0) {
                                const moveLeft = p.map((t, i) => ({ r: anchor.r, c: anchor.c - p.length + i, tile: t }));
                                if (validateMove(board, moveLeft, false).isValid) return moveLeft;
                            }
                        }

                        // Vertical Below
                        if (anchor.r + 1 < BOARD_SIZE) {
                            const moveDown = p.map((t, i) => ({ r: anchor.r + 1 + i, c: anchor.c, tile: t }));
                            if (validateMove(board, moveDown, false).isValid) return moveDown;
                        }

                        // Vertical Above
                        if (anchor.r - 1 >= 0) {
                            const moveUp = p.map((t, i) => ({ r: anchor.r - p.length + i, c: anchor.c, tile: t }));
                            if (validateMove(board, moveUp, false).isValid) return moveUp;
                        }
                    }
                }
            }
        }

        return null; // Pass if no move found
    }
}

// NOTE: Real Scrabble bots are hard. I will add a placeholder note.
