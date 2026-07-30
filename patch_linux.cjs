const fs = require('fs');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.build.linux = pkg.build.linux || {};
pkg.build.linux.desktopName = "Flick";
pkg.build.linux.category = "Network;Chat";
pkg.build.linux.syncDesktopName = true;
pkg.build.linux.icon = "public/icon.png";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
