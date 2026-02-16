/**
 * Scatola Nera biometrica: record giornaliero unificato per correlazioni e algoritmi.
 * Ogni giorno aggrega: Nutrizione (Tracker), Biometria (Bio), Medical (Advisor), Environment (Meteo).
 */

export const BLACKBOX_STORAGE_KEY = '@user_daily_blackbox';

export type NutritionSnapshot = {
  calories: number;
  carbs: number;
  proteins: number;
  fats: number;
  mealTimes: string[]; // ISO time o "HH:mm" per Metabolic Window
};

export type BioSnapshot = {
  hrvMs: number | null;
  sleepHours: number;
  readiness: number;
  glycogenEstimated: number;
  fatiguePredictorScore: number;
  steps?: number;
  heartRate?: number;
};

export type MedicalSnapshot = {
  symptoms: { name: string; impactLabel?: string; severity_factor?: number }[];
  sodiumIntegration?: string | null; // es. "1g sale pre-workout"
};

export type EnvironmentSnapshot = {
  temp: number;
  condition: string;
  saltAdvice?: string;
};

export type DailyBlackboxRecord = {
  date: string; // YYYY-MM-DD
  nutrition: NutritionSnapshot;
  bio: BioSnapshot;
  medical: MedicalSnapshot;
  environment: EnvironmentSnapshot;
  updatedAt: string; // ISO
};

export function createEmptyDailyRecord(date: string): DailyBlackboxRecord {
  return {
    date,
    nutrition: { calories: 0, carbs: 0, proteins: 0, fats: 0, mealTimes: [] },
    bio: {
      hrvMs: null,
      sleepHours: 0,
      readiness: 0,
      glycogenEstimated: 100,
      fatiguePredictorScore: 0,
    },
    medical: { symptoms: [] },
    environment: { temp: 20, condition: '—', saltAdvice: null },
    updatedAt: new Date().toISOString(),
  };
}
