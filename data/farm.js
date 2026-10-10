/* ------------------------------------------------------------------
   The farm's residents. Add an animal by adding a line to `residents`.
   species: snowcat | rabbit | panda | fox | shiba | hedgehog | duckling | penguin
            redpanda | raccoon | wolf | crocodile | fennec

   Visitors' adoption requests reach you by email (or wait in the
   Supabase "adoptions" table for approval — see README.md).
   Tip: open farm.html?keeper to get a ready-made line to paste here.
   ------------------------------------------------------------------ */
window.FARM = {
  keeper: {
    species: "snowcat",
    name: "Matcha",
    title: "Keeper of the Farm",
    note: "A snow-mountain leopard cat. Guards the orchard, naps on the warm rock, and silently judges everyone who forgets to water the trees."
  },
  residents: [
    { species: "rabbit", name: "Mochi", adoptedBy: "Titan · Host", note: "Eats the fallen petals every spring.", since: "2026-03" },
    { species: "panda", name: "Dumpling", adoptedBy: "Titan · Host", note: "Professional napper. Amateur bamboo critic.", since: "2026-04" },
    { species: "fox", name: "Ember", adoptedBy: "Titan · Host", note: "Visits at dusk. Pretends not to care about the apples.", since: "2026-06" },
    { species: "shiba", name: "Kinako", adoptedBy: "Titan · Host", note: "Has never once caught a firefly. Still believes.", since: "2026-07" },
    { species: "duckling", name: "Pip", adoptedBy: "Titan · Host", note: "Thinks the pond is the ocean.", since: "2026-09" },
    { species: "redpanda", name: "Maple", adoptedBy: "Titan · Host", note: "A little red panda with a ringed tail and a soft spot for bamboo shoots.", since: "2026-10" },
    { species: "raccoon", name: "Pebble", adoptedBy: "Titan · Host", note: "Collects shiny pebbles. Always has a curious little paw to lend.", since: "2026-10" },
    { species: "wolf", name: "Luna", adoptedBy: "Titan · Host", note: "A gentle wolf pup who listens for the wind between the trees.", since: "2026-10" },
    { species: "crocodile", name: "Moss", adoptedBy: "Titan · Host", note: "Lives in the pond, floating among the lily pads and dreaming of fish.", since: "2026-10" },
    { species: "fennec", name: "Dune", adoptedBy: "Titan · Host", note: "Those enormous ears can hear an apple land before anyone else.", since: "2026-10" }
  ]
};
