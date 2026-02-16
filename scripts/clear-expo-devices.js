const fs = require('fs');
const path = require('path');

// Rimuove .expo (o solo devices.json*) per evitare EPERM su rename su Windows
const root = path.join(__dirname, '..');
const expoDir = path.join(root, '.expo');
if (!fs.existsSync(expoDir)) process.exit(0);

try {
  const files = fs.readdirSync(expoDir);
  for (const f of files) {
    if (f === 'devices.json' || f.startsWith('devices.json.')) {
      try {
        fs.unlinkSync(path.join(expoDir, f));
      } catch (_) {}
    }
  }
} catch (_) {}
process.exit(0);
