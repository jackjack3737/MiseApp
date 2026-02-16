# Riassunto app KetolabV2 (mise-app) — per contesto AI (Gemini / Cursor)

**Uso:** allega questo file a Gemini (o altro AI) per lavorare in squadra con contesto condiviso. Aggiornalo quando cambiano struttura o convenzioni.

---

## 1. Cos’è l’app

- **Nome prodotto:** KetolabV2 (slug repo: `mise-app`).
- **In breve:** app di salute e nutrizione in stile “Garmin”: traccia pasti e macro, integra dati da sensori (passi, sonno, battito/HRV via Health Connect), mostra readiness, metabolismo, idratazione e consigli. Target: sia utenti “semplici” (signora Maria) sia power user (nerd); **stessa UI**, copy chiaro in superficie e **dettagli tecnici on-demand** (tocca per espandere).
- **Piattaforma:** React Native + Expo (SDK 52), Android (Health Connect); iOS previsto ma non prioritario in questo riassunto.

---

## 2. Stack tecnico

- **Frontend:** React 18, React Native 0.76, Expo ~52, expo-router (file-based), TypeScript.
- **Navigazione:** expo-router con Stack + Tabs. Tab principali: Oggi (home), Pasti (tracker), Corpo (biostatus), Tu (profilo). Altre route: history, cart, medical, explore, profile (modal), recipe-detail.
- **Stato / dati locali:** AsyncStorage (chiavi sotto); context React `BioContext` per meteo, metriche globali (readiness, glycogen, hydration, coachMessage) e azioni (refresh health/weather, permessi).
- **Salute:** `react-native-health-connect` + hook `useHealthConnect` (passi, calorie attive, sonno, peso, tipo ultimo workout). Android.
- **Meteo:** expo-location (GPS) + chiamata esterna (in BioContext) per temperatura e consiglio sodio/idratazione.
- **AI / analisi pasti:** Google Generative AI (`@google/generative-ai`) lato app con cache in AsyncStorage (`gemini_cache`); opzionalmente Supabase Edge Function `analyze-meal` (se configurata). Componente `QuickAddMeal` + `analyzeMeal()` per “aggiungi veloce” da frase.
- **Backend opzionale:** Supabase (auth, DB, edge functions) presente nel repo; molti flussi funzionano offline-first su AsyncStorage.

---

## 3. Struttura schermate e tab

| Tab / Route   | File principale        | Cosa fa |
|---------------|------------------------|--------|
| **Oggi**      | `app/(tabs)/home.tsx` → `components/HomeScreen.tsx` | Readiness (“Pronto oggi”), check-up rapido “Come ti senti?” (chip sintomi → log in history), consiglio coach, sezione Stato (riserve energia / idratazione), meteo. Header: profilo, titolo, pulsante Aggiorna (sync health + weather). |
| **Pasti**     | `app/(tabs)/tracker.tsx` | Diario alimentare: barre P/C/F (Proteine/Carboidrati/Grassi), stima chetoni, sonno/passi/bruciate, MetabolicReactor (carboidrati dinamici), timeline pasti. Input: testo + microfono → ricerca AI/Open Food Facts; “Aggiungi veloce” con QuickAddMeal. Salvataggio in `@user_daily_logs`. |
| **Corpo**     | `app/(tabs)/biostatus.tsx` → `components/BioStatusScreen.tsx` | “Salute e dati”: sezioni Oggi in sintesi, Metabolismo, Sonno e recupero, Idratazione e sali, Previsioni. Metriche toccabili con box “Dettagli” (ex BIO-LOGIC). Dati da BioContext + Health Connect; banner permessi se mancanti. Link a History (calendario) e Medical (Advisor). |
| **Tu**        | `app/(tabs)/profile.tsx` (re-export) → `app/profile.tsx` | Profilo utente: peso, altezza, età, sesso, livello attività, protocollo (Keto, Carnivora, Paleo, Low Carb), target kcal/macro, BMI. Salvataggio in `@user_profile`. Usato da Tracker per target e BMR. |
| **History**   | `app/(tabs)/history.tsx` | Calendario / lista giorni con log da `@user_daily_logs` (pasti, sintomi, workout). Modifica/elimina log. |
| **Medical**   | `app/(tabs)/medical.tsx` | “Advisor”: sintomi, suggerimenti, log in history e opzionale lista della spesa (`@user_shopping_list`). |
| **Cart**      | `app/(tabs)/cart.tsx`   | Lista della spesa (`@user_shopping_list`, `@user_shopping_cart`). |
| **Explore**   | `app/(tabs)/explore.tsx` | Ricette / esplorazione (profilo + log per contesto). |
| **recipe-detail** | `app/recipe-detail.tsx` | Dettaglio ricetta, aggiungi a carrello / a pasti (`@user_daily_logs`). |

- **Onboarding:** `components/OnboardingFlow.tsx`; gate `AppGate` controlla `ONBOARDING_COMPLETED_KEY` e `USER_PROFILE_KEY` (@user_profile).
- **Root:** `app/_layout.tsx`: SplashScreen → AppGate, BioProvider, Stack (tabs + profile modal + recipe-detail).

---

## 4. Dati locali (AsyncStorage) — chiavi principali

- **`@user_profile`** — Profilo: peso, altezza, età, sesso, attività, protocollo, targetCalories, protein, carbs, fat. Usato da Tracker, Profile, Explore.
- **`@user_daily_logs`** — Array di log giornalieri: `{ id, date, meal_type, food_name, kcal, carbs, proteins, fats, time, label, icon_type, ... }`. meal_type: Colazione, Pranzo, Cena, Snack, WORKOUT, SINTOMO, ecc. Usato da Tracker, History, Medical, HomeScreen (sintomi), BioContext (carboidrati per glycogen), recipe-detail.
- **`@user_daily_symptom_factor`** — Fattore sintomo giornaliero (Medical/Advisor): `{ factor, name }`. Usato da Tracker (Metabolic Reactor / target dinamici).
- **`@user_shopping_list`** / **`@user_shopping_cart`** — Lista spesa e carrello ricette (Cart, Medical, recipe-detail).
- **`@user_daily_blackbox`** — Dati “blackbox” (tipato in `types/blackbox.ts`).
- **Onboarding:** chiavi in `constants/onboarding.ts` (es. `USER_PROFILE_KEY`, `ONBOARDING_COMPLETED_KEY`).
- **Cache:** `gemini_cache` (utils/gemini-cache.ts), `@is_premium` (PaywallModal).

---

## 5. Context e salute

- **BioContext** (`context/BioContext.tsx`):  
  - **weather:** temp, condition, saltAdvice, isLive, loading, error.  
  - **metrics:** readiness, cnsBattery, glycogen, hydration (0–100).  
  - **coachMessage**, **healthPermissionMissing**.  
  - **actions:** updateWeather, updateMetrics, setCoachMessage, refreshWeather, refreshHealth, requestHealthPermissions, logWorkout.  
  - Readiness/CNS derivati da sonno + HRV (useHealthConnect); glycogen anche da carboidrati del giorno (lettura @user_daily_logs).

- **useHealthConnect** (`hooks/useHealthConnect.ts`): steps, calories, sleepHours, weight, lastWorkoutType, refresh, connect, error, loading. Android Health Connect.

- **useAnabolicAlgorithm** (`hooks/useAnabolicAlgorithm.ts`): target proteine dinamico e messaggio per la barra P nel Tracker (peso, workout, calorie).

---

## 6. Design e convenzioni copy

- **Tema:** Dark per tab bar e header (es. `#121212`, `#1E1E1E`); Tracker content su sfondo chiaro (`#F7F9FC`). Accento cyan `#00E0FF` (TRACKER_BLACK.ACCENT). Costanti: `constants/theme.ts`, `constants/Colors.ts`, `constants/trackerBlack.ts`.
- **Copy:** Linguaggio semplice in superficie (per tutti); termini tecnici e spiegazioni nel box “Dettagli” (tocca la metrica). Niente modalità “semplice/esperto” in avvio; stessa struttura per tutti.
- **Tab:** Oggi, Pasti, Corpo, Tu. Schermate secondarie senza tab: History, Cart, Medical, Explore.

---

## 7. Funzionalità principali (per area)

- **Home (Oggi):** Readiness, check-up “Come ti senti?” (log sintomi in @user_daily_logs), consiglio coach, Stato (riserve energia + idratazione), meteo. Modali spiegazione su tocco (readiness, riserve, idratazione).
- **Pasti (Tracker):** Aggiunta pasti (testo, voce, QuickAddMeal), barre P/C/F con target da profilo + useAnabolicAlgorithm, limite carboidrati dinamico (MetabolicReactor: passi, sonno, workout, sintomo), stima chetoni, BMR + NEAT + sport = “Bruciate oggi”, timeline pasti con modifica ora/elimina. Salvataggio in @user_daily_logs.
- **Corpo (BioStatus):** Metriche bio (readiness, affaticamento, difese, energia grassi/zuccheri, glicogeno, efficienza metabolica, sonno/recupero, idratazione/sale, previsioni). Ogni metrica espandibile con “Dettagli”. Sincronizzazione metriche con BioContext.
- **Profilo:** Dati anagrafici e target; salvataggio @user_profile; Tracker e algoritmi leggono da qui.
- **History:** Lettura/modifica @user_daily_logs per data.
- **Medical:** Sintomi, fattore giornaliero @user_daily_symptom_factor, log e lista spesa.
- **AI pasti:** Frase → Gemini (o Supabase analyze-meal) → analisi nutrienti; QuickAddMeal per “aggiungi veloce” da testo. Open Food Facts per barcode/ricerca in Tracker.

---

## 8. File utili (dove cercare)

- **Layout / nav:** `app/_layout.tsx`, `app/(tabs)/_layout.tsx`
- **Home:** `app/(tabs)/home.tsx`, `components/HomeScreen.tsx`
- **Tracker:** `app/(tabs)/tracker.tsx` (BarsHeader, MetabolicReactor, QuickAddMeal, timeline, modali)
- **Corpo:** `app/(tabs)/biostatus.tsx`, `components/BioStatusScreen.tsx`
- **Profilo:** `app/profile.tsx`
- **Context:** `context/BioContext.tsx`
- **Health:** `hooks/useHealthConnect.ts`, `hooks/useAnabolicAlgorithm.ts`
- **Algoritmi / utilità:** `utils/smart-algorithm.ts` (calculateMetabolicReactor), `utils/gemini-cache.ts`, `utils/openfoodfacts.ts`, `constants/workoutTypes.ts`
- **Componenti condivisi:** `components/MetabolicReactor.tsx`, `components/SmartHint.tsx`, `components/QuickAddMeal.tsx`
- **Backend:** `supabase/functions/analyze-meal/index.ts`

---

## 9. Note per AI (Gemini / Cursor)

- Mantenere **un solo flusso** per tutti: niente “modalità facile/esperto” in avvio; complessità sotto “Dettagli” o link “Altro”.
- **AsyncStorage** è la fonte di verità per profilo e log; Health Connect per passi/sonno/calorie/peso/workout.
- **Italiano** per tutta l’UI e i messaggi utente.
- Per modifiche grosse a schermate o dati, aggiornare anche questo riassunto così il contesto resta allineato tra te, Cursor e Gemini.
