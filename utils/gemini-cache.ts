import AsyncStorage from '@react-native-async-storage/async-storage';

// Cambiamo la chiave in v2 per forzare il sistema a ignorare i vecchi errori salvati
const GEMINI_CACHE_KEY = '@gemini_food_cache_v2';

/** Converte valore in number (rimuove "g", spazi, ecc.). */
function ensureNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

export const getFoodFromAI = async (userInput: string) => {
  try {
    const query = userInput.toLowerCase().trim();

    // 1. Controllo Cache Locale (v2)
    const cacheRaw = await AsyncStorage.getItem(GEMINI_CACHE_KEY);
    let cache = cacheRaw ? JSON.parse(cacheRaw) : {};

    // Restituiamo dalla cache solo se il dato è valido
    if (cache[query] && cache[query].food_name !== "ERRORE_PARSING_AI") {
      console.log("🚀 Recuperato dalla Cache Locale (v2)");
      return cache[query];
    }

    console.log("🧠 Interrogazione tramite Supabase Bridge...");
    
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXJuZm5oc2tjZ3ZoaXRwenVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTQyNzQsImV4cCI6MjA4NTE5MDI3NH0.BZ85owCqu_5LzFcaSfLymTkTJqnB4W3RxXj58PW1O4c"; 
    const URL = 'https://bfmrnfnhskcgvhitpzuh.supabase.co/functions/v1/analyze-meal';

    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query: query })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Errore HTTP: ${response.status}`, errorText);
      throw new Error(`Errore Supabase: ${response.status}`);
    }

    let foodData: any = await response.json();

    // Pulizia: se la risposta è una stringa (JSON grezzo), rimuovi backticks/markdown e caratteri di controllo, poi parsifica
    if (typeof foodData === 'string') {
      let stripped = foodData.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = stripped.indexOf('{');
      const lastBrace = stripped.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        stripped = stripped.substring(firstBrace, lastBrace + 1).replace(/[\u0000-\u001F\u007F]/g, ' ');
        try {
          foodData = JSON.parse(stripped);
        } catch {
          foodData = {};
        }
      } else {
        foodData = {};
      }
    }
    // Normalizza: valori nutrizionali devono essere number, non stringhe
    if (foodData && !foodData.isText) {
      foodData = {
        ...foodData,
        weight_g: ensureNumber(foodData.weight_g, 100),
        kcal: ensureNumber(foodData.kcal, 0),
        carbs: ensureNumber(foodData.carbs, 0),
        proteins: ensureNumber(foodData.proteins, 0),
        fats: ensureNumber(foodData.fats, 0),
        isText: Boolean(foodData.isText),
      };
    }

    // 2. FILTRO DI SICUREZZA E SALVATAGGIO
    // Salviamo se: 
    // - Non è l'errore di parsing generato dalla nostra Edge Function
    // - Oppure contiene il campo ai_advice (segno che è una ricetta valida)
    const isValidData = foodData && foodData.food_name !== "ERRORE_PARSING_AI";
    const isRecipeData = foodData && foodData.isText && foodData.ai_advice;

    if (isValidData || isRecipeData) {
      cache[query] = foodData;
      await AsyncStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(cache));
      console.log("💾 Risposta IA (Ricetta/Cibo) salvata in cache v2");
    } else {
      console.log("⚠️ Risposta non valida, bypass salvataggio");
    }

    return foodData;

  } catch (error) {
    console.error("❌ Errore AI:", error);
    throw error;
  }
};

export const clearGeminiCache = async () => {
    await AsyncStorage.removeItem(GEMINI_CACHE_KEY);
    console.log("🧹 Cache Gemini v2 svuotata");
};