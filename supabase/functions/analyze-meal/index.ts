import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { query } = await req.json()
    console.log(`🍔 Richiesta cibo: "${query}"`)

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('API Key mancante')

    // USIAMO 1.5 FLASH (È veloce e non si blocca sui limiti del piano free)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
                Analizza: "${query}".
                Se è un brand (McDonalds, Burger King, ecc) usa i valori ufficiali.
                Se è generico, stima una porzione media.
                
                Restituisci SOLO un JSON crudo (niente markdown, niente ```json, niente testo introduttivo).
                Struttura:
                {
                  "name": "Nome cibo",
                  "weight_g": 100,
                  "kcal": 0,
                  "c": 0,
                  "p": 0,
                  "f": 0
                }
              `
            }]
          }]
        })
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini Error: ${err}`)
    }

    const data = await response.json()
    
    // --- PULIZIA CHIRURGICA DEL JSON ---
    let rawText = data.candidates[0].content.parts[0].text
    console.log("Raw da Gemini:", rawText) // Vediamo cosa risponde nei log

    // 1. Rimuovi i backticks del markdown (```json ... ```)
    let cleanText = rawText.replace(/```json/g, '').replace(/```/g, '')
    
    // 2. Trova la prima parentesi graffa aperta '{' e l'ultima chiusa '}'
    const firstBrace = cleanText.indexOf('{')
    const lastBrace = cleanText.lastIndexOf('}')
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1)
    }

    const result = JSON.parse(cleanText)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("🔥 ERRORE:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})