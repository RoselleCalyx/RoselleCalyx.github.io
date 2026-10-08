/* ------------------------------------------------------------------
   The farm's residents. Add an animal by adding a line to `residents`.
   species: snowcat | rabbit | panda | fox | shiba | hedgehog | duckling | penguin

   Visitors' adoption requests reach you by email (or wait in the
   Supabase "adoptions" table for approval — see README.md).
   Tip: open farm.html?keeper to get a ready-made line to paste here.
   ------------------------------------------------------------------ */
window.FARM = {
  keeper: {
    species: "snowcat",
    name: "Yuki",
    title: "Keeper of the Farm",
    note: "A snow-mountain leopard cat. Guards the orchard, naps on the warm rock, and silently judges everyone who forgets to water the trees."
  },
  residents: [
    { species: "rabbit", name: "Mochi", adoptedBy: "Chen", note: "Eats the fallen petals every spring.", since: "2026-03" },
    { species: "panda", name: "Dumpling", adoptedBy: "Chen", note: "Professional napper. Amateur bamboo critic.", since: "2026-04" },
    { species: "fox", name: "Ember", adoptedBy: "Chen", note: "Visits at dusk. Pretends not to care about the apples.", since: "2026-06" },
    { species: "shiba", name: "Kinako", adoptedBy: "Chen", note: "Has never once caught a firefly. Still believes.", since: "2026-07" },
    { species: "duckling", name: "Pip", adoptedBy: "Chen", note: "Thinks the pond is the ocean.", since: "2026-09" }
  ]
};
