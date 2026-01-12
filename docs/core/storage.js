const KEY="IV3_STATE";

function uid(){ return Math.random().toString(16).slice(2)+Date.now().toString(16); }

export function defaultState(){
  const p0={id:"me", name:"Sébastien", created:Date.now()};
  return {
    app:{ theme:"armor", colorScheme:"dark", voiceEnabled:true },
    profiles:[p0],
    activeProfileId:p0.id,
    data:{
      [p0.id]: profileDefaultData()
    }
  };
}

export function profileDefaultData(){
  return {
    planStartISO:null,
    planChecks:{},
    measurements:{ weightKg:[], waistCm:[], sleepH:[], energy10:[], libido10:[], notes:[] },
    jing:{ wk:null, ejacThisWeek:0, targetPerWeek:3 },
    reminders:{ enabled:false, items:[
      {id:"gm", label:"Golden milk", time:"21:30", days:[0,1,2,3,4,5,6], active:true},
      {id:"walk", label:"Marche", time:"16:30", days:[0,1,2,3,4,5,6], active:true}
    ]}
  };
}

export function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw) return defaultState();
    const obj=JSON.parse(raw);
    // minimal migration safety
    if(!obj.app) obj.app={theme:"armor", colorScheme:"dark", voiceEnabled:true};
    if(!obj.profiles?.length) obj.profiles=[{id:"me", name:"Sébastien", created:Date.now()}];
    if(!obj.activeProfileId) obj.activeProfileId=obj.profiles[0].id;
    if(!obj.data) obj.data={};
    for(const p of obj.profiles){
      obj.data[p.id]=obj.data[p.id]||profileDefaultData();
    }
    return obj;
  }catch{
    return defaultState();
  }
}

export function save(state){
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function addProfile(state, name){
  const p={id:uid(), name:(name||"Profil").trim()||"Profil", created:Date.now()};
  state.profiles.push(p);
  state.data[p.id]=profileDefaultData();
  state.activeProfileId=p.id;
  return p;
}

export function deleteProfile(state, id){
  if(state.profiles.length<=1) return false;
  state.profiles = state.profiles.filter(p=>p.id!==id);
  delete state.data[id];
  if(state.activeProfileId===id) state.activeProfileId=state.profiles[0].id;
  return true;
}

export function activeData(state){
  return state.data[state.activeProfileId];
}
