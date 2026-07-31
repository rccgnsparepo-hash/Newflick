const fs = require('fs');
let code = fs.readFileSync('src/lib/pushNotifications.ts', 'utf8');

code = code.replace(
  /priority: 10,/g,
  `priority: 10,
      content_available: true,
      mutable_content: true,`
);

fs.writeFileSync('src/lib/pushNotifications.ts', code);
