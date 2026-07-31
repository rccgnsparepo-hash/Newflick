const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /payload\.priority = 10;/g,
  `payload.priority = 10;
                  payload.isAndroid = true;
                  payload.isIos = true;
                  payload.isAnyWeb = true;`
);

fs.writeFileSync('server.ts', code);
