const fs = require('fs');
let code = fs.readFileSync('src/lib/pushNotifications.ts', 'utf8');

code = code.replace(
  /payload\.target_channel = "push";/g,
  `payload.target_channel = "push";
      payload.isAndroid = true;
      payload.isIos = true;
      payload.isAnyWeb = true;`
);

fs.writeFileSync('src/lib/pushNotifications.ts', code);
