import fs from 'fs';
import path from 'path';

const getDictionaryPath = () => {
    // Try multiple possible paths
    const paths = [
        path.join(__dirname, 'data', 'dictionary.txt'),      // Dev (ts-node) or if copied
        path.join(__dirname, '..', 'data', 'dictionary.txt'), // Prod (dist/index.js -> server/data)
        path.join(process.cwd(), 'server', 'data', 'dictionary.txt'), // Fallback from root
        path.join(process.cwd(), 'data', 'dictionary.txt') // Fallback from server root
    ];

    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return path.join(__dirname, 'data', 'dictionary.txt'); // Default to fail
};

const DICTIONARY_PATH = getDictionaryPath();
let wordSet: Set<string> | null = null;

export const loadDictionary = () => {
    if (wordSet) return;
    console.log(`Loading dictionary from: ${DICTIONARY_PATH}`);
    try {
        const data = fs.readFileSync(DICTIONARY_PATH, 'utf-8');
        wordSet = new Set(data.split(/\r?\n/).map((w: string) => w.trim().toUpperCase()));
        console.log(`Dictionary loaded: ${wordSet.size} words.`);
    } catch (error) {
        console.error(`Failed to load dictionary from ${DICTIONARY_PATH}:`, error);
        wordSet = new Set();
    }
};

export const isValidWord = (word: string): boolean => {
    if (!wordSet) loadDictionary();
    return wordSet!.has(word.toUpperCase());
};
