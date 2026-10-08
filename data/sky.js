/* ------------------------------------------------------------------
   Star map data. Coordinates are J2000 right ascension / declination
   in degrees; mag is apparent magnitude (smaller = brighter).
   stars: [name, ra, dec, mag]     lines: pairs of star indices
   ------------------------------------------------------------------ */
window.CONSTELLATIONS = [
  {
    id: "ori", name: "Orion", zh: "猎户座", season: "Winter · Dec – Feb",
    tagline: "A hunter in the winter sky, chasing forever across the stars.",
    story: "One of the most recognizable constellations. Red Betelgeuse marks the hunter's shoulder and blue-white Rigel his foot; the three belt stars point to Sirius. Below the belt hangs the Orion Nebula (M42), a stellar nursery 1,300 light-years away.",
    stars: [["Betelgeuse", 88.79, 7.41, 0.5], ["Rigel", 78.63, -8.2, 0.1], ["Bellatrix", 81.28, 6.35, 1.6], ["Saiph", 86.94, -9.67, 2.1], ["Alnitak", 85.19, -1.94, 1.8], ["Alnilam", 84.05, -1.2, 1.7], ["Mintaka", 83.0, -0.3, 2.2], ["Meissa", 83.78, 9.93, 3.4]],
    lines: [[7, 0], [7, 2], [0, 2], [0, 4], [2, 6], [6, 5], [5, 4], [4, 3], [6, 1]]
  },
  {
    id: "uma", name: "Ursa Major", zh: "大熊座", season: "All year (north) · best in spring",
    tagline: "The Great Bear, carrying the Big Dipper on her back.",
    story: "The seven bright stars of the Big Dipper (北斗七星) belong to the Great Bear. Follow the two stars at the end of the bowl, Merak and Dubhe, and they lead you to Polaris. Mizar, in the handle, has a faint companion, Alcor — an old test of good eyesight.",
    stars: [["Dubhe", 165.93, 61.75, 1.8], ["Merak", 165.46, 56.38, 2.4], ["Phecda", 178.46, 53.69, 2.4], ["Megrez", 183.86, 57.03, 3.3], ["Alioth", 193.51, 55.96, 1.8], ["Mizar", 200.98, 54.93, 2.2], ["Alkaid", 206.89, 49.31, 1.9]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]
  },
  {
    id: "umi", name: "Ursa Minor", zh: "小熊座", season: "All year (north)",
    tagline: "The Little Bear, with the North Star at the tip of its tail.",
    story: "Polaris sits less than a degree from the north celestial pole, so the whole sky seems to turn around it. Sailors have steered by it for centuries; its height above the horizon equals your latitude.",
    stars: [["Polaris", 37.95, 89.26, 2.0], ["Yildun", 263.05, 86.59, 4.4], ["ε UMi", 251.49, 82.04, 4.2], ["ζ UMi", 236.01, 77.79, 4.3], ["Kochab", 222.68, 74.16, 2.1], ["Pherkad", 230.18, 71.83, 3.0], ["η UMi", 244.38, 75.76, 5.0]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]
  },
  {
    id: "cas", name: "Cassiopeia", zh: "仙后座", season: "Autumn · Oct – Dec",
    tagline: "A queen on her throne, drawn as a W in the Milky Way.",
    story: "Opposite the Big Dipper across Polaris, the bright W of Cassiopeia is easy to find on any clear northern night. In 1572 Tycho Brahe saw a new star blaze here — a supernova that helped overturn the idea of unchanging heavens.",
    stars: [["Caph", 2.29, 59.15, 2.3], ["Schedar", 10.13, 56.54, 2.2], ["Navi", 14.18, 60.72, 2.2], ["Ruchbah", 21.45, 60.24, 2.7], ["Segin", 28.6, 63.67, 3.4]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
  },
  {
    id: "cyg", name: "Cygnus", zh: "天鹅座", season: "Summer · Jul – Sep",
    tagline: "A swan flying down the river of the Milky Way.",
    story: "Also called the Northern Cross. Its tail star Deneb forms the Summer Triangle with Vega and Altair. In Chinese legend the Milky Way is the river separating the Weaver Girl (Vega) and the Cowherd (Altair); magpies build a bridge for them once a year.",
    stars: [["Deneb", 310.36, 45.28, 1.3], ["Sadr", 305.56, 40.26, 2.2], ["Albireo", 292.68, 27.96, 3.1], ["Gienah", 311.55, 33.97, 2.5], ["δ Cyg", 296.24, 45.13, 2.9], ["ζ Cyg", 318.23, 30.23, 3.2], ["κ Cyg", 289.28, 53.37, 3.8]],
    lines: [[0, 1], [1, 2], [4, 1], [1, 3], [3, 5], [4, 6]]
  },
  {
    id: "lyr", name: "Lyra", zh: "天琴座", season: "Summer · Jun – Aug",
    tagline: "The lyre of Orpheus, holding brilliant Vega.",
    story: "Vega (织女星) is the fifth brightest star in the night sky and was the pole star about 12,000 years ago. Between Sheliak and Sulafat lies the Ring Nebula, the glowing shell of a dying star.",
    stars: [["Vega", 279.23, 38.78, 0.0], ["ε Lyr", 281.08, 39.67, 4.7], ["ζ Lyr", 281.19, 37.61, 4.4], ["Sheliak", 282.52, 33.36, 3.5], ["Sulafat", 284.74, 32.69, 3.3], ["δ Lyr", 283.63, 36.9, 4.3]],
    lines: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2]]
  },
  {
    id: "aql", name: "Aquila", zh: "天鹰座", season: "Summer · Jul – Sep",
    tagline: "The eagle that carried Zeus' thunderbolts.",
    story: "Altair (牛郎星), flanked by two fainter stars, is one of the closest bright stars to us at 17 light-years. It spins so fast — once every nine hours — that it is visibly flattened at the poles.",
    stars: [["Altair", 297.7, 8.87, 0.8], ["Tarazed", 296.56, 10.61, 2.7], ["Alshain", 298.83, 6.41, 3.7], ["ζ Aql", 286.35, 13.86, 3.0], ["δ Aql", 291.37, 3.11, 3.4], ["θ Aql", 302.83, -0.82, 3.2], ["λ Aql", 286.56, -4.88, 3.4]],
    lines: [[3, 1], [1, 0], [0, 2], [2, 5], [0, 4], [4, 6]]
  },
  {
    id: "sco", name: "Scorpius", zh: "天蝎座", season: "Summer · Jun – Aug",
    tagline: "The scorpion that chases Orion across the sky.",
    story: "In myth the scorpion killed Orion, so the two were placed on opposite sides of the sky: one rises as the other sets. Its red heart Antares (心宿二, the Great Fire) is a supergiant hundreds of times wider than the Sun.",
    stars: [["Antares", 247.35, -26.43, 1.0], ["Graffias", 241.36, -19.81, 2.6], ["Dschubba", 240.08, -22.62, 2.3], ["π Sco", 239.71, -26.11, 2.9], ["σ Sco", 245.3, -25.59, 2.9], ["τ Sco", 248.97, -28.22, 2.8], ["ε Sco", 252.54, -34.29, 2.3], ["μ Sco", 252.97, -38.05, 3.0], ["ζ Sco", 253.65, -42.36, 3.6], ["η Sco", 258.04, -43.24, 3.3], ["Sargas", 264.33, -43.0, 1.9], ["ι Sco", 266.9, -40.13, 3.0], ["κ Sco", 265.62, -39.03, 2.4], ["Shaula", 263.4, -37.1, 1.6]],
    lines: [[1, 2], [2, 3], [2, 4], [4, 0], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]]
  },
  {
    id: "sgr", name: "Sagittarius", zh: "人马座", season: "Summer · Jul – Sep",
    tagline: "The archer — or, to most eyes, a teapot steaming with stars.",
    story: "The Milky Way's centre lies just beyond the spout of the Teapot, 26,000 light-years away, around a black hole four million times heavier than the Sun. The 'steam' rising from the spout is the dense star clouds of our galaxy's core.",
    stars: [["Kaus Australis", 276.04, -34.38, 1.8], ["Kaus Media", 275.25, -29.83, 2.7], ["Kaus Borealis", 276.99, -25.42, 2.8], ["Nunki", 283.82, -26.3, 2.1], ["Ascella", 285.65, -29.88, 2.6], ["φ Sgr", 281.41, -26.99, 3.2], ["Alnasl", 271.45, -30.42, 3.0], ["τ Sgr", 286.74, -27.67, 3.3]],
    lines: [[6, 1], [1, 0], [0, 6], [1, 2], [2, 5], [5, 1], [5, 3], [3, 7], [7, 4], [4, 5], [4, 0]]
  },
  {
    id: "leo", name: "Leo", zh: "狮子座", season: "Spring · Mar – May",
    tagline: "A lion crouching in the spring sky.",
    story: "A backwards question mark — the Sickle — forms the lion's mane, with Regulus at its base. Every November the Leonid meteor shower seems to pour out of this region, debris from comet Tempel–Tuttle.",
    stars: [["Regulus", 152.09, 11.97, 1.4], ["η Leo", 151.83, 16.76, 3.5], ["Algieba", 154.99, 19.84, 2.0], ["Adhafera", 154.17, 23.42, 3.4], ["Rasalas", 148.19, 26.01, 3.9], ["ε Leo", 146.46, 23.77, 3.0], ["Zosma", 168.53, 20.52, 2.6], ["Chertan", 168.56, 15.43, 3.3], ["Denebola", 177.26, 14.57, 2.1]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 8], [8, 7], [7, 0], [6, 7]]
  },
  {
    id: "gem", name: "Gemini", zh: "双子座", season: "Winter · Jan – Mar",
    tagline: "The twins Castor and Pollux, side by side forever.",
    story: "Castor and Pollux were brothers so devoted that Zeus placed them together in the sky. Castor is actually six stars bound together. The Geminid meteors of December, among the year's best, radiate from here.",
    stars: [["Castor", 113.65, 31.89, 1.6], ["Pollux", 116.33, 28.03, 1.1], ["Alhena", 99.43, 16.4, 1.9], ["Mebsuta", 100.98, 25.13, 3.0], ["Tejat", 95.74, 22.51, 2.9], ["Wasat", 110.03, 21.98, 3.5], ["Mekbuda", 106.03, 20.57, 3.8], ["τ Gem", 107.78, 30.25, 4.4]],
    lines: [[0, 7], [7, 3], [3, 4], [1, 5], [5, 6], [6, 2], [0, 1], [7, 5]]
  },
  {
    id: "tau", name: "Taurus", zh: "金牛座", season: "Winter · Nov – Feb",
    tagline: "A bull charging, with the Pleiades riding on its shoulder.",
    story: "Aldebaran glows as the bull's red eye amid the V-shaped Hyades cluster. On its shoulder sit the Pleiades (昴星团), the Seven Sisters; near its horn lies the Crab Nebula, remnant of a supernova seen by Chinese astronomers in 1054.",
    stars: [["Aldebaran", 68.98, 16.51, 0.9], ["Elnath", 81.57, 28.61, 1.7], ["ζ Tau", 84.41, 21.14, 3.0], ["θ Tau", 67.17, 15.87, 3.4], ["γ Tau", 64.95, 15.63, 3.6], ["δ Tau", 65.73, 17.54, 3.8], ["ε Tau", 67.15, 19.18, 3.5], ["λ Tau", 60.17, 12.49, 3.4]],
    lines: [[2, 0], [0, 3], [3, 4], [4, 7], [1, 6], [6, 5], [5, 4]]
  },
  {
    id: "and", name: "Andromeda", zh: "仙女座", season: "Autumn · Oct – Dec",
    tagline: "The chained princess, guarding a neighbouring galaxy.",
    story: "Just off the princess's knee lies the Andromeda Galaxy (M31), 2.5 million light-years away — the most distant thing most people can see with the naked eye. In about 4.5 billion years it will merge with our Milky Way.",
    stars: [["Alpheratz", 2.1, 29.09, 2.1], ["δ And", 9.83, 30.86, 3.3], ["Mirach", 17.43, 35.62, 2.1], ["Almach", 30.97, 42.33, 2.1], ["μ And", 14.19, 38.5, 3.9], ["ν And", 12.45, 41.08, 4.5]],
    lines: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]]
  },
  {
    id: "peg", name: "Pegasus", zh: "飞马座", season: "Autumn · Sep – Nov",
    tagline: "The winged horse, its body a great square of autumn.",
    story: "The Great Square of Pegasus is a signpost of autumn nights; one corner, Alpheratz, is borrowed from Andromeda. In 1995, 51 Pegasi b — the first planet found around a Sun-like star — was discovered here.",
    stars: [["Markab", 346.19, 15.21, 2.5], ["Scheat", 345.94, 28.08, 2.4], ["Algenib", 3.31, 15.18, 2.8], ["Alpheratz", 2.1, 29.09, 2.1], ["Enif", 326.05, 9.88, 2.4], ["Homam", 340.37, 10.83, 3.4], ["θ Peg", 332.55, 6.2, 3.5], ["Matar", 340.75, 30.22, 2.9]],
    lines: [[0, 1], [1, 3], [3, 2], [2, 0], [0, 5], [5, 6], [6, 4], [1, 7]]
  },
  {
    id: "cma", name: "Canis Major", zh: "大犬座", season: "Winter · Jan – Mar",
    tagline: "Orion's loyal hound, wearing the brightest star of all.",
    story: "Sirius (天狼星), the Dog Star, is the brightest star in the night sky — only 8.6 light-years away. Ancient Egyptians timed the flooding of the Nile by its first appearance before dawn.",
    stars: [["Sirius", 101.29, -16.72, -1.5], ["Mirzam", 95.67, -17.96, 2.0], ["Adhara", 104.66, -28.97, 1.5], ["Wezen", 107.1, -26.39, 1.8], ["Aludra", 111.02, -29.3, 2.4]],
    lines: [[0, 1], [0, 3], [3, 2], [3, 4]]
  },
  {
    id: "boo", name: "Boötes", zh: "牧夫座", season: "Spring · Apr – Jun",
    tagline: "The herdsman, following the bears around the pole.",
    story: "Follow the arc of the Big Dipper's handle and you 'arc to Arcturus', the brightest star of the northern sky — an old orange giant passing through our neighbourhood at 122 km/s.",
    stars: [["Arcturus", 213.92, 19.18, -0.05], ["Izar", 221.25, 27.07, 2.4], ["Seginus", 218.02, 38.31, 3.0], ["Nekkar", 225.49, 40.39, 3.5], ["δ Boo", 228.88, 33.31, 3.5], ["ρ Boo", 217.96, 30.37, 3.6], ["Muphrid", 208.67, 18.4, 2.7]],
    lines: [[0, 1], [1, 4], [4, 3], [3, 2], [2, 5], [5, 0], [0, 6]]
  },
  {
    id: "cru", name: "Crux", zh: "南十字座", season: "Southern sky · Apr – Jun",
    tagline: "The Southern Cross, a compass for the other half of the world.",
    story: "The smallest of the 88 constellations, but famous on the flags of Australia, New Zealand and Brazil. Its long axis points toward the south celestial pole. From Munich it never rises — a reason to travel south.",
    stars: [["Acrux", 186.65, -63.1, 0.8], ["Mimosa", 191.93, -59.69, 1.3], ["Gacrux", 187.79, -57.11, 1.6], ["δ Cru", 183.79, -58.75, 2.8]],
    lines: [[0, 2], [1, 3]]
  }
];

window.DEEP_SKY = [
  { id: "m42", name: "Orion Nebula", code: "M42", ra: 83.82, dec: -5.39, kind: "Nebula", dist: "1,344 ly", text: "A stellar nursery visible to the naked eye as the fuzzy 'star' in Orion's sword. Thousands of young stars are forming inside it right now." },
  { id: "m31", name: "Andromeda Galaxy", code: "M31", ra: 10.68, dec: 41.27, kind: "Galaxy", dist: "2.5 million ly", text: "Our nearest large galactic neighbour, home to about a trillion stars. Its light left before our species existed." },
  { id: "m45", name: "Pleiades", code: "M45", ra: 56.75, dec: 24.12, kind: "Open cluster", dist: "444 ly", text: "The Seven Sisters (昴). Young, hot blue stars still wrapped in a drifting veil of dust." },
  { id: "m13", name: "Hercules Cluster", code: "M13", ra: 250.42, dec: 36.46, kind: "Globular cluster", dist: "22,200 ly", text: "Several hundred thousand ancient stars packed into a ball. In 1974 the Arecibo message was beamed toward it." },
  { id: "m57", name: "Ring Nebula", code: "M57", ra: 283.4, dec: 33.03, kind: "Planetary nebula", dist: "2,570 ly", text: "The glowing shell of gas thrown off by a dying Sun-like star — a preview of our own Sun's far future." },
  { id: "m1", name: "Crab Nebula", code: "M1", ra: 83.63, dec: 22.01, kind: "Supernova remnant", dist: "6,500 ly", text: "The wreck of a star whose explosion Chinese astronomers recorded in 1054 as a 'guest star' bright enough to see by day." },
  { id: "m8", name: "Lagoon Nebula", code: "M8", ra: 270.9, dec: -24.38, kind: "Nebula", dist: "4,100 ly", text: "A vast cloud of glowing hydrogen in Sagittarius, cut by a dark lane like a lagoon." },
  { id: "m51", name: "Whirlpool Galaxy", code: "M51", ra: 202.47, dec: 47.2, kind: "Galaxy", dist: "23 million ly", text: "A grand spiral galaxy tugged by a smaller companion — the first galaxy in which spiral structure was seen." },
  { id: "omc", name: "Omega Centauri", code: "NGC 5139", ra: 201.7, dec: -47.48, kind: "Globular cluster", dist: "17,000 ly", text: "The largest globular cluster of the Milky Way, perhaps the stripped core of a swallowed dwarf galaxy." }
];
