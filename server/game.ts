import { GameState, Player, Tile, Move } from './shared/types';
import { BOARD_SIZE, INITIAL_TILE_BAG } from './shared/constants';
import { shuffle } from './shared/utils';
import { validateMove } from './validation';
import { calculateMoveScore } from './scoring';
import { isValidWord } from './dictionary';
import { Bot } from './bot';

export class SuperScrabbleGame {
    private state: GameState;
    private tileBag: Tile[];

    constructor(roomCode: string) {
        this.tileBag = shuffle([...INITIAL_TILE_BAG]);
        this.state = {
            board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
            players: [],
            currentPlayerIndex: 0,
            tileBagCount: this.tileBag.length,
            gameStatus: 'LOBBY',
            roomCode,
        };
    }

    addPlayer(id: string, name: string, userId: string = '', isBot: boolean = false) {
        if (this.state.players.length >= 6) return false;
        this.state.players.push({
            id,
            name,
            score: 0,
            rack: [],
            isReady: isBot, // Bots are always ready
            isBot,
            userId: userId || undefined
        });

        // ...
        // If lobby, check if all ready
        // Auto-start disabled. logic removed.
        // if (this.state.gameStatus === 'LOBBY' && this.state.players.length >= 2 && this.state.players.every((p: Player) => p.isReady)) {
        //    this.startGame();
        // }

        return true;
    }

    // ...

    public onGameOver: ((results: { userId?: string, score: number, isWinner: boolean, isBot?: boolean }[]) => void) | null = null;

    private endGame() {
        this.state.gameStatus = 'FINISHED';

        // Calculate winner
        const maxScore = Math.max(...this.state.players.map(p => p.score));

        if (this.onGameOver) {
            const results = this.state.players.map(p => ({
                userId: p.userId,
                score: p.score,
                isWinner: p.score === maxScore,
                isBot: p.isBot
            }));
            this.onGameOver(results);
        }
    }

    // ... existing removePlayer ...

    // ... existing setPlayerReady ...

    // ... existing startGame ...

    // ... existing drawTiles ...

    // ... existing playWord ...

    private nextTurn() {
        this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;

        // Check if next player is Bot
        const nextPlayer = this.state.players[this.state.currentPlayerIndex];
        if (nextPlayer.isBot) {
            // Trigger Bot Move with a small delay for realism
            setTimeout(() => this.handleBotTurn(nextPlayer.id), 1500);
        }
    }

    private async handleBotTurn(botId: string) {
        try {
            console.log(`[Bot] Turn started for ${botId}`);
            // Validation: Ensure it's still bot's turn
            const currentPlayer = this.state.players[this.state.currentPlayerIndex];
            if (currentPlayer.id !== botId || this.state.gameStatus !== 'PLAYING') {
                console.log(`[Bot] Turn aborted: Not bot's turn or game not playing.`);
                return;
            }

            const bot = new Bot(botId, currentPlayer.name);
            console.log(`[Bot] Generating move...`);
            const move = bot.generateMove(this.state, currentPlayer.rack);

            if (move) {
                console.log(`[Bot] Move found! Playing...`);
                const result = await this.playWord(botId, move);
                if (result.error) {
                    console.error(`[Bot] Failed to play calculated move: ${result.error}`);
                    // Fallback to swap/pass
                    if (this.tileBag.length > 0) this.swap(botId);
                    else this.nextTurn();
                }
            } else {
                console.log(`[Bot] No move found.`);
                // Swap tiles to try to get better letters, if bag has tiles
                if (this.tileBag.length > 0) {
                    console.log(`[Bot] Swapping tiles.`);
                    this.swap(botId);
                } else {
                    console.log(`[Bot] Passing.`);
                    this.nextTurn();
                }
            }
        } catch (err) {
            console.error(`[Bot] Error during turn execution:`, err);
            // Ensure game proceeds even if bot crashes
            this.nextTurn();
        }
    }

    public onUpdate: ((state: GameState) => void) | null = null;


    setPlayerReady(id: string) {
        const player = this.state.players.find((p: Player) => p.id === id);
        if (player) {
            player.isReady = true;
        }
    }

    removePlayer(id: string) {
        this.state.players = this.state.players.filter((p: Player) => p.id !== id);
    }

    // Auto-start removed. Host must start manually.
    /* 
    if (this.state.players.length >= 2 && this.state.players.every((p: Player) => p.isReady)) {
        this.startGame();
    } 
    */

    public startGame() {
        if (this.state.players.length < 2) return;
        this.state.gameStatus = 'PLAYING';
        this.state.players.forEach((player: Player) => {
            player.rack = this.drawTiles(7);
        });
        this.state.tileBagCount = this.tileBag.length;
    }

    swap(playerId: string) {
        if (this.state.gameStatus !== 'PLAYING') return;
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) return;

        // Swap 7 or less
        const count = Math.min(player.rack.length, 7);
        if (count === 0) return;

        // Return tiles to bag
        this.tileBag.push(...player.rack);
        this.tileBag = shuffle(this.tileBag);

        // Clear rack and redraw
        player.rack = [];
        player.rack = this.drawTiles(count);

        this.nextTurn();
    }

    private drawTiles(count: number): Tile[] {
        const drawn = this.tileBag.splice(0, count);
        this.state.tileBagCount = this.tileBag.length;
        return drawn;
    }

    async playWord(playerId: string, move: { r: number, c: number, tile: Tile }[]) {
        if (this.state.gameStatus !== 'PLAYING') return { error: 'Game not playing' };
        const player = this.state.players[this.state.currentPlayerIndex];
        if (player.id !== playerId) return { error: 'Not your turn' };

        // 1. Validate Move Geometry & Rules
        const isFirstMove = this.state.board[10][10] === null;
        const validation = validateMove(this.state.board, move, isFirstMove);
        if (!validation.isValid) {
            return { error: validation.error };
        }

        // 2. Calculate Score & Extract Words
        // We do this BEFORE updating the board to properly check "new" vs "old" tiles in logic, 
        // BUT our scoring logic expects "move" to be passed separately.
        const { score, words } = calculateMoveScore(this.state.board, move);

        // 3. Validate Words against Dictionary
        const invalidWords = words.filter((w: { word: string }) => !isValidWord(w.word));
        if (invalidWords.length > 0) {
            return { error: `Invalid word(s): ${invalidWords.map(w => w.word).join(', ')}` };
        }

        // 4. Apply Changes
        player.score += score;

        // Update board
        move.forEach(({ r, c, tile }) => {
            this.state.board[r][c] = tile;
            // Remove from rack
            let tileIndex = -1;
            if (tile.points === 0) {
                // If it's a blank tile (0 points), find ANY blank tile in rack
                // Usually blank tiles in rack have letter '' or ' ' and points 0
                tileIndex = player.rack.findIndex((t: Tile) => t.points === 0);
            } else {
                tileIndex = player.rack.findIndex((t: Tile) => t.letter === tile.letter && t.points !== 0);
            }

            if (tileIndex !== -1) player.rack.splice(tileIndex, 1);
        });

        // Refill rack
        const needed = 7 - player.rack.length;
        if (this.tileBag.length > 0) {
            player.rack.push(...this.drawTiles(needed));
        }

        // Check for Game Over (Empty bag + Empty rack)
        if (this.tileBag.length === 0 && player.rack.length === 0) {
            this.endGame();
        }

        // Next turn
        this.nextTurn();

        this.state.lastMove = {
            playerId,
            tiles: move,
            word: words.map(w => w.word).join(', '),
            points: score,
        };

        return { success: true };
    }

    // nextTurn is defined above

    pass(playerId: string) {
        if (this.state.gameStatus !== 'PLAYING') return;
        const player = this.state.players[this.state.currentPlayerIndex];
        if (player.id !== playerId) return;

        // Passing counts as a zero-score move, potentially ending game if all pass × 2
        // For now just next turn.
        this.nextTurn();
        return true;
    }



    getState() {
        return this.state;
    }
}
