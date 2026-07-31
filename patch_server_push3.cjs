const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /priority: 10,/g,
  `priority: 10,
                  content_available: true,
                  mutable_content: true,`
);

fs.writeFileSync('server.ts', code);
