import path from 'path';
import fs from 'fs';

let db: any = null;
let useMemory = false;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'scrabble.db');

try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    // Initialize Tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        high_score INTEGER DEFAULT 0
      );
    `);
} catch (e) {
    console.warn("Failed to load better-sqlite3, using in-memory mock DB.", e);
    useMemory = true;
    db = {
        users: {} as Record<string, any>
    };
}

export const getUser = (id: string) => {
    if (useMemory) {
        return db.users[id];
    }
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as { id: string, name: string, games_played: number, games_won: number, high_score: number } | undefined;
};

export const createUser = (id: string, name: string) => {
    if (useMemory) {
        if (!db.users[id]) {
            db.users[id] = { id, name, games_played: 0, games_won: 0, high_score: 0 };
        }
        return db.users[id];
    }
    try {
        db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name);
        return getUser(id);
    } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            return getUser(id); // Return existing if ID matches
        }
        throw err;
    }
};

export const updateUserStats = (id: string, score: number, isWin: boolean) => {
    if (useMemory) {
        const user = db.users[id];
        if (user) {
            user.games_played++;
            if (isWin) user.games_won++;
            user.high_score = Math.max(user.high_score, score);
        }
        return;
    }
    const user = getUser(id);
    if (!user) return; // Should not happen if flow is correct

    const newHighScore = Math.max(user.high_score, score);
    db.prepare(`
        UPDATE users 
        SET games_played = games_played + 1,
            games_won = games_won + ?,
            high_score = ?
        WHERE id = ?
    `).run(isWin ? 1 : 0, newHighScore, id);
};

export const getAllUsers = () => {
    if (useMemory) {
        return Object.values(db.users).sort((a: any, b: any) => b.high_score - a.high_score).slice(0, 50);
    }
    return db.prepare('SELECT * FROM users ORDER BY high_score DESC LIMIT 50').all();
};


