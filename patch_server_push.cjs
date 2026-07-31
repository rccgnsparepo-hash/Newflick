const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

let replaced = false;
code = code.replace(
  /payload\.include_aliases = \{ external_id: \[receiverId\] \};\s*payload\.include_external_user_ids = \[receiverId\]; \/\/ Fallback for older API versions\s*payload\.target_channel = "push";/g,
  `payload.include_aliases = { external_id: [receiverId] };
                  payload.include_external_user_ids = [receiverId]; // Fallback for older API versions
                  payload.target_channel = "push";
                  payload.isAndroid = true; // Ensure native Android push delivery`
);
code = code.replace(
  /payload\.include_aliases = \{ external_id: \[uDoc\.id\] \};\s*payload\.target_channel = "push";/g,
  `payload.include_aliases = { external_id: [uDoc.id] };
                payload.target_channel = "push";
                payload.isAndroid = true; // Ensure native Android push delivery`
);

fs.writeFileSync('server.ts', code);
