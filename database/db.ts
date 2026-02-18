/**
 * Sherlock Engine — Motore di persistenza locale (SQLite).
 * Tutti i dati restano sul dispositivo; nessun cloud o API esterne per dati sensibili.
 * Se il modulo nativo ExpoSQLite non è disponibile (es. Expo Go), le funzioni restituiscono
 * valori vuoti senza far crashare l'app.
 */

import { FULL_SCHEMA } from './schema';

const DB_NAME = 'sherlock.db';

let dbInstance: Awaited<ReturnType<typeof openDb>> | null = null;
let dbUnavailable = false;

async function openDb() {
  const SQLite = require('expo-sqlite');
  return SQLite.openDatabaseAsync(DB_NAME);
}

async function getDB(): Promise<Awaited<ReturnType<typeof openDb>> | null> {
  if (dbUnavailable) return null;
  if (dbInstance) return dbInstance;
  try {
    const db = await openDb();
    await db.execAsync('PRAGMA journal_mode = WAL;');
    for (const sql of FULL_SCHEMA) {
      await db.execAsync(sql);
    }
    dbInstance = db;
    return db;
  } catch (_e) {
    dbUnavailable = true;
    return null;
  }
}

// ─── Tipi evento (come da specifica) ────────────────────────────────────────
export type EventType = 'FOOD' | 'WORKOUT' | 'WEATHER' | 'SLEEP';

/** Serializza value per la colonna (stringa o JSON). */
function serializeValue(value: string | number | object): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

// ─── Logger (scrittura) ────────────────────────────────────────────────────

/**
 * Registra un evento (cibo, workout, meteo, sonno).
 * @param type - 'FOOD' | 'WORKOUT' | 'WEATHER' | 'SLEEP'
 * @param name - es. 'Prosecco', 'Running', 'Low Pressure'
 * @param value - quantità, intensità o dettagli (stringa, numero o oggetto)
 */
export async function logEvent(
  type: EventType,
  name: string,
  value: string | number | object
): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  const timestamp = new Date().toISOString();
  const valueStr = serializeValue(value);
  const result = await db.runAsync(
    'INSERT INTO events (type, name, value, timestamp) VALUES (?, ?, ?, ?)',
    type,
    name,
    valueStr,
    timestamp
  );
  return result.lastInsertRowId;
}

/**
 * Registra un sintomo con intensità 1–10.
 * @param name - es. 'Acidità', 'Emicrania', 'Dolore Ginocchio'
 * @param intensity - 1–10
 */
export async function logSintomo(name: string, intensity: number): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  const clamped = Math.max(1, Math.min(10, Math.round(intensity)));
  const timestamp = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO symptoms (name, intensity, timestamp) VALUES (?, ?, ?)',
    name,
    clamped,
    timestamp
  );
  return result.lastInsertRowId;
}

// ─── Analyzer (lettura / Detective) ─────────────────────────────────────────

export type CorrelationResult = {
  eventName: string;
  eventType: string;
  occurrences: number;
  symptomEpisodes: number;
  percentage: number;
};

/**
 * Trova correlazioni per un sintomo: cosa è successo nelle 24h prima di ogni episodio.
 * Restituisce gli eventi che compaiono in più del 50% degli episodi.
 *
 * 1. Trova tutti i timestamp del sintomo.
 * 2. Per ogni timestamp, cerca in events cosa è successo nelle 24h precedenti.
 * 3. Raggruppa per event.name e conta le occorrenze.
 * 4. Restituisce gli eventi con occorrenze >= 50% degli episodi.
 */
export async function findCorrelations(symptomName: string): Promise<CorrelationResult[]> {
  const db = await getDB();
  if (!db) return [];

  const totalRow = (await db.getFirstAsync(
    'SELECT COUNT(*) AS total FROM symptoms WHERE name = ?',
    [symptomName]
  )) as { total: number } | null;
  const totalEpisodes = totalRow?.total ?? 0;
  if (totalEpisodes === 0) return [];

  const threshold = Math.ceil(totalEpisodes * 0.5);

  const rows = (await db.getAllAsync(
    `SELECT e.name AS name, e.type AS type, COUNT(DISTINCT s.id) AS cnt
     FROM symptoms s
     INNER JOIN events e ON e.timestamp >= datetime(s.timestamp, '-24 hours') AND e.timestamp <= s.timestamp
     WHERE s.name = ?
     GROUP BY e.name, e.type
     HAVING cnt >= ?
     ORDER BY cnt DESC`,
    [symptomName, threshold]
  )) as { name: string; type: string; cnt: number }[];

  return rows.map((r: { name: string; type: string; cnt: number }) => ({
    eventName: r.name,
    eventType: r.type,
    occurrences: r.cnt,
    symptomEpisodes: totalEpisodes,
    percentage: Math.round((r.cnt / totalEpisodes) * 100),
  }));
}

// ─── Pattern Engine (3° Indizio: analisi mensile per Calendar Insights) ─────

export type MonthlyPattern = {
  eventName: string;
  eventType: string;
  symptomName: string;
  count: number;
  symptomDates: string[];
  /** Ingredienti del pasto (se evento FOOD con value.ingredients), per correlazioni sintomo → possibile causa */
  ingredients?: string[];
};

/**
 * Analisi mensile: eventi che hanno preceduto un sintomo entro 24h.
 * Count = 1 → ignorato (coincidenza).
 * Count = 2 → "Indiziario" (Clue).
 * Count >= 3 → "Confermato" (Evidence).
 * Restituisce solo count >= 2.
 */
export async function getMonthlyPatterns(year: number, month: number): Promise<MonthlyPattern[]> {
  const db = await getDB();
  if (!db) return [];
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  type Row = { event_name: string; event_type: string; symptom_name: string; symptom_date: string; event_value: string | null };
  const rows = (await db.getAllAsync(
    `SELECT e.name AS event_name, e.type AS event_type, s.name AS symptom_name, date(s.timestamp) AS symptom_date, e.value AS event_value
     FROM symptoms s
     INNER JOIN events e ON e.timestamp >= datetime(s.timestamp, '-24 hours') AND e.timestamp <= s.timestamp
     WHERE date(s.timestamp) >= ? AND date(s.timestamp) <= ?
     ORDER BY s.timestamp`,
    [monthStart, monthEnd]
  )) as Row[];

  const byKey: Record<string, { eventName: string; eventType: string; symptomName: string; dates: Set<string>; eventValue: string | null }> = {};
  for (const r of rows) {
    const key = `${r.event_type}|${r.event_name}|${r.symptom_name}`;
    if (!byKey[key]) {
      byKey[key] = { eventName: r.event_name, eventType: r.event_type, symptomName: r.symptom_name, dates: new Set(), eventValue: r.event_value ?? null };
    }
    byKey[key].dates.add(r.symptom_date);
    if (r.event_value && !byKey[key].eventValue) byKey[key].eventValue = r.event_value;
  }

  const parseIngredients = (valueStr: string | null): string[] | undefined => {
    if (!valueStr) return undefined;
    try {
      const o = JSON.parse(valueStr);
      if (Array.isArray(o?.ingredients)) return o.ingredients.filter((x: unknown) => typeof x === 'string');
      return undefined;
    } catch {
      return undefined;
    }
  };

  const out: MonthlyPattern[] = [];
  for (const v of Object.values(byKey)) {
    const count = v.dates.size;
    if (count >= 2) {
      const ingredients = parseIngredients(v.eventValue);
      out.push({
        eventName: v.eventName,
        eventType: v.eventType,
        symptomName: v.symptomName,
        count,
        symptomDates: Array.from(v.dates).sort(),
        ...(ingredients && ingredients.length > 0 ? { ingredients } : {}),
      });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}
