/**
 * Scatola Nera — Record giornaliero unificato per correlazioni e algoritmi.
 * Aggrega Nutrizione (Tracker), Biometria (Bio), Medical (Advisor), Environment.
 */

export type NutritionSnapshot = {
  kcal: number;
  carbs: number;
  proteins: number;
  fats: number;
  mealTimes: string[]; // ISO time o "HH:mm" per Metabolic Window
};

export type BioSnapshot = {
  hrvMs: number | null;
  sleepHours: number;
  readiness: number;
  glycogenPercent: number;
  fatiguePredictorScore: number; // 0-100, alto = più affaticamento
  steps?: number;
  activeKcal?: number;
  /** ISO string, per calcolo Metabolic Window */
  sleepStartIso?: string | null;
};

export type MedicalSnapshot = {
  symptoms: { name: string; impactLabel?: string }[];
  sodiumIntegration?: string; // es. "Caricato 1g" / null
};

export type EnvironmentSnapshot = {
  temp: number;
  condition: string;
};

export type CorrelationResult = {
  /** Correlazione sintomi con giorno precedente (es. poco sodio, poco sonno) */
  causality: string | null;
  /** true se HRV in calo e stress in salita → allerta */
  fatigueAlert: boolean;
  /** Ore tra ultimo pasto e inizio sonno (per Metabolic Window) */
  metabolicWindowHours: number | null;
};

export type DailyBlackboxRecord = {
  date: string; // YYYY-MM-DD
  nutrition: NutritionSnapshot;
  bio: BioSnapshot;
  medical: MedicalSnapshot;
  environment: EnvironmentSnapshot;
  correlations?: CorrelationResult;
};

export const BLACKBOX_STORAGE_KEY = '@user_daily_blackbox';
