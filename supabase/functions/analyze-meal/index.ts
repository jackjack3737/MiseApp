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
              text: `RUOLO: Sei un database nutrizionale che restituisce SOLO JSON. Non sei un assistente conversazionale. Non scrivere MAI frasi, spiegazioni o suggerimenti.

OUTPUT: Restituisci SOLO ED ESCLUSIVAMENTE un oggetto JSON valido. Zero caratteri prima del primo { e zero dopo l'ultimo }. Niente "Ecco i dati", niente "Nota:", niente markdown.

DIVIETI ASSOLUTI (violazione = output non valido):
- NON spiegare i valori. NON dire "dipende dalla cottura", "considera che...", "può variare".
- NON suggerire di "cercare online" o "consultare un nutrizionista".
- NON fare domande. NON chiedere chiarimenti. Stima sempre.
- NON restituire testo discorsivo. Solo JSON.

STIMA OBBLIGATORIA: Per qualsiasi input (es. "200g pollo con le mandorle", "pollo alle mandorle"):
- Assumi una preparazione standard (es. pollo alle mandorle = stile ristorante cinese/italiano: pollo, mandorle, salsa, olio). Calcola i macro per il peso indicato (o 200g/porzione se non indicato).
- Restituisci numeri stimati come se fossero certi. L'utente preferisce una stima immediata piuttosto che spiegazioni.

FALLBACK: Se non riconosci l'alimento, inventa una stima basata sugli ingredienti probabili. Un numero sbagliato del 10% è MEGLIO che nessun numero o testo inutile.

Struttura JSON obbligatoria (solo per alimenti; tutti number, mai stringhe per kcal/carbs/proteins/fats/weight_g):
{"food_name":"Nome descrittivo","weight_g":200,"kcal":380,"carbs":12,"proteins":45,"fats":28,"isText":false}

Esempio INPUT "200g pollo alle mandorle" → OUTPUT (solo questo, nient'altro):
{"food_name":"Pollo alle Mandorle (Stima Ristorante)","weight_g":200,"kcal":380,"carbs":12,"proteins":45,"fats":28,"isText":false}

Input utente da analizzare: "${query}"`
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

    // 1. Rimuovi blocchi markdown
    let cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    const firstBrace = cleanText.indexOf('{')
    const lastBrace = cleanText.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) cleanText = cleanText.substring(firstBrace, lastBrace + 1)

    // 2. SANITIZZAZIONE AGGRESSIVA (fix per errore 500)
    // Rimuove caratteri di controllo (ASCII 0-31 e 127); sostituisce con spazio
    cleanText = cleanText.replace(/[\x00-\x1F\x7F]/g, () => ' ')

    let parsed: any
    try {
      parsed = JSON.parse(cleanText)
    } catch (parseError) {
      console.error("JSON PARSE ERROR:", parseError)
      console.log("TESTO FALLITO:", cleanText)
      return new Response(
        JSON.stringify({ error: "AI_OUTPUT_FORMAT_ERROR", raw: cleanText }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const toNum = (v: unknown, d: number) => (typeof v === 'number' && !Number.isNaN(v)) ? v : (typeof v === 'string' ? parseFloat(v.replace(/[^0-9.,-]/g, '').replace(',', '.')) || d : d)
    const result = parsed.isText
      ? parsed
      : {
          food_name: parsed.food_name ?? 'Alimento',
          weight_g: toNum(parsed.weight_g, 100),
          kcal: toNum(parsed.kcal, 0),
          carbs: toNum(parsed.carbs, 0),
          proteins: toNum(parsed.proteins, 0),
          fats: toNum(parsed.fats, 0),
          isText: false,
        }
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