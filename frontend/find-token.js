const fs = require('fs');
const os = require('os');
const path = require('path');

const home = os.homedir();
const candidates = [
  path.join(home, '.local', 'share', 'com.vercel.cli', 'auth.json'),
  path.join(home, 'AppData', 'Roaming', 'com.vercel.cli', 'auth.json'),
  path.join(home, 'AppData', 'Local', 'com.vercel.cli', 'auth.json'),
  path.join(home, '.config', 'com.vercel.cli', 'auth.json'),
  path.join(home, '.vercel', 'auth.json'),
  path.join(process.env.APPDATA || '', 'com.vercel.cli', 'auth.json'),
  path.join(process.env.LOCALAPPDATA || '', 'com.vercel.cli', 'auth.json'),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    console.log('FOUND:', p);
    console.log('TOKEN:', data.token);
    process.exit(0);
  }
}

// Try to find it recursively
const searchDirs = [
  path.join(home, 'AppData', 'Roaming'),
  path.join(home, 'AppData', 'Local'),
];

function findFile(dir, name, depth = 0) {
  if (depth > 3) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isFile() && e.name === name && fullPath.includes('vercel')) return fullPath;
      if (e.isDirectory() && !e.name.startsWith('.') && e.name.includes('vercel')) {
        const found = findFile(fullPath, name, depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

for (const dir of searchDirs) {
  const found = findFile(dir, 'auth.json');
  if (found) {
    const data = JSON.parse(fs.readFileSync(found, 'utf-8'));
    console.log('FOUND:', found);
    console.log('TOKEN:', data.token);
    process.exit(0);
  }
}

console.log('Not found in any known location');
