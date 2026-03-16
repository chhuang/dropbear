const fs = require('fs');
const geojson = JSON.parse(fs.readFileSync('nsw-suburbs.geojson', 'utf8'));

// Calculate centroid of a polygon/multipolygon
function getCentroid(coords, depth = 0) {
  if (depth === 0 && Array.isArray(coords[0])) {
    // Polygon or MultiPolygon
    let allPoints = [];
    function flatten(c, d) {
      if (d === 2) {
        allPoints.push(c);
      } else {
        for (const x of c) flatten(x, d + 1);
      }
    }
    flatten(coords, 0);
    
    if (allPoints.length === 0) return null;
    const sum = allPoints.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / allPoints.length, sum[1] / allPoints.length]; // [lng, lat]
  }
  return null;
}

const centroids = {};
for (const feature of geojson.features) {
  const name = feature.properties?.nsw_loca_2?.toLowerCase();
  if (name && feature.geometry?.coordinates) {
    const centroid = getCentroid(feature.geometry.coordinates);
    if (centroid) {
      centroids[name] = { lng: centroid[0], lat: centroid[1] };
    }
  }
}

// Missing suburbs from our check
const missing = [
  "ryde", "st leonards", "roseville", "willoughby", "killara", "potts point",
  "eastwood", "campsie", "dee why", "neutral bay", "ashfield", "cremorne",
  "vaucluse", "penrith", "kogarah", "lindfield", "macquarie park", "bellevue hill",
  "ultimo", "castle hill", "crows nest", "redfern", "camperdown", "bondi",
  "rhodes", "marsfield", "bronte", "northbridge", "croydon", "beecroft",
  "dover heights", "tamarama", "turramurra", "artarmon", "centennial park",
  "castlecrag", "clovelly", "queens park", "birchgrove", "auburn",
  "denistone east", "carlingford", "meadowbank", "darlington", "beaconsfield",
  "north strathfield", "chester hill", "milsons point"
];

console.log('=== Found in GeoJSON ===\n');
const found = [];
const notFound = [];

for (const suburb of missing) {
  if (centroids[suburb]) {
    const c = centroids[suburb];
    console.log(`"${suburb}": [${c.lat}, ${c.lng}],`);
    found.push(suburb);
  } else {
    notFound.push(suburb);
  }
}

console.log(`\n// Found: ${found.length}, Not found: ${notFound.length}`);
if (notFound.length > 0) {
  console.log('// Not found:', notFound.join(', '));
}
