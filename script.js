/**
 * EcoTrack - Daily Carbon Footprint Tracker (SDG 13: Climate Action)
 * JavaScript logic communicating with Python Flask backend and handling localStorage fallbacks.
 */

// API Endpoint configuration
const API_BASE_URL = window.location.protocol === 'file:' 
    ? 'http://127.0.0.1:5000/api' 
    : '/api';


// ==========================================
// 1. CARBON CONVERSION FACTORS (LOCAL FALLBACK MATH)
// ==========================================
const CARBON_FACTORS = {
    carPerKm: 0.20,
    transitPerKm: 0.05,
    electricityPerHour: 0.45,
    diet: {
        vegan: 1.5,
        vegetarian: 2.5,
        'meat-heavy': 7.0
    }
};

const ECO_TIPS = [
    { text: "Try meatless Mondays! Swapping meat for plant-based meals once a week saves up to 3.6 kg of CO2 emissions.", category: "diet" },
    { text: "Public transit reduces emissions by up to 75% compared to driving alone. Keep up the green commute!", category: "transport" },
    { text: "Set your thermostat 1-2 degrees higher in summer or lower in winter. Each degree saves roughly 3% on utility bills.", category: "energy" },
    { text: "Unplug idle electronics. 'Vampire power' from standby devices accounts for up to 10% of household electricity use.", category: "energy" },
    { text: "Walking or cycling for short trips under 2 km is a zero-carbon exercise that keeps you and the planet healthy.", category: "transport" },
    { text: "Line-drying your clothes instead of using a tumble dryer eliminates roughly 2.0 kg of CO2 per load.", category: "energy" },
    { text: "Reduce food waste! Planning meals and freezing leftovers keeps organic waste out of landfills, reducing methane.", category: "diet" },
    { text: "Switching to LED lightbulbs uses up to 85% less energy and they last 25 times longer than incandescent bulbs.", category: "energy" },
    { text: "Transitioning to a plant-forward diet is one of the most powerful individual actions you can take for SDG 13.", category: "diet" },
    { text: "Check your car's tire pressure regularly. Properly inflated tires improve fuel efficiency and cut emissions.", category: "transport" }
];

const CLIMATE_TARGET_LIMIT = 5.5; 

// ==========================================
// 2. DOM ELEMENT SELECTORS
// ==========================================
const trackerForm = document.getElementById('tracker-form');
const entryDateInput = document.getElementById('entry-date');
const carKmInput = document.getElementById('car-km');
const transitKmInput = document.getElementById('transit-km');
const energyHoursInput = document.getElementById('energy-hours');
const dietTypeInput = document.getElementById('diet-type');

// Results elements
const currentTotalText = document.getElementById('current-total');
const resultsCard = document.getElementById('results-container');
const statusIndicator = document.querySelector('.status-indicator');
const emissionBreakdown = document.getElementById('emission-breakdown');
const transportValText = document.getElementById('breakdown-transport-val');
const energyValText = document.getElementById('breakdown-energy-val');
const dietValText = document.getElementById('breakdown-diet-val');
const transportBar = document.getElementById('breakdown-transport-bar');
const energyBar = document.getElementById('breakdown-energy-bar');
const dietBar = document.getElementById('breakdown-diet-bar');
const metricOuterRing = document.querySelector('.metric-outer-ring');

// Tip & History elements
const tipCard = document.getElementById('tip-card');
const tipText = document.getElementById('tip-text');
const emptyState = document.getElementById('empty-state');
const entriesList = document.getElementById('entries-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// ==========================================
// 3. APPLICATION INITIALIZATION & STATE
// ==========================================
let trackingHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Date input to Today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    entryDateInput.value = `${yyyy}-${mm}-${dd}`;
    entryDateInput.max = `${yyyy}-${mm}-${dd}`; // Restrict future date entry

    // 2. Load data from Flask API or localStorage
    loadHistory();

    // 3. Add Event Listeners
    trackerForm.addEventListener('submit', handleFormSubmit);
    clearHistoryBtn.addEventListener('click', clearAllLogs);
});

// ==========================================
// 4. STORAGE & DATABASE API INTEGRATIONS
// ==========================================
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/entries`);
        if (!response.ok) throw new Error("Server returned non-200 response");
        trackingHistory = await response.json();
        console.log("Loaded entry history from Flask backend.");
    } catch (e) {
        console.warn("Flask API unavailable. Loading from localStorage fallback.", e);
        const stored = localStorage.getItem('ecotrack_logs');
        if (stored) {
            try {
                trackingHistory = JSON.parse(stored);
                trackingHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            } catch (err) {
                trackingHistory = [];
            }
        }
    }
    renderHistoryUI();
}

// ==========================================
// 5. CALCULATION LOGIC & FALLBACK HELPERS
// ==========================================
function roundDecimal(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function calculateFootprint(carKm, transitKm, energyHours, dietType) {
    const transportCO2 = (carKm * CARBON_FACTORS.carPerKm) + (transitKm * CARBON_FACTORS.transitPerKm);
    const energyCO2 = energyHours * CARBON_FACTORS.electricityPerHour;
    const dietCO2 = CARBON_FACTORS.diet[dietType] || 2.5;
    const totalCO2 = transportCO2 + energyCO2 + dietCO2;

    return {
        transport: roundDecimal(transportCO2, 2),
        energy: roundDecimal(energyCO2, 2),
        diet: roundDecimal(dietCO2, 2),
        total: roundDecimal(totalCO2, 2)
    };
}

function getImpactLevel(totalCO2) {
    if (totalCO2 <= CLIMATE_TARGET_LIMIT) return 'low';
    else if (totalCO2 <= 15.0) return 'medium';
    else return 'high';
}

// ==========================================
// 6. UI RENDERING & INTERACTIONS
// ==========================================

async function handleFormSubmit(e) {
    e.preventDefault();

    // Retrieve input values
    const dateValue = entryDateInput.value;
    const carKm = parseFloat(carKmInput.value) || 0;
    const transitKm = parseFloat(transitKmInput.value) || 0;
    const energyHours = parseFloat(energyHoursInput.value) || 0;
    const dietType = dietTypeInput.value;

    const payload = {
        date: dateValue,
        carKm,
        transitKm,
        energyHours,
        dietType
    };

    try {
        // Send inputs to Flask API for backend calculation and database persistence
        const response = await fetch(`${API_BASE_URL}/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Flask Server post failed");

        const data = await response.json();
        const entry = data.entry;
        const tip = data.tip;

        // Upsert localized list cache
        const existingIndex = trackingHistory.findIndex(e => e.date === entry.date);
        if (existingIndex !== -1) {
            trackingHistory[existingIndex] = entry;
        } else {
            trackingHistory.push(entry);
            trackingHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        renderHistoryUI();
        updateDashboardUI(entry);
        displayTip(tip.text);

    } catch (err) {
        console.warn("Flask Server offline. Executing client fallback calculation.", err);
        
        // Execute fallback local calculations
        const results = calculateFootprint(carKm, transitKm, energyHours, dietType);
        const impactLevel = getImpactLevel(results.total);
        const fallbackEntry = {
            id: Date.now().toString(),
            date: dateValue,
            carKm,
            transitKm,
            energyHours,
            dietType,
            breakdown: results,
            totalCO2: results.total,
            impactLevel
        };

        const existingIndex = trackingHistory.findIndex(entry => entry.date === dateValue);
        if (existingIndex !== -1) {
            trackingHistory[existingIndex] = fallbackEntry;
        } else {
            trackingHistory.push(fallbackEntry);
            trackingHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        // Cache locally in localStorage
        localStorage.setItem('ecotrack_logs', JSON.stringify(trackingHistory));
        
        renderHistoryUI();
        updateDashboardUI(fallbackEntry);
        
        // Local random tip
        const randomIndex = Math.floor(Math.random() * ECO_TIPS.length);
        displayTip(ECO_TIPS[randomIndex].text);
    }
}

/**
 * Updates the right-hand dashboard metrics and layout.
 */
function updateDashboardUI(entry) {
    // 1. Animate metric total
    animateValue(currentTotalText, parseFloat(currentTotalText.textContent) || 0, entry.totalCO2, 600);

    // 2. Set Indicator Classes
    statusIndicator.className = 'status-indicator';
    if (entry.impactLevel === 'low') {
        statusIndicator.classList.add('status-low');
        statusIndicator.textContent = 'Low Carbon Footprint (Goal Met!)';
        metricOuterRing.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #27ae60, #2ecc71)');
    } else if (entry.impactLevel === 'medium') {
        statusIndicator.classList.add('status-medium');
        statusIndicator.textContent = 'Moderate Footprint';
        metricOuterRing.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #f2994a, #f2c94c)');
    } else {
        statusIndicator.classList.add('status-high');
        statusIndicator.textContent = 'High Footprint';
        metricOuterRing.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #eb5757, #ff7675)');
    }

    // 3. Populate and show breakdowns
    emissionBreakdown.style.display = 'block';
    
    // Labels
    transportValText.textContent = `${roundDecimal(entry.breakdown.transport, 1).toFixed(1)} kg`;
    energyValText.textContent = `${roundDecimal(entry.breakdown.energy, 1).toFixed(1)} kg`;
    dietValText.textContent = `${roundDecimal(entry.breakdown.diet, 1).toFixed(1)} kg`;

    // Width percentages
    const total = entry.totalCO2 || 1;
    const transportPct = Math.round((entry.breakdown.transport / total) * 100);
    const energyPct = Math.round((entry.breakdown.energy / total) * 100);
    const dietPct = Math.round((entry.breakdown.diet / total) * 100);

    // Smooth loading bars
    setTimeout(() => {
        transportBar.style.width = `${transportPct}%`;
        energyBar.style.width = `${energyPct}%`;
        dietBar.style.width = `${dietPct}%`;
    }, 50);
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const val = progress * (end - start) + start;
        obj.textContent = roundDecimal(val, 1).toFixed(1);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function displayTip(text) {
    tipCard.style.display = 'block';
    tipText.style.opacity = '0';
    setTimeout(() => {
        tipText.textContent = text;
        tipText.style.opacity = '1';
        tipText.style.transition = 'opacity 0.3s ease-in-out';
    }, 150);
}

/**
 * Renders history logs in UI.
 */
function renderHistoryUI() {
    if (trackingHistory.length === 0) {
        emptyState.style.display = 'block';
        entriesList.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    entriesList.style.display = 'flex';
    entriesList.innerHTML = '';

    trackingHistory.forEach(entry => {
        const dateObj = new Date(entry.date + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString(undefined, { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            year: 'numeric' 
        });

        const li = document.createElement('li');
        li.className = 'entry-item';
        
        let badgeClass = '';
        if (entry.impactLevel === 'low') badgeClass = 'status-low';
        else if (entry.impactLevel === 'medium') badgeClass = 'status-medium';
        else badgeClass = 'status-high';

        li.innerHTML = `
            <div class="entry-item-left">
                <span class="entry-date">${formattedDate}</span>
                <span class="entry-details-desc">
                    Car: ${entry.carKm}km • Transit: ${entry.transitKm}km • Energy: ${entry.energyHours}h • Diet: ${entry.dietType}
                </span>
            </div>
            <div class="entry-item-right">
                <span class="entry-value-badge">${roundDecimal(entry.totalCO2, 1).toFixed(1)}<span>kg</span></span>
                <span class="impact-badge ${badgeClass}">${entry.impactLevel}</span>
                <button class="delete-entry-btn" onclick="deleteEntry('${entry.id}')" title="Delete Log">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
        entriesList.appendChild(li);
    });
}

/**
 * Delete a single entry.
 */
window.deleteEntry = async function(id) {
    const isMongoId = id.length === 24 && /^[0-9a-fA-F]+$/.test(id);
    if (isMongoId) {
        try {
            const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Database deletion failed");
            console.log(`Deleted document ${id} from MongoDB.`);
        } catch (e) {
            console.warn("Failed deleting from backend. Syncing locally.", e);
        }
    }

    trackingHistory = trackingHistory.filter(entry => entry.id !== id);
    localStorage.setItem('ecotrack_logs', JSON.stringify(trackingHistory));
    renderHistoryUI();
};

/**
 * Clear all logs.
 */
async function clearAllLogs() {
    if (confirm("Are you sure you want to delete all historical logs? This action cannot be undone.")) {
        try {
            const response = await fetch(`${API_BASE_URL}/entries`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error("Database clear failed");
            console.log("Wiped all records in MongoDB entries collection.");
        } catch (e) {
            console.warn("Failed clearing backend database collection. Syncing locally.", e);
        }

        trackingHistory = [];
        localStorage.removeItem('ecotrack_logs');
        renderHistoryUI();
        
        // Reset dashboard values to zero
        currentTotalText.textContent = '0.0';
        statusIndicator.className = 'status-indicator';
        statusIndicator.textContent = 'Enter details to calculate';
        metricOuterRing.style.setProperty('--accent-gradient', 'var(--border-color)');
        emissionBreakdown.style.display = 'none';
        tipCard.style.display = 'none';
        
        // Reset inputs
        carKmInput.value = '0';
        transitKmInput.value = '0';
        energyHoursInput.value = '0';
        dietTypeInput.value = 'meat-heavy';
    }
}
