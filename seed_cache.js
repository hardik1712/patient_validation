const db = require('./database');
const fs = require('fs');
const path = require('path');

async function seed() {
  try {
    const cachePath = path.join(__dirname, 'responses_cache.json');
    if (!fs.existsSync(cachePath)) {
      console.error('responses_cache.json not found!');
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    console.log('Seeding database cache with pre-computed AI responses...');
    await db.setCache('ai_responses', data);
    console.log('Successfully seeded database cache!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding cache:', err);
    process.exit(1);
  }
}

seed();
