# SpendWise 💳

> **A modern, elegant financial center and personal expense tracker built with Flask, Tailwind CSS, Supabase PostgreSQL, and Progressive Web App (PWA) architecture.**

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-black.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable%20Standalone-blueviolet.svg?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-Modern_UI-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

---

## 🌟 Overview

**SpendWise** is a full-featured personal finance and expense tracking progressive web application. Designed with modern Material 3 design principles, fluid glassmorphism accents, and fully responsive layouts for mobile and desktop, SpendWise gives users complete control over their cashflow, budgets, spending habits, and financial analytics.

Powered by a robust **Flask** backend with **SQLAlchemy 2.0**, SpendWise connects to **Supabase PostgreSQL** for cloud-native persistence with automatic connection pooling, resilient health monitoring, and local SQLite fallback.

---

## ✨ Key Features

- 📱 **Progressive Web App (PWA)**:
  - Installable directly on **Android, iOS, and Desktop** with standalone display mode.
  - Custom brand logo and manifest configuration (`manifest.json`).
  - Service Worker (`sw.js`) precaches core static UI assets for fast, reliable loading.
  - **Strict Privacy & Security Guarantee**: Service worker bypasses all `/api/*` requests and sensitive calls. Private financial and user data is **never cached**.

- 🩺 **Automatic Backend & Database Monitoring**:
  - Live `/health` check verifying both Flask server runtime and Supabase PostgreSQL connection (`SELECT 1`).
  - Real-time status indicator pill in the top header:
    - 🟢 **Connected** (Backend & Supabase database operational)
    - 🟡 **Offline** (No internet connection detected)
    - 🔴 **Server unavailable** (Backend server unreachable or gateway error)
    - 🔴 **Database unavailable** (Backend reachable but database check failed)
  - **Zero continuous polling**: Health checks run strictly on lifecycle events (app open, foreground return with a 5s cooldown throttle, and internet reconnect).

- 🔁 **Submission Mutex, Retry Handling & Deduplication**:
  - Double-click prevention on transaction submissions.
  - Clear error alerts with an interactive **Retry** button if a request fails.
  - Backend deduplication guard prevents duplicate records if a submission is retried or network drops during transit.

- 📱 **Fully Responsive Mobile UI**:
  - Touch-friendly slide-over navigation drawer with backdrop overlay.
  - Top header with mobile hamburger toggle.
  - Horizontally touch-scrollable view switcher tabs (`no-scrollbar touch-scroll`).
  - Adaptive 7-column calendar grid that scales seamlessly on 360px–412px smartphone screens.
  - Mobile viewport safety with scrollable modal containers.

- 📊 **Real-time Financial Dashboard**:
  - Live balance, total monthly income, total expenses, and net cashflow calculations.
  - Dynamic monthly budget progress tracker with automated burn-rate visual alerts.

- 💸 **Transaction Management**:
  - Add, edit, filter, search, and delete expenses and incomes.
  - Multi-attribute tracking: Merchant/Payee, Amount, Category, Payment Method (UPI, Card, Net Banking, Cash), Date, Time, and Notes.

- 📈 **Visual Analytics & Category Donut**:
  - Interactive SVG category spending breakdown with percentage distribution and legend.
  - Peak outflow day detection and daily average calculations.

- 📅 **Calendar Daily Heatmap**:
  - Month-at-a-glance view aggregating day-by-day outflows.
  - Color-coded daily expense thresholds with interactive date inspection panel.

- 🔍 **Advanced Filtering & Search**:
  - Instant search across descriptions, categories, payment methods, and date ranges.

- 📥 **Export Reports**:
  - One-click CSV export of user transactions with formatted timestamps and currencies.

- 🔐 **Secure Multi-User Authentication**:
  - Password hashing with Bcrypt.
  - Session-based authentication with strict per-user data isolation.
  - Profile customization (name, custom currency symbol `₹`, `$`, `€`, `£`, and monthly budget).

- ☁️ **Supabase Cloud Native**:
  - Direct integration with Supabase PostgreSQL.
  - Resilient connection pooler support with `pool_pre_ping` and `pool_recycle`.
  - Automatic fallback to local SQLite for offline development.

---

## 🛠️ Tech Stack

- **Backend**: Python 3, Flask 3.0, Flask-SQLAlchemy, Flask-Bcrypt, Flask-Cors
- **Database**: Supabase (PostgreSQL 15+) via `psycopg2-binary` / Local SQLite
- **PWA & Client**: Service Worker (Cache API), Web App Manifest, Vanilla ES6 JavaScript, HTML5, Tailwind CSS, Google Material Symbols
- **Environment Management**: `python-dotenv`

---

## 📁 Directory Structure

```text
spendwise/
├── static/
│   ├── css/
│   │   └── style.css            # Custom CSS animations, touch utilities & typography
│   ├── icons/
│   │   ├── logo.png             # Brand logo
│   │   ├── icon-192.png         # PWA 192x192 maskable icon
│   │   ├── icon-512.png         # PWA 512x512 maskable icon
│   │   └── icon-apple-touch.png # Apple touch icon
│   ├── js/
│   │   ├── api.js               # REST API client & health endpoint
│   │   ├── app.js               # Application coordinator, monitoring, PWA & UI
│   │   ├── auth.js              # Authentication & user profile logic
│   │   ├── calendar.js          # Responsive calendar & daily outflow aggregation
│   │   ├── charts.js            # SVG donut charts & category analytics
│   │   └── filters.js           # Filtering, searching & sorting engine
│   ├── manifest.json            # Web App Manifest for PWA installation
│   └── sw.js                    # Service worker caching safe static assets only
├── templates/
│   └── index.html               # Responsive single-page application template
├── app.py                       # Flask server, REST API, PWA routes & /health
├── config.py                    # Environment configuration & DB connection pooler
├── models.py                    # SQLAlchemy ORM models (User, Transaction)
├── requirements.txt             # Python package dependencies
├── test_e2e.py                  # End-to-end integration test suite
├── .env.example                 # Environment template for Supabase
├── .gitignore                   # Git ignore rules for security
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/karmapatel/spendwise.git
cd spendwise
```

### 2. Create and Activate a Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment (.env)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and configure your database settings:

#### To use Supabase (Recommended):
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** ➔ **Database** ➔ **Connection string (URI)**.
3. Select **Transaction Pooler** (port `6543`) or **Direct** (port `5432`), and paste your URI into `.env`:
   ```ini
   DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
   SECRET_KEY=spendwise_super_secret_key_2026
   ```

*(Note: If `DATABASE_URL` is omitted or left empty, SpendWise automatically falls back to a local SQLite database `spendwise.db` for instant offline testing!)*

### 5. Run the Application
```bash
python app.py
```
Open your browser and navigate to:
```text
http://127.0.0.1:5000
```

To install on your mobile device or desktop, tap **Install** or **Add to Home Screen** from the browser address bar.

---

## 📡 API Endpoints

### System & Health Monitoring
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Live backend and Supabase database health check (`SELECT 1`) |
| `GET` | `/manifest.json` | PWA web app manifest |
| `GET` | `/sw.js` | Service Worker script with root scope |

### Authentication & Profile
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Log in and start session |
| `POST` | `/api/auth/logout` | End session |
| `GET` | `/api/auth/me` | Fetch authenticated user data |
| `PUT` | `/api/auth/profile` | Update profile (budget, currency, name) |

### Transactions & Analytics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/transactions` | Query transactions (supports filtering & search) |
| `POST` | `/api/transactions` | Add a new transaction (with duplicate submission protection) |
| `PUT` | `/api/transactions/<id>` | Update an existing transaction |
| `DELETE` | `/api/transactions/<id>` | Delete a transaction |
| `GET` | `/api/transactions/stats` | Aggregated metrics, categories & daily totals |
| `GET` | `/api/transactions/export`| Export transactions to CSV file |

---

## 🔒 Security Best Practices

- Never commit your `.env` file containing database passwords or secret keys.
- Production deployments should use a production WSGI server (e.g. `gunicorn -w 4 app:app`).
- Keep `pool_pre_ping=True` enabled in `config.py` to ensure serverless and pooled PostgreSQL connections remain healthy.
- Financial transactions and user profiles are strictly isolated at the SQL query level by `user_id`.
- The PWA Service Worker never caches `/api/*` responses to ensure financial records are never leaked through browser storage.

---

## 📄 License

This project is licensed under the [GNU General Public License v3.0 (GPL-3.0)](https://www.gnu.org/licenses/gpl-3.0.html).
