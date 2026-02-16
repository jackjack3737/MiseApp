/**
 * Mappatura Health Connect ExerciseSessionRecord.exerciseType (Android)
 * verso categoria metabolica e moltiplicatore bonus carboidrati.
 * Valori da react-native-health-connect ExerciseType (ExerciseSession).
 */
export type WorkoutCategory = 'anaerobic' | 'aerobic_intense' | 'low' | null;

const ANAEROBIC_TYPES = new Set<number>([
  6, 10, 11, 13, 17, 36, 42, 43, 67, 70, 81, // BENCH_PRESS, BOOT_CAMP, BOXING, CALISTHENICS, DEADLIFT, HIIT, LAT_PULL_DOWN, LUNGE, SQUAT, STRENGTH_TRAINING, WEIGHTLIFTING
  3, 7, 12, 15, 18, 19, 20, 21, 22, 23, 24, 34, 40, 41, 44, 49, 51, 66, 68, 69, // barbell/dumbbell, CRUNCH, BURPEE, GYMNASTICS, JUMPING_JACK, JUMP_ROPE, MARTIAL_ARTS, PLANK, ROCK_CLIMBING, SQUASH, STAIR_*
]);

const AEROBIC_INTENSE_TYPES = new Set<number>([
  8, 9, 25, 53, 54, 56, 57, 61, 62, 63, 68, 69, 73, 74, 37, 64, 72, 78, // BIKING, ELLIPTICAL, ROWING, RUNNING, SKIING, SNOWBOARDING, SNOWSHOEING, STAIR_*, SWIMMING_*, HIKING, SOCCER, SURFING, VOLLEYBALL
]);

const LOW_INTENSITY_TYPES = new Set<number>([
  33, 48, 71, 79, 83, // GUIDED_BREATHING, PILATES, STRETCHING, WALKING, YOGA
]);

export function getWorkoutCategory(exerciseType: number): WorkoutCategory {
  if (ANAEROBIC_TYPES.has(exerciseType)) return 'anaerobic';
  if (AEROBIC_INTENSE_TYPES.has(exerciseType)) return 'aerobic_intense';
  if (LOW_INTENSITY_TYPES.has(exerciseType)) return 'low';
  return null;
}

export function getWorkoutMultiplier(category: WorkoutCategory): number {
  switch (category) {
    case 'anaerobic': return 1.5;
    case 'aerobic_intense': return 1.2;
    case 'low': return 0.8;
    default: return 1.0;
  }
}

export interface WorkoutUI {
  message: string;
  color: string;
  colorLight: string;
  icon: string; // emoji o nome per Ionicons
}

export function getWorkoutUI(category: WorkoutCategory): WorkoutUI | null {
  switch (category) {
    case 'anaerobic':
      return { message: 'Ricarica Glicogeno', color: '#8B2E8B', colorLight: '#7C3AED', icon: 'barbell' };
    case 'aerobic_intense':
      return { message: 'Recupero Cardio', color: '#0066CC', colorLight: '#2563EB', icon: 'flash' };
    case 'low':
      return { message: 'Brucia Grassi', color: '#0D9488', colorLight: '#059669', icon: 'leaf' };
    default:
      return null;
  }
}
