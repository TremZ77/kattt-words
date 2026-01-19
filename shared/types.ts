export interface Tile {
    letter: string;
    points: number;
}

export interface Player {
    id: string;
    name: string;
    score: number;
    rack: Tile[];
    isReady: boolean;
    isBot?: boolean;
    userId?: string;
    moveHistory: { word: string, points: number }[];
}

export interface GameState {
    board: (Tile | null)[][];
    players: Player[];
    currentPlayerIndex: number;
    tileBagCount: number;
    gameStatus: 'LOBBY' | 'PLAYING' | 'FINISHED';
    roomCode: string;
    lastMove?: Move;
}

export interface Move {
    playerId: string;
    tiles: { r: number; c: number; tile: Tile }[];
    word: string;
    points: number;
}

export interface ServerToClientEvents {
    gameUpdate: (state: GameState) => void;
    error: (msg: string) => void;
    profileUpdated: (user: any) => void;
    stats: (user: any) => void;
}

export interface ClientToServerEvents {
    createRoom: (playerName: string, userId: string) => void;
    joinRoom: (roomCode: string, playerName: string, userId: string) => void;
    addBot: (roomCode: string) => void;
    ready: () => void;
    playWord: (move: { r: number, c: number, tile: Tile }[]) => void;
    passTurn: () => void;
    swapTiles: (tiles: Tile[]) => void;
    createProfile: (data: { id: string; name: string }) => void;
    getStats: (id: string) => void;
}
