# Spark Perfumes POS — Developer Operations Guide

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Local Development Setup](#2-local-development-setup)
3. [Daily Development Workflow](#3-daily-development-workflow)
4. [Deployment Workflow](#4-deployment-workflow)
5. [Database Operations](#5-database-operations)
6. [Common Fixes & Scenarios](#6-common-fixes--scenarios)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [URLs & Credentials Reference](#8-urls--credentials-reference)

---

## 1. System Architecture

```
Client Browser / Phone
        ↓
Vercel (Frontend)
https://spark-perfumes-pos.vercel.app
React + Vite
        ↓  HTTPS API calls
Render (Backend)
https://pos2-1.onrender.com
Flask + Gunicorn
        ↓  SQL
Render PostgreSQL
spark_pos_db (Oregon, US West)
```

**Key facts:**
- Frontend and backend are deployed independently
- Backend auto-deploys when you push to GitHub `main` branch
- Frontend requires manual redeploy via `npx vercel --prod`
- Free Render backend sleeps after 15 min inactivity — first request takes ~30s to wake up
- Free database expires May 22, 2026 — upgrade or migrate before then

---

## 2. Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running locally
- pipenv installed

### First time setup

```bash
# Clone the repo
git clone https://github.com/EDEL-WEB/POS2.git
cd POS2

# Backend setup
pipenv install
cp .env.example .env
# Edit .env with your local database credentials

# Create local database
psql -U postgres -c "CREATE DATABASE perfume_pos;"

# Run migrations
pipenv run flask db upgrade

# Seed sample products (optional)
pipenv run python seed.py

# Frontend setup
cd frontend
npm install
```

### Running locally

**Terminal 1 — Backend:**
```bash
cd POS2
pipenv run flask run
# Runs at http://127.0.0.1:5000
```

**Terminal 2 — Frontend:**
```bash
cd POS2/frontend
npm run dev
# Runs at http://localhost:3000
```

### Local environment variables (.env)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/perfume_pos
SECRET_KEY=any-local-secret
JWT_SECRET_KEY=any-local-jwt-secret
```

### Frontend local environment (frontend/.env)
```
VITE_API_BASE_URL=http://127.0.0.1:5000/api
```

---

## 3. Daily Development Workflow

### Making a code change

```bash
# 1. Make your changes in the code editor

# 2. Test locally
#    - Backend auto-reloads on file save (use flask run --debug for hot reload)
#    - Frontend hot-reloads automatically with npm run dev

# 3. Once satisfied, commit and push
git add .
git commit -m "fix: describe what you changed"
git push
# Render auto-deploys the backend within 2-3 minutes

# 4. Redeploy frontend
cd frontend
npx vercel --prod --name spark-perfumes-pos
```

### Checking if backend deployed successfully
- Go to https://dashboard.render.com → POS2-1 → Logs
- Look for: `Booting worker with pid` — means it's live
- Look for errors in red — means something broke

---

## 4. Deployment Workflow

### How auto-deploy works
```
You write code locally
        ↓
git push to GitHub (main branch)
        ↓
Render detects the push automatically
        ↓
Render pulls latest code
        ↓
Runs: pip install -r requirements.txt
        ↓
Runs: flask db upgrade (pre-deploy command)
        ↓
Runs: gunicorn "app:create_app()" (start command)
        ↓
Backend is live at https://pos2-1.onrender.com
```

**This means:** every time you `git push`, the backend updates automatically within 2-3 minutes. You do NOT need to touch Render manually.

### Backend deploy (automatic)
```bash
# Make your changes, then:
git add .
git commit -m "fix: describe what you changed"
git push
# Render auto-deploys — check logs at dashboard.render.com → POS2-1 → Logs
```

### Frontend deploy (manual — must run this every time)
```bash
cd /home/tempadmin/projects/software_engineering/POS2/frontend
npx vercel --prod --name spark-perfumes-pos
```

> **Why is frontend manual?** Vercel can also auto-deploy from GitHub like Render does.
> To enable it: go to Vercel dashboard → your project → Settings → Git → connect your GitHub repo → select the `frontend` folder as root directory.
> After that, every `git push` deploys both backend AND frontend automatically.

### Enable Vercel auto-deploy from GitHub (one-time setup)
```
1. Go to https://vercel.com/dashboard
2. Open your spark-perfumes-pos project
3. Settings → Git
4. Connect to GitHub → select EDEL-WEB/POS2
5. Set Root Directory to: frontend
6. Save
```
After this, your full deploy workflow becomes just:
```bash
git add .
git commit -m "your message"
git push
# Both backend (Render) and frontend (Vercel) auto-deploy
```

### When you add a new database column
You cannot use `flask db migrate` on Render directly. Do it in two steps:

**Step 1 — Add column to the live database manually:**
```bash
cd /home/tempadmin/projects/software_engineering/POS2
pipenv run python -c "
import os
os.environ['DATABASE_URL'] = 'postgresql://spark_pos_db_user:Zi1ySnoIBRZoDYFWTc4nS8qxqJxMOvKV@dpg-d7kel21o3t8c73cls5l0-a.oregon-postgres.render.com/spark_pos_db'
from app import create_app
from models import db
from sqlalchemy import text
app = create_app()
with app.app_context():
    with db.engine.connect() as conn:
        conn.execute(text('ALTER TABLE your_table ADD COLUMN IF NOT EXISTS new_column VARCHAR(100)'))
        conn.commit()
    print('Done')
"
```

**Step 2 — Update the model in models.py, commit and push**
```bash
git add .
git commit -m "feat: add new_column to table"
git push
```

---

## 5. Database Operations

### Connect to live database via psql
```bash
PGPASSWORD=Zi1ySnoIBRZoDYFWTc4nS8qxqJxMOvKV psql \
  -h dpg-d7kel21o3t8c73cls5l0-a.oregon-postgres.render.com \
  -U spark_pos_db_user \
  -d spark_pos_db \
  --set=sslmode=require
```

### Useful psql commands
```sql
\dt                          -- list all tables
\d products                  -- describe products table structure
\q                           -- quit psql
```

### Common database tasks

**View all users:**
```sql
SELECT id, name, email, role, status, created_at FROM users;
```

**Change owner:**
```sql
-- Demote current owner to cashier
UPDATE users SET role = 'cashier' WHERE role = 'owner';

-- Promote a user to owner
UPDATE users SET role = 'owner', status = 'active' WHERE email = 'email@example.com';
```

**Reset owner (full replacement):**
```sql
-- Step 1: demote current owner
UPDATE users SET role = 'cashier' WHERE role = 'owner';
-- Step 2: go to /bootstrap on the Vercel app and create new owner
```

**Reset a user's password (via Python — bcrypt required):**
```bash
pipenv run python -c "
import os
os.environ['DATABASE_URL'] = 'postgresql://spark_pos_db_user:Zi1ySnoIBRZoDYFWTc4nS8qxqJxMOvKV@dpg-d7kel21o3t8c73cls5l0-a.oregon-postgres.render.com/spark_pos_db'
from app import create_app
from models import db, User
app = create_app()
with app.app_context():
    u = User.query.filter_by(email='someone@email.com').first()
    u.set_password('NewPassword@2025')
    db.session.commit()
    print('Password reset done')
"
```

**Delete a product:**
```sql
-- Only works if product has no sales history
DELETE FROM products WHERE id = 5;

-- If it has sales history, deactivate instead
UPDATE products SET is_active = FALSE, stock_quantity = 0 WHERE id = 5;
```

**Delete a sale (use carefully):**
```sql
DELETE FROM sale_items WHERE sale_id = 10;
DELETE FROM payments WHERE sale_id = 10;
DELETE FROM sales WHERE id = 10;
```

**View today's sales:**
```sql
SELECT s.id, u.name as cashier, s.total_amount, s.payment_method, s.status, s.timestamp
FROM sales s
JOIN users u ON s.user_id = u.id
WHERE DATE(s.timestamp) = CURRENT_DATE
ORDER BY s.timestamp DESC;
```

**View all completed sales with items:**
```sql
SELECT s.id, u.name as cashier, p.name as product, si.quantity, si.price, s.status
FROM sales s
JOIN users u ON s.user_id = u.id
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON p.id = si.product_id
WHERE s.status = 'completed'
ORDER BY s.timestamp DESC;
```

**Fix stuck pending sales (older than 1 day):**
```sql
UPDATE sales SET status = 'cancelled'
WHERE status = 'pending'
AND timestamp < NOW() - INTERVAL '1 day';
```

**Check low stock:**
```sql
SELECT name, stock_quantity FROM products
WHERE stock_quantity <= 5 AND is_active = TRUE
ORDER BY stock_quantity ASC;
```

**Restock a product:**
```sql
UPDATE products SET stock_quantity = 50 WHERE name = 'Dior Sauvage (100ml)';
```

---

## 6. Common Fixes & Scenarios

### App is down / 500 errors
```
1. Check Render logs → dashboard.render.com → POS2-1 → Logs
2. Fix the code locally
3. Test locally
4. git push → Render auto-redeploys
5. Redeploy frontend if needed
```

### Frontend shows blank page or 404 on refresh
```bash
# Make sure frontend/vercel.json exists with:
# { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }

cd frontend
npx vercel --prod --name spark-perfumes-pos
```

### CORS errors (frontend can't reach backend)
```python
# In app.py, add the new frontend URL to the origins list
# or ensure re.compile(r"https://.*\.vercel\.app") is in origins
git add . && git commit -m "fix: cors" && git push
```

### Backend sleeping (first request slow)
- Normal on free tier — wakes up in ~30 seconds
- Upgrade to Render Starter ($7/month) to keep it always on

### Database column missing (500 on specific endpoint)
```bash
# Add the column directly to live DB
pipenv run python -c "
import os
os.environ['DATABASE_URL'] = 'postgresql://spark_pos_db_user:Zi1ySnoIBRZoDYFWTc4nS8qxqJxMOvKV@dpg-d7kel21o3t8c73cls5l0-a.oregon-postgres.render.com/spark_pos_db'
from app import create_app
from models import db
from sqlalchemy import text
app = create_app()
with app.app_context():
    with db.engine.connect() as conn:
        conn.execute(text('ALTER TABLE table_name ADD COLUMN IF NOT EXISTS col_name TYPE'))
        conn.commit()
"
```

### Cashier can't log in
```sql
-- Check their status
SELECT name, email, status FROM users WHERE email = 'cashier@email.com';

-- Activate them
UPDATE users SET status = 'active' WHERE email = 'cashier@email.com';
```

### Need to wipe all sales data (fresh start)
```sql
DELETE FROM payments;
DELETE FROM sale_items;
DELETE FROM sales;
-- Reset sequences
ALTER SEQUENCE sales_id_seq RESTART WITH 1;
ALTER SEQUENCE sale_items_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_id_seq RESTART WITH 1;
```

---

## 7. Environment Variables Reference

### Backend (set on Render dashboard)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Internal URL) |
| `SECRET_KEY` | Flask session secret |
| `JWT_SECRET_KEY` | JWT signing secret |
| `PYTHON_VERSION` | `3.11.0` |
| `FRONTEND_URL` | Vercel frontend URL for CORS |

### Frontend (set on Vercel dashboard)
| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | `https://pos2-1.onrender.com/api` |

---

## 8. URLs & Credentials Reference

### Live URLs
| Service | URL |
|---------|-----|
| Frontend | https://spark-perfumes-pos.vercel.app |
| Backend API | https://pos2-1.onrender.com |
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| GitHub Repo | https://github.com/EDEL-WEB/POS2 |

### Database Connection
| Field | Value |
|-------|-------|
| Host (external) | `dpg-d7kel21o3t8c73cls5l0-a.oregon-postgres.render.com` |
| Port | `5432` |
| Database | `spark_pos_db` |
| Username | `spark_pos_db_user` |
| SSL | Required |

### Default Owner (local dev)
| Field | Value |
|-------|-------|
| Email | `admin@perfume.local` |
| Password | `Admin@2025` |
###git  basics
git add DEVOPS.md
git commit -m "docs: expand deployment section with auto-deploy flow"
git push
