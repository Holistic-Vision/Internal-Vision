/* app.js — UI + stockage local + graphiques + minuterie + notifications */
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const STORE_KEY = "IV_STATE_V1";

  const defaultState = () => ({
    theme: "dark",
    route: "dashboard",
    // Suivi
    measurements: {
      weightKg: [],   // {t, v}
      waistCm: [],    // {t, v}
      sleepH: [],     // {t, v}
      energy10: [],   // {t, v}
      libido10: [],   // {t, v}
      ejaculations: [] // {t, note}
    },
    // validations plan: { dayId: { habits: {h_id:true/false}, mealsDone:{b,l,d}, trainingDone, notes } }
    planChecks: {},
    // Reminders local (utile quand page ouverte). Notifications requièrent permission.
    reminders: {
      enabled: false,
      items: [
        { id:"r_gm", label:"Golden milk (soir)", time:"21:30", days:[1,2,3,4,5,6,0], active:true },
        { id:"r_walk", label:"Marche", time:"16:30", days:[1,2,3,4,5,6,0], active:true },
        { id:"r_sleep", label:"Écrans off", time:"22:30", days:[1,2,3,4,5,6,0], active:true },
      ]
    },
    timer: {
      running:false,
      mode:"strength",
      remainingSec: 0,
      phaseIndex: 0,
      phases: []
    },
    settings: {
      units: { weight:"kg", waist:"cm" },
      privacy: { noNetwork:true }
    }
  });

  function loadState(){
    try{
      const raw = localStorage.getItem(STORE_KEY);
      if(!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return deepMerge(defaultState(), parsed);
    }catch{
      return defaultState();
    }
  }
  function saveState(){
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }
  function deepMerge(base, patch){
    if(typeof base !== "object" || base === null) return patch;
    const out = Array.isArray(base) ? [...base] : {...base};
    for(const k of Object.keys(patch||{})){
      const pv = patch[k];
      const bv = out[k];
      if(Array.isArray(pv)) out[k] = pv;
      else if(typeof pv === "object" && pv !== null) out[k] = deepMerge(bv ?? {}, pv);
      else out[k] = pv;
    }
    return out;
  }

  const state = loadState();
  const data = window.IV_DATA;

  // ===== PWA install handling =====
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    $("#btnInstall").disabled = false;
  });

  // ===== Theme =====
  function applyTheme(){
    document.documentElement.dataset.theme = state.theme === "light" ? "light" : "dark";
    $("#btnTheme").textContent = (state.theme === "light") ? "Clair" : "Sombre";
  }

  // ===== Drawer =====
  const drawer = $("#drawer");
  const backdrop = $("#backdrop");
  function openDrawer(){
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden","false");
    backdrop.hidden = false;
  }
  function closeDrawer(){
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden","true");
    backdrop.hidden = true;
  }

  // Swipe to open/close (mobile)
  let touchX0 = null;
  document.addEventListener("touchstart", (e)=>{
    touchX0 = e.touches?.[0]?.clientX ?? null;
  }, {passive:true});
  document.addEventListener("touchend", (e)=>{
    if(touchX0 == null) return;
    const x1 = e.changedTouches?.[0]?.clientX ?? touchX0;
    const dx = x1 - touchX0;
    // swipe from left edge
    if(touchX0 < 24 && dx > 60) openDrawer();
    // swipe to close
    if(drawer.classList.contains("open") && dx < -60) closeDrawer();
    touchX0 = null;
  }, {passive:true});

  // ===== Routing =====
  function setRoute(route){
    state.route = route;
    saveState();
    render();
    closeDrawer();
  }

  // ===== Utilities =====
  function nowISO(){ return new Date().toISOString(); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
  function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {weekday:"short", day:"2-digit", month:"2-digit"});
  }
  function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function parseHHMM(s){
    const [hh,mm] = s.split(":").map(x=>parseInt(x,10));
    return {hh: hh||0, mm: mm||0};
  }

  // ===== Pages =====
  function pageDashboard(){
    const last = (arr)=> arr.length ? arr[arr.length-1].v : null;

    const w = last(state.measurements.weightKg);
    const waist = last(state.measurements.waistCm);
    const sleep = last(state.measurements.sleepH);
    const energy = last(state.measurements.energy10);
    const libido = last(state.measurements.libido10);

    const adherence = computeAdherence7d();

    return `
      <section class="card">
        <div class="h1">Tableau de bord</div>
        <p class="p">Objectif: libérer testostérone (insuline↓, inflammation↓, sommeil↑, zinc/D↑) + densifier sperme.</p>
        <div class="hr"></div>

        <div class="kpis">
          <div class="kpi">
            <div class="kpiVal">${w ?? "—"} <span class="small">kg</span></div>
            <div class="kpiLab">Poids (dernier)</div>
          </div>
          <div class="kpi">
            <div class="kpiVal">${waist ?? "—"} <span class="small">cm</span></div>
            <div class="kpiLab">Tour de taille (dernier)</div>
          </div>
          <div class="kpi">
            <div class="kpiVal">${sleep ?? "—"} <span class="small">h</span></div>
            <div class="kpiLab">Sommeil (dernier)</div>
          </div>
          <div class="kpi">
            <div class="kpiVal">${energy ?? "—"} <span class="small">/10</span></div>
            <div class="kpiLab">Énergie (dernier)</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <div class="badge"><span class="dot ${adherence >= 70 ? "ok" : adherence >= 50 ? "warn" : "danger"}"></span>Adhérence 7 jours: ${adherence}%</div>
            <div style="height:10px"></div>
            <button class="btn" data-route="tracker">Renseigner aujourd’hui</button>
          </div>
          <div class="col">
            <div class="badge"><span class="dot ${libido!=null && libido>=6 ? "ok" : "warn"}"></span>Libido: ${libido ?? "—"}/10</div>
            <div style="height:10px"></div>
            <button class="btn secondary" data-route="plan">Ouvrir le plan du jour</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="h2">Courbes (tendance)</div>
        <p class="p">Objectif principal: tour de taille ↓ + sommeil ↑ = testostérone libre ↑ (souvent).</p>
        <div class="hr"></div>
        <canvas id="chartMain" width="980" height="260"></canvas>
        <div class="small note" style="margin-top:10px">
          Lecture pratique: si la taille baisse (même sans gros changement de poids), la testostérone “se libère” souvent (aromatase ↓).
        </div>
      </section>

      <section class="card">
        <div class="h2">Golden Milk</div>
        <p class="p"><b>Soir</b> : terrain anti-inflammatoire + soutien du sommeil. Adapter selon tolérance (reflux/HTA/traitements).</p>
        <div class="hr"></div>
        <button class="btn secondary" data-route="library">Voir instructions complètes (MTC • Ayurveda • Médecine)</button>
      </section>
    `;
  }

  function pagePlan(){
    const flatDays = data.weeks.flatMap(w=>w.days);
    // “Jour” courant = index depuis début plan (jour 1 à 28) basé sur date de départ (stockée), sinon aujourd’hui = jour 1
    const start = state.planStartISO ?? null;
    const startDate = start ? new Date(start) : new Date();
    const d0 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const dn = new Date().getTime();
    const dayIndex = clamp(Math.floor((dn - d0) / (24*3600*1000)), 0, 27);
    const day = flatDays[dayIndex];

    const checks = state.planChecks[day.id] ?? {};
    const habits = day.habits.map(h=>{
      const v = checks.habits?.[h.id] ?? false;
      return `
        <div class="item">
          <div class="itemTop">
            <div>
              <div class="itemTitle">${h.label}</div>
              <div class="itemMeta">${h.target ? "Cible" : ""}</div>
            </div>
            <button class="btn secondary" data-toggle-habit="${day.id}:${h.id}">${v ? "Validé" : "Valider"}</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="card">
        <div class="h1">Plan 4 semaines</div>
        <p class="p">Tu peux démarrer “aujourd’hui”. Le plan s’adapte: l’essentiel est la cohérence (insuline↓, sommeil↑, protéines, graisses utiles).</p>
        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <label>Date de départ du plan</label>
            <div class="row" style="align-items:center">
              <input class="input" type="date" id="planStart" />
              <button class="btn secondary" id="btnSetStart">Définir</button>
            </div>
            <p class="small">Astuce: mets une date fixe pour que “Jour X” corresponde à ton calendrier.</p>
          </div>
          <div class="col">
            <div class="badge"><span class="dot ok"></span>Jour courant: ${day.title} — Semaine ${day.week}</div>
            <div style="height:10px"></div>
            <button class="btn" data-route="tracker">Renseigner suivi du jour</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="h2">${day.title} — ${data.weeks[day.week-1].name}</div>
        <p class="p"><b>Focus semaine:</b> ${data.weeks[day.week-1].focus.join(" • ")}</p>
        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <div class="h2">Repas</div>
            <div class="list">
              ${mealBlock(day.id, "breakfast", day.meals.breakfast)}
              ${mealBlock(day.id, "lunch", day.meals.lunch)}
              ${mealBlock(day.id, "dinner", day.meals.dinner)}
            </div>
          </div>

          <div class="col">
            <div class="h2">Entraînement</div>
            <div class="item">
              <div class="itemTitle">${day.training.strength ? "Force (courte, efficace)" : "Récupération / Respiration"}</div>
              <div class="itemMeta">${day.training.plan.join(" — ")}</div>
              <div class="itemActions">
                <button class="btn" data-start-timer="${day.training.strength ? "strength" : "breath"}">Lancer minuterie</button>
                <button class="btn secondary" data-toggle-training="${day.id}">${(checks.trainingDone??false) ? "ValidAS validé" : "Valider séance"}</button>
              </div>
            </div>

            <div class="hr"></div>
            <div class="h2">Habitudes</div>
            <div class="list">${habits}</div>

            <div class="hr"></div>
            <label>Notes du jour</label>
            <textarea class="input" id="dayNotes" rows="3" placeholder="Ex: faim, stress, qualité sommeil, libido, éjaculation oui/non…">${checks.notes ?? ""}</textarea>
            <div style="height:10px"></div>
            <button class="btn secondary" id="btnSaveNotes" data-day="${day.id}">Enregistrer notes</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="h2">Plan complet (28 jours)</div>
        <p class="p">Tout est consultable. Tu peux aussi valider rétroactivement.</p>
        <div class="hr"></div>
        ${renderAllDays()}
      </section>
    `;
  }

  function mealBlock(dayId, slot, meal){
    const checks = state.planChecks[dayId] ?? {};
    const done = checks.mealsDone?.[slot] ?? false;
    const label = slot === "breakfast" ? "Petit-déj" : slot === "lunch" ? "Déjeuner" : "Dîner";
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${label}</div>
            <div class="itemMeta"><b>${meal.name}</b> • ${meal.tags.join(" • ")}<br>${meal.notes}</div>
          </div>
          <button class="btn secondary" data-toggle-meal="${dayId}:${slot}">${done ? "Validé" : "Valider"}</button>
        </div>
      </div>
    `;
  }

  function renderAllDays(){
    const flat = data.weeks.flatMap(w=>w.days);
    return `
      <div class="list">
        ${flat.map(d=>{
          const c = state.planChecks[d.id] ?? {};
          const p = computeDayCompletion(d.id, d);
          return `
            <div class="item">
              <div class="itemTop">
                <div>
                  <div class="itemTitle">${d.title} • S${d.week} ${p>=80 ? "✅" : p>=50 ? "🟡" : "⚪"}</div>
                  <div class="itemMeta">
                    PDJ: ${d.meals.breakfast.name}<br>
                    Midi: ${d.meals.lunch.name}<br>
                    Soir: ${d.meals.dinner.name}
                  </div>
                </div>
                <button class="btn secondary" data-open-day="${d.id}">Ouvrir</button>
              </div>
              <div class="small">Progression du jour: ${p}%</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function pageRecipes(){
    const list = data.recipes.map(r=>{
      return `
        <div class="item">
          <div class="itemTop">
            <div>
              <div class="itemTitle">${r.title}</div>
              <div class="itemMeta">${r.timeMin} min • ${r.servings} portion(s)</div>
            </div>
            <button class="btn secondary" data-open-recipe="${r.id}">Voir</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="card">
        <div class="h1">Recettes</div>
        <p class="p">Recettes simples, orientées “terrain hormonal”. Tu peux en ajouter (ou on les étend ensuite à 50+ recettes).</p>
      </section>

      <section class="card">
        <div class="h2">Catalogue</div>
        <div class="list">${list}</div>
      </section>

      <section class="card">
        <div class="h2">Règles cuisine (effet testostérone)</div>
        <div class="small note">
          1) Protéines à chaque repas.<br>
          2) Dîner léger & chaud (sommeil = testostérone).<br>
          3) Zéro sucre ajouté, quasi zéro ultra-transformés.<br>
          4) Graisses utiles : olive, beurre (si toléré), coco, œufs.<br>
          5) Épices: adapter à ton estomac (reflux → réduire poivre/gingembre).
        </div>
      </section>
    `;
  }

  function recipeModal(r){
    const wrap = document.createElement("div");
    wrap.className = "backdrop";
    wrap.style.zIndex = 60;
    wrap.innerHTML = `
      <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0; z-index:61;">
        <div class="row" style="align-items:center; justify-content:space-between;">
          <div>
            <div class="h1">${r.title}</div>
            <p class="p">${r.timeMin} min • ${r.servings} portion(s)</p>
          </div>
          <button class="iconbtn" id="closeModal">✕</button>
        </div>
        <div class="hr"></div>

        <div class="h2">Ingrédients</div>
        <ul class="small">${r.ingredients.map(x=>`<li>${x}</li>`).join("")}</ul>

        <div class="h2">Étapes</div>
        <ol class="small">${r.steps.map(x=>`<li>${x}</li>`).join("")}</ol>

        <div class="h2">Bénéfices (lecture moderne)</div>
        <ul class="small">${r.benefits.map(x=>`<li>${x}</li>`).join("")}</ul>

        <div class="h2">Prudences</div>
        <ul class="small">${r.cautions.map(x=>`<li>${x}</li>`).join("")}</ul>

        <div class="h2">MTC</div>
        <ul class="small">${r.mtc.map(x=>`<li>${x}</li>`).join("")}</ul>

        <div class="h2">Ayurveda</div>
        <ul class="small">${r.ayurveda.map(x=>`<li>${x}</li>`).join("")}</ul>
      </div>
    `;
    document.body.appendChild(wrap);
    $("#closeModal", wrap).onclick = () => wrap.remove();
    wrap.onclick = (e)=> { if(e.target === wrap) wrap.remove(); };
  }

  function pageTracker(){
    return `
      <section class="card">
        <div class="h1">Carnet de suivi</div>
        <p class="p">Objectif: mesurer ce qui compte (taille, sommeil, énergie) → corriger vite.</p>
        <div class="hr"></div>

        <div class="form">
          <div class="row">
            <div class="col">
              <label>Poids (kg)</label>
              <input class="input" id="inWeight" type="number" step="0.1" placeholder="ex: 94.2" />
            </div>
            <div class="col">
              <label>Tour de taille (cm)</label>
              <input class="input" id="inWaist" type="number" step="0.1" placeholder="ex: 102.0" />
            </div>
          </div>

          <div class="row">
            <div class="col">
              <label>Sommeil (heures)</label>
              <input class="input" id="inSleep" type="number" step="0.1" placeholder="ex: 6.5" />
            </div>
            <div class="col">
              <label>Énergie (0–10)</label>
              <input class="input" id="inEnergy" type="number" step="1" min="0" max="10" placeholder="ex: 6" />
            </div>
          </div>

          <div class="row">
            <div class="col">
              <label>Libido (0–10)</label>
              <input class="input" id="inLibido" type="number" step="1" min="0" max="10" placeholder="ex: 7" />
            </div>
            <div class="col">
              <label>Éjaculation aujourd’hui ? (optionnel)</label>
              <select class="input" id="inEjac">
                <option value="">—</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </div>
          </div>

          <div>
            <label>Note (optionnel)</label>
            <textarea class="input" id="inNote" rows="3" placeholder="Stress, digestion, douleurs, qualité orgasme, etc."></textarea>
          </div>

          <button class="btn" id="btnSaveTrack">Enregistrer</button>
          <button class="btn secondary" id="btnExport">Exporter (JSON)</button>
          <button class="btn danger" id="btnReset">Réinitialiser (local)</button>
        </div>
      </section>

      <section class="card">
        <div class="h2">Courbes</div>
        <canvas id="chartTracker" width="980" height="260"></canvas>
        <p class="small note" style="margin-top:10px">
          Priorité: <b>tour de taille</b> + <b>sommeil</b>. Ce sont souvent les deux plus corrélés à la remontée de testostérone libre.
        </p>
      </section>
    `;
  }

  function pageTimer(){
    return `
      <section class="card">
        <div class="h1">Minuterie</div>
        <p class="p">Séances courtes (force) + respiration (récupération). L’objectif est hormonal: intensité brève + régularité.</p>
        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <div class="h2">Modes</div>
            <div class="list">
              ${timerPreset("strength", "Force 18 min", [
                {label:"Échauffement", sec: 360},
                {label:"Bloc 1 (pompes + gainage)", sec: 360},
                {label:"Pause", sec: 60},
                {label:"Bloc 2 (squats + gainage)", sec: 360},
                {label:"Pause", sec: 60},
                {label:"Bloc 3 (tirage élastique si dispo / hip hinge)", sec: 360},
                {label:"Retour au calme", sec: 120},
              ])}
              ${timerPreset("breath", "Respiration 6 min", [
                {label:"Respiration lente", sec: 360},
              ])}
              ${timerPreset("kegel", "Périnée 2 min", [
                {label:"Contraction/relâchement", sec: 120},
              ])}
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
              <div class="small note" style="margin-top:10px">
                Option: garde l’écran allumé (Android: “écran toujours actif”).
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function timerPreset(id, title, phases){
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${title}</div>
            <div class="itemMeta">${phases.map(p=>`${p.label} (${Math.round(p.sec/60)}m)`).join(" • ")}</div>
          </div>
          <button class="btn secondary" data-preset="${id}">Choisir</button>
        </div>
      </div>
    `;
  }

  function pageReminders(){
    const items = state.reminders.items.map(r=>{
      return `
        <div class="item">
          <div class="itemTop">
            <div>
              <div class="itemTitle">${r.label}</div>
              <div class="itemMeta">Heure: ${r.time} • Actif: ${r.active ? "Oui" : "Non"}</div>
            </div>
            <button class="btn secondary" data-toggle-rem="${r.id}">${r.active ? "Désactiver" : "Activer"}</button>
          </div>
          <div class="hr"></div>
          <div class="row">
            <div class="col">
              <label>Heure (HH:MM)</label>
              <input class="input" value="${r.time}" data-rem-time="${r.id}" />
            </div>
            <div class="col">
              <label>Jours (0=dim..6=sam)</label>
              <input class="input" value="${r.days.join(",")}" data-rem-days="${r.id}" />
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <section class="card">
        <div class="h1">Rappels & notifications</div>
        <p class="p">Deux niveaux: (1) rappels internes (page ouverte) (2) notifications navigateur (permission requise). Pour de vraies notifications Android “système”, l’intégration Tasker est idéale (on peut l’ajouter ensuite).</p>
        <div class="hr"></div>

        <div class="row">
          <div class="col">
            <button class="btn" id="btnNotif">Demander permission notifications</button>
          </div>
          <div class="col">
            <button class="btn secondary" id="btnApplyRem">Appliquer les changements</button>
          </div>
        </div>

        <div class="hr"></div>
        <div class="badge"><span class="dot ${state.reminders.enabled ? "ok" : "warn"}"></span>Rappels actifs: ${state.reminders.enabled ? "Oui" : "Non"}</div>
        <div style="height:10px"></div>
        <button class="btn secondary" id="btnToggleRem">${state.reminders.enabled ? "Couper les rappels" : "Activer les rappels"}</button>
      </section>

      <section class="card">
        <div class="h2">Rappels configurables</div>
        <div class="list">${items}</div>
      </section>

      <section class="card">
        <div class="h2">Suggestion pro (niveau supérieur)</div>
        <div class="small note">
          Pour des notifications fiables même app fermée: Tasker/AutoNotification peut piloter ces rappels.  
          Ici, on garde une version “autonome web” (PWA) déjà utilisable.
        </div>
      </section>
    `;
  }

  function pageLibrary(){
    const d = data.meta.disclaimer.map(x=>`<li>${x}</li>`).join("");
    const pillars = data.pillars.map(p=>`
      <div class="item">
        <div class="itemTitle">${p.title}</div>
        <ul class="small">${p.points.map(x=>`<li>${x}</li>`).join("")}</ul>
      </div>
    `).join("");

    const gm = data.goldenMilk;
    return `
      <section class="card">
        <div class="h1">Explications (MTC • Ayurveda • Médecine)</div>
        <p class="p">Objectif: comprendre “quoi faire” et “pourquoi”.</p>
        <div class="hr"></div>

        <div class="h2">Sécurité</div>
        <ul class="small">${d}</ul>
      </section>

      <section class="card">
        <div class="h2">Modèle moderne (ce qui fait remonter la testostérone)</div>
        <div class="list">${pillars}</div>
        <div class="small note" style="margin-top:10px">
          Point central: <b>graisse viscérale</b> + <b>mauvais sommeil</b> bloquent souvent la testostérone (aromatase, cortisol, insuline).
        </div>
      </section>

      <section class="card">
        <div class="h2">${gm.title}</div>
        <div class="row">
          <div class="col">
            <div class="itemTitle">Recette</div>
            <ul class="small">${gm.recipe.map(x=>`<li>${x}</li>`).join("")}</ul>
          </div>
          <div class="col">
            <div class="itemTitle">Méthode</div>
            <ol class="small">${gm.method.map(x=>`<li>${x}</li>`).join("")}</ol>
          </div>
        </div>
        <div class="hr"></div>
        <div class="h2">Prudences</div>
        <ul class="small">${gm.cautions.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="hr"></div>
        <div class="h2">Lecture MTC</div>
        <ul class="small">${gm.mtc.map(x=>`<li>${x}</li>`).join("")}</ul>
        <div class="hr"></div>
        <div class="h2">Lecture Ayurveda</div>
        <ul class="small">${gm.ayurveda.map(x=>`<li>${x}</li>`).join("")}</ul>
      </section>

      <section class="card">
        <div class="h2">Ce qui annule l’effet (concret)</div>
        <div class="small note">
          • Boissons froides/glacées le soir • sucre • alcool • coucher tardif • porno • éjaculation trop fréquente • ultra-transformés.  
          Si tu corriges seulement <b>sucre + sommeil + tour de taille</b>, tu verras souvent déjà une différence.
        </div>
      </section>
    `;
  }

  function pageSettings(){
    return `
      <section class="card">
        <div class="h1">Paramètres</div>
        <p class="p">Tout est local. Tu peux exporter tes données en JSON (suivi).</p>
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
            <label>Confidentialité</label>
            <div class="small note">
              Aucun compte. Aucune base distante.  
              Données = LocalStorage (navigateur).
            </div>
          </div>
        </div>

        <div class="hr"></div>
        <button class="btn secondary" id="btnSW">Activer offline (Service Worker)</button>
      </section>
    `;
  }

  // ===== Rendering =====
  function render(){
    applyTheme();

    // active nav
    $$(".navItem").forEach(b=> b.classList.toggle("active", b.dataset.route === state.route));
    $$(".tab").forEach(b=> b.classList.toggle("active", b.dataset.route === state.route));

    const main = $("#main");
    let html = "";
    switch(state.route){
      case "dashboard": html = pageDashboard(); break;
      case "plan": html = pagePlan(); break;
      case "recipes": html = pageRecipes(); break;
      case "tracker": html = pageTracker(); break;
      case "timer": html = pageTimer(); break;
      case "reminders": html = pageReminders(); break;
      case "library": html = pageLibrary(); break;
      case "settings": html = pageSettings(); break;
      default: html = pageDashboard();
    }
    main.innerHTML = html;

    wirePage();
    drawChartsIfAny();
  }

  // ===== Adherence computations =====
  function computeDayCompletion(dayId, dayObj){
    const c = state.planChecks[dayId] ?? {};
    let total = 0, done = 0;

    // meals
    ["breakfast","lunch","dinner"].forEach(k=>{
      total += 1;
      if(c.mealsDone?.[k]) done += 1;
    });

    // training
    total += 1;
    if(c.trainingDone) done += 1;

    // habits
    const habits = (dayObj?.habits ?? []).length ? dayObj.habits : [];
    total += habits.length;
    for(const h of habits){
      if(c.habits?.[h.id]) done += 1;
    }

    return total ? Math.round((done/total)*100) : 0;
  }

  function computeAdherence7d(){
    const flat = data.weeks.flatMap(w=>w.days);
    // si start défini, on prend les 7 derniers jours du plan, sinon 7 derniers jours “logiques” = premiers
    const idxToday = getPlanDayIndex();
    const from = Math.max(0, idxToday - 6);
    const slice = flat.slice(from, idxToday+1);
    if(!slice.length) return 0;

    const avg = slice.reduce((sum, d)=> sum + computeDayCompletion(d.id, d), 0) / slice.length;
    return Math.round(avg);
  }

  function getPlanDayIndex(){
    const start = state.planStartISO ?? null;
    const startDate = start ? new Date(start) : new Date();
    const d0 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const dn = new Date().getTime();
    return clamp(Math.floor((dn - d0) / (24*3600*1000)), 0, 27);
  }

  // ===== Page wiring =====
  function wirePage(){
    // global route buttons
    $$("[data-route]").forEach(btn=>{
      btn.onclick = ()=> setRoute(btn.dataset.route);
    });

    // plan: set start
    const planStart = $("#planStart");
    if(planStart){
      // init value
      const d = state.planStartISO ? new Date(state.planStartISO) : new Date();
      planStart.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      $("#btnSetStart").onclick = ()=>{
        const v = planStart.value;
        if(!v) return;
        state.planStartISO = new Date(v + "T00:00:00").toISOString();
        saveState();
        render();
      };
    }

    // plan: toggle habit
    $$("[data-toggle-habit]").forEach(b=>{
      b.onclick = ()=>{
        const [dayId, habitId] = b.dataset.toggleHabit.split(":");
        state.planChecks[dayId] = state.planChecks[dayId] ?? {};
        const c = state.planChecks[dayId];
        c.habits = c.habits ?? {};
        c.habits[habitId] = !c.habits[habitId];
        saveState();
        render();
      };
    });

    // plan: toggle meal
    $$("[data-toggle-meal]").forEach(b=>{
      b.onclick = ()=>{
        const [dayId, slot] = b.dataset.toggleMeal.split(":");
        state.planChecks[dayId] = state.planChecks[dayId] ?? {};
        const c = state.planChecks[dayId];
        c.mealsDone = c.mealsDone ?? {};
        c.mealsDone[slot] = !c.mealsDone[slot];
        saveState();
        render();
      };
    });

    // plan: toggle training
    $$("[data-toggle-training]").forEach(b=>{
      b.onclick = ()=>{
        const dayId = b.dataset.toggleTraining;
        state.planChecks[dayId] = state.planChecks[dayId] ?? {};
        const c = state.planChecks[dayId];
        c.trainingDone = !c.trainingDone;
        saveState();
        render();
      };
    });

    // plan: notes
    const btnSaveNotes = $("#btnSaveNotes");
    if(btnSaveNotes){
      btnSaveNotes.onclick = ()=>{
        const dayId = btnSaveNotes.dataset.day;
        const notes = $("#dayNotes").value ?? "";
        state.planChecks[dayId] = state.planChecks[dayId] ?? {};
        state.planChecks[dayId].notes = notes;
        saveState();
        toast("Notes enregistrées.");
      };
    }

    // open day from list
    $$("[data-open-day]").forEach(b=>{
      b.onclick = ()=>{
        const id = b.dataset.openDay;
        // hack: set planStart so that chosen day becomes "today" view? Non.
        // Simpler: store selectedDay and render a modal
        const flat = data.weeks.flatMap(w=>w.days);
        const day = flat.find(x=>x.id===id);
        if(day) openDayModal(day);
      };
    });

    // recipes open
    $$("[data-open-recipe]").forEach(b=>{
      b.onclick = ()=>{
        const r = data.recipes.find(x=>x.id===b.dataset.openRecipe);
        if(r) recipeModal(r);
      };
    });

    // tracker
    const btnSaveTrack = $("#btnSaveTrack");
    if(btnSaveTrack){
      btnSaveTrack.onclick = ()=>{
        const t = nowISO();
        const w = parseFloat($("#inWeight").value);
        const wa = parseFloat($("#inWaist").value);
        const sl = parseFloat($("#inSleep").value);
        const en = parseInt($("#inEnergy").value,10);
        const li = parseInt($("#inLibido").value,10);
        const ej = $("#inEjac").value;
        const note = ($("#inNote").value || "").trim();

        if(!Number.isNaN(w)) state.measurements.weightKg.push({t, v:w});
        if(!Number.isNaN(wa)) state.measurements.waistCm.push({t, v:wa});
        if(!Number.isNaN(sl)) state.measurements.sleepH.push({t, v:sl});
        if(!Number.isNaN(en)) state.measurements.energy10.push({t, v:clamp(en,0,10)});
        if(!Number.isNaN(li)) state.measurements.libido10.push({t, v:clamp(li,0,10)});
        if(ej){
          state.measurements.ejaculations.push({t, note: `Éjaculation: ${ej}${note? " — "+note : ""}`});
        }else if(note){
          // note “générale” -> stocke dans énergie log (option)
          state.measurements.energy10.push({t, v: Number.isNaN(en) ? 0 : clamp(en,0,10), note});
        }

        saveState();
        toast("Suivi enregistré.");
        render();
      };

      $("#btnExport").onclick = ()=>{
        const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `internal-vision-export-${todayKey()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };

      $("#btnReset").onclick = ()=>{
        if(!confirm("Effacer toutes les données locales ?")) return;
        localStorage.removeItem(STORE_KEY);
        location.reload();
      };
    }

    // timer presets
    $$("[data-preset]").forEach(b=>{
      b.onclick = ()=>{
        const id = b.dataset.preset;
        applyTimerPreset(id);
        toast("Preset chargé.");
      };
    });

    // timer start from plan page
    $$("[data-start-timer]").forEach(b=>{
      b.onclick = ()=>{
        const id = b.dataset.startTimer;
        applyTimerPreset(id);
        setRoute("timer");
        setTimeout(()=> $("#btnStart")?.click(), 50);
      };
    });

    // timer controls
    if($("#btnStart")){
      $("#btnStart").onclick = ()=> timerStart();
      $("#btnPause").onclick = ()=> timerPause();
      $("#btnStop").onclick  = ()=> timerStop();
      syncTimerUI();
    }

    // reminders controls
    if($("#btnToggleRem")){
      $("#btnToggleRem").onclick = ()=>{
        state.reminders.enabled = !state.reminders.enabled;
        saveState();
        if(state.reminders.enabled) scheduleReminderLoop();
        toast(state.reminders.enabled ? "Rappels activés." : "Rappels coupés.");
        render();
      };

      $("#btnNotif").onclick = async ()=>{
        if(!("Notification" in window)) return alert("Notifications non supportées ici.");
        const p = await Notification.requestPermission();
        toast("Permission: " + p);
      };

      $("#btnApplyRem").onclick = ()=>{
        // read inputs
        $$("[data-rem-time]").forEach(inp=>{
          const id = inp.dataset.remTime;
          const r = state.reminders.items.find(x=>x.id===id);
          if(r) r.time = (inp.value || "21:00").slice(0,5);
        });
        $$("[data-rem-days]").forEach(inp=>{
          const id = inp.dataset.remDays;
          const r = state.reminders.items.find(x=>x.id===id);
          if(r){
            const arr = (inp.value||"").split(",").map(x=>parseInt(x.trim(),10)).filter(x=>!Number.isNaN(x) && x>=0 && x<=6);
            r.days = arr.length ? arr : [0,1,2,3,4,5,6];
          }
        });
        saveState();
        scheduleReminderLoop();
        toast("Rappels mis à jour.");
      };

      $$("[data-toggle-rem]").forEach(b=>{
        b.onclick = ()=>{
          const r = state.reminders.items.find(x=>x.id===b.dataset.toggleRem);
          if(!r) return;
          r.active = !r.active;
          saveState();
          scheduleReminderLoop();
          render();
        };
      });
    }

    // settings
    if($("#selTheme")){
      $("#selTheme").onchange = ()=>{
        state.theme = $("#selTheme").value;
        saveState();
        render();
      };
      $("#btnSW").onclick = async ()=>{
        try{
          if("serviceWorker" in navigator){
            await navigator.serviceWorker.register("sw.js");
            toast("Offline activé.");
          }else{
            alert("Service Worker non supporté.");
          }
        }catch(e){
          alert("Erreur SW: " + e.message);
        }
      };
    }

    // install
    $("#btnInstall").onclick = async ()=>{
      if(!deferredPrompt) return toast("Installer: non disponible.");
      deferredPrompt.prompt();
      const res = await deferredPrompt.userChoice;
      toast("Installation: " + res.outcome);
      deferredPrompt = null;
    };
  }

  // ===== Day modal =====
  function openDayModal(day){
    const wrap = document.createElement("div");
    wrap.className = "backdrop";
    wrap.style.zIndex = 70;
    const c = state.planChecks[day.id] ?? {};
    const prog = computeDayCompletion(day.id, day);

    wrap.innerHTML = `
      <div class="card" style="position:fixed; left:12px; right:12px; top:12px; bottom:12px; overflow:auto; margin:0; z-index:71;">
        <div class="row" style="align-items:center; justify-content:space-between;">
          <div>
            <div class="h1">${day.title} • Semaine ${day.week}</div>
            <p class="p">Progression: ${prog}%</p>
          </div>
          <button class="iconbtn" id="closeDay">✕</button>
        </div>
        <div class="hr"></div>

        <div class="h2">Repas</div>
        <div class="list">
          ${mealBlock(day.id, "breakfast", day.meals.breakfast)}
          ${mealBlock(day.id, "lunch", day.meals.lunch)}
          ${mealBlock(day.id, "dinner", day.meals.dinner)}
        </div>

        <div class="hr"></div>
        <div class="h2">Entraînement</div>
        <div class="item">
          <div class="itemTitle">${day.training.strength ? "Force" : "Respiration"}</div>
          <div class="itemMeta">${day.training.plan.join(" — ")}</div>
          <div class="itemActions">
            <button class="btn" data-start-timer="${day.training.strength ? "strength" : "breath"}">Lancer minuterie</button>
            <button class="btn secondary" data-toggle-training="${day.id}">${(c.trainingDone??false) ? "Validé" : "Valider"}</button>
          </div>
        </div>

        <div class="hr"></div>
        <div class="h2">Habitudes</div>
        <div class="list">
          ${day.habits.map(h=>{
            const v = c.habits?.[h.id] ?? false;
            return `
              <div class="item">
                <div class="itemTop">
                  <div>
                    <div class="itemTitle">${h.label}</div>
                    <div class="itemMeta">${h.target ? "Cible" : ""}</div>
                  </div>
                  <button class="btn secondary" data-toggle-habit="${day.id}:${h.id}">${v ? "Validé" : "Valider"}</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="hr"></div>
        <label>Notes</label>
        <textarea class="input" id="modalNotes" rows="3">${c.notes ?? ""}</textarea>
        <div style="height:10px"></div>
        <button class="btn secondary" id="saveModalNotes">Enregistrer</button>
      </div>
    `;

    document.body.appendChild(wrap);

    $("#closeDay", wrap).onclick = ()=> wrap.remove();
    wrap.onclick = (e)=> { if(e.target === wrap) wrap.remove(); };

    // wire inside modal
    $$("[data-toggle-meal]", wrap).forEach(b=> b.onclick = ()=>{
      const [dayId, slot] = b.dataset.toggleMeal.split(":");
      state.planChecks[dayId] = state.planChecks[dayId] ?? {};
      const cc = state.planChecks[dayId];
      cc.mealsDone = cc.mealsDone ?? {};
      cc.mealsDone[slot] = !cc.mealsDone[slot];
      saveState();
      wrap.remove();
      render();
    });

    $$("[data-toggle-training]", wrap).forEach(b=> b.onclick = ()=>{
      const dayId = b.dataset.toggleTraining;
      state.planChecks[dayId] = state.planChecks[dayId] ?? {};
      state.planChecks[dayId].trainingDone = !state.planChecks[dayId].trainingDone;
      saveState();
      wrap.remove();
      render();
    });

    $$("[data-toggle-habit]", wrap).forEach(b=> b.onclick = ()=>{
      const [dayId, habitId] = b.dataset.toggleHabit.split(":");
      state.planChecks[dayId] = state.planChecks[dayId] ?? {};
      const cc = state.planChecks[dayId];
      cc.habits = cc.habits ?? {};
      cc.habits[habitId] = !cc.habits[habitId];
      saveState();
      wrap.remove();
      render();
    });

    $$("[data-start-timer]", wrap).forEach(b=> b.onclick = ()=>{
      const id = b.dataset.startTimer;
      applyTimerPreset(id);
      wrap.remove();
      setRoute("timer");
      setTimeout(()=> $("#btnStart")?.click(), 50);
    });

    $("#saveModalNotes", wrap).onclick = ()=>{
      const notes = $("#modalNotes", wrap).value ?? "";
      state.planChecks[day.id] = state.planChecks[day.id] ?? {};
      state.planChecks[day.id].notes = notes;
      saveState();
      toast("Notes enregistrées.");
      wrap.remove();
      render();
    };
  }

  // ===== Charts =====
  function drawChartsIfAny(){
    const c1 = $("#chartMain");
    if(c1){
      const series = [
        {name:"Taille (cm)", data: state.measurements.waistCm},
        {name:"Sommeil (h)", data: state.measurements.sleepH},
      ];
      drawChart(c1, series);
    }

    const c2 = $("#chartTracker");
    if(c2){
      const series = [
        {name:"Poids (kg)", data: state.measurements.weightKg},
        {name:"Taille (cm)", data: state.measurements.waistCm},
        {name:"Énergie (/10)", data: state.measurements.energy10},
      ];
      drawChart(c2, series);
    }
  }

  function drawChart(canvas, series){
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0,0,W,H);

    // gather points (last 21)
    const maxPts = 21;
    const lines = series
      .map(s=> ({...s, pts:(s.data||[]).slice(-maxPts)}))
      .filter(s=> s.pts.length >= 2);

    // background grid
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    for(let i=1;i<=4;i++){
      const y = (H*i)/5;
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    }

    if(!lines.length){
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "bold 14px system-ui";
      ctx.fillText("Pas assez de données (ajoute 2 mesures).", 18, 36);
      return;
    }

    // normalize each line independently
    lines.forEach((s, idx)=>{
      const vals = s.pts.map(p=>p.v);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const pad = (max-min) === 0 ? 1 : (max-min)*0.15;

      const lo = min - pad;
      const hi = max + pad;

      ctx.lineWidth = 3;
      ctx.strokeStyle = idx % 2 === 0 ? "rgba(96,165,250,.95)" : "rgba(79,209,197,.95)";
      ctx.beginPath();
      s.pts.forEach((p,i)=>{
        const x = (W-24) * (i/(s.pts.length-1)) + 12;
        const y = H - ((p.v - lo) / (hi - lo)) * (H-28) - 14;
        if(i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      });
      ctx.stroke();

      // label
      ctx.fillStyle = idx % 2 === 0 ? "rgba(96,165,250,.95)" : "rgba(79,209,197,.95)";
      ctx.font = "bold 12px system-ui";
      ctx.fillText(s.name, 14, 18 + idx*16);
    });
  }

  // ===== Timer =====
  let timerTick = null;

  function applyTimerPreset(presetId){
    const presets = {
      strength: [
        {label:"Échauffement", sec: 360},
        {label:"Bloc 1", sec: 360},
        {label:"Pause", sec: 60},
        {label:"Bloc 2", sec: 360},
        {label:"Pause", sec: 60},
        {label:"Bloc 3", sec: 360},
        {label:"Retour au calme", sec: 120},
      ],
      breath: [{label:"Respiration lente", sec: 360}],
      kegel: [{label:"Périnée", sec: 120}],
    };

    state.timer.mode = presetId;
    state.timer.phases = presets[presetId] ?? presets.strength;
    state.timer.phaseIndex = 0;
    state.timer.remainingSec = state.timer.phases[0].sec;
    state.timer.running = false;
    saveState();
    syncTimerUI();
  }

  function syncTimerUI(){
    const label = $("#timerLabel");
    if(!label) return;

    const modeName = state.timer.mode === "strength" ? "Force 18 min"
      : state.timer.mode === "breath" ? "Respiration 6 min"
      : "Périnée 2 min";

    label.textContent = modeName;

    const phase = state.timer.phases[state.timer.phaseIndex] ?? {label:"—", sec:0};
    $("#timerMeta").textContent = "Phases: " + state.timer.phases.map(p=>p.label).join(" • ");
    $("#timerPhase").textContent = "Phase: " + phase.label;
    $("#timerClock").textContent = secToMMSS(state.timer.remainingSec);

    $("#btnStart").textContent = state.timer.running ? "En cours…" : "Démarrer";
  }

  function secToMMSS(s){
    const m = Math.floor(s/60);
    const r = s%60;
    return `${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}`;
  }

  function beep(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.start();
      setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
    }catch{}
  }

  function timerStart(){
    if(!state.timer.phases?.length) applyTimerPreset("strength");
    if(state.timer.running) return;

    state.timer.running = true;
    saveState();
    syncTimerUI();
    beep();

    let last = Date.now();

    timerTick = setInterval(()=>{
      const now = Date.now();
      const dt = Math.floor((now - last) / 1000);
      if(dt <= 0) return;
      last = now;

      state.timer.remainingSec -= dt;
      if(state.timer.remainingSec <= 0){
        beep();
        state.timer.phaseIndex += 1;
        if(state.timer.phaseIndex >= state.timer.phases.length){
          timerStop(true);
          toast("Timer terminé.");
          return;
        }
        const ph = state.timer.phases[state.timer.phaseIndex];
        state.timer.remainingSec = ph.sec;
      }
      saveState();
      syncTimerUI();
    }, 250);
  }

  function timerPause(){
    if(!state.timer.running) return;
    state.timer.running = false;
    saveState();
    if(timerTick){ clearInterval(timerTick); timerTick = null; }
    syncTimerUI();
    toast("Pause.");
  }

  function timerStop(finished=false){
    state.timer.running = false;
    if(timerTick){ clearInterval(timerTick); timerTick = null; }
    // reset phase
    state.timer.phaseIndex = 0;
    state.timer.remainingSec = (state.timer.phases?.[0]?.sec) ?? 0;
    saveState();
    syncTimerUI();
    if(!finished) toast("Stop.");
  }

  // ===== Reminders =====
  let reminderLoop = null;

  function scheduleReminderLoop(){
    if(reminderLoop){ clearInterval(reminderLoop); reminderLoop = null; }
    if(!state.reminders.enabled) return;

    reminderLoop = setInterval(()=>{
      checkReminders();
    }, 20 * 1000);

    checkReminders();
  }

  function checkReminders(){
    if(!state.reminders.enabled) return;
    const now = new Date();
    const dow = now.getDay();
    const hh = now.getHours();
    const mm = now.getMinutes();

    state._lastRemFire = state._lastRemFire ?? {};

    for(const r of state.reminders.items){
      if(!r.active) continue;
      if(!r.days.includes(dow)) continue;
      const {hh:rh, mm:rm} = parseHHMM(r.time);
      if(hh === rh && mm === rm){
        const key = `${todayKey()}_${r.id}_${r.time}`;
        if(state._lastRemFire[key]) continue;
        state._lastRemFire[key] = true;
        saveState();

        // fire
        fireReminder(r.label);
      }
    }
  }

  function fireReminder(text){
    toast("Rappel: " + text);
    beep();
    if("Notification" in window && Notification.permission === "granted"){
      new Notification("Internal-Vision", { body: text });
    }
  }

  // ===== Toast =====
  function toast(msg){
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.position="fixed";
    t.style.left="12px";
    t.style.right="12px";
    t.style.bottom="calc(82px + env(safe-area-inset-bottom))";
    t.style.zIndex="100";
    t.style.padding="12px 14px";
    t.style.borderRadius="16px";
    t.style.fontWeight="900";
    t.style.border="1px solid rgba(255,255,255,.10)";
    t.style.background="rgba(16,24,38,.92)";
    t.style.backdropFilter="blur(10px)";
    document.body.appendChild(t);
    setTimeout(()=> t.remove(), 1600);
  }

  // ===== Header controls =====
  $("#btnMenu").onclick = openDrawer;
  $("#btnClose").onclick = closeDrawer;
  $("#backdrop").onclick = closeDrawer;

  $("#btnTheme").onclick = ()=>{
    state.theme = (state.theme === "dark") ? "light" : "dark";
    saveState();
    render();
  };

  // Drawer nav buttons
  $$(".navItem").forEach(b=> b.onclick = ()=> setRoute(b.dataset.route));

  // Init timer preset default
  if(!state.timer.phases?.length) applyTimerPreset("strength");

  // reminders auto-run
  if(state.reminders.enabled) scheduleReminderLoop();

  // initial render
  applyTheme();
  render();

  // initial SW register optional (safe)
  if("serviceWorker" in navigator){
    // do not auto-register silently; user can do it in Settings.
  }
})();
