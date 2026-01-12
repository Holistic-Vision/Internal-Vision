import { THEMES, applyTheme } from "./themes/themes.js";
import { BASE } from "./data/base.js";
import { load, save, addProfile, deleteProfile, activeData } from "./core/storage.js";
import { clamp, nowISO, todayKey, ensureJingWeek, flatPlan, dayCompletion } from "./core/engine.js";
import { speak } from "./core/voice.js";
import { download, toCSV } from "./core/export.js";

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

let state = load();
let data = activeData(state);
const plan = flatPlan();

function setActiveProfile(id){
  state.activeProfileId=id;
  data = activeData(state);
  save(state);
  render();
}

function themeLabel(id){ return (THEMES.find(t=>t.id===id)?.label)||id.toUpperCase(); }

function cycleTheme(){
  const i=THEMES.findIndex(t=>t.id===state.app.theme);
  const next=THEMES[(i+1)%THEMES.length].id;
  state.app.theme=next; save(state);
  applyTheme(next);
  $("#btnThemeCycle").textContent=themeLabel(next);
  toast("Thème: "+themeLabel(next));
  render();
}

function applyAppPrefs(){
  applyTheme(state.app.theme || BASE.meta.defaultTheme);
  document.documentElement.dataset.colorScheme = state.app.colorScheme==="light" ? "light" : "dark";
  $("#btnThemeCycle").textContent = themeLabel(state.app.theme);
  $("#btnVoice").textContent = state.app.voiceEnabled ? "Voix ON" : "Voix OFF";
}

function openDrawer(){ $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden","false"); $("#backdrop").hidden=false; }
function closeDrawer(){ $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden","true"); $("#backdrop").hidden=true; }

let x0=null;
document.addEventListener("touchstart",(e)=>{ x0 = e.touches?.[0]?.clientX ?? null; }, {passive:true});
document.addEventListener("touchend",(e)=>{
  if(x0==null) return;
  const x1 = e.changedTouches?.[0]?.clientX ?? x0;
  const dx = x1-x0;
  if(x0<24 && dx>60) openDrawer();
  if($("#drawer").classList.contains("open") && dx<-60) closeDrawer();
  x0=null;
}, {passive:true});

function setRoute(r){ state.route=r; save(state); render(); closeDrawer(); }

function last(arr){ return arr?.length?arr[arr.length-1].v:null; }

function adherence7d(){
  const {flat, idx} = currentPlanDay();
  const from = Math.max(0, idx-6);
  const slice = flat.slice(from, idx+1);
  if(!slice.length) return 0;
  const avg = slice.reduce((s,d)=>s+dayCompletion(data,d),0)/slice.length;
  return Math.round(avg);
}

function currentPlanDay(){
  const flat=plan.days;
  const start = data.planStartISO ? new Date(data.planStartISO) : new Date();
  const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const idx = clamp(Math.floor((Date.now()-d0)/(24*3600*1000)),0,27);
  return {flat, idx, day: flat[idx]};
}

function pageDashboard(){
  ensureJingWeek(data);
  const adh=adherence7d();
  const ej=data.jing.ejacThisWeek, target=data.jing.targetPerWeek;
  return `
    <section class="card">
      <div class="h1">Tableau de bord</div>
      <p class="p">V3 • Multi-profils • Multi-thèmes • Voix • Rapport PDF • HUD.</p>
      <div class="hr"></div>
      <div class="row">
        <div class="col"><div class="badge"><span class="dot ${adh>=70?"ok":adh>=50?"warn":"danger"}"></span>Adhérence 7 jours: ${adh}%</div></div>
        <div class="col"><div class="badge"><span class="dot ${ej<=target?"ok":"warn"}"></span>Jing (semaine): ${ej}/${target}</div></div>
      </div>
      <div class="hr"></div>
      <div class="kpis">
        <div class="kpi"><div class="kpiVal">${last(data.measurements.weightKg) ?? "—"} <span class="small">kg</span></div><div class="kpiLab">Poids (dernier)</div></div>
        <div class="kpi"><div class="kpiVal">${last(data.measurements.waistCm) ?? "—"} <span class="small">cm</span></div><div class="kpiLab">Tour de taille (dernier)</div></div>
        <div class="kpi"><div class="kpiVal">${last(data.measurements.sleepH) ?? "—"} <span class="small">h</span></div><div class="kpiLab">Sommeil (dernier)</div></div>
        <div class="kpi"><div class="kpiVal">${last(data.measurements.energy10) ?? "—"} <span class="small">/10</span></div><div class="kpiLab">Énergie (dernier)</div></div>
      </div>
      <div class="hr"></div>
      <canvas id="chartMain" width="980" height="260"></canvas>
      <div class="hr"></div>
      <div class="row">
        <button class="btn" data-route="tracker">Renseigner aujourd’hui</button>
        <button class="btn secondary" data-route="report">Rapport PDF</button>
      </div>
    </section>
  `;
}

function pagePlan(){
  const {flat, day}=currentPlanDay();
  const startDate = data.planStartISO ? new Date(data.planStartISO) : new Date();
  const startVal = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,"0")}-${String(startDate.getDate()).padStart(2,"0")}`;
  const c=data.planChecks[day.id]||{};
  const habits=(day.habits||[]).map(h=>{
    const v=c.habits?.[h.id]??false;
    return `<div class="item"><div class="itemTop">
      <div><div class="itemTitle">${h.label}</div><div class="itemMeta">${h.target?"Cible":""}</div></div>
      <button class="btn secondary" data-toggle-habit="${day.id}:${h.id}">${v?"Validé":"Valider"}</button>
    </div></div>`;
  }).join("");

  const mealBlock=(slot, meal)=>{
    const done=c.mealsDone?.[slot]??false;
    const label=slot==="breakfast"?"Petit-déj":slot==="lunch"?"Déjeuner":"Dîner";
    return `<div class="item"><div class="itemTop">
      <div><div class="itemTitle">${label}</div><div class="itemMeta"><b>${meal.name}</b> • ${meal.tags.join(" • ")}<br>${meal.notes}</div></div>
      <button class="btn secondary" data-toggle-meal="${day.id}:${slot}">${done?"Validé":"Valider"}</button>
    </div></div>`;
  };

  const allDays=flat.map(d=>{
    const p=dayCompletion(data,d);
    return `<div class="item"><div class="itemTop">
      <div><div class="itemTitle">${d.title} • S${d.week} ${p>=80?"✅":p>=50?"🟡":"⚪"}</div>
      <div class="itemMeta">${d.weekName} — ${d.weekFocus.join(" • ")}</div></div>
      <button class="btn secondary" data-open-day="${d.id}">Ouvrir</button>
    </div><div class="small">Progression: ${p}%</div></div>`;
  }).join("");

  return `
    <section class="card">
      <div class="h1">Plan 4 semaines</div>
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
          <button class="btn" data-route="timer">Lancer timer</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="h2">${day.title} — ${day.weekName}</div>
      <p class="p"><b>Focus semaine:</b> ${day.weekFocus.join(" • ")}</p>
      <div class="hr"></div>
      <div class="row">
        <div class="col"><div class="h2">Repas</div><div class="list">
          ${mealBlock("breakfast",day.meals.breakfast)}
          ${mealBlock("lunch",day.meals.lunch)}
          ${mealBlock("dinner",day.meals.dinner)}
        </div></div>
        <div class="col">
          <div class="h2">Entraînement</div>
          <div class="item">
            <div class="itemTitle">${day.training.strength?"Force (courte)":"Respiration / récupération"}</div>
            <div class="itemMeta">${day.training.plan.join(" — ")}</div>
            <div class="itemActions">
              <button class="btn" data-route="timer">Minuterie</button>
              <button class="btn secondary" data-toggle-training="${day.id}">${(c.trainingDone??false)?"Validé":"Valider"}</button>
            </div>
          </div>
          <div class="hr"></div>
          <div class="h2">Habitudes</div>
          <div class="list">${habits}</div>
          <div class="hr"></div>
          <label>Notes du jour</label>
          <textarea class="input" id="dayNotes" rows="3">${c.notes??""}</textarea>
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
  const list=BASE.recipes.map(r=>`<div class="item"><div class="itemTop">
    <div><div class="itemTitle">${r.title}</div><div class="itemMeta">${r.timeMin} min • ${r.tags.join(" • ")}</div></div>
    <button class="btn secondary" data-open-recipe="${r.id}">Voir</button>
  </div></div>`).join("");
  return `<section class="card"><div class="h1">Recettes</div><p class="p">Base V3 (extensible).</p></section>
          <section class="card"><div class="h2">Catalogue</div><div class="list">${list}</div></section>`;
}

function pageTracker(){
  return `
    <section class="card">
      <div class="h1">Carnet de suivi</div>
      <p class="p">Mesures utiles: taille, sommeil, énergie.</p>
      <div class="hr"></div>
      <div class="form">
        <div class="row">
          <div class="col"><label>Poids (kg)</label><input class="input" id="inWeight" type="number" step="0.1" /></div>
          <div class="col"><label>Tour de taille (cm)</label><input class="input" id="inWaist" type="number" step="0.1" /></div>
        </div>
        <div class="row">
          <div class="col"><label>Sommeil (h)</label><input class="input" id="inSleep" type="number" step="0.1" /></div>
          <div class="col"><label>Énergie (0–10)</label><input class="input" id="inEnergy" type="number" step="1" min="0" max="10" /></div>
        </div>
        <div class="row">
          <div class="col"><label>Libido (0–10)</label><input class="input" id="inLibido" type="number" step="1" min="0" max="10" /></div>
          <div class="col"><label>Note</label><input class="input" id="inNote" type="text" placeholder="Stress, digestion, douleur…" /></div>
        </div>
        <button class="btn" id="btnSaveTrack">Enregistrer</button>
      </div>
    </section>
    <section class="card"><div class="h2">Courbes</div><canvas id="chartTracker" width="980" height="260"></canvas></section>
  `;
}

function pageJing(){
  ensureJingWeek(data);
  const ej=data.jing.ejacThisWeek, target=data.jing.targetPerWeek;
  return `
    <section class="card">
      <div class="h1">Jing / Sexe</div>
      <p class="p">Objectif: orgasmes possibles, éjaculations choisies (cible / semaine).</p>
      <div class="hr"></div>
      <div class="row">
        <div class="col">
          <div class="badge"><span class="dot ${ej<=target?"ok":"warn"}"></span>Éjaculations semaine: <b>${ej}/${target}</b></div>
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
      <button class="btn secondary" id="btnSpeakJing">Annonce vocale</button>
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
          <div class="list">
            ${presetCard("strength","Force 18 min",["Échauffement 6m","Bloc 1 6m","Pause 1m","Bloc 2 6m","Pause 1m","Bloc 3 6m","Retour 2m"])}
            ${presetCard("breath","Respiration 6 min",["Respiration lente 6m"])}
            ${presetCard("kegel","Périnée 2 min",["Contraction/relâchement 2m"])}
          </div>
        </div>
        <div class="col">
          <div class="item">
            <div class="itemTitle" id="timerLabel">—</div>
            <div class="itemMeta" id="timerMeta">Choisis un mode.</div>
            <div class="hr"></div>
            <div style="font-size:44px;font-weight:950" id="timerClock">00:00</div>
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
function presetCard(id,title,lines){
  return `<div class="item"><div class="itemTop">
    <div><div class="itemTitle">${title}</div><div class="itemMeta">${lines.join(" • ")}</div></div>
    <button class="btn secondary" data-preset="${id}">Choisir</button>
  </div></div>`;
}

function pageReminders(){
  const items=(data.reminders.items||[]).map(r=>`
    <div class="item">
      <div class="itemTop">
        <div><div class="itemTitle">${r.label}</div><div class="itemMeta">Heure: ${r.time} • Actif: ${r.active?"Oui":"Non"}</div></div>
        <button class="btn secondary" data-toggle-rem="${r.id}">${r.active?"Désactiver":"Activer"}</button>
      </div>
      <div class="hr"></div>
      <div class="row">
        <div class="col"><label>Heure</label><input class="input" value="${r.time}" data-rem-time="${r.id}" /></div>
        <div class="col"><label>Jours (0..6)</label><input class="input" value="${r.days.join(",")}" data-rem-days="${r.id}" /></div>
      </div>
    </div>`).join("");

  return `
    <section class="card">
      <div class="h1">Rappels</div>
      <p class="p">Notifications navigateur (si permission) + rappel interne.</p>
      <div class="hr"></div>
      <div class="row">
        <div class="col"><button class="btn" id="btnNotif">Permission</button></div>
        <div class="col"><button class="btn secondary" id="btnApplyRem">Appliquer</button></div>
      </div>
      <div class="hr"></div>
      <div class="badge"><span class="dot ${data.reminders.enabled?"ok":"warn"}"></span>Rappels actifs: ${data.reminders.enabled?"Oui":"Non"}</div>
      <div style="height:10px"></div>
      <button class="btn secondary" id="btnToggleRem">${data.reminders.enabled?"Couper":"Activer"}</button>
    </section>
    <section class="card"><div class="h2">Rappels configurables</div><div class="list">${items}</div></section>
  `;
}

function pageReport(){
  return `
    <section class="card">
      <div class="h1">Rapport (PDF)</div>
      <p class="p">Ouvre la page Rapport, puis “Imprimer → Enregistrer en PDF”.</p>
      <div class="hr"></div>
      <a class="btn" href="./report.html" target="_blank" rel="noopener">Ouvrir Rapport</a>
    </section>
  `;
}

function pageImport(){
  return `
    <section class="card">
      <div class="h1">Import / Export</div>
      <div class="hr"></div>
      <div class="row">
        <div class="col">
          <button class="btn" id="btnExportJSON">Exporter JSON (profil)</button>
          <button class="btn secondary" id="btnExportCSV">Exporter CSV (mesures)</button>
        </div>
        <div class="col">
          <label>Importer JSON (profil)</label>
          <input class="input" id="fileImport" type="file" accept=".json,application/json" />
          <div style="height:10px"></div>
          <button class="btn danger" id="btnImportJSON">Importer (remplace profil)</button>
        </div>
      </div>
    </section>
  `;
}

function pageLibrary(){
  return `
    <section class="card">
      <div class="h1">Explications</div>
      <div class="hr"></div>
      <div class="h2">Sécurité</div>
      <ul class="small">${BASE.meta.notes.map(x=>`<li>${x}</li>`).join("")}</ul>
      <div class="hr"></div>
      <div class="h2">Golden Milk</div>
      <div class="row">
        <div class="col"><div class="itemTitle">Recette</div><ul class="small">${BASE.goldenMilk.recipe.map(x=>`<li>${x}</li>`).join("")}</ul></div>
        <div class="col"><div class="itemTitle">Méthode</div><ol class="small">${BASE.goldenMilk.method.map(x=>`<li>${x}</li>`).join("")}</ol></div>
      </div>
    </section>
  `;
}

function pageTasker(){
  const url = location.origin + location.pathname.replace(/index\.html$/,"") + "hud.html";
  return `
    <section class="card">
      <div class="h1">Tasker / HUD</div>
      <p class="p">HUD dédié + liens de lancement. Sur Android: ouvre en WebView/Chrome, puis “Ajouter à l’écran d’accueil”.</p>
      <div class="hr"></div>
      <div class="item">
        <div class="itemTitle">HUD</div>
        <div class="itemMeta">Lien HUD (thème actif) :</div>
        <div class="small">${url}?theme=${encodeURIComponent(state.app.theme)}</div>
        <div class="itemActions">
          <a class="btn" href="./hud.html?theme=${encodeURIComponent(state.app.theme)}" target="_blank" rel="noopener">Ouvrir HUD</a>
        </div>
      </div>
      <div class="hr"></div>
      <div class="item">
        <div class="itemTitle">Déclenchement Tasker (simple)</div>
        <div class="itemMeta">
          Tasker peut ouvrir une URL précise via “Browse URL”. Exemples:
          <ul class="small">
            <li>Ouvrir Dashboard: <code>.../index.html#dashboard</code></li>
            <li>Ouvrir Jing: <code>.../index.html#jing</code></li>
            <li>Ouvrir Timer: <code>.../index.html#timer</code></li>
          </ul>
        </div>
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
            ${THEMES.map(t=>`<option value="${t.id}" ${t.id===state.app.theme?"selected":""}>${t.label}</option>`).join("")}
          </select>
        </div>
        <div class="col">
          <label>Clair / sombre</label>
          <select class="input" id="selScheme">
            <option value="dark" ${state.app.colorScheme!=="light"?"selected":""}>Sombre</option>
            <option value="light" ${state.app.colorScheme==="light"?"selected":""}>Clair</option>
          </select>
        </div>
      </div>
      <div class="hr"></div>
      <button class="btn secondary" id="btnSW">Activer offline</button>
      <div class="small note" style="margin-top:10px">Offline = cache local (Service Worker).</div>
    </section>
  `;
}

/* Modals */
function modalProfiles(){
  const wrap=document.createElement("div");
  wrap.className="backdrop"; wrap.style.zIndex=80;
  wrap.innerHTML=`
    <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0;">
      <div class="row" style="align-items:center; justify-content:space-between;">
        <div><div class="h1">Profils</div><p class="p">Ajouter/supprimer. Données séparées.</p></div>
        <button class="iconbtn" id="closeP">✕</button>
      </div>
      <div class="hr"></div>
      <div class="row">
        <div class="col">
          <label>Nouveau profil</label>
          <input class="input" id="newName" placeholder="ex: Alexandra, Esteban..." />
          <div style="height:10px"></div>
          <button class="btn" id="addP">Ajouter</button>
        </div>
        <div class="col">
          <div class="h2">Existants</div>
          <div class="list" id="plist"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("#closeP",wrap).onclick=()=>wrap.remove();
  wrap.onclick=(e)=>{ if(e.target===wrap) wrap.remove(); };

  function renderList(){
    const el=$("#plist",wrap);
    el.innerHTML = state.profiles.map(p=>`
      <div class="item">
        <div class="itemTop">
          <div><div class="itemTitle">${p.name}</div><div class="itemMeta">${p.id===state.activeProfileId?"Actif":""}</div></div>
          <div class="itemActions">
            <button class="btn secondary" data-sel="${p.id}">Activer</button>
            <button class="btn danger" data-del="${p.id}" ${state.profiles.length<=1?"disabled":""}>Supprimer</button>
          </div>
        </div>
      </div>`).join("");
    $$("[data-sel]",wrap).forEach(b=>b.onclick=()=>{ setActiveProfile(b.dataset.sel); renderList(); });
    $$("[data-del]",wrap).forEach(b=>b.onclick=()=>{
      const id=b.dataset.del;
      if(!confirm("Supprimer ce profil ?")) return;
      if(deleteProfile(state,id)){ save(state); data=activeData(state); render(); renderList(); }
    });
  }
  renderList();

  $("#addP",wrap).onclick=()=>{
    const name=$("#newName",wrap).value||"Profil";
    addProfile(state,name);
    save(state);
    data=activeData(state);
    render();
    renderList();
    $("#newName",wrap).value="";
  };
}

function modalRecipe(r){
  const wrap=document.createElement("div");
  wrap.className="backdrop"; wrap.style.zIndex=70;
  wrap.innerHTML=`
    <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0;">
      <div class="row" style="align-items:center; justify-content:space-between;">
        <div><div class="h1">${r.title}</div><p class="p">${r.timeMin} min • ${r.tags.join(" • ")}</p></div>
        <button class="iconbtn" id="closeR">✕</button>
      </div>
      <div class="hr"></div>
      <div class="h2">Ingrédients</div><ul class="small">${r.ingredients.map(x=>`<li>${x}</li>`).join("")}</ul>
      <div class="h2">Étapes</div><ol class="small">${r.steps.map(x=>`<li>${x}</li>`).join("")}</ol>
    </div>`;
  document.body.appendChild(wrap);
  $("#closeR",wrap).onclick=()=>wrap.remove();
  wrap.onclick=(e)=>{ if(e.target===wrap) wrap.remove(); };
}

function modalDay(day){
  const wrap=document.createElement("div");
  wrap.className="backdrop"; wrap.style.zIndex=70;
  const c=data.planChecks[day.id]||{};
  const p=dayCompletion(data,day);
  const meal=(slot, m)=>{
    const done=c.mealsDone?.[slot]??false;
    const label=slot==="breakfast"?"Petit-déj":slot==="lunch"?"Déjeuner":"Dîner";
    return `<div class="item"><div class="itemTop">
      <div><div class="itemTitle">${label}</div><div class="itemMeta"><b>${m.name}</b></div></div>
      <button class="btn secondary" data-toggle-meal="${day.id}:${slot}">${done?"Validé":"Valider"}</button>
    </div></div>`;
  };
  wrap.innerHTML=`
    <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0;">
      <div class="row" style="align-items:center; justify-content:space-between;">
        <div><div class="h1">${day.title} • S${day.week}</div><p class="p">Progression: ${p}%</p></div>
        <button class="iconbtn" id="closeD">✕</button>
      </div>
      <div class="hr"></div>
      <div class="h2">Repas</div>
      <div class="list">
        ${meal("breakfast",day.meals.breakfast)}
        ${meal("lunch",day.meals.lunch)}
        ${meal("dinner",day.meals.dinner)}
      </div>
      <div class="hr"></div>
      <div class="h2">Habitudes</div>
      <div class="list">
        ${(day.habits||[]).map(h=>{
          const v=c.habits?.[h.id]??false;
          return `<div class="item"><div class="itemTop">
            <div><div class="itemTitle">${h.label}</div></div>
            <button class="btn secondary" data-toggle-habit="${day.id}:${h.id}">${v?"Validé":"Valider"}</button>
          </div></div>`;
        }).join("")}
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $("#closeD",wrap).onclick=()=>wrap.remove();
  wrap.onclick=(e)=>{ if(e.target===wrap) wrap.remove(); };
  $$("[data-toggle-meal]",wrap).forEach(b=>b.onclick=()=>{
    const [dayId,slot]=b.dataset.toggleMeal.split(":");
    data.planChecks[dayId]=data.planChecks[dayId]||{};
    const cc=data.planChecks[dayId];
    cc.mealsDone=cc.mealsDone||{};
    cc.mealsDone[slot]=!cc.mealsDone[slot];
    save(state); render(); wrap.remove();
  });
  $$("[data-toggle-habit]",wrap).forEach(b=>b.onclick=()=>{
    const [dayId,hid]=b.dataset.toggleHabit.split(":");
    data.planChecks[dayId]=data.planChecks[dayId]||{};
    const cc=data.planChecks[dayId];
    cc.habits=cc.habits||{};
    cc.habits[hid]=!cc.habits[hid];
    save(state); render(); wrap.remove();
  });
}

/* Charts */
function drawChart(canvas, series){
  const ctx=canvas.getContext("2d");
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.lineWidth=1; ctx.strokeStyle="rgba(255,255,255,.08)";
  for(let i=1;i<=4;i++){const y=(H*i)/5; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();}
  const lines=series.map(s=>({name:s.name, pts:(s.data||[]).slice(-21)})).filter(s=>s.pts.length>=2);
  if(!lines.length){ ctx.fillStyle="rgba(255,255,255,.55)"; ctx.font="bold 14px system-ui"; ctx.fillText("Pas assez de données.", 18, 36); return; }
  lines.forEach((s,idx)=>{
    const vals=s.pts.map(p=>p.v); const min=Math.min(...vals), max=Math.max(...vals);
    const pad=(max-min)===0?1:(max-min)*0.15; const lo=min-pad, hi=max+pad;
    ctx.lineWidth=3;
    ctx.strokeStyle = idx%2===0 ? "rgba(96,165,250,.95)" : "rgba(251,146,60,.95)";
    ctx.beginPath();
    s.pts.forEach((p,i)=>{
      const x=(W-24)*(i/(s.pts.length-1))+12;
      const y=H-((p.v-lo)/(hi-lo))*(H-28)-14;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    ctx.fillStyle=ctx.strokeStyle;
    ctx.font="bold 12px system-ui";
    ctx.fillText(s.name, 14, 18+idx*16);
  });
}

/* Timer */
let tick=null;
const presets={
  strength:[{label:"Échauffement",sec:360},{label:"Bloc 1",sec:360},{label:"Pause",sec:60},{label:"Bloc 2",sec:360},{label:"Pause",sec:60},{label:"Bloc 3",sec:360},{label:"Retour",sec:120}],
  breath:[{label:"Respiration",sec:360}],
  kegel:[{label:"Périnée",sec:120}],
};
if(!state.timer) state.timer={mode:"strength",phases:presets.strength,phaseIndex:0,remainingSec:presets.strength[0].sec,running:false};

function applyPreset(id){
  state.timer.mode=id;
  state.timer.phases=presets[id]||presets.strength;
  state.timer.phaseIndex=0;
  state.timer.remainingSec=state.timer.phases[0].sec;
  state.timer.running=false;
  save(state);
  syncTimerUI();
}
function secToMMSS(s){ const m=Math.floor(s/60), r=s%60; return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`; }
function beep(){
  try{ const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(), g=ctx.createGain();
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
  if(state.timer.running) return;
  state.timer.running=true; save(state); syncTimerUI(); beep();
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
    save(state); syncTimerUI();
  },250);
}
function timerPause(){
  if(!state.timer.running) return;
  state.timer.running=false; save(state);
  if(tick){clearInterval(tick); tick=null;}
  syncTimerUI(); toast("Pause.");
}
function timerStop(finished=false){
  state.timer.running=false;
  if(tick){clearInterval(tick); tick=null;}
  state.timer.phaseIndex=0;
  state.timer.remainingSec=(state.timer.phases?.[0]?.sec)||0;
  save(state); syncTimerUI();
  if(!finished) toast("Stop.");
}

/* Reminders */
let remLoop=null;
function parseHHMM(s){ const [hh,mm]=(s||"00:00").split(":").map(x=>parseInt(x,10)); return {hh:hh||0, mm:mm||0}; }
function scheduleReminders(){
  if(remLoop){ clearInterval(remLoop); remLoop=null; }
  if(!data.reminders.enabled) return;
  remLoop=setInterval(checkReminders, 20000);
  checkReminders();
}
function checkReminders(){
  if(!data.reminders.enabled) return;
  const now=new Date(); const dow=now.getDay();
  const hh=now.getHours(), mm=now.getMinutes();
  state._lastRemFire = state._lastRemFire || {};
  for(const r of data.reminders.items){
    if(!r.active) continue;
    if(!r.days.includes(dow)) continue;
    const t=parseHHMM(r.time);
    if(hh===t.hh && mm===t.mm){
      const key=`${todayKey()}_${state.activeProfileId}_${r.id}_${r.time}`;
      if(state._lastRemFire[key]) continue;
      state._lastRemFire[key]=true; save(state);
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

/* Toast */
function toast(msg){
  const t=document.createElement("div");
  t.textContent=msg;
  Object.assign(t.style,{
    position:"fixed", left:"12px", right:"12px",
    bottom:"calc(82px + env(safe-area-inset-bottom))",
    zIndex:100, padding:"12px 14px", borderRadius:"16px",
    fontWeight:"950", border:"1px solid rgba(255,255,255,.10)",
    background:"rgba(16,24,38,.92)", backdropFilter:"blur(10px)"
  });
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1600);
}

/* Render */
function render(){
  applyAppPrefs();

  // profile selector
  const sel=$("#selProfile");
  if(sel){
    sel.innerHTML = state.profiles.map(p=>`<option value="${p.id}" ${p.id===state.activeProfileId?"selected":""}>${p.name}</option>`).join("");
    sel.onchange=()=>setActiveProfile(sel.value);
  }

  // route from hash if present
  const hash=(location.hash||"").replace("#","");
  if(hash && hash!==state.route){ state.route=hash; save(state); }

  $$(".navItem").forEach(b=>b.classList.toggle("active", b.dataset.route===state.route));
  $$(".tab").forEach(b=>b.classList.toggle("active", b.dataset.route===state.route));
  $("#brandSub").textContent = `V3 • ${themeLabel(state.app.theme)} • ${state.profiles.find(p=>p.id===state.activeProfileId)?.name||"Profil"}`;

  const main=$("#main");
  let html="";
  switch(state.route){
    case "plan": html=pagePlan(); break;
    case "recipes": html=pageRecipes(); break;
    case "tracker": html=pageTracker(); break;
    case "jing": html=pageJing(); break;
    case "timer": html=pageTimer(); break;
    case "reminders": html=pageReminders(); break;
    case "report": html=pageReport(); break;
    case "import": html=pageImport(); break;
    case "library": html=pageLibrary(); break;
    case "tasker": html=pageTasker(); break;
    case "settings": html=pageSettings(); break;
    default: state.route="dashboard"; html=pageDashboard();
  }
  main.innerHTML=html;

  // wire
  $$("[data-route]").forEach(b=>b.onclick=()=>{ location.hash=b.dataset.route; setRoute(b.dataset.route); });
  $$(".navItem").forEach(b=>b.onclick=()=>{ location.hash=b.dataset.route; setRoute(b.dataset.route); });

  // plan start / notes / toggles
  const btnSet=$("#btnSetStart");
  if(btnSet){
    btnSet.onclick=()=>{
      const v=$("#planStart").value;
      if(!v) return;
      data.planStartISO = new Date(v+"T00:00:00").toISOString();
      save(state); render();
    };
  }
  $$("[data-toggle-habit]").forEach(b=>b.onclick=()=>{
    const [dayId,hid]=b.dataset.toggleHabit.split(":");
    data.planChecks[dayId]=data.planChecks[dayId]||{};
    const c=data.planChecks[dayId]; c.habits=c.habits||{};
    c.habits[hid]=!c.habits[hid];
    save(state); render();
  });
  $$("[data-toggle-meal]").forEach(b=>b.onclick=()=>{
    const [dayId,slot]=b.dataset.toggleMeal.split(":");
    data.planChecks[dayId]=data.planChecks[dayId]||{};
    const c=data.planChecks[dayId]; c.mealsDone=c.mealsDone||{};
    c.mealsDone[slot]=!c.mealsDone[slot];
    save(state); render();
  });
  $$("[data-toggle-training]").forEach(b=>b.onclick=()=>{
    const dayId=b.dataset.toggleTraining;
    data.planChecks[dayId]=data.planChecks[dayId]||{};
    data.planChecks[dayId].trainingDone=!data.planChecks[dayId].trainingDone;
    save(state); render();
  });
  const btnSaveNotes=$("#btnSaveNotes");
  if(btnSaveNotes){
    btnSaveNotes.onclick=()=>{
      const dayId=btnSaveNotes.dataset.day;
      data.planChecks[dayId]=data.planChecks[dayId]||{};
      data.planChecks[dayId].notes=$("#dayNotes").value||"";
      save(state); toast("Notes enregistrées.");
    };
  }
  $$("[data-open-day]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.openDay;
    const day=plan.days.find(x=>x.id===id);
    if(day) modalDay(day);
  });

  // recipes modal
  $$("[data-open-recipe]").forEach(b=>b.onclick=()=>{
    const r=BASE.recipes.find(x=>x.id===b.dataset.openRecipe);
    if(r) modalRecipe(r);
  });

  // tracker save
  const btnSave=$("#btnSaveTrack");
  if(btnSave){
    btnSave.onclick=()=>{
      const t=nowISO();
      const w=parseFloat($("#inWeight").value);
      const wa=parseFloat($("#inWaist").value);
      const sl=parseFloat($("#inSleep").value);
      const en=parseInt($("#inEnergy").value,10);
      const li=parseInt($("#inLibido").value,10);
      const note=($("#inNote").value||"").trim();

      if(!Number.isNaN(w)) data.measurements.weightKg.push({t,v:w});
      if(!Number.isNaN(wa)) data.measurements.waistCm.push({t,v:wa});
      if(!Number.isNaN(sl)) data.measurements.sleepH.push({t,v:sl});
      if(!Number.isNaN(en)) data.measurements.energy10.push({t,v:clamp(en,0,10)});
      if(!Number.isNaN(li)) data.measurements.libido10.push({t,v:clamp(li,0,10)});
      if(note) data.measurements.notes.push({t,v:note});

      save(state); toast("Suivi enregistré."); render();
    };
  }

  // jing
  if($("#btnEjacPlus")){
    $("#btnEjacPlus").onclick=()=>{ ensureJingWeek(data); data.jing.ejacThisWeek++; save(state); render(); };
    $("#btnEjacMinus").onclick=()=>{ ensureJingWeek(data); data.jing.ejacThisWeek=Math.max(0,data.jing.ejacThisWeek-1); save(state); render(); };
    $("#btnSaveEjacTarget").onclick=()=>{ data.jing.targetPerWeek=Math.max(0, parseInt($("#inEjacTarget").value,10)||0); save(state); toast("Cible enregistrée."); render(); };
    $("#btnSpeakJing").onclick=()=>{
      ensureJingWeek(data);
      const txt = `Mode ${themeLabel(state.app.theme)}. Jing semaine: ${data.jing.ejacThisWeek} sur ${data.jing.targetPerWeek}.`;
      speak(txt, state.app.voiceEnabled);
    };
  }

  // timer
  $$("[data-preset]").forEach(b=>b.onclick=()=>{ applyPreset(b.dataset.preset); toast("Preset chargé."); });
  if($("#btnStart")){
    $("#btnStart").onclick=timerStart;
    $("#btnPause").onclick=timerPause;
    $("#btnStop").onclick=()=>timerStop(false);
    syncTimerUI();
  }

  // reminders
  if($("#btnToggleRem")){
    $("#btnToggleRem").onclick=()=>{
      data.reminders.enabled=!data.reminders.enabled;
      save(state);
      if(data.reminders.enabled) scheduleReminders();
      toast(data.reminders.enabled?"Rappels activés.":"Rappels coupés.");
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
        const r=data.reminders.items.find(x=>x.id===id);
        if(r) r.time=(inp.value||"21:00").slice(0,5);
      });
      $$("[data-rem-days]").forEach(inp=>{
        const id=inp.dataset.remDays;
        const r=data.reminders.items.find(x=>x.id===id);
        if(r){
          const arr=(inp.value||"").split(",").map(x=>parseInt(x.trim(),10)).filter(x=>!Number.isNaN(x)&&x>=0&&x<=6);
          r.days = arr.length?arr:[0,1,2,3,4,5,6];
        }
      });
      save(state); scheduleReminders(); toast("Rappels mis à jour.");
    };
    $$("[data-toggle-rem]").forEach(b=>b.onclick=()=>{
      const r=data.reminders.items.find(x=>x.id===b.dataset.toggleRem);
      if(!r) return;
      r.active=!r.active;
      save(state); scheduleReminders(); render();
    });
  }

  // import/export
  if($("#btnExportJSON")){
    $("#btnExportJSON").onclick=()=>{
      const blob = JSON.stringify(data,null,2);
      download(`internal-vision-${state.activeProfileId}-${todayKey()}.json`, blob, "application/json");
    };
    $("#btnExportCSV").onclick=()=>{
      const rows=[];
      const push=(metric, arr)=> (arr||[]).forEach(p=>rows.push({t:p.t, metric, value:p.v}));
      push("weightKg", data.measurements.weightKg);
      push("waistCm", data.measurements.waistCm);
      push("sleepH", data.measurements.sleepH);
      push("energy10", data.measurements.energy10);
      push("libido10", data.measurements.libido10);
      if(!rows.length) return alert("Pas de mesures.");
      download(`internal-vision-measures-${state.activeProfileId}-${todayKey()}.csv`, toCSV(rows), "text/csv");
    };
    $("#btnImportJSON").onclick=async()=>{
      const f=$("#fileImport").files?.[0];
      if(!f) return alert("Choisis un .json");
      if(!confirm("Importer remplace les données du profil actif. Continuer ?")) return;
      try{
        const obj=JSON.parse(await f.text());
        state.data[state.activeProfileId]=obj;
        save(state);
        data=activeData(state);
        toast("Import OK.");
        render();
      }catch(e){ alert("JSON invalide: "+e.message); }
    };
  }

  // settings
  if($("#selTheme")){
    $("#selTheme").onchange=()=>{ state.app.theme=$("#selTheme").value; save(state); render(); };
    $("#selScheme").onchange=()=>{ state.app.colorScheme=$("#selScheme").value; save(state); render(); };
    $("#btnSW").onclick=async()=>{
      try{
        if("serviceWorker" in navigator){ await navigator.serviceWorker.register("./sw.js"); toast("Offline activé."); }
        else alert("Service Worker non supporté.");
      }catch(e){ alert("Erreur SW: "+e.message); }
    };
  }

  // charts
  const c1=$("#chartMain"); if(c1) drawChart(c1,[{name:"Taille (cm)",data:data.measurements.waistCm},{name:"Sommeil (h)",data:data.measurements.sleepH}]);
  const c2=$("#chartTracker"); if(c2) drawChart(c2,[{name:"Poids (kg)",data:data.measurements.weightKg},{name:"Taille (cm)",data:data.measurements.waistCm},{name:"Énergie (/10)",data:data.measurements.energy10}]);

  // start reminders loop if enabled
  if(data.reminders.enabled) scheduleReminders();
}

$("#btnMenu").onclick=openDrawer;
$("#btnClose").onclick=closeDrawer;
$("#backdrop").onclick=closeDrawer;
$("#btnThemeCycle").onclick=cycleTheme;
$("#btnVoice").onclick=()=>{
  state.app.voiceEnabled=!state.app.voiceEnabled;
  save(state);
  $("#btnVoice").textContent = state.app.voiceEnabled ? "Voix ON" : "Voix OFF";
  toast(state.app.voiceEnabled?"Voix activée.":"Voix coupée.");
};

$("#btnProfiles").onclick=()=>modalProfiles();

// initial route
if(!state.route) state.route="dashboard";
applyAppPrefs();
render();
