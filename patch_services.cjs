const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');

// Replace any }); at the end of an onSnapshot block if there's no error handler.
// Actually, let's just replace all "return onSnapshot(q, (snap) => { ... });" 
// We can use a regex to find onSnapshots.
let replaced = code.replace(/return onSnapshot\([^,]+, \(snap\) => \{([\s\S]*?)\}\);/g, (match, body) => {
  if (match.includes(', (err) =>') || match.includes(', err =>')) {
    return match;
  }
  return `return onSnapshot(arguments[0], (snap) => {${body}}, (err) => { console.warn("Firestore subscription error:", err?.message || err); });`.replace('arguments[0]', match.match(/onSnapshot\(([^,]+)/)[1]);
});

fs.writeFileSync('src/lib/services.ts', replaced);
