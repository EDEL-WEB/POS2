# POS2 Deployment Checklist

## ✅ Completed
- [x] Neon PostgreSQL database created
- [x] PythonAnywhere account created
- [x] Vercel project created
- [x] Frontend built (frontend/dist/)
- [x] Deployment guides created

## 🔄 In Progress
- [ ] Upload code to PythonAnywhere
- [ ] Install dependencies on PythonAnywhere
- [ ] Configure WSGI file
- [ ] Add environment variables
- [ ] Initialize database
- [ ] Reload PythonAnywhere app
- [ ] Update Vercel API URL
- [ ] Test full deployment

## 📋 Quick Commands for PythonAnywhere

### Upload Files
Go to Files tab → Upload to `/home/marked/pos2/`:
- app.py, auth.py, config.py, models.py, routes.py, seed.py
- requirements.txt, Pipfile, .env
- migrations/ folder

### Install Dependencies (Bash console)
```bash
cd /home/marked/pos2
pip install -r requirements.txt
```

### Configure WSGI
Edit `/var/www/marked_pythonanywhere_com_wsgi.py`:
```python
import sys
path = '/home/marked/pos2'
if path not in sys.path:
    sys.path.insert(0, path)

from app import create_app
application = create_app()
```

### Environment Variables
Add in Web tab → Environment variables:
```
DATABASE_URL=postgresql://neondb_owner:npg_RTzPAZW2sro6@ep-soft-leaf-amba69uu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
SECRET_KEY=your-random-key
JWT_SECRET_KEY=your-jwt-key
MPESA_CONSUMER_KEY=your-mpesa-key
MPESA_CONSUMER_SECRET=your-mpesa-secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your-passkey
MPESA_CALLBACK_URL=https://marked.pythonanywhere.com/payments/confirm
MPESA_ENV=sandbox
```

### Initialize Database (Bash console)
```bash
cd /home/marked/pos2
python3 -c "from app import create_app, db; app = create_app(); with app.app_context(): db.create_all(); print('✓ Database ready!')"
```

### Reload App
Web tab → Click "Reload" button

## 🎯 Final URLs
- Frontend: https://pos-2.vercel.app
- Backend: https://marked.pythonanywhere.com
- Database: Neon console

## 🧪 Testing
1. Visit frontend URL
2. Try login
3. Create test sale
4. Check reports
5. Test M-Pesa (if configured)

## 🚨 Troubleshooting
- Check PythonAnywhere error logs
- Verify environment variables
- Test database connection locally first
- Ensure WSGI file is correct

## 📞 Support
- PythonAnywhere: Check error logs in Web tab
- Vercel: Check deployment logs
- Neon: Check connection in console.neon.tech