const BASE_URL = 'http://127.0.0.1:8000/api';
const ML_URL = 'http://127.0.0.1:8001';

async function loginApi(username, password) {
    try {
        const response = await fetch(`${BASE_URL}/token/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            throw new Error('Login failed');
        }
        
        const data = await response.json();
        
        // Save tokens
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        
        return data;
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
}

function logoutApi() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    // Clear dashboard data as well
    localStorage.removeItem('fitmacro_meals');
    localStorage.removeItem('fitmacro_goal');
}

// Function to attach JWT token to authenticated requests
async function fetchWithAuth(url, options = {}) {
    let token = localStorage.getItem('access_token');
    
    if (!token) {
        throw new Error('No access token found');
    }
    
    let headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    
    let updatedOptions = { ...options, headers };
    
    let response = await fetch(url, updatedOptions);
    
    // If token expired, try to refresh it
    if (response.status === 401) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
            const refreshResponse = await fetch(`${BASE_URL}/token/refresh/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh: refreshToken })
            });
            
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                localStorage.setItem('access_token', refreshData.access);
                
                // Retry original request
                headers['Authorization'] = `Bearer ${refreshData.access}`;
                updatedOptions.headers = headers;
                response = await fetch(url, updatedOptions);
            } else {
                // Refresh failed, logout
                logoutApi();
                window.location.reload();
            }
        } else {
            logoutApi();
        }
    }
    
    return response;
}

/* ==========================================================================
   Calorie Tracker & Macro Dashboard State Management & Logic
   ========================================================================== */

const GOALS = {
    'weight-loss': {
        name: 'Weight Loss',
        calories: 1600,
        protein: 120,
        carbs: 160,
        fats: 53
    },
    'maintenance': {
        name: 'Maintenance',
        calories: 2000,
        protein: 100,
        carbs: 250,
        fats: 67
    },
    'muscle-gain': {
        name: 'Muscle Gain',
        calories: 2500,
        protein: 150,
        carbs: 300,
        fats: 78
    }
};

// Local food database for autocomplete search (per 100g)
const FOOD_DATABASE = [
    { name: "Pizza", calories: 266, protein: 11, carbs: 33, fats: 10 },
    { name: "Hotdog", calories: 290, protein: 10, carbs: 26, fats: 16 },
    { name: "Cheeseburger", calories: 263, protein: 14, carbs: 28, fats: 11 },
    { name: "Bagel", calories: 250, protein: 10, carbs: 48, fats: 1.5 },
    { name: "Spaghetti Carbonara", calories: 200, protein: 8, carbs: 25, fats: 8 },
    { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fats: 0.3 },
    { name: "Strawberry", calories: 32, protein: 0.7, carbs: 7.7, fats: 0.3 },
    { name: "Orange", calories: 47, protein: 0.9, carbs: 12, fats: 0.1 },
    { name: "Lemon", calories: 29, protein: 1.1, carbs: 9, fats: 0.3 },
    { name: "Pineapple", calories: 50, protein: 0.5, carbs: 13, fats: 0.1 },
    { name: "Mushroom", calories: 22, protein: 3.1, carbs: 3.3, fats: 0.3 },
    { name: "Bell Pepper", calories: 20, protein: 0.9, carbs: 4.6, fats: 0.2 },
    { name: "Croissant", calories: 406, protein: 8, carbs: 46, fats: 21 },
    { name: "Pretzel", calories: 380, protein: 10, carbs: 80, fats: 3 },
    { name: "Mashed Potato", calories: 88, protein: 1.8, carbs: 17, fats: 1.5 },
    { name: "Guacamole", calories: 157, protein: 2, carbs: 9, fats: 15 },
    { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fats: 3.6 },
    { name: "Oatmeal", calories: 389, protein: 16.9, carbs: 66, fats: 6.9 },
    { name: "Brown Rice", calories: 111, protein: 2.6, carbs: 23, fats: 0.9 },
    { name: "Egg", calories: 155, protein: 13, carbs: 1.1, fats: 11 },
    { name: "Salmon", calories: 208, protein: 20, carbs: 0, fats: 13 },
    { name: "Salad", calories: 15, protein: 0.9, carbs: 3, fats: 0.2 },
    { name: "French Bread", calories: 272, protein: 9, carbs: 52, fats: 2.5 },
    { name: "Ice Cream", calories: 207, protein: 3.5, carbs: 24, fats: 11 },
    { name: "Zucchini", calories: 17, protein: 1.2, carbs: 3.1, fats: 0.3 },
    { name: "Broccoli", calories: 34, protein: 2.8, carbs: 7.0, fats: 0.4 },
    { name: "Cauliflower", calories: 25, protein: 1.9, carbs: 5.0, fats: 0.3 },
    { name: "Pomegranate", calories: 83, protein: 1.7, carbs: 19, fats: 1.2 },
    { name: "Fig", calories: 74, protein: 0.8, carbs: 19, fats: 0.3 }
];

let appState = {
    currentGoal: 'weight-loss',
    loggedMeals: [],
    warningShownThisSession: false
};

// Load initial state
function loadDashboardData() {
    // Load Goal
    const savedGoal = localStorage.getItem('fitmacro_goal');
    if (savedGoal && GOALS[savedGoal]) {
        appState.currentGoal = savedGoal;
    } else {
        appState.currentGoal = 'weight-loss';
    }
    
    // Load Meals
    const savedMeals = localStorage.getItem('fitmacro_meals');
    if (savedMeals) {
        try {
            appState.loggedMeals = JSON.parse(savedMeals);
        } catch (e) {
            appState.loggedMeals = [];
        }
    } else {
        appState.loggedMeals = [];
    }

    // Reset warning state on fresh reload
    appState.warningShownThisSession = false;

    // Apply goal to UI buttons
    document.querySelectorAll('.goal-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`goal-${appState.currentGoal}`);
    if (activeBtn) activeBtn.classList.add('active');

    updateDashboard();
    renderMealHistory();
}

// Switch current fitness goal
function setGoal(goalId) {
    if (!GOALS[goalId]) return;
    appState.currentGoal = goalId;
    localStorage.setItem('fitmacro_goal', goalId);
    
    // Update goal button states
    document.querySelectorAll('.goal-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`goal-${goalId}`).classList.add('active');
    
    // Recalculate
    updateDashboard();
}

// Calculate totals and update progress meters
function updateDashboard() {
    const goalConfig = GOALS[appState.currentGoal];
    
    // Recalculate totals
    let totalCalories = 0;
    let totalProtein = 0.0;
    let totalCarbs = 0.0;
    let totalFats = 0.0;
    
    appState.loggedMeals.forEach(meal => {
        totalCalories += Number(meal.calories);
        totalProtein += Number(meal.protein);
        totalCarbs += Number(meal.carbs);
        totalFats += Number(meal.fats);
    });
    
    totalCalories = Math.round(totalCalories);
    totalProtein = Math.round(totalProtein * 10) / 10;
    totalCarbs = Math.round(totalCarbs * 10) / 10;
    totalFats = Math.round(totalFats * 10) / 10;

    // Update Text Elements
    document.getElementById('current-calories').innerText = totalCalories;
    document.getElementById('target-calories').innerText = goalConfig.calories;
    
    document.getElementById('current-protein').innerText = totalProtein;
    document.getElementById('target-protein').innerText = goalConfig.protein;
    
    document.getElementById('current-carbs').innerText = totalCarbs;
    document.getElementById('target-carbs').innerText = goalConfig.carbs;
    
    document.getElementById('current-fats').innerText = totalFats;
    document.getElementById('target-fats').innerText = goalConfig.fats;

    // Calories Remaining Text
    const remainingCalories = goalConfig.calories - totalCalories;
    const remainingTextEl = document.getElementById('calorie-remaining-text');
    if (remainingCalories >= 0) {
        remainingTextEl.innerText = `${remainingCalories} kcal remaining`;
        remainingTextEl.style.color = 'var(--text-secondary)';
    } else {
        remainingTextEl.innerText = `${Math.abs(remainingCalories)} kcal over budget`;
        remainingTextEl.style.color = 'var(--red-exceeded)';
    }

    // Calorie Progress Fill & Warning
    const caloriePct = Math.min((totalCalories / goalConfig.calories) * 100, 100);
    const calorieFill = document.getElementById('calorie-progress-fill');
    calorieFill.style.width = `${caloriePct}%`;

    // Clear classes
    calorieFill.classList.remove('warning', 'exceeded');
    
    // Output validation status flag to control the frontend color layout
    if (totalCalories > goalConfig.calories) {
        appState.validationStatus = 'exceeded';
    } else if (totalCalories >= goalConfig.calories * 0.85) {
        appState.validationStatus = 'warning';
    } else {
        appState.validationStatus = 'safe';
    }

    // Apply color layout styling based on status flag
    if (appState.validationStatus === 'exceeded') {
        calorieFill.classList.add('exceeded');
        
        // Trigger Warning Modal if not already shown
        if (!appState.warningShownThisSession) {
            document.getElementById('warning-modal').style.display = 'flex';
            appState.warningShownThisSession = true;
        }
    } else if (appState.validationStatus === 'warning') {
        calorieFill.classList.add('warning');
    }

    // Macro Progress Fills
    const proteinPct = Math.min((totalProtein / goalConfig.protein) * 100, 100);
    document.getElementById('protein-progress-fill').style.width = `${proteinPct}%`;
    
    const carbsPct = Math.min((totalCarbs / goalConfig.carbs) * 100, 100);
    document.getElementById('carbs-progress-fill').style.width = `${carbsPct}%`;
    
    const fatsPct = Math.min((totalFats / goalConfig.fats) * 100, 100);
    document.getElementById('fats-progress-fill').style.width = `${fatsPct}%`;
}

// Search local database for manual input
function searchFoodDatabase(val) {
    const list = document.getElementById('autocomplete-list');
    list.innerHTML = '';
    
    if (!val) {
        list.style.display = 'none';
        return;
    }
    
    const matches = FOOD_DATABASE.filter(food => 
        food.name.toLowerCase().includes(val.toLowerCase())
    ).slice(0, 5);
    
    if (matches.length === 0) {
        list.style.display = 'none';
        return;
    }
    
    matches.forEach(food => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>${food.name}</strong> <span style="color: var(--text-muted); font-size: 0.8rem;">(${food.calories} kcal/100g)</span>`;
        div.onclick = () => selectFood(food);
        list.appendChild(div);
    });
    
    list.style.display = 'block';
}

// Select item from suggestions list
function selectFood(food) {
    document.getElementById('food-name').value = food.name;
    document.getElementById('raw-calories').value = food.calories;
    document.getElementById('raw-protein').value = food.protein;
    document.getElementById('raw-carbs').value = food.carbs;
    document.getElementById('raw-fats').value = food.fats;
    
    document.getElementById('autocomplete-list').style.display = 'none';
    
    calculateScaledNutrients();
}

// Scaling algorithm: calculates nutrients relative to portion weight
function calculateScaledNutrients() {
    const portion = Number(document.getElementById('portion-weight').value) || 100;
    
    const rawCal = Number(document.getElementById('raw-calories').value) || 0;
    const rawProt = Number(document.getElementById('raw-protein').value) || 0;
    const rawCarbs = Number(document.getElementById('raw-carbs').value) || 0;
    const rawFats = Number(document.getElementById('raw-fats').value) || 0;

    const scaledCal = Math.round((rawCal * portion) / 100);
    const scaledProt = Math.round(((rawProt * portion) / 100) * 10) / 10;
    const scaledCarbs = Math.round(((rawCarbs * portion) / 100) * 10) / 10;
    const scaledFats = Math.round(((rawFats * portion) / 100) * 10) / 10;

    // Update Live Badges
    document.getElementById('preview-portion-text').innerText = `(${portion}g)`;
    document.getElementById('preview-calories').innerText = scaledCal;
    document.getElementById('preview-protein').innerText = `${scaledProt}g`;
    document.getElementById('preview-carbs').innerText = `${scaledCarbs}g`;
    document.getElementById('preview-fats').innerText = `${scaledFats}g`;
}

// Close suggestion box if user clicks outside
document.addEventListener('click', function(e) {
    if (e.target.id !== 'food-name') {
        const list = document.getElementById('autocomplete-list');
        if (list) list.style.display = 'none';
    }
});

// Handle food image upload & send to FastAPI
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show image preview and loading status
    const previewContainer = document.getElementById('preview-container');
    const uploadPlaceholder = document.querySelector('.upload-placeholder');
    const imagePreview = document.getElementById('image-preview');
    const statusText = document.getElementById('prediction-status');
    
    uploadPlaceholder.style.display = 'none';
    previewContainer.style.display = 'block';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        imagePreview.src = e.target.result;
    }
    reader.readAsDataURL(file);
    
    statusText.style.display = 'flex';
    statusText.innerHTML = `<span class="spinner"></span> Analyzing food image...`;
    
    // Send request to FastAPI ML Service
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${ML_URL}/predict`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Prediction API failed');
        }
        
        const prediction = await response.json();
        
        // Success: Auto-fill inputs
        document.getElementById('food-name').value = prediction.name;
        document.getElementById('raw-calories').value = prediction.calories;
        document.getElementById('raw-protein').value = prediction.protein;
        document.getElementById('raw-carbs').value = prediction.carbs;
        document.getElementById('raw-fats').value = prediction.fats;
        
        const confidencePct = Math.round(prediction.confidence * 100);
        statusText.innerHTML = `✨ Identified: <strong>${prediction.name}</strong> (${confidencePct}% confidence)`;
        
        // Recalculate scaled nutrients with current portion weight
        calculateScaledNutrients();
        
    } catch (error) {
        console.error('FastAPI ML Prediction failed:', error);
        statusText.innerHTML = `❌ Scan failed. Using default entry values.`;
        // Fallback default
        document.getElementById('food-name').value = "Scanned Food";
        document.getElementById('raw-calories').value = 150;
        document.getElementById('raw-protein').value = 5;
        document.getElementById('raw-carbs').value = 20;
        document.getElementById('raw-fats').value = 5;
        calculateScaledNutrients();
    }
}

// Log food item to dashboard
function logMeal() {
    const name = document.getElementById('food-name').value.trim();
    const portion = Number(document.getElementById('portion-weight').value) || 100;
    
    if (!name) {
        alert("Please enter a food name or upload a photo.");
        return;
    }
    
    // Get scaled values
    const rawCal = Number(document.getElementById('raw-calories').value) || 0;
    const rawProt = Number(document.getElementById('raw-protein').value) || 0;
    const rawCarbs = Number(document.getElementById('raw-carbs').value) || 0;
    const rawFats = Number(document.getElementById('raw-fats').value) || 0;

    const meal = {
        name: name,
        portion: portion,
        calories: Math.round((rawCal * portion) / 100),
        protein: Math.round(((rawProt * portion) / 100) * 10) / 10,
        carbs: Math.round(((rawCarbs * portion) / 100) * 10) / 10,
        fats: Math.round(((rawFats * portion) / 100) * 10) / 10,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    // Add to list
    appState.loggedMeals.push(meal);
    
    // Save
    localStorage.setItem('fitmacro_meals', JSON.stringify(appState.loggedMeals));
    
    // Update Dashboard & List
    updateDashboard();
    renderMealHistory();
    
    // Reset inputs
    resetLoggingForm();
}

// Reset logging form elements
function resetLoggingForm() {
    document.getElementById('food-name').value = '';
    document.getElementById('portion-weight').value = '100';
    document.getElementById('raw-calories').value = '0';
    document.getElementById('raw-protein').value = '0';
    document.getElementById('raw-carbs').value = '0';
    document.getElementById('raw-fats').value = '0';
    
    // Reset scanner view
    document.getElementById('preview-container').style.display = 'none';
    document.querySelector('.upload-placeholder').style.display = 'flex';
    document.getElementById('image-input').value = '';
    
    // Restore simulate button
    const simulateBtn = document.querySelector('button[onclick="simulateImageUpload()"]');
    if (simulateBtn) simulateBtn.style.display = 'inline-block';
    
    calculateScaledNutrients();
}

// Simulated Image Upload: Auto-fills standard mock values immediately
function simulateImageUpload() {
    const previewContainer = document.getElementById('preview-container');
    const uploadPlaceholder = document.querySelector('.upload-placeholder');
    const imagePreview = document.getElementById('image-preview');
    const statusText = document.getElementById('prediction-status');
    const simulateBtn = document.querySelector('button[onclick="simulateImageUpload()"]');
    
    uploadPlaceholder.style.display = 'none';
    if (simulateBtn) simulateBtn.style.display = 'none';
    previewContainer.style.display = 'block';
    
    // Nice placeholder image showing a cheeseburger
    imagePreview.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop';
    
    statusText.style.display = 'flex';
    statusText.innerHTML = `<span class="spinner"></span> Simulating AI food scan...`;
    
    setTimeout(() => {
        // Predefined mock values as required
        const mockFood = {
            name: "Cheeseburger Deluxe",
            calories: 263,
            protein: 14.0,
            carbs: 28.0,
            fats: 11.0,
            confidence: 0.95
        };
        
        document.getElementById('food-name').value = mockFood.name;
        document.getElementById('portion-weight').value = 150;
        document.getElementById('raw-calories').value = mockFood.calories;
        document.getElementById('raw-protein').value = mockFood.protein;
        document.getElementById('raw-carbs').value = mockFood.carbs;
        document.getElementById('raw-fats').value = mockFood.fats;
        
        statusText.innerHTML = `✨ Mock Scan: Identified <strong>${mockFood.name}</strong> (95% confidence)`;
        
        calculateScaledNutrients();
    }, 1000);
}

// Render logged meal entries in table
function renderMealHistory() {
    const listEl = document.getElementById('meal-history-list');
    listEl.innerHTML = '';
    
    if (appState.loggedMeals.length === 0) {
        listEl.innerHTML = `
            <tr class="empty-state" id="empty-history-row">
                <td colspan="8">No meals logged for today. Start tracking your fitness journey!</td>
            </tr>
        `;
        return;
    }
    
    appState.loggedMeals.forEach((meal, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${meal.time}</td>
            <td style="font-weight: 600; color: var(--text-primary);">${meal.name}</td>
            <td>${meal.portion}g</td>
            <td style="font-weight: 600; color: var(--accent-indigo);">${meal.calories} kcal</td>
            <td><span style="color: var(--protein-color); font-weight: 600;">${meal.protein}g</span></td>
            <td><span style="color: var(--carbs-color); font-weight: 600;">${meal.carbs}g</span></td>
            <td><span style="color: var(--fats-color); font-weight: 600;">${meal.fats}g</span></td>
            <td>
                <button class="btn-delete" onclick="deleteMeal(${index})">🗑️</button>
            </td>
        `;
        listEl.appendChild(tr);
    });
}

// Delete individual meal item
function deleteMeal(index) {
    appState.loggedMeals.splice(index, 1);
    localStorage.setItem('fitmacro_meals', JSON.stringify(appState.loggedMeals));
    
    // Reset warning modal state if they reduce below budget
    const goalConfig = GOALS[appState.currentGoal];
    let totalCalories = appState.loggedMeals.reduce((sum, m) => sum + Number(m.calories), 0);
    if (totalCalories <= goalConfig.calories) {
        appState.warningShownThisSession = false;
    }
    
    updateDashboard();
    renderMealHistory();
}

// Clear all logged meals
function clearHistory() {
    if (confirm("Are you sure you want to clear today's meals?")) {
        appState.loggedMeals = [];
        localStorage.removeItem('fitmacro_meals');
        appState.warningShownThisSession = false;
        
        updateDashboard();
        renderMealHistory();
    }
}

// Modal handling
function closeModal() {
    document.getElementById('warning-modal').style.display = 'none';
}
