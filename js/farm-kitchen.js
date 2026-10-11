/* Fixed recipes share the existing local baskets and finished meal artwork. */
(function () {
  const groups = {
    orchard: ['apple','peach','orange','cherry','kiwi','grape','durian','mango'],
    berries: ['bayberry','strawberry','rosehip'],
    mushrooms: ['morel','chanterelle','porcini','shiitake','matsutake'],
    fish: ['crucian','carp','koi','goldkoi','catfish','blackcarp','snakehead','mandarin','bitterling','minnow','loach','eel'],
    shellfish: ['shrimp','crayfish','crab'], shoots: ['shoot'], lotus: ['lotus']
  };
  const recipes = [
    {id:'fruit-feast',name:'Orchard & berry feast',icon:'🍓',diet:'plants',parts:[['orchard',24],['berries',12]]},
    {id:'bamboo-bowl',name:'Bamboo & lotus bowl',icon:'🥣',diet:'plants',parts:[['shoots',20],['lotus',12],['orchard',12]]},
    {id:'forest-pot',name:'Woodland mushroom pot',icon:'🍲',diet:'plants',parts:[['mushrooms',24],['shoots',16]]},
    {id:'fish-stew',name:'Pond fish stew',note:'Black carp, snakehead or any pond fish, simmered with lotus.',icon:'🐟',diet:'sea',parts:[['fish',24],['lotus',12]]},
    {id:'river-feast',name:'River seafood feast',note:'Mix river shellfish with black carp, snakehead or your other catches.',icon:'🦐',diet:'sea',parts:[['shellfish',24],['fish',16]]},
    {id:'berry-pudding',name:'Berry & lotus pudding',icon:'🍮',diet:'plants',parts:[['berries',24],['orchard',16],['lotus',8]]}
  ];
  const keys = ['farm-basket','wild-woods','wild-pond','farm-meals'];
  // Common harvests count as one portion; scarce catches replace more of them.
  const portions = {morel:4,chanterelle:2,porcini:2,matsutake:8,carp:2,catfish:2,blackcarp:4,snakehead:2,koi:6,goldkoi:24,mandarin:4,loach:2,eel:4,crab:2,lotus:2};
  const value = id => portions[id] || 1;
  const cost = (id, portions) => Math.ceil(portions / value(id));
  const journal = 'farm-cooking-journal';
  function recover(storage = localStorage) {
    const saved = storage.getItem(journal); if (!saved) return;
    const prior = JSON.parse(saved);
    for (const key of keys) prior[key] === null ? storage.removeItem(key) : storage.setItem(key, prior[key]);
    storage.removeItem(journal);
  }
  function read(storage = localStorage) {
    const values = Object.fromEntries(keys.map(key => [key,JSON.parse(storage.getItem(key) || '{}')]));
    return {values,stock:{...values['farm-basket'],...values['wild-woods'].basket,...values['wild-pond'].creel},meals:values['farm-meals']};
  }
  function plan(recipe, stock, choices = {}) {
    const used = {};
    for (const [group, needed] of recipe.parts) {
      let remaining = needed;
      const ids = groups[group], chosen = choices[group];
      const commonFirst = [...ids].sort((a,b) => value(a) - value(b));
      const order = chosen && ids.includes(chosen) ? [chosen, ...commonFirst.filter(id => id !== chosen)] : commonFirst;
      for (const id of order) {
        const available = Math.max(0, Math.floor(Number(stock[id]) || 0) - (used[id] || 0));
        const count = Math.min(cost(id, remaining), available); if (count) used[id] = (used[id] || 0) + count;
        remaining = Math.max(0, remaining - count * value(id)); if (!remaining) break;
      }
      if (remaining) return null;
    }
    return used;
  }
  function cook(id, choices = {}, storage = localStorage) {
    recover(storage);
    const recipe = recipes.find(item => item.id === id); if (!recipe) throw Error('Choose a recipe.');
    const {values,stock} = read(storage), used = plan(recipe, stock, choices);
    if (!used) throw Error('Not enough ingredients for this recipe.');
    const prior = Object.fromEntries(keys.map(key => [key,storage.getItem(key)]));
    for (const [ingredient,count] of Object.entries(used)) {
      const bag = groups.orchard.includes(ingredient) ? values['farm-basket'] : groups.fish.includes(ingredient) || groups.shellfish.includes(ingredient) || ingredient === 'lotus' ? (values['wild-pond'].creel ||= {}) : (values['wild-woods'].basket ||= {});
      bag[ingredient] -= count; if (!bag[ingredient]) delete bag[ingredient];
    }
    values['farm-meals'][id] = (values['farm-meals'][id] || 0) + 1;
    // Roll back an interrupted batch on the next visit, including the meal.
    storage.setItem(journal, JSON.stringify(prior));
    try {
      for (const key of keys) storage.setItem(key, JSON.stringify(values[key]));
      storage.removeItem(journal);
    } catch (_) { recover(storage); throw Error('The meal could not be saved. Your ingredients were kept.'); }
    return {recipe,used};
  }
  const herbivores = ['rabbit','panda','redpanda'], carnivores = ['snowcat','wolf','crocodile','penguin'];
  const accepts = (species,recipe) => herbivores.includes(species) ? recipe.diet === 'plants' : carnivores.includes(species) ? recipe.diet === 'sea' : true;
  const image = id => recipes.some(recipe => recipe.id === id) ? `assets/farm/meals/${id}-v1.webp` : '';
  window.FarmKitchen = {groups,recipes,image,value,cost,read,plan,cook,recover,accepts};
  try { recover(); } catch (_) { /* Cooking reports storage failure without blocking the scene. */ }
})();
