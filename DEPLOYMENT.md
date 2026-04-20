# POS2 Deployment Guide

## Architecture
```
Frontend (React)         Backend (Flask)          Database (PostgreSQL)
Vercel                   PythonAnywhere           Neon
https://...vercel.app    https://...pythonanywhere.com
```

---

## Step 1: Set Up Database (Neon PostgreSQL)

**Note**: ElephantSQL has been discontinued. We're using **Neon** instead - a modern PostgreSQL hosting with a generous free tier.

1. **Go to [Neon.tech](https://neon.tech)**
2. **Sign up** (free tier: 3 free projects, 10GB storage)
3. **Create a new project**:
   - Project name: `pos2`
   - Database name: `pos2_db`
   - Data center: Choose closest to you
   - Click "Create project"

4. **Get your connection string**:
   - Go to your project dashboard
   - Click "Connection string" (top right)
   - Copy the PostgreSQL connection string
   - It looks like: `postgresql://user:password@host/database?sslmode=require`
   
5. **Connection string format for PythonAnywhere**:
   ```
   postgresql://user:password@host/database
   ```
   Keep this safe - you'll need it for backend setup.

---

## Step 2: Deploy Backend to PythonAnywhere

### 2.1 Create Account
1. Go to [pythonanywhere.com](https://pythonanywhere.com)
2. Sign up (free tier available)
3. Log in to your dashboard

### 2.2 Upload Your Code
1. Go to **Files** tab
2. Create a folder: `/home/yourusername/pos2`
3. Upload all files from your project EXCEPT the `frontend/` folder:
   - `app.py`
   - `auth.py`
   - `config.py`
   - `models.py`
   - `routes.py`
   - `seed.py`
   - `requirements.txt`
   - `Pipfile`
   - `migrations/` folder
   - `.env` file

### 2.3 Set Up Web App
1. Go to **Web** tab → **Add a new web app**
2. Choose:
   - Backend: Manual Configuration
   - Python: 3.12
   - Directory: `/home/yourusername/pos2`

3. Click **Create web app**

### 2.4 Configure Web App
1. In the Web tab, find your app and click it
2. Scroll to **Virtualenv** section:
   - Path: `/home/yourusername/.virtualenvs/pos2`
   - Click the path to create it

3. In **Bash console**, run:
   ```bash
   cd /home/yourusername/pos2
   pip install -r requirements.txt
   ```

### 2.5 Configure WSGI
1. In Web tab, click the WSGI file link (usually `/var/www/yourusername_pythonanywhere_com_wsgi.py`)
2. Replace the content with:
   ```python
   import sys
   path = '/home/yourusername/pos2'
   if path not in sys.path:
       sys.path.insert(0, path)
   
   from app import create_app
   application = create_app()
   ```

3. Save and go back

### 2.6 Set Environment Variables
1. In Web tab, scroll to **Web app security** → **Environment variables**
2. Add these variables:
   ```
   SECRET_KEY=your-secure-random-key-here
   JWT_SECRET_KEY=your-jwt-secret-key-here
   DATABASE_URL=postgresql://user:password@host/database
   MPESA_CONSUMER_KEY=your-mpesa-key
   MPESA_CONSUMER_SECRET=your-mpesa-secret
   MPESA_SHORTCODE=174379
   MPESA_PASSKEY=your-passkey
   MPESA_CALLBACK_URL=https://yourusername.pythonanywhere.com/payments/confirm
   MPESA_ENV=sandbox
   ```
   
   **Note**: For Neon PostgreSQL connections, the DATABASE_URL should already include the SSL mode requirement. If you get SSL errors, append `?sslmode=require` to the end of your DATABASE_URL.

### 2.7 Initialize Database
1. Go to **Bash console**
2. Run:
   ```bash
   cd /home/yourusername/pos2
   python
   >>> from app import create_app, db
   >>> app = create_app()
   >>> with app.app_context():
   ...     db.create_all()
   >>> exit()
   ```

3. Or use migrations:
   ```bash
   flask db upgrade
   ```

### 2.8 Reload
1. Go to Web tab and click **Reload** button

Your backend URL: `https://yourusername.pythonanywhere.com`

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Update Vercel Settings
1. Go to your Vercel project: `https://vercel.com/dashboard`
2. Find your POS2 project (or create new if needed)
3. Click **Settings** → **Environment Variables**
4. Add:
   ```
   VITE_API_BASE_URL=https://yourusername.pythonanywhere.com
   ```

### 3.2 Reconfigure Project (if needed)
If you imported the entire repo, you need to update:
1. **Project settings**:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

2. **Save settings** and trigger a redeploy

### 3.3 Redeploy
- Click **Deployments** and manually redeploy or push to GitHub

Your frontend URL: Will be shown after deployment (e.g., `https://pos-2.vercel.app`)

---

## Step 4: Generate Secure Keys

Run this to generate production keys:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Use these values for:
- `SECRET_KEY`
- `JWT_SECRET_KEY`

---

## Step 5: Test Everything

1. **Visit your frontend**: `https://your-frontend.vercel.app`
2. **Test login**: Use your test credentials
3. **Test sales flow**: Create a test sale
4. **Check reports**: Verify data is being saved
5. **Test M-Pesa** (if configured)

---

## Troubleshooting

### Backend not responding
- Check PythonAnywhere Web tab - is the app reloaded?
- Check Environment variables are set correctly
- Check Database connection string

### Frontend shows blank page
- Open browser console (F12)
- Check if API calls are reaching backend
- Verify `VITE_API_BASE_URL` is correct

### Database connection error
- Verify Neon connection string is correct
- Check DATABASE_URL format in environment variables
- Ensure Neon project is active (check Neon dashboard)
- Try adding `?sslmode=require` to DATABASE_URL if you get SSL errors

### CORS errors
- Backend already has CORS enabled in `app.py`
- But verify it's working in the deployed version

---

## Next Steps

1. **Monitor**: Use PythonAnywhere and Vercel dashboards to monitor performance
2. **Backups**: Set up automated database backups
3. **M-Pesa Production**: Update M-Pesa credentials when ready for production
4. **Custom Domain**: Add your own domain to both services
5. **SSL Certificates**: Both services provide automatic HTTPS

---

## Key URLs After Deployment

- **Frontend**: `https://your-project.vercel.app`
- **Backend API**: `https://yourusername.pythonanywhere.com`
- **Database**: Neon PostgreSQL dashboard at https://console.neon.tech
- **Backend Admin**: `https://yourusername.pythonanywhere.com/admin` (if you add admin routes)

