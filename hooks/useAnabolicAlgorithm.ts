import { useMemo } from 'react';
import type { WorkoutCategory } from '../constants/workoutTypes';

export interface AnabolicResult {
  dynamicProteinTarget: number;
  proteinMessage: string | null;
}

/**
 * "The Nitrogen Balance Optimizer" — Algoritmo da Preparatore Atletico Avanzato.
 * Calcola il target proteico dinamico in base a tipo di workout e calorie attive.
 */
export function useAnabolicAlgorithm(
  weight: number,
  lastWorkoutType: WorkoutCategory,
  activeCalories: number,
  baseTargetP: number
): AnabolicResult {
  return useMemo(() => {
    const w = Math.max(0, weight);
    const base = Math.max(0, baseTargetP);
    const kcal = Math.max(0, activeCalories);

    // 1. Moltiplicatore di Danno (Damage Multiplier) — bonus g/kg
    let damagePerKg = 0;
    let message: string | null = null;

    switch (lastWorkoutType) {
      case 'anaerobic':
        damagePerKg = 0.6;
        message = 'Sintesi Proteica Massimizzata 🏗️';
        break;
      case 'aerobic_intense':
        damagePerKg = 0.3;
        message = 'Scudo Anti-Catabolico 🛡️';
        break;
      case 'low':
      case null:
      default:
        damagePerKg = 0;
        break;
    }

    const damageBonus = w * damagePerKg;

    // 2. Safety Buffer calorico: +5g ogni 300 kcal
    const safetyBuffer = Math.floor(kcal / 300) * 5;

    // 3. Target dinamico
    const dynamicProteinTarget = Math.round(base + damageBonus + safetyBuffer);

    return {
      dynamicProteinTarget: Math.max(base, dynamicProteinTarget),
      proteinMessage: message,
    };
  }, [weight, lastWorkoutType, activeCalories, baseTargetP]);
}

export default useAnabolicAlgorithm;
