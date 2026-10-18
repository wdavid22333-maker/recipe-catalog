// Sample data for demonstration
let recipes = [
    {
        id: 1,
        name: "Grandma's Apple Pie",
        ingredients: "- 6 cups sliced apples
- 3/4 cup sugar
- 2 tbsp flour
- 3/4 tsp cinnamon
- 1/4 tsp nutmeg
- 2 pie crusts",
        instructions: "1. Preheat oven to 425°F
2. Mix sugar, flour, and spices
3. Layer apples in crust
4. Cover with top crust and seal
5. Bake 40-50 minutes",
        notes: "Try with Granny Smith apples for tartness",
        rating: 5
    }
];

// DOM Elements
let recipeList, recipeFormSection, newRecipeForm, addRecipeButton, cancelFormButton;

// Initialize DOM elements when the page loads
document.addEventListener('DOMContentLoaded', function() {
    recipeList = document.getElementById('recipes');
    recipeFormSection = document.getElementById('recipe-form');
    newRecipeForm = document.getElementById('new-recipe-form');
    addRecipeButton = document.getElementById('add-recipe');
    cancelFormButton = document.getElementById('cancel-form');

    // Event Listeners
    addRecipeButton.addEventListener('click', showRecipeForm);
    cancelFormButton.addEventListener('click', hideRecipeForm);
    newRecipeForm.addEventListener('submit', addRecipe);

    // Initialize
    loadRecipes();
});

// Load recipes from localStorage or use sample data
function loadRecipes() {
    const storedRecipes = localStorage.getItem('recipes');
    if (storedRecipes) {
        recipes = JSON.parse(storedRecipes);
    }
    displayRecipes();
}

// Save recipes to localStorage
function saveRecipes() {
    localStorage.setItem('recipes', JSON.stringify(recipes));
}

// Display all recipes
function displayRecipes() {
    if (!recipeList) return; // Guard clause if element not found

    recipeList.innerHTML = '';
    recipes.forEach(recipe => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        recipeCard.innerHTML = `
            <h3>${recipe.name}</h3>
            <p><strong>Ingredients:</strong><br>${recipe.ingredients.replace(/
/g, '<br>')}</p>
            <p><strong>Instructions:</strong><br>${recipe.instructions.replace(/
/g, '<br>')}</p>
            <p><strong>Notes:</strong><br>${recipe.notes ? recipe.notes.replace(/
/g, '<br>') : 'No notes yet'}</p>
            <p class="rating"><strong>Rating:</strong> ${'★'.repeat(recipe.rating)}${'☆'.repeat(5 - recipe.rating)}</p>
            <button onclick="editRecipe(${recipe.id})">Edit</button>
            <button onclick="deleteRecipe(${recipe.id})">Delete</button>
        `;
        recipeList.appendChild(recipeCard);
    });
}

// Show the recipe form
function showRecipeForm() {
    if (!recipeFormSection || !newRecipeForm) return; // Guard clause if elements not found

    recipeFormSection.classList.remove('hidden');
    newRecipeForm.reset();
    document.getElementById('name').focus();
}

// Hide the recipe form
function hideRecipeForm() {
    if (!recipeFormSection) return; // Guard clause if element not found

    recipeFormSection.classList.add('hidden');
}

// Add a new recipe
function addRecipe(event) {
    event.preventDefault();

    const name = document.getElementById('name').value;
    const ingredients = document.getElementById('ingredients').value;
    const instructions = document.getElementById('instructions').value;
    const notes = document.getElementById('notes').value;
    const rating = parseInt(document.getElementById('rating').value) || 0;

    const newRecipe = {
        id: Date.now(), // Unique ID based on timestamp
        name,
        ingredients,
        instructions,
        notes,
        rating
    };

    recipes.push(newRecipe);
    saveRecipes();
    displayRecipes();
    hideRecipeForm();
}

// Edit a recipe
function editRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    document.getElementById('name').value = recipe.name;
    document.getElementById('ingredients').value = recipe.ingredients;
    document.getElementById('instructions').value = recipe.instructions;
    document.getElementById('notes').value = recipe.notes;
    document.getElementById('rating').value = recipe.rating;

    // Remove the existing recipe
    recipes = recipes.filter(r => r.id !== id);

    showRecipeForm();
}

// Delete a recipe
function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        recipes = recipes.filter(r => r.id !== id);
        saveRecipes();
        displayRecipes();
    }
}
