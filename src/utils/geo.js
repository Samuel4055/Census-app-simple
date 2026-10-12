// Pure-JS geometry helpers. Keeping this out of SQL means the app runs on any
// MySQL/MariaDB version and there is no spatial axis-order (lat/lng) trap.

// boundary: GeoJSON Polygon { type:'Polygon', coordinates:[[[lng,lat],...]] }
// Returns true/false, or null when there is no usable boundary.
function pointInPolygon(latitude, longitude, boundary) {
  const ring = boundary && boundary.coordinates && boundary.coordinates[0];
  if (!ring || ring.length < 4) return null;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const crosses =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// Great-circle distance in metres.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { pointInPolygon, haversineMeters };
