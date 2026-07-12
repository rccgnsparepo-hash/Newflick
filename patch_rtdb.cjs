const fs = require('fs');
let code = fs.readFileSync('src/lib/rtdbService.ts', 'utf8');

code = code.replace(/catch\(console\.error\)/g, 'catch(err => console.warn("RTDB set error", err))');

// Also catch the await set(userStatusRef)
code = code.replace(/await set\(userStatusRef, \{/g, 'await set(userStatusRef, {');
code = code.replace(/      await disconnectRef\.set\(\{([\s\S]*?)\}\);/g, '      await disconnectRef.set({$1}).catch(err => console.warn("RTDB disconnect error", err));');
code = code.replace(/      await set\(userStatusRef, \{([\s\S]*?)\}\);/g, '      await set(userStatusRef, {$1}).catch(err => console.warn("RTDB set error", err));');

fs.writeFileSync('src/lib/rtdbService.ts', code);
