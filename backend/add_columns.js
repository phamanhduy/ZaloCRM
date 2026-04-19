import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('zalocrm.db');
const db = new Database(dbPath);

try {
    db.prepare('ALTER TABLE conversations ADD COLUMN is_friend_request INTEGER NOT NULL DEFAULT 0').run();
    db.prepare('ALTER TABLE conversations ADD COLUMN friend_request_message TEXT').run();
    console.log('Columns added successfully');
} catch (err) {
    console.error('Failed to add columns:', err.message);
} finally {
    db.close();
}
