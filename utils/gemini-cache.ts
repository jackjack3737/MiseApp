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

export const getFoodFromAI = async (userInput: string, imageBase64?: string | null) => {
  try {
    const query = userInput.toLowerCase().trim();
    const hasImage = Boolean(imageBase64 && imageBase64.length > 0);

    // 1. Cache solo per richieste senza immagine (chiave = testo)
    if (!hasImage) {
      const cacheRaw = await AsyncStorage.getItem(GEMINI_CACHE_KEY);
      const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
      if (cache[query] && cache[query].food_name !== "ERRORE_PARSING_AI") {
        return cache[query];
      }
    }

    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXJuZm5oc2tjZ3ZoaXRwenVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTQyNzQsImV4cCI6MjA4NTE5MDI3NH0.BZ85owCqu_5LzFcaSfLymTkTJqnB4W3RxXj58PW1O4c";
    const URL = 'https://bfmrnfnhskcgvhitpzuh.supabase.co/functions/v1/analyze-meal';

    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query: query, image: imageBase64 || null })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Errore HTTP: ${response.status}`, errorText);
      throw new Error(`Errore Supabase: ${response.status}`);
    }

    let foodData: any = await response.json();

    if (foodData && foodData.error) {
      console.error('❌ Errore da backend:', foodData.error);
      throw new Error(foodData.error === 'AI_OUTPUT_FORMAT_ERROR' ? 'Formato risposta non valido' : foodData.error);
    }

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
    // Normalizza: valori nutrizionali + ingredients (array di stringhe per correlazioni sintomi)
    if (foodData && !foodData.isText) {
      const toIngredients = (v: unknown): string[] => {
        if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string').map(s => String(s).trim()).filter(Boolean);
        if (typeof v === 'string') return v.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        return [];
      };
      foodData = {
        ...foodData,
        weight_g: ensureNumber(foodData.weight_g, 100),
        kcal: ensureNumber(foodData.kcal, 0),
        carbs: ensureNumber(foodData.carbs, 0),
        proteins: ensureNumber(foodData.proteins, 0),
        fats: ensureNumber(foodData.fats, 0),
        ingredients: toIngredients(foodData.ingredients),
        isText: Boolean(foodData.isText),
      };
    }

    // 2. FILTRO DI SICUREZZA E SALVATAGGIO
    // Salviamo se: 
    // - Non è l'errore di parsing generato dalla nostra Edge Function
    // - Oppure contiene il campo ai_advice (segno che è una ricetta valida)
    const isValidData = foodData && foodData.food_name !== "ERRORE_PARSING_AI";
    const isRecipeData = foodData && foodData.isText && foodData.ai_advice;

    if (!hasImage && (isValidData || isRecipeData)) {
      const cacheRaw = await AsyncStorage.getItem(GEMINI_CACHE_KEY);
      const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
      cache[query] = foodData;
      await AsyncStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(cache));
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