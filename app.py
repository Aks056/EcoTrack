import os
import random
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
# pyrefly: ignore [missing-import]
from pymongo import MongoClient
# pyrefly: ignore [missing-import]
from bson.objectid import ObjectId
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
# Enable CORS for frontend API calls
CORS(app)

# ==========================================
# 1. MONGODB DATABASE CONFIGURATION
# ==========================================
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/ecotrack")
client = MongoClient(MONGO_URI)
if os.environ.get("TESTING") == "true":
    db = client.get_database("ecotrack_test")
else:
    db = client.get_database() # Uses database from MONGO_URI path (e.g. 'ecotrack')



# ==========================================
# 2. CARBON CALCULATOR FACTOR CONSTANTS
# ==========================================
CARBON_FACTORS = {
    "carPerKm": 0.20,
    "transitPerKm": 0.05,
    "electricityPerHour": 0.45,
    "diet": {
        "vegan": 1.5,
        "vegetarian": 2.5,
        "meat-heavy": 7.0
    }
}

CLIMATE_TARGET_LIMIT = 5.5

ECO_TIPS = [
    { "text": "Try meatless Mondays! Swapping meat for plant-based meals once a week saves up to 3.6 kg of CO2 emissions.", "category": "diet" },
    { "text": "Public transit reduces emissions by up to 75% compared to driving alone. Keep up the green commute!", "category": "transport" },
    { "text": "Set your thermostat 1-2 degrees higher in summer or lower in winter. Each degree saves roughly 3% on utility bills.", "category": "energy" },
    { "text": "Unplug idle electronics. 'Vampire power' from standby devices accounts for up to 10% of household electricity use.", "category": "energy" },
    { "text": "Walking or cycling for short trips under 2 km is a zero-carbon exercise that keeps you and the planet healthy.", "category": "transport" },
    { "text": "Line-drying your clothes instead of using a tumble dryer eliminates roughly 2.0 kg of CO2 per load.", "category": "energy" },
    { "text": "Reduce food waste! Planning meals and freezing leftovers keeps organic waste out of landfills, reducing methane.", "category": "diet" },
    { "text": "Switching to LED lightbulbs uses up to 85% less energy and they last 25 times longer than incandescent bulbs.", "category": "energy" },
    { "text": "Transitioning to a plant-forward diet is one of the most powerful individual actions you can take for SDG 13.", "category": "diet" },
    { "text": "Check your car's tire pressure regularly. Properly inflated tires improve fuel efficiency and cut emissions.", "category": "transport" }
]

def calculate_footprint(car_km, transit_km, energy_hours, diet_type):
    """
    Computes individual carbon footprints and daily total on the backend.
    """
    transport_co2 = (car_km * CARBON_FACTORS["carPerKm"]) + (transit_km * CARBON_FACTORS["transitPerKm"])
    energy_co2 = energy_hours * CARBON_FACTORS["electricityPerHour"]
    diet_co2 = CARBON_FACTORS["diet"].get(diet_type, 2.5)
    total_co2 = transport_co2 + energy_co2 + diet_co2

    return {
        "transport": round(transport_co2, 2),
        "energy": round(energy_co2, 2),
        "diet": round(diet_co2, 2),
        "total": round(total_co2, 2)
    }

def get_impact_level(total_co2):
    """
    Classifies carbon footprint levels.
    """
    if total_co2 <= CLIMATE_TARGET_LIMIT:
        return "low"
    elif total_co2 <= 15.0:
        return "medium"
    else:
        return "high"

# ==========================================
# 3. API ROUTE ENDPOINTS
# ==========================================

@app.route("/")
def serve_index():
    """
    Serves the main HTML page.
    """
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    """
    Serves static files (CSS, JS).
    """
    return send_from_directory(".", filename)

@app.route("/api/entries", methods=["GET"])
def get_entries():
    """
    Retrieves all entries from MongoDB, sorted by date descending.
    """
    try:
        entries_cursor = db.entries.find().sort("date", -1)
        entries_list = []
        for entry in entries_cursor:
            entries_list.append({
                "id": str(entry["_id"]),
                "date": entry["date"],
                "carKm": entry["carKm"],
                "transitKm": entry["transitKm"],
                "energyHours": entry["energyHours"],
                "dietType": entry["dietType"],
                "breakdown": entry["breakdown"],
                "totalCO2": entry["totalCO2"],
                "impactLevel": entry["impactLevel"]
            })
        return jsonify(entries_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/entries", methods=["POST"])
def create_or_update_entry():
    """
    Calculates carbon footprints and saves the daily entry to MongoDB.
    Upserts (updates) existing entries if matching same date.
    """
    try:
        data = request.json or {}
        
        # Validate inputs
        date = data.get("date")
        if not date:
            return jsonify({"error": "Date field is required"}), 400
            
        def parse_float(val):
            if val is None:
                return 0.0
            return float(val)

        car_km = parse_float(data.get("carKm", 0))
        transit_km = parse_float(data.get("transitKm", 0))
        energy_hours = parse_float(data.get("energyHours", 0))
        diet_type = data.get("dietType", "meat-heavy")

        if car_km < 0 or transit_km < 0 or energy_hours < 0:
            return jsonify({"error": "Numerical values must be non-negative"}), 400

        # Execute Math Calculations
        calculations = calculate_footprint(car_km, transit_km, energy_hours, diet_type)
        impact_level = get_impact_level(calculations["total"])

        entry_doc = {
            "date": date,
            "carKm": car_km,
            "transitKm": transit_km,
            "energyHours": energy_hours,
            "dietType": diet_type,
            "breakdown": calculations,
            "totalCO2": calculations["total"],
            "impactLevel": impact_level
        }

        # Upsert: Update if matching date, otherwise insert new.
        db.entries.update_one(
            {"date": date},
            {"$set": entry_doc},
            upsert=True
        )

        # Retrieve saved document to get database generated ObjectId
        saved_doc = db.entries.find_one({"date": date})
        entry_doc["id"] = str(saved_doc["_id"])

        # Pick random tip
        random_tip = random.choice(ECO_TIPS)

        return jsonify({
            "entry": entry_doc,
            "tip": random_tip
        }), 201
        
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numerical input values"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/entries/<entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    """
    Deletes a single entry by MongoDB ObjectId string.
    """
    try:
        if not ObjectId.is_valid(entry_id):
            return jsonify({"error": "Invalid entry ID format"}), 400
            
        result = db.entries.delete_one({"_id": ObjectId(entry_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Entry not found"}), 404
            
        return jsonify({"success": True, "message": "Log entry deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/entries", methods=["DELETE"])
def clear_all_entries():
    """
    Wipes all documents in the database collection.
    """
    try:
        db.entries.delete_many({})
        return jsonify({"success": True, "message": "All database logs cleared successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run locally on default port 5000
    app.run(debug=True, host="127.0.0.1", port=5000)
