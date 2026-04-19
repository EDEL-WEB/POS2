# Perfume Shop POS — React Frontend

A lightweight React frontend for the Flask POS backend.

## Setup

1. Open a terminal in `POS2/frontend`
2. Install dependencies:

```bash
npm install
```

3. Copy the example file:

```bash
cp .env.example .env
```

4. Update `VITE_API_BASE_URL` if your backend is not running at `http://127.0.0.1:5000`.

5. Start the app:

```bash
npm run dev
```

The frontend will run at `http://localhost:3000`.

## Features

- Login, register, and bootstrap owner account
- Product list, creation, editing, and deletion for owners
- Sale creation with cash or M-Pesa payment flows
- Daily report viewer
- Owner-only cashier activation / deactivation
- Profile view and logout

## Backend Notes

The backend must allow cross-origin requests from the frontend, or you can proxy API calls through the same domain.

If needed, add a small CORS configuration to the Flask app using `flask-cors`.
