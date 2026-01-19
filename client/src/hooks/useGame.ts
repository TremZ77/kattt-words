import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, GameState } from '../shared/types';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : undefined;

export const useGame = () => {
    const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userStats, setUserStats] = useState<any>(null);

    useEffect(() => {
        const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('gameUpdate', (state) => {
            setGameState(state);
        });

        newSocket.on('error', (msg) => {
            setError(msg);
        });

        newSocket.on('stats', (stats) => {
            setUserStats(stats);
        });

        return () => {
            newSocket.close();
        };
    }, []);

    const createRoom = (playerName: string, userId: string) => {
        socket?.emit('createRoom', playerName, userId);
    };

    const joinRoom = (roomCode: string, playerName: string, userId: string) => {
        socket?.emit('joinRoom', roomCode, playerName, userId);
    };

    const getStats = (userId: string) => {
        socket?.emit('getStats', userId);
    }

    const setReady = () => {
        socket?.emit('ready');
    };

    const playWord = (move: { r: number, c: number, tile: any }[]) => {
        socket?.emit('playWord', move);
    };

    return {
        gameState,
        error,
        userStats,
        createRoom,
        joinRoom,
        getStats,
        setReady,
        playWord,
        socketId: socket?.id,
        socket,
    };
};
