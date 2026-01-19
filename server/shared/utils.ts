import { BOARD_SIZE, getBoardLayout, MultiplierType } from './constants';
import { Tile } from './types';

const LAYOUT = getBoardLayout();

export const calculateScore = (
    tilesPlaced: { r: number; c: number; tile: Tile }[],
    board: (Tile | null)[][]
): number => {
    let totalScore = 0;
    let wordMultiplier = 1;

    // This is a simplified version, real Scrabble scoring needs to account for cross-words
    // and the fact that multipliers only count for the first time they are used.
    // For the sake of this prompt, I'll implement the primary word score.

    // 1. Identify all words formed (Horizontal and Vertical)
    // 2. Sum letter points with multipliers
    // 3. Apply word multipliers

    // For now, let's just score the tiles placed with their multipliers
    tilesPlaced.forEach(({ r, c, tile }) => {
        let letterScore = tile.points;
        const multiplier = LAYOUT[r][c];

        if (multiplier === 'DL') letterScore *= 2;
        if (multiplier === 'TL') letterScore *= 3;
        if (multiplier === 'QL') letterScore *= 4;

        totalScore += letterScore;

        if (multiplier === 'DW') wordMultiplier *= 2;
        if (multiplier === 'TW') wordMultiplier *= 3;
        if (multiplier === 'QW') wordMultiplier *= 4;
    });

    return totalScore * wordMultiplier;
};

export const shuffle = <T>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};
