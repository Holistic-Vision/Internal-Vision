export const BASE = {
  meta:{
    title:"Internal-Vision",
    version:"3.0.0",
    defaultTheme:"armor",
    notes:[
      "Éducatif. Ne remplace pas un avis médical.",
      "Si hypertension/thyroïde/anticoagulants: prudence sur épices et compléments; avis médical si doute.",
      "Fertilité: viser 2–5 jours d’abstinence avant recueil; éviter fièvre/sauna/excès alcool."
    ]
  },
  pillars:[
    {title:"Testostérone (moderne)", items:[
      "Sommeil + régularité",
      "Tour de taille ↓ (insuline/aromatase ↓)",
      "Protéines + lipides (ne pas faire low-fat)",
      "Zinc / Vit D / force",
      "Stress chronique ↓"
    ]},
    {title:"MTC / Ayurveda (lecture traditionnelle)", items:[
      "Soutenir le Yang (si vide-froid) via chaud/tiède",
      "Éviter le froid interne (glacé le soir)",
      "Adapter si signes de chaleur (reflux, irritabilité)"
    ]}
  ],
  goldenMilk:{
    recipe:["Lait végétal 250 ml","Curcuma 1 c.à.c","Gingembre 1/2–1 c.à.c","Poivre 1 pincée","Cannelle (option)","Miel (hors feu) option"],
    method:["Chauffer doux 3–5 min","Tiédir","Ajouter miel si utilisé","Boire 30–90 min avant sommeil"]
  },
  recipes:[
    {id:"r_omelette", title:"Omelette T+", timeMin:12, ingredients:["3–4 œufs","oignon","légumes","huile d’olive/beurre","sel"], steps:["Revenir légumes","Ajouter œufs","Cuire doux"], tags:["T+","simple"]},
    {id:"r_soupe", title:"Soupe du soir", timeMin:20, ingredients:["légumes","bouillon","huile d’olive"], steps:["Cuire","Mixer","Assaisonner"], tags:["sommeil","léger"]},
    {id:"r_zinc", title:"Snack zinc", timeMin:2, ingredients:["graines de courge 20–30g","noix 15–20g"], steps:["Portionner"], tags:["zinc","satiété"]}
  ]
};