import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';
import {
    getGrantedPermissions,
    initialize,
    openHealthConnectSettings,
    readRecords,
    requestPermission,
} from 'react-native-health-connect';
import { getWorkoutCategory, type WorkoutCategory } from '../constants/workoutTypes';

interface HealthData {
  steps: number;
  calories: number;
  heartRate: number;
  hrvMs: number | null;
  sleepHours: number;
  weight: number;
  lastWorkoutType: WorkoutCategory;
  loading: boolean;
  error: string | null;
}

const TIMEOUT_MS = 5000;

// Soglie per evitare setData inutili (dati quasi identici)
const STEP_EPS = 1;
const WEIGHT_EPS = 0.1;
const SLEEP_EPS = 0.1;
const HEART_RATE_EPS = 1;
const HRV_EPS = 2;

function isMinimalChange(prev: HealthData, next: Partial<HealthData>): boolean {
  if (next.loading !== undefined && next.loading !== prev.loading) return false;
  if (next.error !== undefined && next.error !== prev.error) return false;
  if (next.lastWorkoutType !== undefined && next.lastWorkoutType !== prev.lastWorkoutType) return false;
  const stepsOk = Math.abs((next.steps ?? prev.steps) - prev.steps) < STEP_EPS;
  const weightOk = Math.abs((next.weight ?? prev.weight) - prev.weight) < WEIGHT_EPS;
  const sleepOk = Math.abs((next.sleepHours ?? prev.sleepHours) - prev.sleepHours) < SLEEP_EPS;
  const caloriesOk = Math.abs((next.calories ?? prev.calories) - prev.calories) < 1;
  const hrOk = Math.abs((next.heartRate ?? prev.heartRate) - prev.heartRate) < HEART_RATE_EPS;
  const hrvOk =
    (next.hrvMs == null && prev.hrvMs == null) ||
    (next.hrvMs != null && prev.hrvMs != null && Math.abs(next.hrvMs - prev.hrvMs) < HRV_EPS);
  return stepsOk && weightOk && sleepOk && caloriesOk && hrOk && hrvOk;
}

// Utility per applicare un timeout alle chiamate Health Connect
function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error('Health Connect timeout'));
    }, timeoutMs);

    fn()
      .then((result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

const useHealthConnect = () => {
  const isMounted = useRef(true);
  const loadingRef = useRef(false);
  const [data, setData] = useState<HealthData>({
    steps: 0,
    calories: 0,
    heartRate: 0,
    hrvMs: null,
    sleepHours: 0,
    weight: 0,
    lastWorkoutType: null,
    loading: false,
    error: null,
  });

  // Sposta il lavoro pesante fuori dal main thread (dopo le interazioni)
  const runOffUIThread = useCallback((work: () => void) => {
    if (InteractionManager && typeof InteractionManager.runAfterInteractions === 'function') {
      InteractionManager.runAfterInteractions(() => {
        work();
      });
    } else {
      // Fallback: mettiamo il lavoro nella coda successiva
      setTimeout(work, 0);
    }
  }, []);

  const fetchHealthData = useCallback(
    async (shouldRequest = false) => {
      if (!isMounted.current) return;
      if (Platform.OS !== 'android') return;

      loadingRef.current = true;
      if (isMounted.current) {
        setData((prev) => {
          if (prev.loading) return prev;
          return { ...prev, loading: true, error: null };
        });
      }

      try {
        // initialize() con timeout
        const isInitialized = await withTimeout(() => initialize(), TIMEOUT_MS);
        if (!isInitialized) {
          loadingRef.current = false;
          if (isMounted.current) setData((p) => (p.loading ? { ...p, loading: false } : p));
          return;
        }

        let granted = await getGrantedPermissions();

        // Niente popup automatico: se non è una richiesta esplicita e non abbiamo permessi, usciamo
        if (!granted || granted.length === 0) {
          if (!shouldRequest) {
            loadingRef.current = false;
            if (isMounted.current) setData((p) => (p.loading ? { ...p, loading: false, error: 'Permessi mancanti' } : p));
            return;
          }

          // Azione esplicita "Connetti": apri subito Health Connect così l'utente può abilitare l'app
          openHealthConnectSettings();
          // In parallelo prova il dialog in-app (su alcuni device appare quando torni nell'app)
          try {
            await withTimeout(
              () =>
                requestPermission([
                  { accessType: 'read', recordType: 'Steps' },
                  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
                  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
                  { accessType: 'read', recordType: 'Weight' },
                  { accessType: 'read', recordType: 'SleepSession' },
                  { accessType: 'read', recordType: 'ExerciseSession' },
                  { accessType: 'read', recordType: 'HeartRate' },
                  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
                ]),
              TIMEOUT_MS,
            );
          } catch (_) {
            // timeout o errore: l'utente è già in Health Connect
          }
          granted = await getGrantedPermissions();
          if (!granted || granted.length === 0) {
            loadingRef.current = false;
            if (isMounted.current) setData((p) => (p.loading ? { ...p, loading: false } : p));
            return;
          }
        }

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Lettura passi con timeout
        const stepsRes = await withTimeout(
          () =>
            readRecords('Steps', {
              timeRangeFilter: {
                operator: 'between',
                startTime: today.toISOString(),
                endTime: now.toISOString(),
              },
            }),
          TIMEOUT_MS,
        );
        const totalSteps = (stepsRes.records || []).reduce(
          (acc: number, r: any) => acc + (r.count || 0),
          0,
        );

        // Lettura peso con timeout
        const weightRes = await withTimeout(
          () =>
            readRecords('Weight', {
              timeRangeFilter: {
                operator: 'between',
                startTime: new Date(Date.now() - 30 * 86400000).toISOString(),
                endTime: now.toISOString(),
              },
              ascendingOrder: false,
              pageSize: 1,
            }),
          TIMEOUT_MS,
        );
        const rawWeight =
          weightRes.records && weightRes.records[0]
            ? weightRes.records[0].weight?.inKilograms ?? 0
            : 0;
        const lastWeight = rawWeight ? parseFloat(rawWeight.toFixed(1)) : 0;

        // Lettura sonno con timeout
        // IMPORTANTE: startTime deve essere 24 ore fa (non mezzanotte di oggi)
        // per catturare le sessioni che iniziano prima della mezzanotte
        const sleepStartTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sleepRes = await withTimeout(
          () =>
            readRecords('SleepSession', {
              timeRangeFilter: {
                operator: 'between',
                startTime: sleepStartTime.toISOString(),
                endTime: now.toISOString(),
              },
            }),
          TIMEOUT_MS,
        );

        // Calcola la durata totale del sonno in ore (SleepSession: endTime - startTime)
        const totalSleepHours = (sleepRes.records || []).reduce((acc: number, r: any) => {
          if (!r.startTime || !r.endTime) return acc;
          try {
            const start = new Date(r.startTime).getTime();
            const end = new Date(r.endTime).getTime();
            return acc + (end - start) / (1000 * 60 * 60);
          } catch {
            return acc;
          }
        }, 0);

        const sleepHoursRounded = parseFloat(totalSleepHours.toFixed(1));

        // Battito cardiaco: ultime 24h, record più recente, media dei samples (bpm)
        let heartRateBpm = 0;
        try {
          const hrStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const hrRes = await withTimeout(
            () =>
              readRecords('HeartRate', {
                timeRangeFilter: {
                  operator: 'between',
                  startTime: hrStart.toISOString(),
                  endTime: now.toISOString(),
                },
                ascendingOrder: false,
                pageSize: 5,
              }),
            TIMEOUT_MS,
          );
          const hrRecords = hrRes?.records ?? [];
          for (const r of hrRecords) {
            const samples = (r as any)?.samples ?? [];
            if (samples.length > 0) {
              const sum = samples.reduce((acc: number, s: any) => acc + (s.beatsPerMinute ?? 0), 0);
              heartRateBpm = Math.round(sum / samples.length);
              break;
            }
          }
        } catch (_) { /* ignore */ }

        // HRV (RMSSD in ms): ultime 24h, valore più recente (tipicamente mattino/sonno)
        let hrvMs: number | null = null;
        try {
          const hrvStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const hrvRes = await withTimeout(
            () =>
              readRecords('HeartRateVariabilityRmssd', {
                timeRangeFilter: {
                  operator: 'between',
                  startTime: hrvStart.toISOString(),
                  endTime: now.toISOString(),
                },
                ascendingOrder: false,
                pageSize: 10,
              }),
            TIMEOUT_MS,
          );
          const hrvRecords = hrvRes?.records ?? [];
          const first = hrvRecords[0];
          if (first && typeof (first as any).heartRateVariabilityMillis === 'number') {
            hrvMs = Math.round((first as any).heartRateVariabilityMillis);
          }
        } catch (_) { /* ignore */ }

        // Calorie attive oggi (ActiveCaloriesBurned): somma energy.inKilocalories
        let activeKcal = 0;
        try {
          const caloriesRes = await withTimeout(
            () =>
              readRecords('ActiveCaloriesBurned', {
                timeRangeFilter: {
                  operator: 'between',
                  startTime: today.toISOString(),
                  endTime: now.toISOString(),
                },
              }),
            TIMEOUT_MS,
          );
          activeKcal = (caloriesRes.records || []).reduce(
            (acc: number, r: any) => acc + (r.energy?.inKilocalories ?? 0),
            0,
          );
        } catch (_) { /* ignore */ }

        // Ultima sessione esercizio oggi: exerciseType per moltiplicatore metabolico
        let lastWorkoutType: WorkoutCategory = null;
        try {
          const sessionRes = await withTimeout(
            () =>
              readRecords('ExerciseSession', {
                timeRangeFilter: {
                  operator: 'between',
                  startTime: today.toISOString(),
                  endTime: now.toISOString(),
                },
                ascendingOrder: false,
                pageSize: 10,
              }),
            TIMEOUT_MS,
          );
          const firstSession = sessionRes.records?.[0];
          if (firstSession && typeof (firstSession as any).exerciseType === 'number') {
            lastWorkoutType = getWorkoutCategory((firstSession as any).exerciseType);
          }
        } catch (_) { /* ignore */ }

        if (__DEV__) {
          console.log('[HC_SYNC] Sleep: ' + sleepHoursRounded + 'h | Steps: ' + totalSteps + ' | HR: ' + heartRateBpm + ' | HRV: ' + (hrvMs ?? '—') + ' ms | ActiveKcal: ' + Math.round(activeKcal) + ' | Workout: ' + lastWorkoutType);
        }

        if (isMounted.current) {
          loadingRef.current = false;
          const next = {
            steps: totalSteps,
            calories: activeKcal,
            heartRate: heartRateBpm,
            hrvMs,
            sleepHours: sleepHoursRounded,
            weight: lastWeight,
            lastWorkoutType,
            loading: false,
            error: null as string | null,
          };
          setData((prev) => {
            if (isMinimalChange(prev, next)) return prev;
            return { ...prev, ...next };
          });
        }
      } catch (e: any) {
        if (__DEV__) console.error('[HC_ERROR]', e?.message || e);
        loadingRef.current = false;
        if (isMounted.current) {
          setData((prev) => ({
            ...prev,
            loading: false,
            error: e?.message || 'Errore Health Connect',
          }));
        }
      } finally {
        if (isMounted.current) {
          loadingRef.current = false;
          setData((prev) => {
            if (!prev.loading) return prev;
            return { ...prev, loading: false };
          });
        }
      }
    },
    [],
  );

  useEffect(() => {
    isMounted.current = true;

    if (Platform.OS === 'android') {
      // Ogni operazione deve attendere initialize(): prima init, poi permessi, poi letture
      runOffUIThread(() => {
        withTimeout(() => initialize(), TIMEOUT_MS)
          .then((isInitialized) => {
            if (!isMounted.current || !isInitialized) return null;
            return getGrantedPermissions();
          })
          .then((p) => {
            if (!isMounted.current || p == null) return;
            if (p.length > 0) fetchHealthData(false);
          })
          .catch((e) => {
            if (__DEV__) console.error('[HC_PERMS_ERROR]', e?.message || e);
          });
      });
    }

    return () => {
      isMounted.current = false;
    };
  }, [fetchHealthData, runOffUIThread]);

  // connect: forza la richiesta permessi manuale (refresh stabile: usa ref per loading)
  const connect = useCallback(() => {
    if (loadingRef.current) return;
    runOffUIThread(() => fetchHealthData(true));
  }, [fetchHealthData, runOffUIThread]);

  // refresh: aggiorna i dati senza forzare il popup (stabile per evitare loop in useFocusEffect/useEffect)
  const refresh = useCallback(() => {
    if (loadingRef.current) return;
    runOffUIThread(() => fetchHealthData(false));
  }, [fetchHealthData, runOffUIThread]);

  // Apre direttamente l'app Impostazioni di Health Connect (per concedere permessi a quest'app)
  const openSettings = useCallback(() => {
    if (Platform.OS === 'android') openHealthConnectSettings();
  }, []);

  return {
    ...data,
    refresh,
    connect,
    openSettings,
  };
};

export default useHealthConnect;