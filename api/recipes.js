const { MongoClient } = require('mongodb');
const defaultRecipes = require('../recipes-seed.json');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
  }

  const client = await MongoClient.connect(uri);
  const db = client.db('nurture');

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

module.exports = async (req, res) => {
  // Configurer les entêtes CORS pour autoriser l'accès depuis n'importe quelle origine sur Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('recipes');

    if (req.method === 'GET') {
      const recipes = await collection.find({}).toArray();

      // Si la collection est vide dans MongoDB, on insère et retourne les recettes par défaut
      if (recipes.length === 0) {
        await collection.insertMany(defaultRecipes);
        return res.status(200).json(defaultRecipes);
      }

      return res.status(200).json(recipes);
    }

    if (req.method === 'POST') {
      const newRecipe = req.body;
      if (!newRecipe || !newRecipe.name || !newRecipe.type || !newRecipe.id) {
        return res.status(400).json({ error: 'Recipe structure is invalid' });
      }

      // Nettoyer et valider le format de la recette pour MongoDB
      const recipeToInsert = {
        id: newRecipe.id,
        name: newRecipe.name,
        type: newRecipe.type,
        calories: Number(newRecipe.calories) || 0,
        protein: Number(newRecipe.protein) || 0,
        carbs: Number(newRecipe.carbs) || 0,
        fat: Number(newRecipe.fat) || 0,
        emoji: newRecipe.emoji || "🍽️",
        ingredients: newRecipe.ingredients || []
      };

      await collection.insertOne(recipeToInsert);
      return res.status(201).json({ success: true, recipe: recipeToInsert });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
