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
        if (this.state.gameStatus === 'LOBBY' && this.state.players.length >= 2 && this.state.players.every((p: Player) => p.isReady)) {
            this.startGame();
        }

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
        // Validation: Ensure it's still bot's turn
        const currentPlayer = this.state.players[this.state.currentPlayerIndex];
        if (currentPlayer.id !== botId || this.state.gameStatus !== 'PLAYING') return;

        // Lazy load Bot logic to avoid circular deps if any, or just instantiate here
        // We need a Bot instance or static method. 
        // Let's import Bot at top level (added in a separate replacement chunk if needed, but assuming it's available)
        // Actually, we haven't imported Bot yet.

        // Dynamic import or assume imported. I'll duplicate the standard import in next step.
        // For now, I'll use a placeholder and fix import in next step.
        // Or better: I will add the method but I need `Bot` class.

        const bot = new Bot(botId, currentPlayer.name);
        const move = bot.generateMove(this.state, currentPlayer.rack);

        if (move) {
            await this.playWord(botId, move);
        } else {
            // Pass turn
            // We need a passTurn method or just manual nextTurn
            console.log(`Bot ${botId} passes.`);
            this.nextTurn();
            // Emit update? playWord emits update. If we pass, we need to emit update manually from here?
            // Actually playWord emits nothing, the socket handler emits.
            // Wait, playWord is called by socket handler which emits.
            // If I call playWord internally, *I* need to emit the update.
            // Refactoring: playWord should probably emit or return state, and the caller emits.
            // But here I don't have access to `io`.
            // Pattern: The `games` object in index.ts manages `io`. 
            // The `SuperScrabbleGame` class shouldn't know about `io` directly ideally, but it needs to notify.
            // Solution: Add a callback to constructor? Or just return result and have index.ts poll?
            // "EventEmitter" pattern is best for Game class.
            // For this quick implementation: I will assume `index.ts` handles user moves.
            // For BOT moves, the Game class runs it asynchronously.
            // I need a way to tell the server "State Updated".
            // I'll add `onUpdate` callback to Game.
        }
    }

    public onUpdate: ((state: GameState) => void) | null = null;

    removePlayer(id: string) {
        this.state.players = this.state.players.filter((p: Player) => p.id !== id);
    }

    setPlayerReady(id: string) {
        const player = this.state.players.find((p: Player) => p.id === id);
        if (player) player.isReady = true;

        if (this.state.players.length >= 2 && this.state.players.every((p: Player) => p.isReady)) {
            this.startGame();
        }
    }

    private startGame() {
        this.state.gameStatus = 'PLAYING';
        this.state.players.forEach((player: Player) => {
            player.rack = this.drawTiles(7);
        });
        this.state.tileBagCount = this.tileBag.length;
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
            const tileIndex = player.rack.findIndex((t: Tile) => t.letter === tile.letter);
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



    getState() {
        return this.state;
    }
}
