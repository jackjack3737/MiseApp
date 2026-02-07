import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_CACHE_KEY = '@gemini_food_cache';

export const getFoodFromAI = async (userInput: string) => {
  try {
    const query = userInput.toLowerCase().trim();

    // 1. Controllo Cache Locale (Risparmiamo chiamate)
    const cacheRaw = await AsyncStorage.getItem(GEMINI_CACHE_KEY);
    let cache = cacheRaw ? JSON.parse(cacheRaw) : {};

    if (cache[query]) {
      console.log("🚀 Recuperato dalla Cache Locale");
      return cache[query];
    }

    // 2. Chiamata alla tua Edge Function su Supabase
    console.log("🧠 Interrogazione tramite Supabase Bridge...");
    
    // --- IMPORTANTE: INCOLLA QUI LA TUA CHIAVE ---
    // Vai su Supabase -> Project Settings -> API.
    // Copia la chiave "anon public" (quella lunghissima che inizia con "eyJ").
    // Incollala qui sotto tra le virgolette al posto di quella scritta.
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmbXJuZm5oc2tjZ3ZoaXRwenVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTQyNzQsImV4cCI6MjA4NTE5MDI3NH0.BZ85owCqu_5LzFcaSfLymTkTJqnB4W3RxXj58PW1O4c"; 

    // URL DEL TUO PROGETTO
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
      // Questo ci aiuta a capire se l'errore è 401 (chiave sbagliata) o 500 (server)
      console.error(`❌ Errore HTTP: ${response.status}`, errorText);
      throw new Error(`Errore Supabase: ${response.status} - ${errorText}`);
    }

    const foodData = await response.json();

    // 3. Salvataggio in Cache
    cache[query] = foodData;
    await AsyncStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(cache));

    return foodData;

  } catch (error) {
    console.error("❌ Errore AI:", error);
    throw error;
  }
};