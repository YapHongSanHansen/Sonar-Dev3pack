export type Migration = { name: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    name: '001_initial',
    sql: `
      CREATE TABLE users (
        wallet_address    TEXT PRIMARY KEY,
        created_at        INTEGER NOT NULL,
        updated_at        INTEGER NOT NULL,
        risk_preferences  TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE risk_logs (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet        TEXT NOT NULL,
        session_id    TEXT NOT NULL UNIQUE,
        risk_score    INTEGER NOT NULL,
        reasons       TEXT NOT NULL,
        scenario      TEXT,
        domain        TEXT,
        counterparty  TEXT,
        timestamp     INTEGER NOT NULL,
        outcome       TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (wallet) REFERENCES users(wallet_address)
      );
      CREATE INDEX idx_risk_logs_wallet ON risk_logs(wallet);
      CREATE INDEX idx_risk_logs_timestamp ON risk_logs(timestamp);

      CREATE TABLE behavioral_data (
        wallet_address      TEXT PRIMARY KEY,
        sample_size         INTEGER NOT NULL,
        window_days         INTEGER NOT NULL,
        avg_transfer_sol    REAL NOT NULL,
        max_transfer_sol    REAL NOT NULL,
        tx_per_day          REAL NOT NULL,
        top_counterparties  TEXT NOT NULL,
        top_programs        TEXT NOT NULL,
        active_hours_utc    TEXT NOT NULL,
        chains              TEXT NOT NULL,
        computed_at         INTEGER NOT NULL,
        FOREIGN KEY (wallet_address) REFERENCES users(wallet_address)
      );
    `,
  },
];
