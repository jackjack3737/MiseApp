import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    console.log(`🍔 Analisi richiesta per: "${query}"`)

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY mancante su Supabase')

    // ✅ ORA USIAMO IL MODELLO 2.0 FLASH (Dalla tua lista)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
                Sei un nutrizionista. Analizza: "${query}".
                Rispondi SOLO con questo JSON (no markdown):
                {
                  "food_name": "Nome cibo",
                  "kcal": 0,
                  "carbs": 0,
                  "proteins": 0,
                  "fats": 0,
                  "weight_g": 100
                }
              `
            }]
          }]
        })
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error("❌ Errore Google:", errText)
      throw new Error(`Errore API Gemini (${response.status}): ${errText}`)
    }

    const data = await response.json()
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!rawText) throw new Error("Gemini ha risposto vuoto.")

    let cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    const firstBrace = cleanText.indexOf('{')
    const lastBrace = cleanText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) cleanText = cleanText.substring(firstBrace, lastBrace + 1)

    const result = JSON.parse(cleanText)
    console.log("✅ Analisi completata:", result.food_name)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("🔥 Errore:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})