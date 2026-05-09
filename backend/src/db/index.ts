import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { MIGRATIONS } from './migrations.js';

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
  _db = new Database(config.DATABASE_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);
  return _db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    );
  `);
  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name as string),
  );
  const insertMigration = database.prepare(
    'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    database.transaction(() => {
      database.exec(m.sql);
      insertMigration.run(m.name, Date.now());
    })();
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
