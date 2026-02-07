// utils/smart-algorithm.ts

export interface BioData {
  steps: number;
  activeCalories: number;
  averageHeartRate?: number; // Opzionale (se manca, stimiamo)
  sleepHours?: number;       // Opzionale (se manca, assumiamo sonno regolare)
  protocol: 'Keto' | 'Carnivore' | 'Paleo' | 'LowCarb';
}

export interface MacroAdjustment {
  bonusCarbs: number;
  bonusProtein: number;
  bonusFat: number;
  intensityZone: string;   // Es: "Corsa (Zona 3)"
  sleepFeedback: string;   // Es: "Cortisolo Alto: Carbo ridotti"
  burnScore: number;       // 0-100 (Punteggio Efficienza)
}

export const calculateMetabolicReactor = (data: BioData): MacroAdjustment => {
  const { steps, activeCalories, averageHeartRate, sleepHours, protocol } = data;

  // --- 1. FATTORE SONNO (Il Freno al Cortisolo) ---
  // Se dormi poco (<6h), il cortisolo sale e l'insulina funziona male.
  // L'algoritmo "taglia" i carboidrati bonus per evitare che diventino grasso.
  let sleepFactor = 1.0;
  let sleepMessage = "Dati sonno non disponibili";

  if (sleepHours !== undefined) {
      if (sleepHours < 5.5) {
          sleepFactor = 0.5; // DIMEZZIAMO i bonus carbo (Protezione Insulina)
          sleepMessage = "⚠️ SONNO CRITICO (<5.5h): Cortisolo alto. Carboidrati ridotti del 50%.";
      } else if (sleepHours < 6.5) {
          sleepFactor = 0.8; // Penalità leggera
          sleepMessage = "⚠️ SONNO SCARSO: Sensibilità insulinica ridotta.";
      } else if (sleepHours > 7.5) {
          sleepFactor = 1.1; // Bonus recupero!
          sleepMessage = "✅ SONNO OTTIMALE: Metabolismo in assetto di recupero.";
      } else {
          sleepMessage = "⚖️ SONNO REGOLARE: Parametri stabili.";
      }
  }

  // --- 2. INTENSITÀ (Cuore e Bio-Meccanica) ---
  let intensityFactor = 1.0;
  let detectedZone = "Sedentario";

  // A. Analisi Cardiaca (Massima Precisione)
  if (averageHeartRate && averageHeartRate > 0) {
      if (averageHeartRate < 100) {
          detectedZone = "Camminata/Zona 1 (Brucia Grassi)";
          intensityFactor = 0.8; // Bassa necessità di ricarica
      } else if (averageHeartRate < 135) {
          detectedZone = "Moderata/Zona 2 (Ibrido)";
          intensityFactor = 1.0; 
      } else {
          detectedZone = "Intensa/Zona 3+ (Brucia Glicogeno)";
          intensityFactor = 1.6; // Alta necessità di ricarica
      }
  } 
  // B. Fallback (Se non abbiamo il battito, usiamo la densità calorica)
  else {
      const caloriesPerStep = steps > 0 ? activeCalories / steps : 0;
      // Camminata: ~0.04 kcal/passo | Corsa: ~0.10 kcal/passo
      if (caloriesPerStep > 0.08) {
          detectedZone = "Alta Intensità (Stimata)";
          intensityFactor = 1.5;
      } else {
          detectedZone = "Bassa Intensità (Stimata)";
          intensityFactor = 0.8;
      }
  }

  // --- 3. CALCOLO DEL RECUPERO (The Core) ---
  
  // Calorie base da "restituire" per il recupero
  const recoveryCalories = activeCalories * 0.45 * intensityFactor;

  let bonusC = 0, bonusP = 0, bonusF = 0;

  if (protocol === 'Keto') {
      // LOGICA KETO:
      // - Carbo: Solo se intensità alta (>1.2) E moltiplicati per il fattore sonno.
      // - Proteine: Sempre necessarie per riparare i danni muscolari.
      // - Grassi: Energia pulita.
      
      if (intensityFactor > 1.2) {
          const baseCarbBonus = (recoveryCalories * 0.25) / 4;
          bonusC = Math.floor(baseCarbBonus * sleepFactor); // Applichiamo il freno sonno
      } else {
          bonusC = 0; // Se cammini in Keto, niente carbo extra.
      }
      
      bonusP = Math.floor((recoveryCalories * 0.45) / 4);
      bonusF = Math.floor((recoveryCalories * 0.30) / 9);

  } else if (protocol === 'Carnivore') {
      // LOGICA CARNIVORE: Zero Carbo sempre. Tutto in Proteine/Grassi.
      bonusC = 0;
      bonusP = Math.floor((recoveryCalories * 0.60) / 4);
      bonusF = Math.floor((recoveryCalories * 0.40) / 9);

  } else {
      // LOGICA PALEO / LOWCARB: Più tolleranza.
      const baseCarbBonus = (recoveryCalories * 0.45) / 4;
      bonusC = Math.floor(baseCarbBonus * sleepFactor); // Anche qui il sonno conta!
      
      bonusP = Math.floor((recoveryCalories * 0.35) / 4);
      bonusF = Math.floor((recoveryCalories * 0.20) / 9);
  }

  // --- 4. SICUREZZA (Safety Caps) ---
  const maxCarbBonus = protocol === 'Keto' || protocol === 'Carnivore' ? 50 : 250;
  
  // Calcolo Punteggio Brucia-Grassi (0-100) per la UI
  const score = Math.min(100, Math.floor((activeCalories / 800) * 100));

  return {
    bonusCarbs: Math.min(bonusC, maxCarbBonus),
    bonusProtein: bonusP,
    bonusFat: bonusF,
    intensityZone: detectedZone,
    sleepFeedback: sleepMessage,
    burnScore: score
  };
};