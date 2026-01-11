(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const STORE_KEY = "IV_STATE_V2";

  const defaultState = () => ({
    theme:"dark", route:"dashboard",
    planStartISO:null,
    measurements:{ weightKg:[], waistCm:[], sleepH:[], energy10:[], libido10:[], ejaculations:[] },
    planChecks:{},
    reminders:{
      enabled:false,
      items:[
        {id:"r_gm", label:"Golden milk (soir)", time:"21:30", days:[0,1,2,3,4,5,6], active:true},
        {id:"r_walk", label:"Marche", time:"16:30", days:[0,1,2,3,4,5,6], active:true},
        {id:"r_sleep", label:"Écrans off", time:"22:30", days:[0,1,2,3,4,5,6], active:true}
      ]
    },
    timer:{running:false, mode:"strength", remainingSec:0, phaseIndex:0, phases:[]},
    jing:{ ejacThisWeek:0, targetEjacPerWeek:3, lastResetISO:null }
  });
  });

  function deepMerge(a,b){
    if(typeof a!=="object"||a===null) return b;
    const out = Array.isArray(a) ? [...a] : {...a};
    for(const k of Object.keys(b||{})){
      const bv=b[k], av=out[k];
      if(Array.isArray(bv)) out[k]=bv;
      else if(typeof bv==="object"&&bv!==null) out[k]=deepMerge(av??{}, bv);
      else out[k]=bv;
    }
    return out;
  }
  function load(){ try{ const raw=localStorage.getItem(STORE_KEY); return raw?deepMerge(defaultState(), JSON.parse(raw)):defaultState(); }catch{ return defaultState(); } }
  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  const state = load();
  const data = window.IV_DATA;

  // Install prompt
  let deferredPrompt=null;
  window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault(); deferredPrompt=e; const b=$("#btnInstall"); if(b) b.disabled=false;});

  // Theme
  function applyTheme(){
    applyAccent();
  }

  function applyAccent(){
    const c = state.accent?.color || "#4fd1c5";
    document.documentElement.style.setProperty("--accent", c);
    // Accent2 auto = slightly different, keep stable if user sets
    if(!state.accent?.accent2){
      document.documentElement.style.setProperty("--accent2", "#60a5fa");
    }
  }

  function applyTheme(){
    applyAccent();
    document.documentElement.dataset.theme = (state.theme==="light") ? "light" : "dark";
    const b=$("#btnTheme"); if(b) b.textContent = (state.theme==="light") ? "Clair" : "Sombre";
  }

  // Drawer
  const drawer=$("#drawer"), backdrop=$("#backdrop");
  function openDrawer(){ drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false"); backdrop.hidden=false; }
  function closeDrawer(){ drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true"); backdrop.hidden=true; }

  // Swipe
  let x0=null;
  document.addEventListener("touchstart",(e)=>{ x0 = e.touches?.[0]?.clientX ?? null; }, {passive:true});
  document.addEventListener("touchend",(e)=>{
    if(x0==null) return;
    const x1 = e.changedTouches?.[0]?.clientX ?? x0;
    const dx = x1-x0;
    if(x0<24 && dx>60) openDrawer();
    if(drawer.classList.contains("open") && dx<-60) closeDrawer();
    x0=null;
  }, {passive:true});

  // Routing
  function setRoute(r){ state.route=r; save(); render(); closeDrawer(); }

  // Utils
  const clamp=(n,min,max)=>Math.max(min, Math.min(max,n));
  const nowISO=()=>new Date().toISOString();
  const todayKey=()=>{const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function parseHHMM(s){ const [hh,mm]=(s||"00:00").split(":").map(x=>parseInt(x,10)); return {hh:hh||0, mm:mm||0}; }

  // Pages
  function pageDashboard(){
    const last=(arr)=>arr.length?arr[arr.length-1].v:null;
    const w=last(state.measurements.weightKg);
    const waist=last(state.measurements.waistCm);
    const sleep=last(state.measurements.sleepH);
    const energy=last(state.measurements.energy10);
    const libido=last(state.measurements.libido10);
    const adh=adherence7d();

    return `
      <section class="card">
        <div class="h1">Tableau de bord</div>
        <div class="row" style="margin-top:10px">
          <div class="col">
            <div class="badge"><span class="dot ok"></span>Widget: objectif jour (plan + suivi)</div>
          </div>
          <div class="col">
            <div class="badge"><span class="dot warn"></span>Jing: éjaculations semaine ${state.jing?.ejacThisWeek ?? 0}/${state.jing?.targetEjacPerWeek ?? 3}</div>
          </div>
        </div>
        <p class="p">Objectif: libérer la testostérone (insuline↓, inflammation↓, sommeil↑, zinc/D↑) + densifier sperme.</p>
        <div class="hr"></div>
        <div class="kpis">
          <div class="kpi"><div class="kpiVal">${w ?? "—"} <span class="small">kg</span></div><div class="kpiLab">Poids (dernier)</div></div>
          <div class="kpi"><div class="kpiVal">${waist ?? "—"} <span class="small">cm</span></div><div class="kpiLab">Tour de taille (dernier)</div></div>
          <div class="kpi"><div class="kpiVal">${sleep ?? "—"} <span class="small">h</span></div><div class="kpiLab">Sommeil (dernier)</div></div>
          <div class="kpi"><div class="kpiVal">${energy ?? "—"} <span class="small">/10</span></div><div class="kpiLab">Énergie (dernier)</div></div>
        </div>
        <div class="hr"></div>
        <div class="row">
          <div class="col">
            <div class="badge"><span class="dot ${adh>=70?"ok":adh>=50?"warn":"danger"}"></span>Adhérence 7 jours: ${adh}%</div>
            <div style="height:10px"></div>
            <button class="btn" data-route="tracker">Renseigner aujourd’hui</button>
          </div>
          <div class="col">
            <div class="badge"><span class="dot ${libido!=null&&libido>=6?"ok":"warn"}"></span>Libido: ${libido ?? "—"}/10</div>
            <div style="height:10px"></div>
            <button class="btn secondary" data-route="plan">Ouvrir le plan</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="h2">Courbes (tendance)</div>
        <p class="p">Priorité: tour de taille ↓ + sommeil ↑.</p>
        <div class="hr"></div>
        <canvas id="chartMain" width="980" height="260"></canvas>
        <div class="small note" style="margin-top:10px">
          Si la taille baisse (même sans gros changement de poids), la testostérone libre remonte souvent (aromatase ↓).
        </div>
      </section>

      <section class="card">
        <div class="h2">Golden Milk</div>
        <p class="p">Soir: terrain anti-inflammatoire + soutien du sommeil. Adapter selon tolérance.</p>
        <div class="hr"></div>
        <button class="btn secondary" data-route="library">Voir instructions complètes</button>
      </section>
    `;
  }

  function currentPlanDay(){
    const flat=data.weeks.flatMap(w=>w.days);
    const start = state.planStartISO ? new Date(state.planStartISO) : new Date();
    const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const dn = Date.now();
    const idx = clamp(Math.floor((dn-d0)/(24*3600*1000)),0,27);
    return {flat, idx, day: flat[idx]};
  }

  function mealBlock(dayId, slot, meal){
    const c=state.planChecks[dayId]??{};
    const done=c.mealsDone?.[slot]??false;
    const label = slot==="breakfast"?"Petit-déj":slot==="lunch"?"Déjeuner":"Dîner";
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${label}</div>
            <div class="itemMeta"><b>${meal.name}</b> • ${meal.tags.join(" • ")}<br>${meal.notes}</div>
          </div>
          <button class="btn secondary" data-toggle-meal="${dayId}:${slot}">${done?"Validé":"Valider"}</button>
        </div>
      </div>`;
  }

  function dayCompletion(dayId, day){
    const c=state.planChecks[dayId]??{};
    let total=0, done=0;
    ["breakfast","lunch","dinner"].forEach(k=>{total++; if(c.mealsDone?.[k]) done++;});
    total++; if(c.trainingDone) done++;
    total += (day?.habits?.length||0);
    for(const h of (day?.habits||[])) if(c.habits?.[h.id]) done++;
    return total?Math.round((done/total)*100):0;
  }

  function pagePlan(){
    const {flat, idx, day} = currentPlanDay();
    const week = data.weeks[day.week-1];
    const checks = state.planChecks[day.id] ?? {};
    const habits = (day.habits||[]).map(h=>{
      const v = checks.habits?.[h.id] ?? false;
      return `<div class="item">
        <div class="itemTop">
          <div><div class="itemTitle">${h.label}</div><div class="itemMeta">${h.target?"Cible":""}</div></div>
          <button class="btn secondary" data-toggle-habit="${day.id}:${h.id}">${v?"Validé":"Valider"}</button>
        </div></div>`;
    }).join("");

    const startDate = state.planStartISO ? new Date(state.planStartISO) : new Date();
    const startVal = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,"0")}-${String(startDate.getDate()).padStart(2,"0")}`;

    const allDays = flat.map(d=>{
      const p=dayCompletion(d.id,d);
      return `<div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${d.title} • S${d.week} ${p>=80?"✅":p>=50?"🟡":"⚪"}</div>
            <div class="itemMeta">PDJ: ${d.meals.breakfast.name}<br>Midi: ${d.meals.lunch.name}<br>Soir: ${d.meals.dinner.name}</div>
          </div>
          <button class="btn secondary" data-open-day="${d.id}">Ouvrir</button>
        </div>
        <div class="small">Progression: ${p}%</div>
      </div>`;
    }).join("");

    return `
      <section class="card">
        <div class="h1">Plan 4 semaines</div>
        <p class="p">Démarrage libre. Fixe une date de départ pour synchroniser Jour 1→28.</p>
        <div class="hr"></div>
        <div class="row">
          <div class="col">
            <label>Date de départ</label>
            <div class="row" style="align-items:center">
              <input class="input" id="planStart" type="date" value="${startVal}" />
              <button class="btn secondary" id="btnSetStart">Définir</button>
            </div>
          </div>
          <div class="col">
            <div class="badge"><span class="dot ok"></span>Jour courant: ${day.title} — Semaine ${day.week}</div>
            <div style="height:10px"></div>
            <button class="btn" data-route="tracker">Renseigner suivi du jour</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="h2">${day.title} — ${week.name}</div>
        <p class="p"><b>Focus semaine:</b> ${week.focus.join(" • ")}</p>
        <div class="hr"></div>
        <div class="row">
          <div class="col">
            <div class="h2">Repas</div>
            <div class="list">
              ${mealBlock(day.id,"breakfast",day.meals.breakfast)}
              ${mealBlock(day.id,"lunch",day.meals.lunch)}
              ${mealBlock(day.id,"dinner",day.meals.dinner)}
            </div>
          </div>
          <div class="col">
            <div class="h2">Entraînement</div>
            <div class="item">
              <div class="itemTitle">${day.training.strength?"Force (courte, efficace)":"Récupération / Respiration"}</div>
              <div class="itemMeta">${day.training.plan.join(" — ")}</div>
              <div class="itemActions">
                <button class="btn" data-start-timer="${day.training.strength?"strength":"breath"}">Lancer minuterie</button>
                <button class="btn secondary" data-toggle-training="${day.id}">${(checks.trainingDone??false)?"Validé":"Valider séance"}</button>
              </div>
            </div>

            <div class="hr"></div>
            <div class="h2">Habitudes</div>
            <div class="list">${habits}</div>

            <div class="hr"></div>
            <label>Notes du jour</label>
            <textarea class="input" id="dayNotes" rows="3" placeholder="Faim, stress, sommeil, libido, éjaculation…">${checks.notes??""}</textarea>
            <div style="height:10px"></div>
            <button class="btn secondary" id="btnSaveNotes" data-day="${day.id}">Enregistrer notes</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="h2">Plan complet (28 jours)</div>
        <div class="hr"></div>
        <div class="list">${allDays}</div>
      </section>
    `;
  }

  function pageRecipes(){
    const list=data.recipes.map(r=>`<div class="item"><div class="itemTop">
      <div><div class="itemTitle">${r.title}</div><div class="itemMeta">${r.timeMin} min • ${r.servings} portion(s)</div></div>
      <button class="btn secondary" data-open-recipe="${r.id}">Voir</button>
    </div></div>`).join("");
    return `
      <section class="card"><div class="h1">Recettes</div>
        <p class="p">Base v1. Ajout facile de nouvelles recettes dans data.js.</p>
      </section>
      <section class="card"><div class="h2">Catalogue</div><div class="list">${list}</div></section>
    `;
  }

  function pageTracker(){
    return `
      <section class="card">
        <div class="h1">Carnet de suivi</div>
        <p class="p">Mesure ce qui compte: taille, sommeil, énergie.</p>
        <div class="hr"></div>
        <div class="form">
          <div class="row">
            <div class="col"><label>Poids (kg)</label><input class="input" id="inWeight" type="number" step="0.1" placeholder="ex: 94.2" /></div>
            <div class="col"><label>Tour de taille (cm)</label><input class="input" id="inWaist" type="number" step="0.1" placeholder="ex: 102.0" /></div>
          </div>
          <div class="row">
            <div class="col"><label>Sommeil (h)</label><input class="input" id="inSleep" type="number" step="0.1" placeholder="ex: 6.5" /></div>
            <div class="col"><label>Énergie (0–10)</label><input class="input" id="inEnergy" type="number" step="1" min="0" max="10" placeholder="ex: 6" /></div>
          </div>
          <div class="row">
            <div class="col"><label>Libido (0–10)</label><input class="input" id="inLibido" type="number" step="1" min="0" max="10" placeholder="ex: 7" /></div>
            <div class="col"><label>Éjaculation aujourd’hui ?</label>
              <select class="input" id="inEjac"><option value="">—</option><option value="oui">Oui</option><option value="non">Non</option></select>
            </div>
          </div>
          <div><label>Note</label><textarea class="input" id="inNote" rows="3" placeholder="Stress, digestion, douleur, qualité orgasme…"></textarea></div>
          <button class="btn" id="btnSaveTrack">Enregistrer</button>
          <button class="btn secondary" id="btnExport">Exporter JSON</button>
          <button class="btn danger" id="btnReset">Réinitialiser local</button>
        </div>
      </section>
      <section class="card">
        <div class="h2">Courbes</div>
        <canvas id="chartTracker" width="980" height="260"></canvas>
      </section>
    `;
  }

  function pageTimer(){
    return `
      <section class="card">
        <div class="h1">Minuterie</div>
        <p class="p">Séances courtes: cohérence > intensité.</p>
        <div class="hr"></div>
        <div class="row">
          <div class="col">
            <div class="h2">Modes</div>
            <div class="list">
              ${timerPreset("strength","Force 18 min",[
                {label:"Échauffement",sec:360},{label:"Bloc 1",sec:360},{label:"Pause",sec:60},
                {label:"Bloc 2",sec:360},{label:"Pause",sec:60},{label:"Bloc 3",sec:360},{label:"Retour au calme",sec:120}
              ])}
              ${timerPreset("breath","Respiration 6 min",[{label:"Respiration lente",sec:360}])}
              ${timerPreset("kegel","Périnée 2 min",[{label:"Contraction/relâchement",sec:120}])}
            </div>
          </div>
          <div class="col">
            <div class="h2">Écran timer</div>
            <div class="item">
              <div class="itemTitle" id="timerLabel">—</div>
              <div class="itemMeta" id="timerMeta">Choisis un mode.</div>
              <div class="hr"></div>
              <div style="font-size:44px; font-weight:950; letter-spacing:1px" id="timerClock">00:00</div>
              <div class="small" id="timerPhase">—</div>
              <div class="itemActions">
                <button class="btn" id="btnStart">Démarrer</button>
                <button class="btn secondary" id="btnPause">Pause</button>
                <button class="btn danger" id="btnStop">Stop</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function timerPreset(id,title,phases){
    return `<div class="item"><div class="itemTop">
      <div><div class="itemTitle">${title}</div><div class="itemMeta">${phases.map(p=>`${p.label} (${Math.round(p.sec/60)}m)`).join(" • ")}</div></div>
      <button class="btn secondary" data-preset="${id}">Choisir</button>
    </div></div>`;
  }

  function pageReminders(){
    const items = state.reminders.items.map(r=>`
      <div class="item">
        <div class="itemTop">
          <div><div class="itemTitle">${r.label}</div><div class="itemMeta">Heure: ${r.time} • Actif: ${r.active?"Oui":"Non"}</div></div>
          <button class="btn secondary" data-toggle-rem="${r.id}">${r.active?"Désactiver":"Activer"}</button>
        </div>
        <div class="hr"></div>
        <div class="row">
          <div class="col"><label>Heure (HH:MM)</label><input class="input" value="${r.time}" data-rem-time="${r.id}" /></div>
          <div class="col"><label>Jours (0=dim..6=sam)</label><input class="input" value="${r.days.join(",")}" data-rem-days="${r.id}" /></div>
        </div>
      </div>`).join("");

    return `
      <section class="card">
        <div class="h1">Rappels & notifications</div>
        <p class="p">Niveau PWA: rappel interne + notifications navigateur (si permission).</p>
        <div class="hr"></div>
        <div class="row">
          <div class="col"><button class="btn" id="btnNotif">Demander permission</button></div>
          <div class="col"><button class="btn secondary" id="btnApplyRem">Appliquer</button></div>
        </div>
        <div class="hr"></div>
        <div class="badge"><span class="dot ${state.reminders.enabled?"ok":"warn"}"></span>Rappels actifs: ${state.reminders.enabled?"Oui":"Non"}</div>
        <div style="height:10px"></div>
        <button class="btn secondary" id="btnToggleRem">${state.reminders.enabled?"Couper":"Activer"}</button>
      </section>
      <section class="card"><div class="h2">Rappels configurables</div><div class="list">${items}</div></section>
    `;
  }

  function pageLibrary(){
    const disc = data.meta.disclaimer.map(x=>`<li>${x}</li>`).join("");
    const pillars = data.pillars.map(p=>`<div class="item"><div class="itemTitle">${p.title}</div><ul class="small">${p.points.map(x=>`<li>${x}</li>`).join("")}</ul></div>`).join("");
    const gm = data.goldenMilk;
    return `
      <section class="card">
        <div class="h1">Explications</div>
        <div class="hr"></div>
        <div class="h2">Sécurité</div><ul class="small">${disc}</ul>
      </section>
      <section class="card">
        <div class="h2">Modèle moderne (testostérone)</div>
        <div class="list">${pillars}</div>
      </section>
      <section class="card">
        <div class="h2">${gm.title}</div>
        <div class="row">
          <div class="col"><div class="itemTitle">Recette</div><ul class="small">${gm.recipe.map(x=>`<li>${x}</li>`).join("")}</ul></div>
          <div class="col"><div class="itemTitle">Méthode</div><ol class="small">${gm.method.map(x=>`<li>${x}</li>`).join("")}</ol></div>
        </div>
        <div class="hr"></div>
        <div class="h2">Prudences</div><ul class="small">${gm.cautions.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="hr"></div>
        <div class="h2">MTC</div><ul class="small">${gm.mtc.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="hr"></div>
        <div class="h2">Ayurveda</div><ul class="small">${gm.ayurveda.map(x=>`<li>${x}</li>`).join("")}</ul>
      </section>
      <section class="card">
        <div class="h2">À éviter (annule l’effet)</div>
        <div class="small note">Boissons glacées le soir • sucre • alcool • coucher tardif • porno • éjaculation trop fréquente • ultra-transformés.</div>
      </section>
    `;
  }

  
  function weekKey(d=new Date()){
    // ISO week key: YYYY-WW
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
  }

  function ensureWeekReset(){
    const now = new Date();
    const wk = weekKey(now);
    const lastWk = state.jing?._wk || null;
    if(lastWk !== wk){
      state.jing = state.jing || {};
      state.jing._wk = wk;
      state.jing.ejacThisWeek = 0;
      save();
    }
  }

  function pageJing(){
    ensureWeekReset();
    const ej = state.jing?.ejacThisWeek ?? 0;
    const target = state.jing?.targetEjacPerWeek ?? 3;
    return `
      <section class="card">
        <div class="h1">Jing / Sexe</div>
        <p class="p">Objectif: orgasmes possibles, éjaculations choisies (2–3/sem à ton âge, selon énergie).</p>
        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <div class="badge"><span class="dot ${ej<=target? "ok":"warn"}"></span>Éjaculations semaine: <b>${ej}/${target}</b></div>
            <div style="height:10px"></div>
            <button class="btn" id="btnEjacPlus">+1 éjaculation</button>
            <button class="btn secondary" id="btnEjacMinus">-1</button>
          </div>
          <div class="col">
            <label>Cible / semaine</label>
            <input class="input" id="inEjacTarget" type="number" min="0" max="14" value="${target}" />
            <div style="height:10px"></div>
            <button class="btn secondary" id="btnSaveEjacTarget">Enregistrer</button>
          </div>
        </div>

        <div class="hr"></div>
        <div class="small note">
          Indicateurs pratiques que “ça remonte”: érections matinales, énergie stable, sperme plus dense lors des éjaculations réelles.
        </div>
      </section>
    `;
  }

  function toCSV(rows){
    const esc = (v)=> {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
    };
    const headers = Object.keys(rows[0] || {});
    const lines = [headers.map(esc).join(",")];
    for(const r of rows){
      lines.push(headers.map(h=>esc(r[h])).join(","));
    }
    return lines.join("\n");
  }

  function pageImport(){
    return `
      <section class="card">
        <div class="h1">Import / Export</div>
        <p class="p">Export JSON (complet), Export CSV (mesures). Import JSON (remplace l’état).</p>
        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <button class="btn" id="btnExportJSON">Exporter JSON</button>
            <button class="btn secondary" id="btnExportCSV">Exporter CSV (mesures)</button>
          </div>
          <div class="col">
            <label>Importer JSON</label>
            <input class="input" id="fileImport" type="file" accept=".json,application/json" />
            <div style="height:10px"></div>
            <button class="btn danger" id="btnImportJSON">Importer (remplace)</button>
          </div>
        </div>

        <div class="hr"></div>
        <div class="small note">
          Conseil: fais un export JSON avant toute importation.
        </div>
      </section>
    `;
  }

function pageSettings(){
    return `
      <section class="card">
        <div class="h1">Paramètres</div>
        <div class="hr"></div>
        <div class="row">
          <div class="col">
            <label>Thème</label>
            <select class="input" id="selTheme">
              <option value="dark" ${state.theme==="dark"?"selected":""}>Sombre</option>
              <option value="light" ${state.theme==="light"?"selected":""}>Clair</option>
            </select>
          </div>
          <div class="col">
            <label>Couleur HUD</label>
            <select class="input" id="selAccent">
              <option value="#4fd1c5">Jarvis (cyan)</option>
              <option value="#fb923c">X‑VISION (orange)</option>
              <option value="#34d399">SHIELD (vert)</option>
              <option value="#60a5fa">Bleu</option>
              <option value="#fb7185">Rouge</option>
              <option value="#ffffff">Blanc</option>
            </select>
          </div>
          <div class="col">
            <label>Offline</label>
            <div class="small note">Activer le Service Worker (cache offline).</div>
          </div>
        </div>
        <div class="hr"></div>
        <button class="btn secondary" id="btnSW">Activer offline</button>
      </section>
    `;
  }

  function render(){
    applyTheme();
    $$(".navItem").forEach(b=>b.classList.toggle("active", b.dataset.route===state.route));
    $$(".tab").forEach(b=>b.classList.toggle("active", b.dataset.route===state.route));

    const main=$("#main");
    let html="";
    switch(state.route){
      case "dashboard": html=pageDashboard(); break;
      case "plan": html=pagePlan(); break;
      case "recipes": html=pageRecipes(); break;
      case "tracker": html=pageTracker(); break;
      case "jing": html=pageJing(); break;
      case "import": html=pageImport(); break;
      case "timer": html=pageTimer(); break;
      case "reminders": html=pageReminders(); break;
      case "library": html=pageLibrary(); break;
      case "settings": html=pageSettings(); break;
      default: html=pageDashboard();
    }
    main.innerHTML=html;
    wire();
    drawCharts();
  }

  // Charts
  function drawChart(canvas, series){
    const ctx=canvas.getContext("2d");
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.lineWidth=1; ctx.strokeStyle="rgba(255,255,255,.08)";
    for(let i=1;i<=4;i++){const y=(H*i)/5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();}
    const lines = series.map((s)=>({name:s.name, pts:(s.data||[]).slice(-21)})).filter(s=>s.pts.length>=2);
    if(!lines.length){ ctx.fillStyle="rgba(255,255,255,.55)"; ctx.font="bold 14px system-ui"; ctx.fillText("Pas assez de données (ajoute 2 mesures).", 18, 36); return; }
    lines.forEach((s,idx)=>{
      const vals=s.pts.map(p=>p.v); const min=Math.min(...vals), max=Math.max(...vals);
      const pad=(max-min)===0?1:(max-min)*0.15; const lo=min-pad, hi=max+pad;
      ctx.lineWidth=3;
      ctx.strokeStyle = idx%2===0 ? "rgba(96,165,250,.95)" : "rgba(79,209,197,.95)";
      ctx.beginPath();
      s.pts.forEach((p,i)=>{
        const x=(W-24)*(i/(s.pts.length-1))+12;
        const y=H-((p.v-lo)/(hi-lo))*(H-28)-14;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font="bold 12px system-ui";
      ctx.fillText(s.name, 14, 18+idx*16);
    });
  }

  function drawCharts(){
    const c1=$("#chartMain");
    if(c1) drawChart(c1, [
      {name:"Taille (cm)", data: state.measurements.waistCm},
      {name:"Sommeil (h)", data: state.measurements.sleepH}
    ]);
    const c2=$("#chartTracker");
    if(c2) drawChart(c2, [
      {name:"Poids (kg)", data: state.measurements.weightKg},
      {name:"Taille (cm)", data: state.measurements.waistCm},
      {name:"Énergie (/10)", data: state.measurements.energy10}
    ]);
  }

  // Adhérence 7 jours
  function adherence7d(){
    const {flat, idx} = currentPlanDay();
    const from = Math.max(0, idx-6);
    const slice = flat.slice(from, idx+1);
    if(!slice.length) return 0;
    const avg = slice.reduce((s,d)=>s+dayCompletion(d.id,d),0)/slice.length;
    return Math.round(avg);
  }

  // Modales
  function recipeModal(r){
    const wrap=document.createElement("div");
    wrap.className="backdrop"; wrap.style.zIndex=60;
    wrap.innerHTML = `
      <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0; z-index:61;">
        <div class="row" style="align-items:center; justify-content:space-between;">
          <div><div class="h1">${r.title}</div><p class="p">${r.timeMin} min • ${r.servings} portion(s)</p></div>
          <button class="iconbtn" id="closeModal">✕</button>
        </div>
        <div class="hr"></div>
        <div class="h2">Ingrédients</div><ul class="small">${r.ingredients.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="h2">Étapes</div><ol class="small">${r.steps.map(x=>`<li>${x}</li>`).join("")}</ol>
        <div class="h2">Bénéfices</div><ul class="small">${r.benefits.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="h2">Prudences</div><ul class="small">${r.cautions.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="h2">MTC</div><ul class="small">${r.mtc.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="h2">Ayurveda</div><ul class="small">${r.ayurveda.map(x=>`<li>${x}</li>`).join("")}</ul>
      </div>`;
    document.body.appendChild(wrap);
    $("#closeModal", wrap).onclick=()=>wrap.remove();
    wrap.onclick=(e)=>{ if(e.target===wrap) wrap.remove(); };
  }

  function openDayModal(day){
    const wrap=document.createElement("div");
    wrap.className="backdrop"; wrap.style.zIndex=70;
    const c=state.planChecks[day.id]??{};
    const p=dayCompletion(day.id,day);
    wrap.innerHTML = `
      <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0; z-index:71;">
        <div class="row" style="align-items:center; justify-content:space-between;">
          <div><div class="h1">${day.title} • Semaine ${day.week}</div><p class="p">Progression: ${p}%</p></div>
          <button class="iconbtn" id="closeDay">✕</button>
        </div>
        <div class="hr"></div>
        <div class="h2">Repas</div>
        <div class="list">
          ${mealBlock(day.id,"breakfast",day.meals.breakfast)}
          ${mealBlock(day.id,"lunch",day.meals.lunch)}
          ${mealBlock(day.id,"dinner",day.meals.dinner)}
        </div>
        <div class="hr"></div>
        <div class="h2">Entraînement</div>
        <div class="item">
          <div class="itemTitle">${day.training.strength?"Force":"Respiration"}</div>
          <div class="itemMeta">${day.training.plan.join(" — ")}</div>
          <div class="itemActions">
            <button class="btn" data-start-timer="${day.training.strength?"strength":"breath"}">Lancer minuterie</button>
            <button class="btn secondary" data-toggle-training="${day.id}">${(c.trainingDone??false)?"Validé":"Valider"}</button>
          </div>
        </div>
        <div class="hr"></div>
        <div class="h2">Habitudes</div>
        <div class="list">
          ${(day.habits||[]).map(h=>{
            const v=c.habits?.[h.id]??false;
            return `<div class="item"><div class="itemTop">
              <div><div class="itemTitle">${h.label}</div><div class="itemMeta">${h.target?"Cible":""}</div></div>
              <button class="btn secondary" data-toggle-habit="${day.id}:${h.id}">${v?"Validé":"Valider"}</button>
            </div></div>`;
          }).join("")}
        </div>
        <div class="hr"></div>
        <label>Notes</label><textarea class="input" id="modalNotes" rows="3">${c.notes??""}</textarea>
        <div style="height:10px"></div>
        <button class="btn secondary" id="saveModalNotes">Enregistrer</button>
      </div>`;
    document.body.appendChild(wrap);
    $("#closeDay", wrap).onclick=()=>wrap.remove();
    wrap.onclick=(e)=>{ if(e.target===wrap) wrap.remove(); };

    $$("[data-toggle-meal]", wrap).forEach(b=>b.onclick=()=>{
      const [dayId, slot]=b.dataset.toggleMeal.split(":");
      state.planChecks[dayId]=state.planChecks[dayId]??{};
      const cc=state.planChecks[dayId];
      cc.mealsDone=cc.mealsDone??{};
      cc.mealsDone[slot]=!cc.mealsDone[slot];
      save(); wrap.remove(); render();
    });
    $$("[data-toggle-training]", wrap).forEach(b=>b.onclick=()=>{
      const dayId=b.dataset.toggleTraining;
      state.planChecks[dayId]=state.planChecks[dayId]??{};
      state.planChecks[dayId].trainingDone=!state.planChecks[dayId].trainingDone;
      save(); wrap.remove(); render();
    });
    $$("[data-toggle-habit]", wrap).forEach(b=>b.onclick=()=>{
      const [dayId, hid]=b.dataset.toggleHabit.split(":");
      state.planChecks[dayId]=state.planChecks[dayId]??{};
      const cc=state.planChecks[dayId]; cc.habits=cc.habits??{};
      cc.habits[hid]=!cc.habits[hid];
      save(); wrap.remove(); render();
    });
    $$("[data-start-timer]", wrap).forEach(b=>b.onclick=()=>{
      applyPreset(b.dataset.startTimer); wrap.remove(); setRoute("timer"); setTimeout(()=>$("#btnStart")?.click(),50);
    });
    $("#saveModalNotes", wrap).onclick=()=>{
      state.planChecks[day.id]=state.planChecks[day.id]??{};
      state.planChecks[day.id].notes=$("#modalNotes", wrap).value ?? "";
      save(); toast("Notes enregistrées."); wrap.remove(); render();
    };
  }

  // Timer
  let tick=null;
  const presets={
    strength:[
      {label:"Échauffement",sec:360},{label:"Bloc 1",sec:360},{label:"Pause",sec:60},
      {label:"Bloc 2",sec:360},{label:"Pause",sec:60},{label:"Bloc 3",sec:360},{label:"Retour au calme",sec:120}
    ],
    breath:[{label:"Respiration lente",sec:360}],
    kegel:[{label:"Périnée",sec:120}]
  };
  function applyPreset(id){
    state.timer.mode=id;
    state.timer.phases=presets[id]||presets.strength;
    state.timer.phaseIndex=0;
    state.timer.remainingSec=state.timer.phases[0].sec;
    state.timer.running=false;
    save(); syncTimerUI();
  }
  function secToMMSS(s){ const m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`; }
  function beep(){
    try{ const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(); const g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type="sine"; o.frequency.value=880; g.gain.value=0.04;
      o.start(); setTimeout(()=>{o.stop(); ctx.close();},120);
    }catch{}
  }
  function syncTimerUI(){
    const label=$("#timerLabel"); if(!label) return;
    label.textContent = state.timer.mode==="strength"?"Force 18 min":state.timer.mode==="breath"?"Respiration 6 min":"Périnée 2 min";
    const ph=state.timer.phases[state.timer.phaseIndex]||{label:"—"};
    $("#timerMeta").textContent = "Phases: " + state.timer.phases.map(p=>p.label).join(" • ");
    $("#timerPhase").textContent = "Phase: " + ph.label;
    $("#timerClock").textContent = secToMMSS(state.timer.remainingSec);
  }
  function timerStart(){
    if(!state.timer.phases?.length) applyPreset("strength");
    if(state.timer.running) return;
    state.timer.running=true; save(); syncTimerUI(); beep();
    let last=Date.now();
    tick=setInterval(()=>{
      const now=Date.now(); const dt=Math.floor((now-last)/1000);
      if(dt<=0) return; last=now;
      state.timer.remainingSec -= dt;
      if(state.timer.remainingSec<=0){
        beep();
        state.timer.phaseIndex++;
        if(state.timer.phaseIndex>=state.timer.phases.length){
          timerStop(true); toast("Timer terminé."); return;
        }
        state.timer.remainingSec = state.timer.phases[state.timer.phaseIndex].sec;
      }
      save(); syncTimerUI();
    },250);
  }
  function timerPause(){
    if(!state.timer.running) return;
    state.timer.running=false; save();
    if(tick){clearInterval(tick); tick=null;}
    syncTimerUI(); toast("Pause.");
  }
  function timerStop(finished=false){
    state.timer.running=false;
    if(tick){clearInterval(tick); tick=null;}
    state.timer.phaseIndex=0;
    state.timer.remainingSec = (state.timer.phases?.[0]?.sec)||0;
    save(); syncTimerUI();
    if(!finished) toast("Stop.");
  }

  // Reminders
  let remLoop=null;
  function scheduleReminders(){
    if(remLoop){ clearInterval(remLoop); remLoop=null; }
    if(!state.reminders.enabled) return;
    remLoop=setInterval(checkReminders, 20000);
    checkReminders();
  }
  function checkReminders(){
    if(!state.reminders.enabled) return;
    const now=new Date(); const dow=now.getDay();
    const hh=now.getHours(), mm=now.getMinutes();
    state._lastRemFire = state._lastRemFire || {};
    for(const r of state.reminders.items){
      if(!r.active) continue;
      if(!r.days.includes(dow)) continue;
      const t=parseHHMM(r.time);
      if(hh===t.hh && mm===t.mm){
        const key=`${todayKey()}_${r.id}_${r.time}`;
        if(state._lastRemFire[key]) continue;
        state._lastRemFire[key]=true; save();
        fireReminder(r.label);
      }
    }
  }
  function fireReminder(text){
    toast("Rappel: "+text); beep();
    if("Notification" in window && Notification.permission==="granted"){
      new Notification("Internal-Vision", {body:text});
    }
  }

  // Toast
  function toast(msg){
    const t=document.createElement("div");
    t.textContent=msg;
    Object.assign(t.style,{
      position:"fixed", left:"12px", right:"12px",
      bottom:"calc(82px + env(safe-area-inset-bottom))",
      zIndex:100, padding:"12px 14px", borderRadius:"16px",
      fontWeight:"900", border:"1px solid rgba(255,255,255,.10)",
      background:"rgba(16,24,38,.92)", backdropFilter:"blur(10px)"
    });
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 1600);
  }

  // Wire
  function wire(){
    $$("[data-route]").forEach(b=>b.onclick=()=>setRoute(b.dataset.route));
    $$(".navItem").forEach(b=>b.onclick=()=>setRoute(b.dataset.route));

    // Plan start
    const btnSet=$("#btnSetStart");
    if(btnSet){
      btnSet.onclick=()=>{
        const v=$("#planStart").value;
        if(!v) return;
        state.planStartISO = new Date(v+"T00:00:00").toISOString();
        save(); render();
      };
    }

    // Plan toggles
    $$("[data-toggle-habit]").forEach(b=>b.onclick=()=>{
      const [dayId,hid]=b.dataset.toggleHabit.split(":");
      state.planChecks[dayId]=state.planChecks[dayId]??{};
      const c=state.planChecks[dayId];
      c.habits=c.habits??{};
      c.habits[hid]=!c.habits[hid];
      save(); render();
    });
    $$("[data-toggle-meal]").forEach(b=>b.onclick=()=>{
      const [dayId,slot]=b.dataset.toggleMeal.split(":");
      state.planChecks[dayId]=state.planChecks[dayId]??{};
      const c=state.planChecks[dayId];
      c.mealsDone=c.mealsDone??{};
      c.mealsDone[slot]=!c.mealsDone[slot];
      save(); render();
    });
    $$("[data-toggle-training]").forEach(b=>b.onclick=()=>{
      const dayId=b.dataset.toggleTraining;
      state.planChecks[dayId]=state.planChecks[dayId]??{};
      state.planChecks[dayId].trainingDone=!state.planChecks[dayId].trainingDone;
      save(); render();
    });

    const btnSaveNotes=$("#btnSaveNotes");
    if(btnSaveNotes){
      btnSaveNotes.onclick=()=>{
        const dayId=btnSaveNotes.dataset.day;
        state.planChecks[dayId]=state.planChecks[dayId]??{};
        state.planChecks[dayId].notes = $("#dayNotes").value ?? "";
        save(); toast("Notes enregistrées.");
      };
    }

    $$("[data-open-day]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.openDay;
      const flat=data.weeks.flatMap(w=>w.days);
      const day=flat.find(x=>x.id===id);
      if(day) openDayModal(day);
    });

    // Recipes
    $$("[data-open-recipe]").forEach(b=>b.onclick=()=>{
      const r=data.recipes.find(x=>x.id===b.dataset.openRecipe);
      if(r) recipeModal(r);
    });

    // Tracker save/export/reset
    const btnSave=$("#btnSaveTrack");
    if(btnSave){
      btnSave.onclick=()=>{
        const t=nowISO();
        const w=parseFloat($("#inWeight").value);
        const wa=parseFloat($("#inWaist").value);
        const sl=parseFloat($("#inSleep").value);
        const en=parseInt($("#inEnergy").value,10);
        const li=parseInt($("#inLibido").value,10);
        const ej=$("#inEjac").value;
        const note=($("#inNote").value||"").trim();

        if(!Number.isNaN(w)) state.measurements.weightKg.push({t,v:w});
        if(!Number.isNaN(wa)) state.measurements.waistCm.push({t,v:wa});
        if(!Number.isNaN(sl)) state.measurements.sleepH.push({t,v:sl});
        if(!Number.isNaN(en)) state.measurements.energy10.push({t,v:clamp(en,0,10)});
        if(!Number.isNaN(li)) state.measurements.libido10.push({t,v:clamp(li,0,10)});
        if(ej) state.measurements.ejaculations.push({t,note:`Éjaculation: ${ej}${note?" — "+note:""}`});

        save(); toast("Suivi enregistré."); render();
      };

      $("#btnExport").onclick=()=>{
        const blob=new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url; a.download=`internal-vision-export-${todayKey()}.json`; a.click();
        URL.revokeObjectURL(url);
      };

      $("#btnReset").onclick=()=>{
        if(!confirm("Effacer toutes les données locales ?")) return;
        localStorage.removeItem(STORE_KEY);
        location.reload();
      };
    }

    // Timer
    $$("[data-preset]").forEach(b=>b.onclick=()=>{ applyPreset(b.dataset.preset); toast("Preset chargé."); });
    $$("[data-start-timer]").forEach(b=>b.onclick=()=>{ applyPreset(b.dataset.startTimer); setRoute("timer"); setTimeout(()=>$("#btnStart")?.click(),50); });
    if($("#btnStart")){
      $("#btnStart").onclick=timerStart;
      $("#btnPause").onclick=timerPause;
      $("#btnStop").onclick=()=>timerStop(false);
      syncTimerUI();
    }

    // Reminders
    if($("#btnToggleRem")){
      $("#btnToggleRem").onclick=()=>{
        state.reminders.enabled=!state.reminders.enabled;
        save();
        if(state.reminders.enabled) scheduleReminders();
        toast(state.reminders.enabled?"Rappels activés.":"Rappels coupés.");
        render();
      };
      $("#btnNotif").onclick=async()=>{
        if(!("Notification" in window)) return alert("Notifications non supportées ici.");
        const p=await Notification.requestPermission();
        toast("Permission: "+p);
      };
      $("#btnApplyRem").onclick=()=>{
        $$("[data-rem-time]").forEach(inp=>{
          const id=inp.dataset.remTime;
          const r=state.reminders.items.find(x=>x.id===id);
          if(r) r.time=(inp.value||"21:00").slice(0,5);
        });
        $$("[data-rem-days]").forEach(inp=>{
          const id=inp.dataset.remDays;
          const r=state.reminders.items.find(x=>x.id===id);
          if(r){
            const arr=(inp.value||"").split(",").map(x=>parseInt(x.trim(),10)).filter(x=>!Number.isNaN(x)&&x>=0&&x<=6);
            r.days = arr.length?arr:[0,1,2,3,4,5,6];
          }
        });
        save(); scheduleReminders(); toast("Rappels mis à jour.");
      };
      $$("[data-toggle-rem]").forEach(b=>b.onclick=()=>{
        const r=state.reminders.items.find(x=>x.id===b.dataset.toggleRem);
        if(!r) return;
        r.active=!r.active;
        save(); scheduleReminders(); render();
      });
    }

    // Jing page
    if($("#btnEjacPlus")){
      $("#btnEjacPlus").onclick=()=>{ state.jing = state.jing || {}; state.jing.ejacThisWeek = (state.jing.ejacThisWeek||0)+1; save(); render(); };
      $("#btnEjacMinus").onclick=()=>{ state.jing = state.jing || {}; state.jing.ejacThisWeek = Math.max(0,(state.jing.ejacThisWeek||0)-1); save(); render(); };
      $("#btnSaveEjacTarget").onclick=()=>{ state.jing = state.jing || {}; state.jing.targetEjacPerWeek = Math.max(0, parseInt($("#inEjacTarget").value,10)||0); save(); toast("Cible enregistrée."); render(); };
    }

    // Import / Export
    if($("#btnExportJSON")){
      $("#btnExportJSON").onclick=()=>{
        const blob=new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url; a.download=`internal-vision-v2-export-${todayKey()}.json`; a.click();
        URL.revokeObjectURL(url);
      };
      $("#btnExportCSV").onclick=()=>{
        const rows=[];
        const pushSeries=(name, arr)=>{ (arr||[]).forEach(p=>rows.push({t:p.t, metric:name, value:p.v})); };
        pushSeries("weightKg", state.measurements.weightKg);
        pushSeries("waistCm", state.measurements.waistCm);
        pushSeries("sleepH", state.measurements.sleepH);
        pushSeries("energy10", state.measurements.energy10);
        pushSeries("libido10", state.measurements.libido10);
        if(rows.length===0) return alert("Pas de mesures.");
        const csv = toCSV(rows);
        const blob=new Blob([csv], {type:"text/csv"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url; a.download=`internal-vision-measures-${todayKey()}.csv`; a.click();
        URL.revokeObjectURL(url);
      };
      $("#btnImportJSON").onclick=async()=>{
        const f = $("#fileImport").files?.[0];
        if(!f) return alert("Choisis un fichier .json");
        if(!confirm("Importer va remplacer l’état actuel. Continuer ?")) return;
        const txt = await f.text();
        try{
          const obj = JSON.parse(txt);
          localStorage.setItem(STORE_KEY, JSON.stringify(obj));
          location.reload();
        }catch(e){
          alert("JSON invalide: "+e.message);
        }
      };
    }

    // Settings
    if($("#selTheme")){
      $("#selTheme").onchange=()=>{ state.theme=$("#selTheme").value; save(); render(); };
      const selA = $("#selAccent");
      if(selA){
        selA.value = state.accent?.color || "#4fd1c5";
        selA.onchange = ()=>{ state.accent = state.accent || {}; state.accent.color = selA.value; save(); render(); };
      }
      $("#btnSW").onclick=async()=>{
        try{
          if("serviceWorker" in navigator){
            await navigator.serviceWorker.register("sw.js");
            toast("Offline activé.");
          }else alert("Service Worker non supporté.");
        }catch(e){ alert("Erreur SW: "+e.message); }
      };
    }

    // Install
    const btnInstall=$("#btnInstall");
    if(btnInstall){
      btnInstall.onclick=async()=>{
        if(!deferredPrompt) return toast("Installer: non disponible.");
        deferredPrompt.prompt();
        const res=await deferredPrompt.userChoice;
        toast("Installation: "+res.outcome);
        deferredPrompt=null;
      };
    }
  }

  // Header buttons
  $("#btnMenu").onclick=openDrawer;
  $("#btnClose").onclick=closeDrawer;
  $("#backdrop").onclick=closeDrawer;
  $("#btnTheme").onclick=()=>{ state.theme=(state.theme==="dark")?"light":"dark"; save(); render(); };

  // Init timer preset
  if(!state.timer.phases?.length) applyPreset("strength");

  // Run reminders if enabled
  if(state.reminders.enabled) scheduleReminders();

  applyTheme();
  render();
})();