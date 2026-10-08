/* ------------------------------------------------------------------
   Site-wide settings. Edit these first.
   ------------------------------------------------------------------ */
window.SITE = {
  name: "Chen Jia",
  brand: "Chen Jia",
  tagline: "A Lonely Voyager",
  location: "Munich, Germany",
  role: "PhD Researcher in Medical AI",
  affiliation: "Technical University of Munich · relAI",
  email: "chen.jia@tum.de",

  // Leave a link empty ("") to hide its icon.
  links: {
    scholar: "https://scholar.google.com/",
    linkedin: "https://www.linkedin.com/",
    github: "https://github.com/RoselleCalyx",
    cv: "assets/cv.pdf"
  },

  // Where "Message in a Bottle" letters and farm adoption requests are delivered.
  // Empty  -> the visitor's mail app opens with the letter pre-filled (works with no setup).
  // Better -> create a free form at https://formspree.io and paste its endpoint, e.g.
  //           "https://formspree.io/f/abcdwxyz". Letters then arrive in your inbox silently.
  formEndpoint: "",

  // Optional shared database (free tier is plenty). When set, bottles and adoption
  // requests are stored there and only appear publicly after you approve them, and the
  // farm keeps a shared harvest record for all visitors. Setup steps: README.md.
  supabase: { url: "", anonKey: "" },

  // The star map is rotated to show tonight's sky from here.
  observer: { place: "Munich", lat: 48.14, lon: 11.58 }
};
