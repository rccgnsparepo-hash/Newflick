const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /if \(isAuthenticated\) \{\s*onSnapshot\(query\(collection\(db, 'notifications'\)/g,
  `if (true) {
      onSnapshot(query(collection(db, 'notifications')`
);

fs.writeFileSync('server.ts', code);
