/**
 * Riscrive assets/images/splash.png come PNG non interlacciato (compatibile AAPT).
 * Esegui: node scripts/fix-splash.js
 * Se splash/icon non sono leggibili, crea uno splash minimo valido (sfondo #F7F9FC).
 */

const fs = require('fs');
const path = require('path');

const SPLASH_SRC = path.join(__dirname, '..', 'assets', 'images', 'splash.png');
const SPLASH_BACKUP = path.join(__dirname, '..', 'assets', 'images', 'splash.png.bak');

function main() {
  let PNG;
  try {
    PNG = require('pngjs').PNG;
  } catch (e) {
    console.error('Installa pngjs: npm install --save-dev pngjs');
    process.exit(1);
  }

  if (fs.existsSync(SPLASH_SRC)) {
    const buf = fs.readFileSync(SPLASH_SRC);
    try {
      const png = PNG.sync.read(buf);
      const out = PNG.sync.write(png, { colorType: 6 });
      fs.writeFileSync(SPLASH_BACKUP, buf);
      fs.writeFileSync(SPLASH_SRC, out);
      console.log('OK: splash.png riscritto (PNG compatibile AAPT). Backup in splash.png.bak');
      return;
    } catch (e) {
      console.warn('splash.png non valido, provo icon.png...');
    }
  }

  const iconPath = path.join(__dirname, '..', 'assets', 'images', 'icon.png');
  if (fs.existsSync(iconPath)) {
    try {
      const icon = PNG.sync.read(fs.readFileSync(iconPath));
      const out = PNG.sync.write(icon, { colorType: 6 });
      if (fs.existsSync(SPLASH_SRC)) fs.writeFileSync(SPLASH_BACKUP, fs.readFileSync(SPLASH_SRC));
      fs.writeFileSync(SPLASH_SRC, out);
      console.log('OK: splash.png sostituito con icon.png (PNG valido). Backup in splash.png.bak');
      return;
    } catch (e) {
      console.warn('icon.png non leggibile.');
    }
  }

  console.log('Creo splash minimo valido (400x400, sfondo #F7F9FC)...');
  createMinimalSplash(PNG);
}

/** Crea un PNG 400x400 solido (RGBA) compatibile AAPT. */
function createMinimalSplash(PNG) {
  const W = 400;
  const H = 400;
  const r = 0xf7, g = 0xf9, b = 0xfc; // #F7F9FC da app.json splash backgroundColor
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = 255;
  }
  const out = PNG.sync.write(png, { colorType: 6 });
  if (fs.existsSync(SPLASH_SRC)) fs.writeFileSync(SPLASH_BACKUP, fs.readFileSync(SPLASH_SRC));
  fs.writeFileSync(SPLASH_SRC, out);
  console.log('OK: splash.png creato (minimo valido). Sostituisci con la tua grafica quando vuoi.');
}

main();
