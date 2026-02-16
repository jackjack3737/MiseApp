# Creare l'APK per provare l'app

Se l'app developer (Expo Go / dev client) crasha, puoi generare un **APK standalone** da installare sul telefono.

---

## Build locale (APK subito, senza EAS)

La cartella **`android`** è già stata generata con `expo prebuild`. Per creare l'APK:

1. **Apri un terminale nella cartella del progetto** (`c:\MiseApp\mise-app`).

2. **Avvia il build release** (può richiedere **5–15 minuti** la prima volta):
   ```bash
   cd android
   .\gradlew.bat assembleRelease
   ```
   Oppure dalla root del progetto:
   ```bash
   npm run build:apk:local
   ```

3. **Trova l'APK** in:
   ```
   android\app\build\outputs\apk\release\app-release.apk
   ```

4. **Trasferisci** `app-release.apk` sul telefono (USB, Drive, email) e installalo. Abilita **"Installazione da fonti sconosciute"** se il sistema lo chiede.

**Requisiti:** Java (JDK 17) e Android SDK installati. Se non li hai, installa [Android Studio](https://developer.android.com/studio) e accetta i componenti SDK; poi riprova il comando.

---

## EAS Build (APK in cloud – quando hai build disponibili)

Se il **piano gratuito EAS** ha ancora build Android disponibili nel mese:

1. `npm install -g eas-cli` e `eas login`
2. `npm run build:apk` oppure `npx eas build --platform android --profile preview`
3. Scarica l'APK dal link in console o da [expo.dev](https://expo.dev) → Builds

Se vedi *"This account has used its Android builds from the Free plan"*, usa il **build locale** sopra.

---

## Se modifichi il progetto (nuovi plugin, ecc.)

Dopo aver cambiato `app.json` o dipendenze native, rigenera `android` e poi rifai il build:

```bash
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
```
