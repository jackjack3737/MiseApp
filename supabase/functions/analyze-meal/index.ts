import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query } = await req.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('API Key mancante!');

    const genAI = new GoogleGenerativeAI(apiKey);
    // Usiamo il tuo modello preferito
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      Sei un nutrizionista. Analizza: "${query}".
      
      ISTRUZIONI:
      1. Stima una porzione media standard in GRAMMI (es. 1 mela = 180g, 1 pizza = 350g).
      2. Calcola kcal e macro per QUELLA quantità standard.
      3. Restituisci JSON puro.
      
      FORMATO JSON:
      { 
        "name": "Nome breve", 
        "weight_g": 100, 
        "kcal": 0, 
        "c": 0, 
        "p": 0, 
        "f": 0 
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("ERRORE:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})