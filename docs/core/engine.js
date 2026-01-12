export function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
export function nowISO(){ return new Date().toISOString(); }
export function todayKey(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function weekKey(d=new Date()){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

export function ensureJingWeek(data){
  const wk = weekKey(new Date());
  if(data.jing.wk !== wk){
    data.jing.wk = wk;
    data.jing.ejacThisWeek = 0;
  }
}

export function flatPlan(){
  // 28 days generated deterministically
  const weeks=[
    {w:1,name:"Reset",focus:["Zéro sucre ajouté","Dîner léger chaud","Marche quotidienne","Éjaculations choisies 2–3/sem max"]},
    {w:2,name:"Densité",focus:["Protéines + lipides","Œufs fréquents","Féculents ciblés midi si besoin"]},
    {w:3,name:"Performance",focus:["Mini force 2–4x/sem","Sommeil + routine","Golden milk stable"]},
    {w:4,name:"Stabilisation",focus:["Varier sans casser règles","Suivi précis","Plan de maintien"]},
  ];
  const meals={
    breakfast:[
      {id:"b1",name:"Omelette 3–4 œufs + légumes",tags:["T+","Insuline↓"],notes:"Chicorée ok."},
      {id:"b2",name:"Œufs + avocat + tomate cuite",tags:["T+","Satiété"],notes:"Éviter sucré."},
      {id:"b3",name:"Protéines + noix (option)",tags:["Option"],notes:"Selon tolérance."},
    ],
    lunch:[
      {id:"l1",name:"Bœuf/poulet + légumes + huile d’olive",tags:["Zinc","Protéines"],notes:"Féculent optionnel midi."},
      {id:"l2",name:"Steak + poêlée de légumes",tags:["T+","Simple"],notes:"Ail/oignon ok."},
      {id:"l3",name:"Salade tiède + œufs",tags:["Inflammation↓"],notes:"Plutôt tiède."},
    ],
    dinner:[
      {id:"d1",name:"Soupe maison + œufs",tags:["Sommeil","Léger"],notes:"Chaud/tiède."},
      {id:"d2",name:"Légumes rôtis + œufs/fromage",tags:["Chaud"],notes:"Éviter féculents le soir."},
      {id:"d3",name:"Bouillon + poêlée rapide",tags:["MTC"],notes:"Utile si froid interne."},
    ]
  };
  const habits=[
    {id:"walk",label:"Marche 25–45 min",target:true},
    {id:"sleep",label:"Écrans off 45 min",target:true},
    {id:"nosugar",label:"Zéro sucre ajouté",target:true},
    {id:"gm",label:"Golden milk (si toléré)",target:true},
    {id:"kegel",label:"Périnée 2 min",target:true},
  ];

  const days=[];
  for(let i=0;i<28;i++){
    const week=weeks[Math.floor(i/7)];
    const b=meals.breakfast[i%meals.breakfast.length];
    const l=meals.lunch[i%meals.lunch.length];
    const d=meals.dinner[i%meals.dinner.length];
    const strength = (week.w>=3) ? (i%2===0) : false;
    days.push({
      id:`w${week.w}d${(i%7)+1}`,
      title:`Jour ${i+1}`,
      week:week.w,
      weekName:week.name,
      weekFocus:week.focus,
      meals:{breakfast:b,lunch:l,dinner:d},
      training:{strength, plan: strength?["Échauffement 6 min","Force 12–18 min","Retour au calme 2 min"]:["Respiration 5 min (option)"]},
      habits
    });
  }
  return {weeks, days};
}

export function dayCompletion(data, day){
  const c=data.planChecks[day.id]||{};
  let total=0, done=0;
  ["breakfast","lunch","dinner"].forEach(k=>{total++; if(c.mealsDone?.[k]) done++;});
  total++; if(c.trainingDone) done++;
  total += (day.habits?.length||0);
  for(const h of (day.habits||[])) if(c.habits?.[h.id]) done++;
  return total?Math.round((done/total)*100):0;
}
