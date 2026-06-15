# EcoTrack: Daily Carbon Footprint Tracker (UN SDG 13)

EcoTrack is a web application designed to help individuals calculate, track, and reduce their daily carbon footprint in alignment with **United Nations Sustainable Development Goal 13: Climate Action**.

The application operates with a modern, glassmorphic UI frontend, backed by a Flask backend and a MongoDB Atlas database. It also features a local storage fallback if the database server is offline.

---

## 🚀 Key Features

* **Daily Footprint Calculations**: Custom math formulas compute footprints for transport, energy, and diet choice.
* **Modern Dashboard**: Visually displays daily totals, climate target comparisons, and relative category breakdowns.
* **Persistent History Logs**: Saves records to a remote MongoDB Atlas database, enabling multi-device tracking.
* **Eco-Tip Recommendation System**: Offers tips to lower carbon impact.
* **Local Fallback Mode**: Functions offline using browser LocalStorage if the Flask server or database is unreachable.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5 (Semantic Structure), Custom Styling (Vanilla CSS with custom HSL palettes and Outfit Google Font), Vanilla JavaScript
* **Backend**: Python 3, Flask framework
* **Database**: MongoDB (via `pymongo` and `dnspython`)
* **Environment Configuration**: `python-dotenv`

---

## ⚙️ Project Setup

### 1. Prerequisites
Ensure you have Python 3.8+ installed on your system.

### 2. Environment Configuration
Create a `.env` file at the root of the project to configure your MongoDB connection string (this file is excluded from Git tracking for security):
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/ecotrack?retryWrites=true&w=majority
```

### 3. Install Dependencies
Initialize and activate your virtual environment, then install requirements:
```bash
# Activate virtual environment (if not active)
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Windows Command Prompt:
.venv\Scripts\activate.bat
# On macOS/Linux:
source .venv/bin/activate

# Install libraries
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask web server:
```bash
python app.py
```

Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)** to use the application!

---

## 🔒 Security Best Practices

* **`.gitignore`**: The repository is pre-configured with a `.gitignore` to prevent sensitive credentials (like your `.env` file containing database passwords) or local environments (`.venv/`, `__pycache__/`) from being pushed to Git.
