const fs = require('fs');
let code = fs.readFileSync('src/lib/services.ts', 'utf8');
code = code.replace(/return onSnapshot\(q, \(snap\) => \{/g, 'return onSnapshot(q, (snap) => {');
// Wait, I can just patch the firebase source to NOT console.error!
