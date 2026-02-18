/**
 * Sherlock Engine — barrel export.
 * Persistenza locale SQLite per correlazioni sintomi/eventi.
 */

export {
  logEvent,
  logSintomo,
  findCorrelations,
  type EventType,
  type CorrelationResult,
} from './db';
export { FULL_SCHEMA, EVENTS_TABLE, SYMPTOMS_TABLE } from './schema';
