/**
 * Chiavi e valori per il primo avvio (Onboarding).
 * Privacy First: tutto salvato solo in locale.
 */

export const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';
export const USER_PROFILE_KEY = '@user_profile';

export type OnboardingObjective = 'performance' | 'ketosis' | 'weight_loss';

export const OBJECTIVE_LABELS: Record<OnboardingObjective, string> = {
  performance: 'Massima Performance',
  ketosis: 'Chetosi Terapeutica',
  weight_loss: 'Perdita Peso',
};

/** Profilo minimo salvato al termine dell'onboarding (compatibile con ProfileScreen). */
export type OnboardingProfilePayload = {
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female';
  objective: OnboardingObjective;
  targetCalories: number;
  protocol: string;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  weeksTarget?: number;
  activityMult?: number;
};
