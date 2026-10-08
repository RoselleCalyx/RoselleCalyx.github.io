/* ------------------------------------------------------------------
   Gallery — footprints. Each entry is one place/trip ("album").

   ⚠  EXAMPLE DATA: replace these with your own places and photos.

   date:   "YYYY-MM"            coords: [latitude, longitude]
   tags:   any of Travel, Nature, Life, Food, People (Favorite = favorite: true)
   photos: put images in assets/gallery/ and list them here.
           If "src" is empty, a painted placeholder is drawn from "paint":
             sky:  dusk | aurora | milkyway | sunset | night | dawn
             land: mountains | sea | city | hills | desert | lake | sakura | fuji
   ------------------------------------------------------------------ */
window.GALLERY = [
  {
    id: "iceland",
    place: "Iceland",
    title: "Where the sky learns to dance",
    date: "2024-02",
    coords: [64.25, -15.2],
    tags: ["Travel", "Nature"],
    favorite: true,
    story: "A cabin under the aurora, snow up to the knees, and the quietest night I have ever heard.",
    photos: [
      { src: "", caption: "Aurora over the cabin", paint: { sky: "aurora", land: "mountains", cabin: true } },
      { src: "", caption: "Black sand, white foam", paint: { sky: "night", land: "sea" } }
    ]
  },
  {
    id: "japan",
    place: "Japan",
    title: "Spring, briefly",
    date: "2024-04",
    coords: [35.36, 138.73],
    tags: ["Travel", "Nature", "Food"],
    favorite: true,
    story: "Cherry blossoms along an old railway, Mount Fuji at dusk, ramen at midnight.",
    photos: [
      { src: "", caption: "Fuji at dusk", paint: { sky: "sunset", land: "fuji" } },
      { src: "", caption: "Blossoms by the tracks", paint: { sky: "dawn", land: "sakura" } }
    ]
  },
  {
    id: "alps",
    place: "Swiss Alps",
    title: "The Milky Way over the pass",
    date: "2023-08",
    coords: [46.56, 8.56],
    tags: ["Travel", "Nature"],
    story: "Two hours of climbing in the dark for twenty minutes of the galactic core.",
    photos: [
      { src: "", caption: "Galactic core", paint: { sky: "milkyway", land: "mountains" } }
    ]
  },
  {
    id: "munich",
    place: "Munich",
    title: "Home, for now",
    date: "2023-10",
    coords: [48.137, 11.575],
    tags: ["Life", "People"],
    story: "The city where I study. Late trams, early bakeries, friends who stay.",
    photos: [
      { src: "", caption: "Evening over the old town", paint: { sky: "dusk", land: "city" } },
      { src: "", caption: "Lake day with friends", paint: { sky: "dawn", land: "lake" } }
    ]
  },
  {
    id: "atacama",
    place: "Atacama",
    title: "The driest, clearest sky",
    date: "2022-11",
    coords: [-23.65, -68.1],
    tags: ["Travel", "Nature"],
    story: "No clouds for a week. The stars cast shadows.",
    photos: [
      { src: "", caption: "Desert night", paint: { sky: "milkyway", land: "desert" } }
    ]
  }
];
