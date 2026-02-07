import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { 
  initialize, 
  readRecords, 
  getSdkStatus, 
  SdkAvailabilityStatus,
  getGrantedPermissions 
} from 'react-native-health-connect';

export const useHealthConnect = () => {
  const [isLinked, setIsLinked] = useState(false);
  const [data, setData] = useState({ weight: 0, steps: 0, sleep: 0, calories: 0 });
  const isSyncing = useRef(false);

  const syncData = useCallback(async () => {
    if (Platform.OS !== 'android' || isSyncing.current) return;
    isSyncing.current = true;
    
    console.log("--- [DEBUG] Inizio Sincronizzazione Totale ---");
    
    try {
      await initialize();
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const now = new Date();

      // 1. LETTURA PASSI (Oggi)
      const stepsRes = await readRecords('Steps', {
        timeRangeFilter: {
            operator: 'between',
            startTime: todayStart.toISOString(),
            endTime: now.toISOString()
        }
      }).catch(() => ({ records: [] }));
      
      const totalSteps = (stepsRes?.records || []).reduce((acc, record) => acc + (record.count || 0), 0);

      // 2. LETTURA PESO (Ultimi 30 giorni per trovare l'ultima pesata)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      console.log("[DEBUG] Ricerca peso dall'ultimo mese...");
      const weightRes = await readRecords('Weight', {
        timeRangeFilter: { 
            operator: 'after', 
            startTime: thirtyDaysAgo.toISOString() 
        },
        ascendingOrder: false, // Prende il più recente per primo
        pageSize: 1
      }).catch(e => {
        console.log("[DEBUG] Errore lettura peso:", e.message);
        return { records: [] };
      });

      const latestWeight = weightRes?.records?.[0]?.weight?.inKilograms || 0;
      console.log(`[DEBUG] Peso trovato: ${latestWeight} kg`);

      // 3. LETTURA CALORIE ATTIVE (Oggi)
      const calRes = await readRecords('ActiveCaloriesBurned', {
        timeRangeFilter: { 
            operator: 'between', 
            startTime: todayStart.toISOString(), 
            endTime: now.toISOString() 
        }
      }).catch(() => ({ records: [] }));

      const totalCalories = (calRes?.records || []).reduce((acc, record) => acc + (record.energy?.inKilocalories || 0), 0);

      // AGGIORNAMENTO STATO
      setData({ 
        weight: Number(latestWeight.toFixed(1)), 
        steps: totalSteps,
        sleep: 0, // Implementeremo dopo se serve
        calories: Math.round(totalCalories),
      });
      
      console.log("--- [DEBUG] Sync Completato ---");
      
    } catch (e) {
      console.error("[DEBUG] Errore durante il sync:", e);
    } finally {
      isSyncing.current = false;
    }
  }, []);

  const init = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const status = await getSdkStatus();
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
        await initialize();
        const granted = await getGrantedPermissions();
        
        if (granted && granted.length > 0) {
          setIsLinked(true);
          syncData();
        }
      }
    } catch (e) {
      console.log('[DEBUG] Errore Init:', e);
    }
  }, [syncData]);

  const connect = async () => {
    console.log("[DEBUG] Trigger manuale connect.");
    await init(); 
    return true; 
  };

  useEffect(() => {
    init();
  }, [init]);

  return { isLinked, connect, syncData, data };
};