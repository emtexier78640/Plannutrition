// La base de données RECIPES est gérée séparément dans le fichier recipes.js

// Objectifs nutritionnels quotidiens
const TARGETS = {
  calories: 1400,
  carbs: 175,
  protein: 70,
  fat: 47
};

// Liste ordonnée des jours de la semaine
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// État initial de l'application
let state = {
  activeDay: "Lundi",
  days: {},
  preferences: {
    includeBreakfast: true,
    includeSnack: true
  },
  disabledRecipeIds: [],
  customRecipes: []
};

// Initialiser l'état vide pour chaque jour
function initializeState() {
  const initialDays = {};
  DAYS.forEach(day => {
    initialDays[day] = {
      meals: {
        "Petit-déjeuner": { recipeId: null, eaten: false, scale: 1.0 },
        "Déjeuner": { recipeId: null, eaten: false, scale: 1.0 },
        "Collation": { recipeId: null, eaten: false, scale: 1.0 },
        "Dîner": { recipeId: null, eaten: false, scale: 1.0 }
      },
      supplements: []
    };
  });
  return {
    activeDay: "Lundi",
    days: initialDays,
    preferences: {
      includeBreakfast: true,
      includeSnack: true
    },
    disabledRecipeIds: [],
    customRecipes: []
  };
}

// Charger l'état depuis le LocalStorage
function loadState() {
  try {
    const saved = localStorage.getItem("intelligent_meal_planner_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validation sommaire de la structure
      if (parsed && parsed.days && parsed.activeDay) {
        state = parsed;
        // Migration/initialisation si nécessaire
        if (!state.preferences) {
          state.preferences = { includeBreakfast: true, includeSnack: true };
        }
        if (!state.disabledRecipeIds) {
          state.disabledRecipeIds = [];
        }
        if (!state.customRecipes) {
          state.customRecipes = [];
        }
        return;
      }
    }
  } catch (e) {
    console.error("Erreur lors du chargement de l'état :", e);
  }
  state = initializeState();
  saveState();
}

// Sauvegarder l'état dans le LocalStorage
function saveState() {
  try {
    localStorage.setItem("intelligent_meal_planner_state", JSON.stringify(state));
  } catch (e) {
    console.error("Erreur lors de la sauvegarde de l'état :", e);
  }
}

// Liste globale des recettes chargées depuis la base de données partagée
let databaseRecipes = [];

// Récupérer les recettes depuis l'API Serverless Vercel
async function fetchDatabaseRecipes() {
  try {
    const res = await fetch('/api/recipes');
    if (res.ok) {
      databaseRecipes = await res.json();
      // Mettre à jour l'affichage après le chargement des recettes
      renderApp();
    } else {
      console.warn("Échec du chargement des recettes depuis l'API, utilisation du fallback local.");
    }
  } catch (e) {
    console.error("Erreur lors de la récupération des recettes :", e);
  }
}

// Obtenir toutes les recettes fusionnées (BDD + personnalisées)
function getAllRecipes() {
  if (databaseRecipes && databaseRecipes.length > 0) {
    return databaseRecipes;
  }
  return [...RECIPES, ...(state.customRecipes || [])];
}

// Obtenir une recette par son ID
function getRecipeById(id) {
  return getAllRecipes().find(r => r.id === id) || null;
}

// Obtenir les recettes par leur type
function getRecipesByType(type) {
  const all = getAllRecipes();
  if (type === "Petit-déjeuner") return all.filter(r => r.type === "Petit-déjeuner");
  if (type === "Collation") return all.filter(r => r.type === "Collation");
  return all.filter(r => r.type === "Déjeuner/Dîner");
}

// Algorithme d'optimisation pour composer les journées de la semaine
// L'algorithme cherche à minimiser l'écart cumulé avec les macros cibles tout en minimisant la répétition
function generateFullWeek() {
  const recipeCounts = {};
  getAllRecipes().forEach(r => { recipeCounts[r.id] = 0; });
  recipeCounts[null] = 0;

  // Filtrer les recettes selon les préférences et exclusions
  let breakfasts = state.preferences.includeBreakfast 
    ? getRecipesByType("Petit-déjeuner").filter(r => !state.disabledRecipeIds.includes(r.id))
    : [];
  if (breakfasts.length === 0) {
    breakfasts.push({ id: null, calories: 0, protein: 0, carbs: 0, fat: 0, name: "Aucun", emoji: "🍽️" });
  }

  let snacks = state.preferences.includeSnack 
    ? getRecipesByType("Collation").filter(r => !state.disabledRecipeIds.includes(r.id))
    : [];
  if (snacks.length === 0) {
    snacks.push({ id: null, calories: 0, protein: 0, carbs: 0, fat: 0, name: "Aucun", emoji: "🍽️" });
  }

  let mains = getRecipesByType("Déjeuner/Dîner").filter(r => !state.disabledRecipeIds.includes(r.id));
  if (mains.length === 0) {
    mains = getRecipesByType("Déjeuner/Dîner");
  }

  DAYS.forEach(day => {
    let bestCombo = null;
    let bestScore = Infinity;

    // Exploration combinatoire exhaustive de toutes les combinaisons possibles (~1400)
    for (let b of breakfasts) {
      for (let l of mains) {
        for (let s of snacks) {
          for (let d of mains) {
            if (l.id && d.id && l.id === d.id) continue; // Pas le même repas pour le midi et le soir

            // Calcul des totaux théoriques pour cette combinaison
            const cal = b.calories + l.calories + s.calories + d.calories;
            if (cal === 0) continue; // Éviter division par zéro
            
            // Calculer l'échelle requise pour atteindre exactement la cible calorique
            const scale = TARGETS.calories / cal;

            // Calcul du score d'écart (erreur quadratique relative) sur les macros mises à l'échelle
            const errProt = (((b.protein + l.protein + s.protein + d.protein) * scale) - TARGETS.protein) / TARGETS.protein;
            const errCarb = (((b.carbs + l.carbs + s.carbs + d.carbs) * scale) - TARGETS.carbs) / TARGETS.carbs;
            const errFat = (((b.fat + l.fat + s.fat + d.fat) * scale) - TARGETS.fat) / TARGETS.fat;

            const nutriError = (errProt * errProt) + (errCarb * errCarb) + (errFat * errFat);

            // Pénalité de répétition (on ignore l'ID null pour les repas exclus)
            const repPenalty = (b.id ? recipeCounts[b.id] : 0) + 
                               (l.id ? recipeCounts[l.id] : 0) + 
                               (s.id ? recipeCounts[s.id] : 0) + 
                               (d.id ? recipeCounts[d.id] : 0);

            // Score total (on cherche à minimiser)
            const score = nutriError + 0.18 * repPenalty;

            if (score < bestScore) {
              bestScore = score;
              bestCombo = { b, l, s, d };
            }
          }
        }
      }
    }

    // Incrémenter les compteurs de répétition des recettes sélectionnées
    if (bestCombo) {
      if (bestCombo.b.id) recipeCounts[bestCombo.b.id]++;
      if (bestCombo.l.id) recipeCounts[bestCombo.l.id]++;
      if (bestCombo.s.id) recipeCounts[bestCombo.s.id]++;
      if (bestCombo.d.id) recipeCounts[bestCombo.d.id]++;

      // Assigner à l'état
      state.days[day].meals["Petit-déjeuner"].recipeId = bestCombo.b.id;
      state.days[day].meals["Petit-déjeuner"].eaten = false;
      
      state.days[day].meals["Déjeuner"].recipeId = bestCombo.l.id;
      state.days[day].meals["Déjeuner"].eaten = false;

      state.days[day].meals["Collation"].recipeId = bestCombo.s.id;
      state.days[day].meals["Collation"].eaten = false;

      state.days[day].meals["Dîner"].recipeId = bestCombo.d.id;
      state.days[day].meals["Dîner"].eaten = false;

      // Conserver les suppléments intacts ou les réinitialiser ? On les réinitialise pour une semaine propre
      state.days[day].supplements = [];

      // Appliquer le calibrage automatique des portions pour cette journée
      autoScaleDayMeals(day);
    }
  });

  saveState();
  renderApp();
}

// Calculer les macros consommées et totales pour un jour donné
function calculateDayMetrics(dayName) {
  const day = state.days[dayName];
  let consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let plannedTotal = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  // Calculer à partir des repas de base
  Object.keys(day.meals).forEach(mealType => {
    const meal = day.meals[mealType];
    if (meal.recipeId) {
      const recipe = getRecipeById(meal.recipeId);
      if (recipe) {
        const scale = meal.scale !== undefined ? meal.scale : 1.0;
        // Ajouter au prévu
        plannedTotal.calories += recipe.calories * scale;
        plannedTotal.protein += recipe.protein * scale;
        plannedTotal.carbs += recipe.carbs * scale;
        plannedTotal.fat += recipe.fat * scale;

        // Si mangé, ajouter au consommé
        if (meal.eaten) {
          consumed.calories += recipe.calories * scale;
          consumed.protein += recipe.protein * scale;
          consumed.carbs += recipe.carbs * scale;
          consumed.fat += recipe.fat * scale;
        }
      }
    }
  });

  // Ajouter les suppléments (qui sont considérés comme mangés d'office)
  day.supplements.forEach(supp => {
    consumed.calories += supp.calories;
    consumed.protein += supp.protein;
    consumed.carbs += supp.carbs;
    consumed.fat += supp.fat;

    plannedTotal.calories += supp.calories;
    plannedTotal.protein += supp.protein;
    plannedTotal.carbs += supp.carbs;
    plannedTotal.fat += supp.fat;
  });

  return { consumed, plannedTotal };
}

// Modifier une recette individuelle sur un repas
function updateMealRecipe(dayName, mealType, newRecipeId) {
  if (state.days[dayName] && state.days[dayName].meals[mealType]) {
    state.days[dayName].meals[mealType].recipeId = newRecipeId;
    state.days[dayName].meals[mealType].eaten = false; // Remettre à non mangé lors du changement
    autoScaleDayMeals(dayName); // Recalculer automatiquement les portions
    saveState();
    renderApp();
  }
}

// Valider ou dévalider un repas (mangé ou non)
function toggleMealEaten(dayName, mealType, eatenStatus) {
  if (state.days[dayName] && state.days[dayName].meals[mealType]) {
    state.days[dayName].meals[mealType].eaten = eatenStatus;
    saveState();
    renderApp();
  }
}

// Ajuster automatiquement les portions de chaque repas d'une journée de manière indépendante pour atteindre les cibles nutritionnelles (solveur combinatoire)
function autoScaleDayMeals(dayName) {
  const day = state.days[dayName];
  if (!day) return;

  const meals = []; // Tableau de { meal, recipe }
  
  Object.keys(day.meals).forEach(mealType => {
    const meal = day.meals[mealType];
    if (meal.recipeId) {
      const recipe = getRecipeById(meal.recipeId);
      if (recipe) {
        meals.push({ meal, recipe });
      }
    }
  });

  if (meals.length === 0) return;

  // Calculer les apports des suppléments
  let suppCal = 0, suppProt = 0, suppCarb = 0, suppFat = 0;
  day.supplements.forEach(supp => {
    suppCal += supp.calories;
    suppProt += supp.protein;
    suppCarb += supp.carbs;
    suppFat += supp.fat;
  });

  // Options d'échelle de portion de 50% à 200% par pas de 10%
  const scaleOptions = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0];
  
  let bestLoss = Infinity;
  let bestScales = meals.map(() => 1.0);
  const numMeals = meals.length;

  function evaluate(scales) {
    let cal = suppCal;
    let prot = suppProt;
    let carb = suppCarb;
    let fat = suppFat;

    for (let i = 0; i < numMeals; i++) {
      const s = scales[i];
      const r = meals[i].recipe;
      cal += s * r.calories;
      prot += s * r.protein;
      carb += s * r.carbs;
      fat += s * r.fat;
    }

    // Calcul de l'erreur relative au carré pour chaque objectif
    const errCal = (cal - TARGETS.calories) / TARGETS.calories;
    const errProt = (prot - TARGETS.protein) / TARGETS.protein;
    const errCarb = (carb - TARGETS.carbs) / TARGETS.carbs;
    const errFat = (fat - TARGETS.fat) / TARGETS.fat;

    // On donne un poids de 2.0 à la cible calorique et 1.0 aux macros
    let loss = (errCal * errCal) * 2.0 + (errProt * errProt) + (errCarb * errCarb) + (errFat * errFat);

    // Régularisation : pénaliser l'écart par rapport à 100% (1.0) pour éviter les portions extrêmes
    let reg = 0;
    for (let i = 0; i < numMeals; i++) {
      reg += 0.04 * Math.pow(scales[i] - 1.0, 2);
    }

    return loss + reg;
  }

  // Exploration récursive de toutes les combinaisons d'échelles possibles
  function solve(index, currentScales) {
    if (index === numMeals) {
      const loss = evaluate(currentScales);
      if (loss < bestLoss) {
        bestLoss = loss;
        bestScales = [...currentScales];
      }
      return;
    }

    for (let s of scaleOptions) {
      currentScales[index] = s;
      solve(index + 1, currentScales);
    }
  }

  solve(0, new Array(numMeals).fill(1.0));

  // Assigner les échelles optimales distinctes calculées
  for (let i = 0; i < numMeals; i++) {
    meals[i].meal.scale = bestScales[i];
  }
}

// Ajouter un supplément à la journée associé à un type de repas
function addSupplement(dayName, name, calories, protein, carbs, fat, mealType) {
  if (state.days[dayName]) {
    const newSupp = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: name || "Supplément",
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      mealType: mealType || "Collation"
    };
    state.days[dayName].supplements.push(newSupp);
    autoScaleDayMeals(dayName); // Ajuster automatiquement les portions de repas
    saveState();
    renderApp();
  }
}

// Supprimer un supplément de la journée
function deleteSupplement(dayName, suppId) {
  if (state.days[dayName]) {
    state.days[dayName].supplements = state.days[dayName].supplements.filter(s => s.id !== suppId);
    autoScaleDayMeals(dayName); // Ajuster automatiquement les portions de repas
    saveState();
    renderApp();
  }
}

// Réinitialiser complètement l'application
function resetAllData() {
  if (confirm("Voulez-vous vraiment réinitialiser toutes les données ? Le planning et vos repas consommés seront supprimés.")) {
    state = initializeState();
    saveState();
    renderApp();
  }
}

// Mettre à jour l'affichage dynamique de la page
function renderApp() {
  const activeDayName = state.activeDay;
  const metrics = calculateDayMetrics(activeDayName);

  // 1. Mettre à jour les onglets des jours de la semaine
  DAYS.forEach(day => {
    const tabBtn = document.getElementById(`tab-${day}`);
    if (tabBtn) {
      // Activer l'onglet en cours
      if (day === activeDayName) {
        tabBtn.className = "px-4 py-3 text-sm font-semibold rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 flex flex-col items-center justify-center transition-all duration-200";
      } else {
        tabBtn.className = "px-4 py-3 text-sm font-medium rounded-xl bg-slate-800/40 text-slate-400 hover:bg-slate-800/80 hover:text-white border border-slate-700/20 flex flex-col items-center justify-center transition-all duration-200";
      }

      // Pastille de complétion sur l'onglet
      const dayData = state.days[day];
      let eatenCount = 0;
      let totalMeals = 0;
      Object.keys(dayData.meals).forEach(m => {
        if (dayData.meals[m].recipeId) {
          totalMeals++;
          if (dayData.meals[m].eaten) eatenCount++;
        }
      });

      const indicator = document.getElementById(`tab-indicator-${day}`);
      if (indicator) {
        if (totalMeals > 0) {
          if (eatenCount === totalMeals) {
            indicator.className = "mt-1 w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50";
          } else if (eatenCount > 0) {
            indicator.className = "mt-1 w-2 h-2 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50";
          } else {
            indicator.className = "mt-1 w-2 h-2 rounded-full bg-slate-600";
          }
        } else {
          indicator.className = "mt-1 w-2 h-2 rounded-full bg-transparent";
        }
      }

      // Petit sous-titre de calories
      const calSub = document.getElementById(`tab-cal-${day}`);
      if (calSub) {
        const dayMetrics = calculateDayMetrics(day);
        calSub.innerText = `${Math.round(dayMetrics.consumed.calories)} kcal`;
      }
    }
  });

  // 2. Mettre à jour les 4 jauges de progression circulaires
  updateProgressGauge("cal", metrics.consumed.calories, TARGETS.calories, "kcal", "glow-cal");
  updateProgressGauge("prot", metrics.consumed.protein, TARGETS.protein, "g", "glow-prot");
  updateProgressGauge("carb", metrics.consumed.carbs, TARGETS.carbs, "g", "glow-carb");
  updateProgressGauge("fat", metrics.consumed.fat, TARGETS.fat, "g", "glow-fat");

  // 3. Mettre à jour la section "Planning du jour"
  const mealsContainer = document.getElementById("meals-container");
  if (mealsContainer) {
    mealsContainer.innerHTML = "";
    const activeDayData = state.days[activeDayName];
    const MEAL_TYPES = ["Petit-déjeuner", "Déjeuner", "Collation", "Dîner"];

    MEAL_TYPES.forEach(mealType => {
      const meal = activeDayData.meals[mealType];
      const recipe = meal ? getRecipeById(meal.recipeId) : null;

      let typeBadgeClass = "";
      if (mealType === "Petit-déjeuner") typeBadgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      else if (mealType === "Déjeuner") typeBadgeClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      else if (mealType === "Collation") typeBadgeClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      else if (mealType === "Dîner") typeBadgeClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";

      // Récupérer les suppléments / aliments du placard associés à ce repas
      const mealSupps = activeDayData.supplements.filter(s => s.mealType === mealType);
      let suppsHtml = "";
      let suppTotalCal = 0;
      let suppTotalProt = 0;
      let suppTotalCarb = 0;
      let suppTotalFat = 0;

      if (mealSupps.length > 0) {
        mealSupps.forEach(s => {
          suppTotalCal += s.calories;
          suppTotalProt += s.protein;
          suppTotalCarb += s.carbs;
          suppTotalFat += s.fat;
        });

        suppsHtml = `
          <div class="mt-3 pt-3 border-t border-slate-800/40 space-y-2 text-left">
            <span class="text-[9px] font-extrabold uppercase tracking-wider text-indigo-400">Bonus / Placard :</span>
            <div class="space-y-1.5">
              ${mealSupps.map(supp => `
                <div class="flex items-center justify-between p-2 bg-slate-950/40 hover:bg-slate-900/30 border border-slate-800/60 rounded-xl text-[11px] group transition-all">
                  <div class="min-w-0 flex-1 pr-1.5">
                    <span class="font-semibold text-slate-300 truncate block" title="${supp.name}">${supp.name}</span>
                    <span class="text-[9px] text-slate-500">${supp.calories} kcal • P:${supp.protein}g • G:${supp.carbs}g • L:${supp.fat}g</span>
                  </div>
                  <button 
                    onclick="deleteSupplement('${activeDayName}', '${supp.id}')" 
                    class="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (recipe) {
        const isEaten = meal.eaten;
        const scale = meal.scale !== undefined ? meal.scale : 1.0;
        const cardClass = isEaten 
          ? "glass-panel rounded-2xl p-5 border-emerald-500/40 bg-emerald-950/10 relative transition-all duration-300 animate-fade-in flex flex-col justify-between" 
          : "glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/80 relative transition-all duration-300 animate-fade-in flex flex-col justify-between";

        // Calculer les macros à l'échelle
        const cal = Math.round(recipe.calories * scale);
        const prot = Math.round(recipe.protein * scale * 10) / 10;
        const carb = Math.round(recipe.carbs * scale * 10) / 10;
        const fat = Math.round(recipe.fat * scale * 10) / 10;

        mealsContainer.innerHTML += `
          <div class="${cardClass}" id="meal-card-${mealType}">
            <div>
              <!-- Type de Repas & Action -->
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${typeBadgeClass}">
                  ${mealType}
                </span>
                
                <div class="flex items-center gap-1.5">
                  <button onclick="openSupplementModal('${mealType}')" title="Ajouter un aliment" class="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-800/80 transition-all flex items-center gap-1 text-[10px] font-bold">
                    <span>➕ Aliment</span>
                  </button>
                  <button onclick="openChangeMealModal('${mealType}')" title="Changer de recette" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Recette Détails -->
              <div class="flex items-start gap-3 mb-4 text-left">
                <span class="text-3xl select-none pt-0.5">${recipe.emoji}</span>
                <div>
                  <h4 class="font-bold text-slate-200 leading-tight mb-1 hover:text-indigo-400 cursor-pointer transition-colors" onclick="showRecipeDetails('${recipe.id}', '${mealType}')">
                    ${recipe.name}
                  </h4>
                  <p class="text-xs text-slate-400 line-clamp-2">
                    ${recipe.ingredients.map(ing => ing.name).join(', ')}
                  </p>
                </div>
              </div>
              
              ${suppsHtml}
            </div>

            <!-- Portion et Macros -->
            <div class="mt-4 pt-4 border-t border-slate-700/40">
              <!-- Portion badge -->
              <div class="flex items-center justify-between mb-3 text-xs bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-850/80">
                <span class="text-slate-400 font-semibold flex items-center gap-1">
                  <span>⚖️</span> Portion :
                </span>
                <span class="font-bold text-indigo-400">${Math.round(scale * 100)}% <span class="text-[9px] text-slate-500 font-medium">(adaptée)</span></span>
              </div>

              <div class="grid grid-cols-4 gap-1 text-center text-[10px] text-slate-400 mb-4">
                <div class="bg-slate-800/40 p-1.5 rounded-lg">
                  <span class="block font-bold text-slate-200 text-xs">${cal}</span> Kcal
                </div>
                <div class="bg-slate-800/40 p-1.5 rounded-lg">
                  <span class="block font-bold text-emerald-400 text-xs">${prot}g</span> Prot
                </div>
                <div class="bg-slate-800/40 p-1.5 rounded-lg">
                  <span class="block font-bold text-amber-500 text-xs">${carb}g</span> Gluc
                </div>
                <div class="bg-slate-800/40 p-1.5 rounded-lg">
                  <span class="block font-bold text-pink-500 text-xs">${fat}g</span> Lipi
                </div>
              </div>

              <!-- Bouton MANGÉ / VALIDER -->
              <button 
                onclick="toggleMeal('${mealType}', ${!isEaten})" 
                class="w-full py-2.5 px-4 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border cursor-pointer ${
                  isEaten 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' 
                    : 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600 hover:text-white hover:border-transparent hover:shadow-md hover:shadow-indigo-600/10 active:scale-[0.98]'
                }"
              >
                ${isEaten ? '<span>✅ Mangé</span>' : '<span>Marquer comme mangé</span>'}
              </button>
            </div>
          </div>
        `;
      } else {
        // Version simplifiée/vide
        mealsContainer.innerHTML += `
          <div class="glass-panel rounded-2xl p-5 border border-dashed border-slate-700/50 relative transition-all duration-300 animate-fade-in flex flex-col justify-between min-h-[220px]" id="meal-card-${mealType}">
            <div>
              <!-- Type de Repas & Action -->
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${typeBadgeClass}">
                  ${mealType}
                </span>
                
                <div class="flex items-center gap-1.5">
                  <button onclick="openChangeMealModal('${mealType}')" title="Planifier une recette" class="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-800/80 transition-all flex items-center gap-1 text-[10px] font-bold">
                    <span>🗓️ Planifier</span>
                  </button>
                </div>
              </div>

              <!-- Recette Vide -->
              <div class="flex items-center gap-3 mb-4 text-left">
                <span class="text-3xl select-none opacity-40">🍽️</span>
                <div>
                  <h4 class="font-bold text-slate-400 leading-tight mb-1">
                    Aucun plat planifié
                  </h4>
                  <p class="text-[10px] text-slate-500">
                    Ce repas est exclu de la génération de la semaine ou n'a pas encore de recette.
                  </p>
                </div>
              </div>
              
              ${suppsHtml}
            </div>

            <!-- Bouton rapide d'ajout au placard -->
            <div class="mt-4 pt-4 border-t border-slate-800/40">
              <button 
                onclick="openSupplementModal('${mealType}')" 
                class="w-full py-2 px-3 bg-slate-800/60 hover:bg-indigo-600 hover:text-white border border-slate-700/50 hover:border-transparent rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>➕</span> Aliment / Placard
              </button>
            </div>
          </div>
        `;
      }
    });
  }

  // 5. Remplir le total de la journée
  const totalDayCal = document.getElementById("total-day-cal");
  if (totalDayCal) totalDayCal.innerText = `${Math.round(metrics.consumed.calories)} kcal`;
  
  const totalDayProt = document.getElementById("total-day-prot");
  if (totalDayProt) totalDayProt.innerText = `${Math.round(metrics.consumed.protein)}g`;
  
  const totalDayCarb = document.getElementById("total-day-carb");
  if (totalDayCarb) totalDayCarb.innerText = `${Math.round(metrics.consumed.carbs)}g`;
  
  const totalDayFat = document.getElementById("total-day-fat");
  if (totalDayFat) totalDayFat.innerText = `${Math.round(metrics.consumed.fat)}g`;
}

// Fonction utilitaire pour rafraîchir une jauge circulaire SVG
function updateProgressGauge(id, consumed, target, unit, glowClass) {
  const percentText = document.getElementById(`percent-${id}`);
  const valText = document.getElementById(`val-${id}`);
  const circle = document.getElementById(`circle-${id}`);
  const card = document.getElementById(`card-${id}`);

  if (!circle || !percentText || !valText) return;

  const rawPercent = (consumed / target) * 100;
  const displayPercent = Math.round(rawPercent);
  
  percentText.innerText = `${displayPercent}%`;
  valText.innerText = `${Math.round(consumed)} / ${target} ${unit}`;

  // Gestion de la couleur si dépassement
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  
  // Limiter le pourcentage visuel du tracé à 100% maximum pour le calcul du offset
  const progressPercent = Math.min(rawPercent, 100);
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;
  
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = strokeDashoffset;

  if (consumed > target) {
    // Alerte Dépassement : Rouge / Rose vif
    circle.classList.remove("text-indigo-500", "text-emerald-500", "text-amber-500", "text-pink-500");
    circle.classList.add("text-rose-500", "glow-red");
    circle.classList.remove(glowClass);
    if (card) {
      card.classList.add("border-rose-500/30", "bg-rose-950/5", "pulse-exceeded");
    }
  } else {
    // Rétablir la couleur normale
    circle.classList.remove("text-rose-500", "glow-red");
    circle.classList.add(glowClass);
    if (card) {
      card.classList.remove("border-rose-500/30", "bg-rose-950/5", "pulse-exceeded");
    }

    // Réassigner la couleur propre par défaut
    if (id === "cal") circle.classList.add("text-indigo-500");
    else if (id === "prot") circle.classList.add("text-emerald-500");
    else if (id === "carb") circle.classList.add("text-amber-500");
    else if (id === "fat") circle.classList.add("text-pink-500");
  }
}

// Changer de jour actif
function setActiveDay(day) {
  if (DAYS.includes(day)) {
    state.activeDay = day;
    saveState();
    renderApp();
  }
}

// Basculer le statut d'un repas de "mangé" à "non mangé"
function toggleMeal(mealType, status) {
  toggleMealEaten(state.activeDay, mealType, status);
}

// Ouvrir la boîte de dialogue d'ajout de supplément avec un repas par défaut pré-sélectionné
function openSupplementModal(defaultMealType = "Collation") {
  const modal = document.getElementById("supplement-modal");
  if (modal) {
    // Réinitialiser les champs
    document.getElementById("supp-name").value = "";
    document.getElementById("supp-calories").value = "";
    document.getElementById("supp-protein").value = "";
    document.getElementById("supp-carbs").value = "";
    document.getElementById("supp-fat").value = "";
    
    const mealTypeSelect = document.getElementById("supp-meal-type");
    if (mealTypeSelect) {
      mealTypeSelect.value = defaultMealType;
    }
    
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

// Fermer la boîte de dialogue d'ajout de supplément
function closeSupplementModal() {
  const modal = document.getElementById("supplement-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

// Soumettre le formulaire d'ajout de supplément
function submitSupplementForm(e) {
  if (e) e.preventDefault();
  
  const name = document.getElementById("supp-name").value.trim() || "Supplément";
  const cal = parseFloat(document.getElementById("supp-calories").value) || 0;
  const prot = parseFloat(document.getElementById("supp-protein").value) || 0;
  const carb = parseFloat(document.getElementById("supp-carbs").value) || 0;
  const fat = parseFloat(document.getElementById("supp-fat").value) || 0;
  const mealType = document.getElementById("supp-meal-type").value;

  addSupplement(state.activeDay, name, cal, prot, carb, fat, mealType);
  closeSupplementModal();
}

// Variables pour le modal de changement de recette
let currentChangeMealType = "";

// Ouvrir la boîte de dialogue de changement de repas
function openChangeMealModal(mealType) {
  currentChangeMealType = mealType;
  const modal = document.getElementById("change-meal-modal");
  const listContainer = document.getElementById("change-meal-list");
  
  if (modal && listContainer) {
    listContainer.innerHTML = "";
    const recipes = getRecipesByType(mealType);

    recipes.forEach(recipe => {
      listContainer.innerHTML += `
        <div 
          onclick="selectNewMealRecipe('${recipe.id}')"
          class="flex items-center justify-between p-3 bg-slate-800/40 hover:bg-indigo-950/30 border border-slate-700/40 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all duration-150"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">${recipe.emoji}</span>
            <div>
              <h5 class="font-bold text-sm text-slate-200">${recipe.name}</h5>
              <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                <span>${recipe.calories} kcal</span>
                <span>•</span>
                <span>P: ${recipe.protein}g</span>
                <span>•</span>
                <span>G: ${recipe.carbs}g</span>
                <span>•</span>
                <span>L: ${recipe.fat}g</span>
              </div>
            </div>
          </div>
          <span class="text-xs font-bold text-indigo-400">Choisir →</span>
        </div>
      `;
    });

    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

// Sélectionner la nouvelle recette depuis le modal
function selectNewMealRecipe(recipeId) {
  if (currentChangeMealType) {
    updateMealRecipe(state.activeDay, currentChangeMealType, recipeId);
    closeChangeMealModal();
  }
}

// Fermer le modal de changement de repas
function closeChangeMealModal() {
  const modal = document.getElementById("change-meal-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

let currentDetailsRecipeId = null;
let currentDetailsMealType = null;

// Afficher les détails complets d'une recette dans un modal
function showRecipeDetails(recipeId, mealType = null) {
  currentDetailsRecipeId = recipeId;
  currentDetailsMealType = mealType;
  
  const recipe = getRecipeById(recipeId);
  const modal = document.getElementById("details-modal");
  if (!recipe || !modal) return;

  document.getElementById("details-title").innerText = `${recipe.emoji} ${recipe.name}`;
  document.getElementById("details-type").innerText = recipe.type;

  // Déterminer l'échelle initiale
  let initialScale = 1.0;
  if (mealType) {
    const dayName = state.activeDay;
    const day = state.days[dayName];
    if (day && day.meals[mealType] && day.meals[mealType].scale !== undefined) {
      initialScale = day.meals[mealType].scale;
    }
  }

  // Afficher ou masquer la section d'ajustement de portion
  const portionSliderContainer = document.getElementById("modal-portion-container");
  if (portionSliderContainer) {
    if (mealType) {
      portionSliderContainer.classList.remove("hidden");
      document.getElementById("modal-portion-text").innerText = `${Math.round(initialScale * 100)}%`;
    } else {
      portionSliderContainer.classList.add("hidden");
    }
  }

  // Mettre à jour l'affichage des macros et des ingrédients avec l'échelle courante
  updateDetailsModalContent(recipe, initialScale);

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

// Mettre à jour le contenu nutritionnel et les portions dans le modal
function updateDetailsModalContent(recipe, scale) {
  document.getElementById("details-cal").innerText = `${Math.round(recipe.calories * scale)} kcal`;
  document.getElementById("details-prot").innerText = `${Math.round(recipe.protein * scale * 10) / 10}g`;
  document.getElementById("details-carb").innerText = `${Math.round(recipe.carbs * scale * 10) / 10}g`;
  document.getElementById("details-fat").innerText = `${Math.round(recipe.fat * scale * 10) / 10}g`;

  const ingList = document.getElementById("details-ingredients");
  ingList.innerHTML = "";
  recipe.ingredients.forEach(ing => {
    const scaledQty = Math.round(ing.quantity * scale);
    const scaledCal = Math.round(ing.calories * scale);
    const scaledProt = Math.round(ing.protein * scale * 10) / 10;
    const scaledCarb = Math.round(ing.carbs * scale * 10) / 10;
    const scaledFat = Math.round(ing.fat * scale * 10) / 10;

    ingList.innerHTML += `
      <li class="p-3 bg-slate-950/30 border border-slate-800/80 rounded-xl flex flex-col gap-1 text-xs">
        <div class="flex justify-between items-center">
          <span class="font-bold text-slate-200">${ing.name}</span>
          <span class="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-lg font-semibold">${scaledQty} ${ing.unit}</span>
        </div>
        <div class="flex justify-between items-center text-[10px] text-slate-400 mt-1 pt-1.5 border-t border-slate-800/40">
          <span class="text-indigo-400 font-semibold">${scaledCal} kcal</span>
          <div class="flex gap-2">
            <span>P: <strong class="text-emerald-400">${scaledProt}g</strong></span>
            <span>G: <strong class="text-amber-500">${scaledCarb}g</strong></span>
            <span>L: <strong class="text-pink-500">${scaledFat}g</strong></span>
          </div>
        </div>
      </li>
    `;
  });
}

// Les portions sont désormais calculées automatiquement en arrière-plan

// Fermer le modal de détails
function closeDetailsModal() {
  const modal = document.getElementById("details-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function openQuickPlan() {
  const day = state.days[state.activeDay];
  
  // Choisir les premières recettes par type
  const b = getRecipesByType("Petit-déjeuner")[0];
  const l = getRecipesByType("Déjeuner/Dîner")[0];
  const s = getRecipesByType("Collation")[0];
  const d = getRecipesByType("Déjeuner/Dîner")[1] || l; // S'assurer que diner != déjeuner

  day.meals["Petit-déjeuner"].recipeId = b.id;
  day.meals["Déjeuner"].recipeId = l.id;
  day.meals["Collation"].recipeId = s.id;
  day.meals["Dîner"].recipeId = d.id;

  autoScaleDayMeals(state.activeDay);
  saveState();
  renderApp();
}

// Ouvrir la liste de courses en agrégeant tous les ingrédients de la semaine à l'échelle
function openShoppingList() {
  const modal = document.getElementById("shopping-modal");
  const container = document.getElementById("shopping-list-content");
  if (!modal || !container) return;

  const ingredientsMap = {};

  // Parcourir tous les jours et repas planifiés de la semaine
  DAYS.forEach(dayName => {
    const day = state.days[dayName];
    Object.keys(day.meals).forEach(mealType => {
      const meal = day.meals[mealType];
      if (meal.recipeId) {
        const recipe = getRecipeById(meal.recipeId);
        if (recipe) {
          const scale = meal.scale !== undefined ? meal.scale : 1.0;
          recipe.ingredients.forEach(ing => {
            const key = ing.name.trim().toLowerCase();
            const scaledQty = ing.quantity * scale;
            if (ingredientsMap[key]) {
              ingredientsMap[key].quantity += scaledQty;
            } else {
              ingredientsMap[key] = {
                name: ing.name,
                quantity: scaledQty,
                unit: ing.unit
              };
            }
          });
        }
      }
    });
  });

  const list = Object.values(ingredientsMap).sort((a, b) => a.name.localeCompare(b.name));

  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <span class="text-4xl mb-3">🛒</span>
        <p class="text-xs">Votre planning de la semaine est vide. Générez un menu pour voir votre liste de courses !</p>
      </div>
    `;
  } else {
    let html = `<ul class="space-y-2">`;
    list.forEach(item => {
      let qtyStr = "";
      if (item.quantity > 0) {
        const roundedQty = Math.round(item.quantity * 10) / 10;
        qtyStr = `${roundedQty} ${item.unit}`;
      }
      
      html += `
        <li class="flex items-center justify-between p-3 bg-slate-950/20 border border-slate-800/60 hover:bg-slate-950/40 rounded-xl transition-all">
          <label class="flex items-center gap-3 cursor-pointer select-none text-xs text-slate-200 w-full font-medium">
            <input type="checkbox" class="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer accent-indigo-500">
            <span>${item.name}</span>
          </label>
          <span class="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg shrink-0">${qtyStr}</span>
        </li>
      `;
    });
    html += `</ul>`;
    container.innerHTML = html;
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

// Fermer la liste de courses
function closeShoppingList() {
  const modal = document.getElementById("shopping-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

// Copier la liste de courses sous forme de texte brut avec des cases à cocher markdown
function copyShoppingList() {
  const ingredientsMap = {};

  DAYS.forEach(dayName => {
    const day = state.days[dayName];
    Object.keys(day.meals).forEach(mealType => {
      const meal = day.meals[mealType];
      if (meal.recipeId) {
        const recipe = getRecipeById(meal.recipeId);
        if (recipe) {
          const scale = meal.scale !== undefined ? meal.scale : 1.0;
          recipe.ingredients.forEach(ing => {
            const key = ing.name.trim().toLowerCase();
            const scaledQty = ing.quantity * scale;
            if (ingredientsMap[key]) {
              ingredientsMap[key].quantity += scaledQty;
            } else {
              ingredientsMap[key] = {
                name: ing.name,
                quantity: scaledQty,
                unit: ing.unit
              };
            }
          });
        }
      }
    });
  });

  const list = Object.values(ingredientsMap).sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    alert("Votre liste de courses est vide !");
    return;
  }

  let text = "🛒 MA LISTE DE COURSES - NURTURE\n\n";
  list.forEach(item => {
    const roundedQty = Math.round(item.quantity * 10) / 10;
    text += `- [ ] ${item.name} : ${roundedQty} ${item.unit}\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    alert("Liste de courses copiée dans le presse-papier !");
  }).catch(err => {
    console.error("Erreur lors de la copie de la liste :", err);
    alert("Copie impossible. Veuillez copier le texte manuellement.");
  });
}

// ==============================================
// GESTION DU MODAL DE RÉGLAGES & RECETTES
// ==============================================

// Ouvrir le modal de réglages
function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    // Initialiser les préférences
    const prefBreakfast = document.getElementById("pref-breakfast");
    const prefSnack = document.getElementById("pref-snack");
    if (prefBreakfast) prefBreakfast.checked = !!state.preferences.includeBreakfast;
    if (prefSnack) prefSnack.checked = !!state.preferences.includeSnack;
    
    // Afficher l'onglet par défaut
    switchSettingsTab("preferences");
    
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

// Fermer le modal de réglages
function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

// Changer d'onglet dans le modal de réglages
function switchSettingsTab(tabName) {
  const tabs = {
    preferences: { tabId: "tab-set-pref", panelId: "panel-set-preferences" },
    recipes: { tabId: "tab-set-rec", panelId: "panel-set-recipes" },
    create: { tabId: "tab-set-create", panelId: "panel-set-create" }
  };

  Object.keys(tabs).forEach(key => {
    const tabEl = document.getElementById(tabs[key].tabId);
    const panelEl = document.getElementById(tabs[key].panelId);
    
    if (key === tabName) {
      if (tabEl) {
        tabEl.classList.remove("border-transparent", "text-slate-400");
        tabEl.classList.add("border-indigo-500", "text-indigo-400");
      }
      if (panelEl) panelEl.classList.remove("hidden");
    } else {
      if (tabEl) {
        tabEl.classList.remove("border-indigo-500", "text-indigo-400");
        tabEl.classList.add("border-transparent", "text-slate-400", "hover:text-white");
      }
      if (panelEl) panelEl.classList.add("hidden");
    }
  });

  // Si on ouvre l'onglet recettes, on rafraîchit la liste
  if (tabName === "recipes") {
    renderSettingsRecipesList();
  }
  // Si on ouvre l'onglet créer recette, on s'assure qu'au moins une ligne d'ingrédient existe
  if (tabName === "create") {
    const list = document.getElementById("custom-recipe-ingredients");
    if (list && list.children.length === 0) {
      addNewIngredientRow();
    }
  }
}

// Mettre à jour les préférences de génération
function updatePreferencesFromUI() {
  const prefBreakfast = document.getElementById("pref-breakfast");
  const prefSnack = document.getElementById("pref-snack");
  if (prefBreakfast && prefSnack) {
    state.preferences.includeBreakfast = prefBreakfast.checked;
    state.preferences.includeSnack = prefSnack.checked;
    
    // Si un repas est désactivé, on retire la planification actuelle pour la recalculer/libérer
    DAYS.forEach(dayName => {
      const day = state.days[dayName];
      let changed = false;
      if (!state.preferences.includeBreakfast && day.meals["Petit-déjeuner"].recipeId !== null) {
        day.meals["Petit-déjeuner"].recipeId = null;
        day.meals["Petit-déjeuner"].scale = 1.0;
        day.meals["Petit-déjeuner"].eaten = false;
        changed = true;
      }
      if (!state.preferences.includeSnack && day.meals["Collation"].recipeId !== null) {
        day.meals["Collation"].recipeId = null;
        day.meals["Collation"].scale = 1.0;
        day.meals["Collation"].eaten = false;
        changed = true;
      }
      if (changed) {
        autoScaleDayMeals(dayName);
      }
    });
    
    saveState();
    renderApp();
  }
}

// Rendre la liste des recettes cochables
function renderSettingsRecipesList() {
  const container = document.getElementById("settings-recipes-list");
  if (!container) return;
  
  container.innerHTML = "";
  const allRecipes = getAllRecipes();
  
  if (allRecipes.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Aucune recette disponible.</p>`;
    return;
  }
  
  const types = ["Petit-déjeuner", "Déjeuner/Dîner", "Collation"];
  
  types.forEach(type => {
    const typeRecipes = allRecipes.filter(r => r.type === type);
    if (typeRecipes.length > 0) {
      const typeHeader = document.createElement("div");
      typeHeader.className = "text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 mt-3 mb-1.5 text-left";
      typeHeader.innerText = type;
      container.appendChild(typeHeader);
      
      typeRecipes.forEach(recipe => {
        const isAllowed = !state.disabledRecipeIds.includes(recipe.id);
        const item = document.createElement("div");
        item.className = "flex items-center justify-between p-2.5 bg-slate-950/20 hover:bg-slate-950/40 border border-slate-850 rounded-xl transition-all";
        
        item.innerHTML = `
          <label class="flex items-center gap-3 cursor-pointer select-none text-xs text-slate-200 w-full font-semibold">
            <input 
              type="checkbox" 
              ${isAllowed ? "checked" : ""} 
              onchange="toggleRecipeAllowed('${recipe.id}', this.checked)"
              class="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500 cursor-pointer accent-indigo-500"
            >
            <span class="text-base select-none">${recipe.emoji}</span>
            <div class="flex flex-col text-left">
              <span>${recipe.name}</span>
              <span class="text-[9px] text-slate-400 font-normal">
                ${recipe.calories} kcal • P: ${recipe.protein}g • G: ${recipe.carbs}g • L: ${recipe.fat}g
              </span>
            </div>
          </label>
        `;
        container.appendChild(item);
      });
    }
  });
}

// Activer / désactiver une recette
function toggleRecipeAllowed(recipeId, allowed) {
  if (allowed) {
    state.disabledRecipeIds = state.disabledRecipeIds.filter(id => id !== recipeId);
  } else {
    if (!state.disabledRecipeIds.includes(recipeId)) {
      state.disabledRecipeIds.push(recipeId);
    }
  }
  saveState();
}

// Cocher / Décocher tout
function toggleAllRecipesCheck(allowed) {
  const allRecipes = getAllRecipes();
  if (allowed) {
    state.disabledRecipeIds = [];
  } else {
    state.disabledRecipeIds = allRecipes.map(r => r.id);
  }
  saveState();
  renderSettingsRecipesList();
}

// Ajouter une nouvelle ligne d'ingrédient
function addNewIngredientRow() {
  const container = document.getElementById("custom-recipe-ingredients");
  if (!container) return;
  
  const rowId = "ing-row-" + Date.now() + Math.random().toString(36).substr(2, 5);
  const row = document.createElement("div");
  row.id = rowId;
  row.className = "p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2.5 relative animate-fade-in";
  
  row.innerHTML = `
    <div class="grid grid-cols-12 gap-2 items-center">
      <div class="col-span-6">
        <input 
          type="text" 
          placeholder="Nom de l'ingrédient" 
          required 
          class="ing-name w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-650 outline-none transition-all"
        >
      </div>
      <div class="col-span-3">
        <input 
          type="number" 
          placeholder="Qté" 
          min="1" 
          required 
          class="ing-qty w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-center text-xs text-slate-200 placeholder-slate-650 outline-none transition-all"
        >
      </div>
      <div class="col-span-2">
        <input 
          type="text" 
          placeholder="Unité" 
          value="g" 
          required 
          class="ing-unit w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-1 py-1.5 text-center text-xs text-slate-200 placeholder-slate-650 outline-none transition-all"
        >
      </div>
      <div class="col-span-1 flex justify-center">
        <button 
          type="button" 
          onclick="removeIngredientRow('${rowId}')" 
          class="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all cursor-pointer"
          title="Supprimer cet ingrédient"
        >
          🗑️
        </button>
      </div>
    </div>
    
    <div class="grid grid-cols-4 gap-2 text-[10px]">
      <div>
        <label class="block text-slate-500 mb-0.5 font-semibold text-[9px] uppercase">Cal (kcal)</label>
        <input 
          type="number" 
          placeholder="0" 
          min="0" 
          required 
          class="ing-cal w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-center text-slate-200 outline-none transition-all"
        >
      </div>
      <div>
        <label class="block text-slate-500 mb-0.5 font-semibold text-[9px] uppercase">Prot (g)</label>
        <input 
          type="number" 
          placeholder="0" 
          min="0" 
          step="0.1" 
          required 
          class="ing-prot w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-center text-slate-200 outline-none transition-all"
        >
      </div>
      <div>
        <label class="block text-slate-500 mb-0.5 font-semibold text-[9px] uppercase">Gluc (g)</label>
        <input 
          type="number" 
          placeholder="0" 
          min="0" 
          step="0.1" 
          required 
          class="ing-carb w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-center text-slate-200 outline-none transition-all"
        >
      </div>
      <div>
        <label class="block text-slate-500 mb-0.5 font-semibold text-[9px] uppercase">Lipi (g)</label>
        <input 
          type="number" 
          placeholder="0" 
          min="0" 
          step="0.1" 
          required 
          class="ing-fat w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 rounded-lg px-1.5 py-1 text-center text-slate-200 outline-none transition-all"
        >
      </div>
    </div>
  `;
  container.appendChild(row);
}

// Supprimer une ligne d'ingrédient
function removeIngredientRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
  }
}

// Enregistrer la recette personnalisée
function submitCustomRecipeForm(e) {
  if (e) e.preventDefault();
  
  const nameInput = document.getElementById("new-rec-name");
  const emojiInput = document.getElementById("new-rec-emoji");
  const typeSelect = document.getElementById("new-rec-type");
  
  if (!nameInput || !emojiInput || !typeSelect) return;
  
  const name = nameInput.value.trim();
  const emoji = emojiInput.value.trim() || "🥣";
  const type = typeSelect.value;
  
  const ingredientRows = document.getElementById("custom-recipe-ingredients").children;
  if (ingredientRows.length === 0) {
    alert("Veuillez ajouter au moins un ingrédient à votre recette.");
    return;
  }
  
  const ingredientsList = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  for (let i = 0; i < ingredientRows.length; i++) {
    const row = ingredientRows[i];
    const ingName = row.querySelector(".ing-name").value.trim();
    const ingQty = parseFloat(row.querySelector(".ing-qty").value) || 0;
    const ingUnit = row.querySelector(".ing-unit").value.trim() || "g";
    const ingCal = parseFloat(row.querySelector(".ing-cal").value) || 0;
    const ingProt = parseFloat(row.querySelector(".ing-prot").value) || 0;
    const ingCarb = parseFloat(row.querySelector(".ing-carb").value) || 0;
    const ingFat = parseFloat(row.querySelector(".ing-fat").value) || 0;
    
    ingredientsList.push({
      name: ingName,
      quantity: ingQty,
      unit: ingUnit,
      calories: Math.round(ingCal),
      protein: Math.round(ingProt * 10) / 10,
      carbs: Math.round(ingCarb * 10) / 10,
      fat: Math.round(ingFat * 10) / 10
    });
    
    totalCalories += ingCal;
    totalProtein += ingProt;
    totalCarbs += ingCarb;
    totalFat += ingFat;
  }
  
  const customRecipe = {
    id: "custom_" + Date.now() + Math.random().toString(36).substr(2, 5),
    name: name,
    type: type,
    calories: Math.round(totalCalories),
    protein: Math.round(totalProtein * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
    emoji: emoji,
    ingredients: ingredientsList
  };
  
  // Envoyer la recette au serveur API pour la partager
  fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customRecipe)
  })
  .then(res => {
    if (res.ok) {
      // Ajouter localement à la liste partagée pour mise à jour immédiate
      if (!databaseRecipes.some(r => r.id === customRecipe.id)) {
        databaseRecipes.push(customRecipe);
      }
      renderApp();
    } else {
      console.error("Échec de l'enregistrement de la recette sur le serveur API.");
    }
  })
  .catch(err => {
    console.error("Erreur réseau lors de l'enregistrement de la recette :", err);
  });

  // Enregistrer également localement dans state.customRecipes (sauvegarde locale/offline-first)
  if (!state.customRecipes) {
    state.customRecipes = [];
  }
  if (!state.customRecipes.some(r => r.id === customRecipe.id)) {
    state.customRecipes.push(customRecipe);
  }
  saveState();
  
  // Réinitialiser le formulaire
  nameInput.value = "";
  emojiInput.value = "🥣";
  document.getElementById("custom-recipe-ingredients").innerHTML = "";
  addNewIngredientRow();
  
  alert("Recette enregistrée avec succès !");
  switchSettingsTab("recipes");
}

// Initialisation au chargement de la page
window.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderApp();
  fetchDatabaseRecipes();

  // Événements de fermetures sur les modals en cliquant en dehors
  window.addEventListener("click", (e) => {
    const suppModal = document.getElementById("supplement-modal");
    if (e.target === suppModal) closeSupplementModal();

    const changeModal = document.getElementById("change-meal-modal");
    if (e.target === changeModal) closeChangeMealModal();

    const detailsModal = document.getElementById("details-modal");
    if (e.target === detailsModal) closeDetailsModal();

    const shoppingModal = document.getElementById("shopping-modal");
    if (e.target === shoppingModal) closeShoppingList();

    const settingsModal = document.getElementById("settings-modal");
    if (e.target === settingsModal) closeSettingsModal();
  });
});
