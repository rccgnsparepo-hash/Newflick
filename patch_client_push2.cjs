const fs = require('fs');
let code = fs.readFileSync('src/lib/pushNotifications.ts', 'utf8');

code = code.replace(
  /payload\.include_aliases = \{ external_id: \[recipientId\] \};\s*payload\.include_external_user_ids = \[recipientId\];\s*payload\.target_channel = "push";/g,
  `payload.include_aliases = { external_id: [recipientId] };
      payload.include_external_user_ids = [recipientId];
      payload.target_channel = "push";
      payload.isAndroid = true;
      payload.isIos = true;
      payload.isAnyWeb = true;`
);

fs.writeFileSync('src/lib/pushNotifications.ts', code);
