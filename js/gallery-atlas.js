/* A locally hosted Natural Earth atlas; detailed tiles remain available at city scale. */
window.GalleryAtlas = async function(map, detail) {
  const response = await fetch('assets/maps/land-50m.json');
  if (!response.ok) throw new Error('Atlas coastline unavailable');
  const land = await response.json();
  const pane = map.createPane('atlasLand');
  pane.style.zIndex = 250;
  pane.style.pointerEvents = 'none';
  const renderer = L.svg({ pane: 'atlasLand', padding: .3 });
  // Repeat the same geography across the date line, like wrapped map tiles.
  const shift = (coordinates, offset) => typeof coordinates[0] === 'number' ? [coordinates[0]+offset,coordinates[1]] : coordinates.map(c => shift(c,offset));
  const worlds = [-360,0,360].map(offset => ({...land, geometry:{...land.geometry, coordinates:shift(land.geometry.coordinates,offset)}}));
  const coast = L.geoJSON(worlds, {
    renderer, interactive: false, smoothFactor: .65,
    style: { className: 'atlas-land', color: '#af9c71', weight: .7, opacity: .55, fillColor: '#1b3044', fillOpacity: 1 }
  }).addTo(map);
  const svg = pane.querySelector('svg');
  if (svg) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = '<linearGradient id="atlas-land-shade" x1="0" y1="0" x2=".35" y2="1"><stop stop-color="#2b4358"/><stop offset=".5" stop-color="#1a3044"/><stop offset="1" stop-color="#132236"/></linearGradient>';
    svg.prepend(defs);
  }
  const grid = L.layerGroup();
  const gridStyle = { renderer, interactive: false, color: '#a9bbcc', opacity: .12, weight: .6 };
  for (let lng = -540; lng <= 540; lng += 30) L.polyline([[-85,lng],[85,lng]],gridStyle).addTo(grid);
  for (let lat = -60; lat <= 60; lat += 30) L.polyline([[lat,-540],[lat,540]],{...gridStyle, opacity: lat === 0 ? .21 : .12, dashArray: lat === 0 ? '3 7' : null}).addTo(grid);
  grid.addTo(map);
  const labels = L.layerGroup();
  const names = [
    [48,-108,'NORTH AMERICA'],[-19,-61,'SOUTH AMERICA'],[54,21,'EUROPE'],[7,20,'AFRICA'],[43,93,'ASIA'],[-26,135,'OCEANIA'],
    [14,-37,'Atlantic Ocean','ocean'],[8,-145,'Pacific Ocean','ocean'],[-20,76,'Indian Ocean','ocean'],[72,80,'Arctic Ocean','ocean']
  ];
  for (const offset of [-360,0,360]) for (const [lat,lng,name,kind] of names) L.marker([lat,lng+offset], {
    interactive: false, keyboard: false, zIndexOffset: 1000, pane: 'atlasLand',
    icon: L.divIcon({ className: 'atlas-name '+(kind || ''), html: `<span>${name}</span>`, iconSize:[160,24], iconAnchor:[80,12] })
  }).addTo(labels);
  const credit = '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';
  let mode;
  detail.on('load', () => { if (mode) pane.style.opacity = '0'; });
  const update = () => {
    const detailed = map.getZoom() >= 5;
    if (mode !== detailed) {
      mode = detailed;
      map.getContainer().classList.toggle('atlas-detail', detailed);
      pane.style.opacity = '1';
      if (detailed) { if (!map.hasLayer(detail)) detail.addTo(map); map.attributionControl.removeAttribution(credit); }
      else { if (map.hasLayer(detail)) map.removeLayer(detail); map.attributionControl.addAttribution(credit); }
    }
    const showNames = !detailed && map.getZoom() >= 2 && map.getZoom() < 4;
    if (showNames && !map.hasLayer(labels)) labels.addTo(map);
    if (!showNames && map.hasLayer(labels)) map.removeLayer(labels);
  };
  map.on('zoomend', update);
  update();
  return { coast, grid, labels };
};
