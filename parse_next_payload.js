const fs = require('fs');

const html = fs.readFileSync('raw_https___antibug_survey_vercel_app_survey.html', 'utf8');

// Print all text matches inside next_f scripts
const matches = html.match(/("([^"]|\\")*")/g) || [];
const cleanStrings = matches
  .map(m => {
    try {
      return JSON.parse(m);
    } catch {
      return m;
    }
  })
  .filter(s => s && s.length > 5 && !s.includes('/') && !s.includes('\\'));

console.log('Clean strings count:', cleanStrings.length);
fs.writeFileSync('clean_strings.txt', Array.from(new Set(cleanStrings)).join('\n'));
console.log('Clean strings written to clean_strings.txt');
