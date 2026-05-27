// Base de données des recettes du Planificateur de Repas Intelligent (Plats exclusifs)
const RECIPES = [
  {
    id: "m_user1",
    name: "Poulet, Riz et Courgettes",
    type: "Déjeuner/Dîner",
    calories: 410,
    protein: 32,
    carbs: 45,
    fat: 10,
    emoji: "🍗",
    ingredients: [
      { name: "Blanc de poulet", quantity: 110, unit: "g", calories: 132, protein: 26, carbs: 0, fat: 3 },
      { name: "Riz basmati cuit", quantity: 140, unit: "g", calories: 182, protein: 3.8, carbs: 40, fat: 0.4 },
      { name: "Courgettes sautées", quantity: 150, unit: "g", calories: 50, protein: 1.8, carbs: 5, fat: 3 },
      { name: "Huile d'olive", quantity: 1, unit: "cc", calories: 45, protein: 0, carbs: 0, fat: 5 }
    ]
  },
  {
    id: "m_user2",
    name: "Omelette aux épinards et pain complet",
    type: "Déjeuner/Dîner",
    calories: 350,
    protein: 22,
    carbs: 25,
    fat: 17,
    emoji: "🍳",
    ingredients: [
      { name: "Œufs entiers", quantity: 2, unit: "pièces", calories: 150, protein: 13, carbs: 1, fat: 10 },
      { name: "Blancs d'œufs", quantity: 1, unit: "pièce", calories: 17, protein: 4, carbs: 0, fat: 0 },
      { name: "Épinards frais", quantity: 100, unit: "g", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
      { name: "Pain complet", quantity: 1, unit: "grande tranche", calories: 160, protein: 6, carbs: 26.4, fat: 1.6 }
    ]
  },
  {
    id: "m_user3",
    name: "Pavé de Saumon, Quinoa et Asperges",
    type: "Déjeuner/Dîner",
    calories: 490,
    protein: 34,
    carbs: 34,
    fat: 25,
    emoji: "🍣",
    ingredients: [
      { name: "Pavé de saumon frais", quantity: 120, unit: "g", calories: 250, protein: 25, carbs: 0, fat: 17 },
      { name: "Quinoa cuit", quantity: 130, unit: "g", calories: 160, protein: 6, carbs: 28, fat: 2.5 },
      { name: "Asperges vertes grillées", quantity: 150, unit: "g", calories: 30, protein: 3, carbs: 5, fat: 0.2 },
      { name: "Huile d'olive", quantity: 1, unit: "cc", calories: 45, protein: 0, carbs: 0, fat: 5 },
      { name: "Jus de citron", quantity: 10, unit: "ml", calories: 5, protein: 0, carbs: 1, fat: 0 }
    ]
  },
  {
    id: "breakfast_1",
    name: "Bowl d'avoine et fruits rouges",
    type: "Petit-déjeuner",
    calories: 320,
    protein: 12,
    carbs: 52,
    fat: 7,
    emoji: "🥣",
    ingredients: [
      { name: "Flocons d'avoine", quantity: 50, unit: "g", calories: 185, protein: 6.5, carbs: 33, fat: 3.5 },
      { name: "Lait d'amande sans sucre", quantity: 200, unit: "ml", calories: 30, protein: 1, carbs: 0.5, fat: 2.5 },
      { name: "Whey protéine", quantity: 10, unit: "g", calories: 40, protein: 8, carbs: 1, fat: 0.5 },
      { name: "Fruits rouges", quantity: 80, unit: "g", calories: 40, protein: 0.8, carbs: 8.5, fat: 0.3 },
      { name: "Graines de chia", quantity: 5, unit: "g", calories: 25, protein: 0.8, carbs: 9, fat: 0.2 }
    ]
  },
  {
    id: "breakfast_2",
    name: "Pancakes protéinés",
    type: "Petit-déjeuner",
    calories: 380,
    protein: 25,
    carbs: 42,
    fat: 8,
    emoji: "🥞",
    ingredients: [
      { name: "Farine d'avoine", quantity: 50, unit: "g", calories: 185, protein: 6.5, carbs: 33, fat: 3.5 },
      { name: "Blanc d'œuf", quantity: 2, unit: "pièces", calories: 34, protein: 8, carbs: 0, fat: 0 },
      { name: "Fromage blanc 0%", quantity: 100, unit: "g", calories: 50, protein: 8, carbs: 4, fat: 0 },
      { name: "Banane", quantity: 50, unit: "g", calories: 45, protein: 0.5, carbs: 11, fat: 0.1 },
      { name: "Huile de coco", quantity: 5, unit: "g", calories: 45, protein: 0, carbs: 0, fat: 5 }
    ]
  },
  {
    id: "breakfast_3",
    name: "Tartines Avocat & Œuf Poché",
    type: "Petit-déjeuner",
    calories: 350,
    protein: 16,
    carbs: 28,
    fat: 18,
    emoji: "🥑",
    ingredients: [
      { name: "Pain de seigle", quantity: 60, unit: "g", calories: 150, protein: 5, carbs: 27, fat: 1 },
      { name: "Avocat", quantity: 50, unit: "g", calories: 80, protein: 1, carbs: 4, fat: 7.5 },
      { name: "Œuf poché", quantity: 1, unit: "pièce", calories: 75, protein: 6.5, carbs: 0.5, fat: 5 },
      { name: "Fromage frais type St-Morêt light", quantity: 20, unit: "g", calories: 45, protein: 3.5, carbs: 1.5, fat: 4.5 }
    ]
  },
  {
    id: "snack_1",
    name: "Shaker Protéiné & Amandes",
    type: "Collation",
    calories: 210,
    protein: 23,
    carbs: 5,
    fat: 10,
    emoji: "🥤",
    ingredients: [
      { name: "Whey isolate", quantity: 25, unit: "g", calories: 95, protein: 21, carbs: 1, fat: 0.5 },
      { name: "Amandes", quantity: 15, unit: "g", calories: 90, protein: 3, carbs: 3, fat: 8 },
      { name: "Chocolat noir 85%", quantity: 10, unit: "g", calories: 55, protein: 1, carbs: 2.5, fat: 4.5 }
    ]
  },
  {
    id: "snack_2",
    name: "Fromage blanc aux noix et miel",
    type: "Collation",
    calories: 190,
    protein: 14,
    carbs: 18,
    fat: 6,
    emoji: "🍯",
    ingredients: [
      { name: "Fromage blanc 0%", quantity: 200, unit: "g", calories: 100, protein: 16, carbs: 8, fat: 0 },
      { name: "Cerneaux de noix", quantity: 10, unit: "g", calories: 65, protein: 1.5, carbs: 1.5, fat: 6 },
      { name: "Miel bio", quantity: 7, unit: "g", calories: 22, protein: 0, carbs: 6, fat: 0 }
    ]
  },
  {
    id: "snack_3",
    name: "Pomme & Beurre de cacahuète",
    type: "Collation",
    calories: 170,
    protein: 4,
    carbs: 22,
    fat: 8,
    emoji: "🍏",
    ingredients: [
      { name: "Pomme", quantity: 150, unit: "g", calories: 80, protein: 0.5, carbs: 20, fat: 0.2 },
      { name: "Beurre de cacahuète", quantity: 15, unit: "g", calories: 90, protein: 3.5, carbs: 2, fat: 8 }
    ]
  },
  {
    id: "salade_thon_pdt",
    name: "Salade Thon & Pommes de Terre",
    type: "Déjeuner/Dîner",
    calories: 415,
    protein: 38,
    carbs: 49,
    fat: 7,
    emoji: "🥗",
    ingredients: [
      { name: "Pommes de terre", quantity: 200, unit: "g", calories: 160, protein: 4, carbs: 36, fat: 0 },
      { name: "Thon au naturel", quantity: 90, unit: "g", calories: 100, protein: 22, carbs: 0, fat: 1 },
      { name: "Maïs", quantity: 50, unit: "g", calories: 50, protein: 2, carbs: 8, fat: 1 },
      { name: "Yaourt Grec 0%", quantity: 125, unit: "g", calories: 60, protein: 10, carbs: 5, fat: 0 },
      { name: "Huile d'olive", quantity: 5, unit: "g", calories: 45, protein: 0, carbs: 0, fat: 5 }
    ]
  }
];