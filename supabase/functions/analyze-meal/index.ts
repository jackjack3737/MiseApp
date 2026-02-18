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
    const { query = '', image: imageBase64 = null } = await req.json()
    const hasImage = typeof imageBase64 === 'string' && imageBase64.length > 0
    console.log(`🍔 Analisi richiesta per: "${query}"${hasImage ? ' (con immagine)' : ''}`)

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY mancante su Supabase')

    const systemPrompt = `RUOLO: Sei un database nutrizionale che restituisce SOLO JSON. Non sei un assistente conversazionale. Non scrivere MAI frasi, spiegazioni o suggerimenti.

OUTPUT: Restituisci SOLO ED ESCLUSIVAMENTE un oggetto JSON valido. Zero caratteri prima del primo { e zero dopo l'ultimo }. Niente "Ecco i dati", niente "Nota:", niente markdown.

DIVIETI ASSOLUTI (violazione = output non valido):
- NON spiegare i valori. NON dire "dipende dalla cottura", "considera che...", "può variare".
- NON suggerire di "cercare online" o "consultare un nutrizionista".
- NON fare domande. NON chiedere chiarimenti. Stima sempre.
- NON restituire testo discorsivo. Solo JSON.

STIMA OBBLIGATORIA: Per qualsiasi input (testo o immagine di un piatto):
- Se c'è un'immagine: descrivi cosa vedi (alimenti, porzioni plausibili) e stima i macro per una porzione ragionevole (es. 200-400g). Stima sempre, anche approssimativa.
- Se c'è solo testo: assumi una preparazione standard. Calcola i macro per il peso indicato (o 200g/porzione se non indicato).
- Restituisci numeri stimati come se fossero certi. L'utente preferisce una stima immediata piuttosto che spiegazioni.

FALLBACK: Se non riconosci l'alimento (testo o foto), inventa una stima basata sugli ingredienti probabili. Un numero sbagliato del 10% è MEGLIO che nessun numero o testo inutile.

REGOLA FONDAMENTALE: Se l'utente scrive un NOME DI PIATTO o di alimento (es. "pasta aglio e olio", "insalata", "pizza margherita") devi SEMPRE restituire il JSON nutrizionale con isText:false. NON rispondere MAI con isText:true o con messaggi di "attenzione" per i nomi di cibi: stima sempre i macro.

Struttura JSON obbligatoria (solo per alimenti): food_name (stringa), weight_g, kcal, carbs, proteins, fats (tutti number), ingredients (array di stringhe, OBBLIGATORIO), isText:false.
Per OGNI piatto, anche a una parola (kebab, pizza, insalata), restituisci SEMPRE ingredients con gli ingredienti tipici (almeno 3-8 voci).
{"food_name":"Nome descrittivo","weight_g":200,"kcal":380,"carbs":12,"proteins":45,"fats":28,"ingredients":["ingrediente1","ingrediente2",...],"isText":false}

Esempi:
- "pasta aglio e olio" → ingredients: ["pasta","aglio","olio extravergine","prezzemolo"]
- "kebab" → ingredients: ["carne","pane o piadina","insalata","pomodoro","cipolla","salsa yogurt","spezie"]
- "pizza" → ingredients: ["impasto pizza","pomodoro","mozzarella","olio"]
Esempio OUTPUT:
{"food_name":"Kebab","weight_g":350,"kcal":520,"carbs":45,"proteins":28,"fats":26,"ingredients":["carne","pane","insalata","pomodoro","cipolla","salsa","spezie"],"isText":false}

${hasImage
  ? `ISTRUZIONI PER FOTO: Guarda l'immagine allegata. È un piatto/un pasto. Devi:
1. Identificare tutti gli alimenti visibili (es. pasta, carne, verdure, condimenti).
2. Stimare il peso TOTALE della porzione nel piatto in grammi (es. 250-400g per un piatto unico).
3. Calcolare i macro per l'intera porzione: kcal, carbs, proteins, fats.
4. Restituire UN SOLO oggetto JSON: food_name, weight_g, kcal, carbs, proteins, fats, ingredients = array di ingredienti principali (es. ["pasta","pomodoro","basilico"]), isText:false.
${query && query !== 'Analizza il pasto nella foto' ? 'Hint utente: "' + query + '". ' : ''}Rispondi SOLO con il JSON, nessun altro testo.`
  : 'Input utente da analizzare: "' + query + '"'}`

    // Parti per Gemini: se c'è immagine, prima immagine poi testo (Vision)
    const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = []
    if (hasImage) {
      const dataUrl = String(imageBase64)
      const match = dataUrl.match(/^data:(image\/(jpeg|png|webp|gif));base64,/)
      const rawBase64 = match ? dataUrl.slice(match[0].length) : dataUrl.replace(/^data:image\/\w+;base64,/, '')
      const mimeType = match ? match[1] : 'image/jpeg'
      parts.push({ inlineData: { mimeType, data: rawBase64 } })
    }
    parts.push({ text: systemPrompt })

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
        }),
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
    const toIngredients = (v: unknown): string[] => {
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string').map(s => String(s).trim()).filter(Boolean)
      if (typeof v === 'string') return v.split(/[,;]/).map(s => s.trim()).filter(Boolean)
      return []
    }
    let ingredients = toIngredients(parsed.ingredients)
    if (ingredients.length === 0) {
      const name = (parsed.food_name ?? query ?? 'Alimento').trim()
      if (name) ingredients = [name]
    }
    // Se il modello ha restituito isText:true per un nome di piatto, forziamo comunque il JSON nutrizionale (evita "Attenzione" per paste, risotti, ecc.)
    const looksLikeDishName = !query.match(/\?|posso|come|quanto|perché|perche|consigli|è meglio|e meglio/i) && query.length > 2 && query.length < 120
    const forceFood = parsed.isText && looksLikeDishName

    const result = parsed.isText && !forceFood
      ? parsed
      : {
          food_name: parsed.food_name ?? (forceFood ? query : 'Alimento'),
          weight_g: toNum(parsed.weight_g, 100),
          kcal: toNum(parsed.kcal, 0),
          carbs: toNum(parsed.carbs, 0),
          proteins: toNum(parsed.proteins, 0),
          fats: toNum(parsed.fats, 0),
          ingredients,
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