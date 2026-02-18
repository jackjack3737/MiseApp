/**
 * Sherlock Engine — Schema SQLite (solo definizione).
 * Le tabelle sono create da database/db.ts all'avvio.
 */

export const EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  timestamp TEXT NOT NULL
);
`;

export const SYMPTOMS_TABLE = `
CREATE TABLE IF NOT EXISTS symptoms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  intensity INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);
`;

export const INDEX_EVENTS_TIMESTAMP = `
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`;
export const INDEX_EVENTS_TYPE = `
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
`;
export const INDEX_SYMPTOMS_TIMESTAMP = `
CREATE INDEX IF NOT EXISTS idx_symptoms_timestamp ON symptoms(timestamp);
`;
export const INDEX_SYMPTOMS_NAME = `
CREATE INDEX IF NOT EXISTS idx_symptoms_name ON symptoms(name);
`;

export const FULL_SCHEMA = [
  EVENTS_TABLE,
  SYMPTOMS_TABLE,
  INDEX_EVENTS_TIMESTAMP,
  INDEX_EVENTS_TYPE,
  INDEX_SYMPTOMS_TIMESTAMP,
  INDEX_SYMPTOMS_NAME,
];
