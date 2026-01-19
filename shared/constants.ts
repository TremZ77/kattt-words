export const BOARD_SIZE = 21;

export type MultiplierType = 'NONE' | 'DL' | 'TL' | 'QL' | 'DW' | 'TW' | 'QW';

export interface Tile {
  letter: string;
  points: number;
}

export type BoardMultiplier = MultiplierType;

export const TILE_DISTRIBUTION: Record<string, { count: number; points: number }> = {
  'A': { count: 16, points: 1 },
  'B': { count: 4, points: 3 },
  'C': { count: 6, points: 3 },
  'D': { count: 8, points: 2 },
  'E': { count: 24, points: 1 },
  'F': { count: 4, points: 4 },
  'G': { count: 5, points: 2 },
  'H': { count: 5, points: 4 },
  'I': { count: 13, points: 1 },
  'J': { count: 2, points: 8 },
  'K': { count: 2, points: 5 },
  'L': { count: 7, points: 1 },
  'M': { count: 6, points: 3 },
  'N': { count: 13, points: 1 },
  'O': { count: 15, points: 1 },
  'P': { count: 4, points: 3 },
  'Q': { count: 2, points: 10 },
  'R': { count: 13, points: 1 },
  'S': { count: 10, points: 1 },
  'T': { count: 15, points: 1 },
  'U': { count: 7, points: 1 },
  'V': { count: 3, points: 4 },
  'W': { count: 4, points: 4 },
  'X': { count: 2, points: 8 },
  'Y': { count: 4, points: 4 },
  'Z': { count: 2, points: 10 },
  'BLANK': { count: 4, points: 0 },
};

export const INITIAL_TILE_BAG: Tile[] = Object.entries(TILE_DISTRIBUTION).flatMap(
  ([letter, { count, points }]) => Array(count).fill({ letter: letter === 'BLANK' ? '' : letter, points })
);

// Helper to generate the 21x21 board multipliers
// 0,0 is top-left. 10,10 is the center.
export const getBoardLayout = (): BoardMultiplier[][] => {
  const layout: BoardMultiplier[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill('NONE'));

  // Center is always a start square (DW effectively)
  layout[10][10] = 'DW';

  // Standard Scrabble layout in the middle 15x15 (centered at 10,10)
  // Offset of 3 from the edges (21 - 15) / 2 = 3
  const offset = 3;
  const standardBoard: MultiplierType[][] = [
    ['TW', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'TW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'TW'],
    ['NONE', 'DW', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE'],
    ['NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE'],
    ['DL', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'DL'],
    ['NONE', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'NONE'],
    ['NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE'],
    ['NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE'],
    ['TW', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'TW'],
    ['NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE'],
    ['NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE'],
    ['NONE', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'NONE'],
    ['DL', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE', 'DL'],
    ['NONE', 'NONE', 'DW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE', 'NONE'],
    ['NONE', 'DW', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'TL', 'NONE', 'NONE', 'NONE', 'DW', 'NONE'],
    ['TW', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'NONE', 'TW', 'NONE', 'NONE', 'NONE', 'DL', 'NONE', 'NONE', 'TW'],
  ];

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      layout[r + offset][c + offset] = standardBoard[r][c];
    }
  }

  // Super Scrabble specific additions (Outer layers)
  // Quadruple Word scores at corners
  layout[0][0] = 'QW';
  layout[0][BOARD_SIZE - 1] = 'QW';
  layout[BOARD_SIZE - 1][0] = 'QW';
  layout[BOARD_SIZE - 1][BOARD_SIZE - 1] = 'QW';

  // Four more Quadruple Word scores on outer edges
  layout[0][10] = 'QW';
  layout[20][10] = 'QW';
  layout[10][0] = 'QW';
  layout[10][20] = 'QW';

  // Quadruple Letter scores
  const qlCoords = [
    [0, 3], [0, 17], [3, 0], [17, 0],
    [20, 3], [20, 17], [3, 20], [17, 20],
    [7, 7], [7, 13], [13, 7], [13, 13] // Some inside too
  ];
  qlCoords.forEach(([r, c]) => {
    if (r < BOARD_SIZE && c < BOARD_SIZE) layout[r][c] = 'QL';
  });

  // More Triple Word Scores on the outermost ring
  const twCoords = [
    [0, 7], [0, 13], [7, 0], [13, 0],
    [20, 7], [20, 13], [7, 20], [13, 20]
  ];
  twCoords.forEach(([r, c]) => {
    layout[r][c] = 'TW';
  });

  return layout;
};
