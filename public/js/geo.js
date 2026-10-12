// boundary is a GeoJSON Polygon: { type: 'Polygon', coordinates: [[[lng,lat], ...]] }
// Returns true/false, or null if no boundary is available yet.
function isPointInBoundary(latitude, longitude, boundary) {
  if (!boundary || !boundary.coordinates || !boundary.coordinates[0]) return null;

  const ring = boundary.coordinates[0];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}
