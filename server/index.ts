import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents } from './shared/types';
import { SuperScrabbleGame } from './game';
import { createUser, getUser, updateUserStats } from './db';

import path from 'path';

const app = express();
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../client/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/^.*$/, (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip if it's an API/internal route if we had any, 
    // but here we only use Socket.io for game logic.
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
        origin: '*',
    },
});

const PORT = process.env.PORT || 3001;
const games: Record<string, SuperScrabbleGame> = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (playerName: string, userId: string) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const game = new SuperScrabbleGame(roomCode);
        game.addPlayer(socket.id, playerName, userId); // Use userId if provided

        // Create user in DB if not exists
        if (userId) createUser(userId, playerName);

        // Attach update listener for Bot moves
        game.onUpdate = (state) => {
            io.to(roomCode).emit('gameUpdate', state);
        };

        // Attach Game Over listener to update stats
        game.onGameOver = (results) => {
            results.forEach(r => {
                if (r.userId && !r.isBot) {
                    updateUserStats(r.userId, r.score, r.isWinner);
                }
            });
        };

        games[roomCode] = game;
        socket.join(roomCode);
        io.to(roomCode).emit('gameUpdate', game.getState());
        console.log(`Room ${roomCode} created by ${playerName} (${userId})`);
    });

    socket.on('addBot', (roomCode: string) => {
        const game = games[roomCode];
        if (game) {
            const botId = `BOT-${Date.now()}`;
            const botName = `Computer ${Math.floor(Math.random() * 100)}`;
            game.addPlayer(botId, botName, botId, true); // isBot = true
            io.to(roomCode).emit('gameUpdate', game.getState());
        }
    });

    socket.on('joinRoom', (roomCode: string, playerName: string, userId: string) => {
        const game = games[roomCode];
        if (game) {
            if (playerName) {
                if (game.addPlayer(socket.id, playerName, userId)) {
                    if (userId) createUser(userId, playerName); // Ensure user exists
                    socket.join(roomCode);
                    io.to(roomCode).emit('gameUpdate', game.getState());
                    console.log(`${playerName} (${userId}) joined room ${roomCode}`);
                } else {
                    socket.emit('error', 'Room full');
                }
            } else {
                // Joining as observer
                socket.join(roomCode);
                socket.emit('gameUpdate', game.getState());
                console.log(`Observer ${socket.id} joined room ${roomCode}`);
            }
        } else {
            socket.emit('error', 'Room not found');
        }
    });

    socket.on('ready', () => {
        // Find game by socket room
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find((r: string) => r.length === 4);
        if (roomCode) {
            const game = games[roomCode];
            if (game) {
                game.setPlayerReady(socket.id);
                io.to(roomCode).emit('gameUpdate', game.getState());
            }
        }
    });

    socket.on('playWord', async (move: { r: number, c: number, tile: any }[]) => {
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find((r: string) => r.length === 4);
        if (roomCode) {
            const game = games[roomCode];
            if (game) {
                const result = await game.playWord(socket.id, move);
                if (result && result.error) {
                    socket.emit('error', result.error);
                } else {
                    io.to(roomCode).emit('gameUpdate', game.getState());
                }
            }
        }
    });

    socket.on('createProfile', ({ id, name }: { id: string, name: string }) => {
        try {
            const user = createUser(id, name); // id could be socket.id or a persistent UUID from client
            socket.emit('profileUpdated', user);
        } catch (e) {
            console.error(e);
        }
    });

    socket.on('getStats', (id: string) => {
        const user = getUser(id);
        if (user) {
            socket.emit('stats', user);
        }
    });

    socket.on('passTurn', () => {
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find((r: string) => r.length === 4);
        if (roomCode) {
            const game = games[roomCode];
            if (game) {
                game.pass(socket.id);
                io.to(roomCode).emit('gameUpdate', game.getState());
            }
        }
    });

    // ... disconnect ...

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Logic to handle player disconnection
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
