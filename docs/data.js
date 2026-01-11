window.IV_DATA = {
  meta: {
    title: "Internal-Vision",
    version: "2.0.0",
    disclaimer: [
      "Information éducative. Ne remplace pas un avis médical.",
      "Si HTA, trouble thyroïde, traitement anticoagulant, pathologie hépatique/vésicule, antécédent de calculs, ou douleur pelvienne/prostatique: avis médical avant usage intensif de gingembre/curcuma/poivre, ou supplémentation.",
      "Si objectif fertilité court-terme, une abstinence de 2–5 jours avant recueil est souvent optimale."
    ]
  },

  pillars: [
    { id:"p1", title:"Insuline basse (ventre ↓, T ↑)", points:[
      "Petit-déj protéiné / gras, pas sucré.",
      "Féculents concentrés seulement si besoin (activité) et plutôt à midi.",
      "Éviter grignotage tardif."
    ]},
    { id:"p2", title:"Inflammation basse (prostate/foie/hormones)", points:[
      "Cuisson douce, aliments simples.",
      "Limiter ultra-transformés, huiles industrielles.",
      "Golden milk le soir (si toléré)."
    ]},
    { id:"p3", title:"Cholestérol suffisant (stéroïdes)", points:[
      "Œufs, beurre (si toléré), huile d’olive, coco.",
      "Protéines animales ou équivalents de qualité.",
      "Ne pas faire low-fat."
    ]},
    { id:"p4", title:"Zinc + Vit D + Sommeil", points:[
      "Zinc alimentaire (œufs, bœuf, graines de courge).",
      "Vitamine D (soleil ou complément), surtout l’hiver.",
      "Sommeil: viser une fenêtre stable + qualité."
    ]}
  ],

  goldenMilk: {
    title: "Golden Milk (soir)",
    recipe: [
      "Lait végétal (coco/amande) 250 ml",
      "Curcuma 1 c.à.c",
      "Gingembre (frais râpé 1 c.à.c ou poudre 1/2 c.à.c)",
      "Poivre noir 1 pincée (augmente biodisponibilité)",
      "Option: cannelle 1/2 c.à.c",
      "Miel 1 c.à.c (hors feu, tiède) — optionnel"
    ],
    method: [
      "Chauffer à feu doux (sans bouillir fort).",
      "Remuer 3–5 min.",
      "Couper le feu, laisser tiédir 1–2 min.",
      "Ajouter le miel si utilisé.",
      "Boire chaud, 30–90 min avant sommeil."
    ],
    cautions: [
      "Curcuma/gingembre peuvent irriter l’estomac chez certains: commencer demi-dose.",
      "Poivre + reflux: réduire/retirer.",
      "Anticoagulants/antiagrégants: prudence (avis médical)."
    ],
    mtc: [
      "MTC: réchauffe le foyer inférieur, mobilise stagnations, soutient le Yang du Rein (si vide-froid).",
      "Si signes de chaleur (bouffées, irritabilité, reflux, langue rouge): diminuer gingembre/poivre, privilégier version plus douce."
    ],
    ayurveda: [
      "Ayurveda: boisson réchauffante utile si Kapha/Vata dominants.",
      "Si Pitta élevé (acidité, irritabilité, chaleur): réduire épices piquantes, préférer curcuma doux + lait + ghee (si toléré)."
    ]
  },

  weeks: [
    { week:1, name:"Reset (insuline & inflammation)", focus:["Zéro sucre ajouté","Dîner léger chaud","Marche quotidienne","2–3 éjaculations/semaine max"], days:[] },
    { week:2, name:"Densité (protéines + graisses utiles)", focus:["Protéines à chaque repas","Œufs quasi quotidiens","Féculents ciblés (si besoin) le midi"], days:[] },
    { week:3, name:"Performance (force + sommeil)", focus:["2–4 mini séances force/semaine","Sommeil + routine d’endormissement","Golden milk stable"], days:[] },
    { week:4, name:"Stabilisation (autonomie & variété)", focus:["Varier recettes sans casser les règles","Suivi précis (poids/tour de taille/énergie)","Plan de maintien"], days:[] }
  ],

  mealTemplates: {
    breakfast: [
      { id:"b1", name:"Omelette 3–4 œufs + légumes", tags:["T+","Insuline↓"], notes:"Ajouter beurre/huile d’olive. Chicorée ok." },
      { id:"b2", name:"Œufs au plat + avocat + tomate cuite", tags:["T+","Satiété"], notes:"Éviter pain/jus." },
      { id:"b3", name:"Fromage blanc (si toléré) + noix + cannelle", tags:["Option"], notes:"Objectif strict: portion modérée." }
    ],
    lunch: [
      { id:"l1", name:"Bœuf (ou poulet) + légumes + huile d’olive", tags:["Zinc","Protéines"], notes:"Féculent optionnel si activité." },
      { id:"l2", name:"Steak haché + poêlée de légumes", tags:["T+","Simple"], notes:"Ajouter ail/oignon." },
      { id:"l3", name:"Salade tiède (légumes cuits) + œufs", tags:["Inflammation↓"], notes:"Préférer tiède le soir." }
    ],
    dinner: [
      { id:"d1", name:"Soupe maison + œufs", tags:["Sommeil","Léger"], notes:"Ex: courgette/poireau." },
      { id:"d2", name:"Légumes rôtis + fromage/œufs", tags:["Chaud"], notes:"Éviter féculents le soir." },
      { id:"d3", name:"Bouillon + poêlée rapide", tags:["MTC"], notes:"Utile si froid interne." }
    ]
  },

  recipes: [
    {
      id:"r_omelette_pro", title:"Omelette T+ (anti-inflammation)", timeMin:12, servings:1,
      ingredients:["3–4 œufs","1 oignon (ou échalote)","1 poignée épinards (ou courgette)","Beurre ou huile d’olive","Curcuma + poivre (option)","Sel"],
      steps:["Faire revenir oignon + légumes 4–5 min.","Battre les œufs, ajouter sel et curcuma (option).","Cuire à feu moyen doux."],
      benefits:["Protéines + lipides: support hormonal","Oignon/ail: soutien métabolique","Curcuma: terrain anti-inflammatoire (si toléré)"],
      cautions:["Si reflux: éviter poivre/épices le matin."],
      mtc:["Tiède/chaud: utile si froid au foyer inférieur."],
      ayurveda:["Bon pour Kapha/Vata. Si Pitta: réduire épices."]
    },
    {
      id:"r_soupe_soir", title:"Soupe du soir (sommeil & reins)", timeMin:20, servings:2,
      ingredients:["Courgettes ou poireaux","1 petite pomme de terre (option)","Bouillon / eau","Huile d’olive","Sel"],
      steps:["Cuire 15–18 min, mixer.","Ajouter huile d’olive à la fin.","Servir chaud, dîner léger."],
      benefits:["Dîner léger: sommeil plus profond","Chaud: confort digestif"],
      cautions:["Éviter gros bol + dessert sucré."],
      mtc:["Chaud le soir = soutien du Rein/Yang (si vide-froid)."],
      ayurveda:["Le soir: chaud, simple, grounding."]
    },
    {
      id:"r_graines_courge", title:"Snack zinc (graines de courge + noix)", timeMin:2, servings:1,
      ingredients:["Graines de courge 20–30 g","Noix 15–20 g","Cannelle (option)"],
      steps:["Mélanger. Collation si faim réelle (pas automatisme)."],
      benefits:["Zinc + bons lipides","Satiété: soutien testostérone"],
      cautions:["Calorique: respecter portion."],
      mtc:["Graines = soutien essence (lecture traditionnelle)."],
      ayurveda:["Éviter excès si digestion lente."]
    }
  ]
};

(function buildDays(){
  const {weeks, mealTemplates} = window.IV_DATA;
  const mkDay = (week, dayIndex) => {
    const dayNum = (week-1)*7 + (dayIndex+1);
    const b = mealTemplates.breakfast[dayNum % mealTemplates.breakfast.length];
    const l = mealTemplates.lunch[dayNum % mealTemplates.lunch.length];
    const d = mealTemplates.dinner[dayNum % mealTemplates.dinner.length];

    const habits = [
      { id:"h_walk", label:"Marche 25–45 min", target:true },
      { id:"h_sleep", label:"Routine sommeil (écrans off 45 min)", target:true },
      { id:"h_no_sugar", label:"Zéro sucre ajouté", target:true },
      { id:"h_gm", label:"Golden milk (soir, si toléré)", target:true },
      { id:"h_kegel", label:"Périnée 2 min (contrôle éjac)", target:true }
    ];

    const strength = (week >= 3) ? (dayIndex % 2 === 0) : false;

    return {
      id:`w${week}d${dayIndex+1}`,
      title:`Jour ${dayNum}`,
      week,
      meals: { breakfast:b, lunch:l, dinner:d },
      training: {
        strength,
        plan: strength
          ? ["6 min échauffement (mobilité + respiration)","12–18 min force (voir minuterie)","2 min retour au calme"]
          : ["Respiration lente 5 min (option)"]
      },
      sex: { guideline:"Éjaculation 2–3x/semaine max (choisie). Orgasme sans éjac possible." },
      habits
    };
  };
  weeks.forEach((w)=>{ w.days = Array.from({length:7}, (_,i)=> mkDay(w.week, i)); });
})();


// V2: recettes supplémentaires (placeholders propres) — tu peux étendre ici.
window.IV_DATA.recipes.push(
  {
    id:"r_boeuf_ail",
    title:"Bœuf à l’ail (zinc) + légumes",
    timeMin:15, servings:1,
    ingredients:["Bœuf 150–250 g","Ail 1–2 gousses","Oignon","Légumes (brocoli/courgette)","Huile d’olive","Sel"],
    steps:["Saisir bœuf 2–3 min.","Ajouter ail/oignon + légumes 6–8 min.","Servir, huile d’olive à la fin."],
    benefits:["Zinc + protéines","Ail/oignon: soutien métabolique","Repas simple: insuline stable"],
    cautions:["Si reflux: éviter repas trop épicé le soir."],
    mtc:["Chaud + ‘tonifiant’ (lecture traditionnelle)"],
    ayurveda:["Bon pour Kapha; si Pitta: limiter ail si brûlures."]
  },
  {
    id:"r_yaourt_tiede",
    title:"Bol tiède (option) : fromage blanc + noix + cannelle",
    timeMin:4, servings:1,
    ingredients:["Fromage blanc (si toléré)","Noix","Cannelle","Option: miel très léger"],
    steps:["Mélanger. Si sensible au froid: laisser revenir à température + cannelle."],
    benefits:["Protéines + lipides","Satiété"],
    cautions:["Si digestion lente/intolérance lactose: éviter."],
    mtc:["Produits laitiers = parfois ‘humidité’ chez certains: adapter."],
    ayurveda:["Si Kapha élevé: portion petite, cannelle utile."]
  }
);
