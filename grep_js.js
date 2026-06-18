const fs = require('fs');

const content = fs.readFileSync('chunk_f07aef5c7ccc5c8d.js', 'utf8');

const key = 'mx-auto max-w-6xl px-4 py-6';
const idx = content.indexOf(key);
if (idx !== -1) {
  console.log('Found key at:', idx);
  console.log('HTML Layout segment:\n', content.slice(idx, idx + 10000));
}
