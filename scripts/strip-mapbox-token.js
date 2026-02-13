const fs = require('fs');
const path = 'components/PriceMap.js';
try {
  let s = fs.readFileSync(path, 'utf8');
  s = s.replace(/const FALLBACK_TOKEN = '[^']*';\s*\n?/g, '');
  s = s.replace(/\|\| FALLBACK_TOKEN/g, "|| ''");
  fs.writeFileSync(path, s);
} catch (e) {
  process.exit(0);
}
