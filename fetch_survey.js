const fs = require('fs');

async function run() {
  const url = 'https://antibug-survey.vercel.app/_next/static/chunks/d5c856a681c8a92e.css';
  console.log('Fetching', url);
  const res = await fetch(url);
  const text = await res.text();
  fs.writeFileSync('raw_css.css', text);
  
  // Extract CSS variables inside :root or html
  const regex = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+)/g;
  let match;
  const vars = {};
  while ((match = regex.exec(text)) !== null) {
    vars[match[1]] = match[2].trim();
  }
  console.log('Found CSS variables:', vars);
}

run();
