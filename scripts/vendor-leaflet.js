// Copies the Leaflet map library into public/vendor/leaflet so it is served from
// the app's own address. A no-op when the files are already there (as in the zip).
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'public', 'vendor', 'leaflet');
if (fs.existsSync(path.join(target, 'leaflet.js'))) {
  console.log('Leaflet already present - nothing to do.');
  process.exit(0);
}

const source = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
if (!fs.existsSync(source)) {
  console.error('Leaflet is not installed. Run `npm install` first.');
  process.exit(1);
}
fs.mkdirSync(target, { recursive: true });
// Only what the pages use: the script, the stylesheet and its images.
for (const file of ['leaflet.js', 'leaflet.css']) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}
fs.cpSync(path.join(source, 'images'), path.join(target, 'images'), { recursive: true });
console.log('Leaflet copied to public/vendor/leaflet');
