// utils/smart-algorithm.ts

/**
 * BIO-HACKING CORE ENGINE v2.0
 * Algoritmo di regolazione metabolica basato su feedback a circuito chiuso.
 * * INPUT: Dati biometrici (Passi, Calorie, Sonno) + Dati Clinici (Sintomi)
 * OUTPUT: Adattamento Nutrizionale di Precisione
 */

export interface BioData {
  steps: number;
  activeCalories: number;
  averageHeartRate?: number;
  sleepHours?: number;      
  symptomFactor?: number;   // 0.5 (Severo) -> 1.0 (Nessun sintomo) - Da MedicalScreen
  symptomName?: string;     // Es: "Gonfiore Addominale"
  protocol: 'Keto' | 'Low Carb' | 'LowCarb' | 'Bilanciata' | 'Personalizza';
}

export interface MacroAdjustment {
  bonusCarbs: number;
  bonusProtein: number;
  bonusFat: number;
  intensityZone: string;   
  sleepFeedback: string;   
  burnScore: number;       
}

export const calculateMetabolicReactor = (data: BioData): MacroAdjustment => {
  const { steps, activeCalories, averageHeartRate, sleepHours, protocol, symptomFactor = 1.0, symptomName } = data;

  // --- 1. K_SLEEP: Coefficiente di Recupero Neurale (0.5 - 1.1) ---
  // Il sonno regola la sensibilità insulinica. 
  // Dormire poco = Cortisolo Alto = Zucchero ematico instabile.
  let kSleep = 1.0;
  let bioFeedback = "🟢 BIOSISTEMA STABILE";

  if (sleepHours !== undefined && sleepHours > 0) {
      if (sleepHours < 5.0) {
          kSleep = 0.5; // CRITICO: Taglio 50% Carbo
          bioFeedback = "🔴 CORTISOLO CRITICO (<5h)";
      } else if (sleepHours < 6.5) {
          kSleep = 0.8; // STRESS: Taglio 20%
          bioFeedback = "🟠 RECUPERO INCOMPLETO";
      } else if (sleepHours > 7.5) {
          kSleep = 1.1; // ANABOLIC PRIME: Bonus 10%
          bioFeedback = "🟢 RECUPERO OTTIMALE";
      }
  }

  // --- 2. K_SYMPTOM: Coefficiente di Infiammazione (0.5 - 1.0) ---
  // Se l'utente ha segnalato un sintomo (es. Gonfiore), il sistema Medical
  // ha passato un fattore < 1.0. Questo ha priorità assoluta.
  let kSymptom = symptomFactor; 
  if (kSymptom < 1.0 && symptomName) {
      bioFeedback = `⚠️ PROTOCOLLO ANTINFIAMMATORIO (${symptomName})`;
  }

  // --- 3. ANALISI INTENSITÀ (Carico di Lavoro) ---
  let intensityMult = 1.0;
  let zoneLabel = "REST";

  // Analisi basata su Calorie/Passo (Efficienza Meccanica)
  const loadDensity = steps > 0 ? activeCalories / steps : 0;

  if (loadDensity > 0.08) { 
      // Alta intensità (Corsa/HIIT) -> Deplezione Glicogeno -> Serve ricarica
      zoneLabel = "AEROBIC ZONE (Z3+)";
      intensityMult = 1.5;
  } else if (steps > 8000) {
      // Volume alto, bassa intensità -> Ossidazione Grassi
      zoneLabel = "LISS / FAT BURN (Z2)";
      intensityMult = 1.0; 
  } else {
      zoneLabel = "SEDENTARY / RECOVERY";
      intensityMult = 0.8;
  }

  // --- 4. CALCOLO ENERGETICO (The Engine) ---
  // Calorie "restituibili" per il recupero muscolare
  const recoveryKcal = activeCalories * 0.50 * intensityMult;

  let rawC = 0, rawP = 0, rawF = 0;

  // --- 5. LOGICA DEI PROTOCOLLI ---
  if (protocol === 'Keto') {
      // KETO: Carbo solo se intensità alta, altrimenti Grassi
      if (intensityMult > 1.2) {
          rawC = (recoveryKcal * 0.20) / 4; // TKD (Targeted Keto)
      }
      rawP = (recoveryKcal * 0.40) / 4; // Riparazione tessuti
      rawF = (recoveryKcal * 0.40) / 9; // Carburante primario

  } else if (protocol === 'LowCarb' || protocol === 'Low Carb' || protocol === 'Bilanciata' || protocol === 'Personalizza') {
      // FLESSIBILE: Ricarica glicogeno moderata (Personalizza usa stesso schema, target effettivi dal profilo)
      rawC = (recoveryKcal * 0.40) / 4;
      rawP = (recoveryKcal * 0.30) / 4;
      rawF = (recoveryKcal * 0.30) / 9;
  }

  // --- 6. APPLICAZIONE COEFFICIENTI DI SMORZAMENTO (NASA LOGIC) ---
  // Formula finale: Bonus = (CalcoloBase) * (FattoreSonno) * (FattoreSintomo)
  // Se stai male o dormi poco, i carboidrati scendono a zero rapidamente.
  
  const finalC = Math.floor(rawC * kSleep * kSymptom);
  
  // Le proteine non vengono mai tagliate dai sintomi (servono per guarire), 
  // anzi aumentano leggermente se c'è stress per prevenire catabolismo.
  const recoveryBonus = (kSleep < 1 || kSymptom < 1) ? 1.1 : 1.0;
  const finalP = Math.floor(rawP * recoveryBonus);
  
  // I grassi compensano parzialmente il taglio calorico, ma senza esagerare
  const finalF = Math.floor(rawF * kSleep);

  // Calcolo Punteggio Efficienza Metabolica (0-100)
  const score = Math.min(100, Math.floor((activeCalories / 600) * 100 * kSleep * kSymptom));

  return {
    bonusCarbs: finalC,
    bonusProtein: finalP,
    bonusFat: finalF,
    intensityZone: zoneLabel,
    sleepFeedback: bioFeedback,
    burnScore: score
  };
};