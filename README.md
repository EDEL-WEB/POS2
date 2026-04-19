# Perfume Shop POS — API Documentation

A backend REST API for a perfume shop Point of Sale system built with Flask, SQLAlchemy, and PostgreSQL.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Tech Stack](#2-tech-stack)
3. [Setup & Installation](#3-setup--installation)
4. [Environment Variables](#4-environment-variables)
5. [Database Models](#5-database-models)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Reference — Auth](#7-api-reference--auth)
8. [API Reference — Products](#8-api-reference--products)
9. [API Reference — Sales](#9-api-reference--sales)
10. [API Reference — Payments](#10-api-reference--payments)
11. [API Reference — Reports](#11-api-reference--reports)
12. [M-Pesa Integration](#12-m-pesa-integration)
13. [Security Features](#13-security-features)
14. [Business Rules](#14-business-rules)
15. [Error Reference](#15-error-reference)

---

## 1. Project Structure

```
POS2/
├── app.py              # Flask app factory, JWT callbacks, error handlers
├── config.py           # All configuration loaded from environment variables
├── models.py           # SQLAlchemy ORM models
├── routes.py           # Products, Sales, Payments, Reports endpoints
├── auth.py             # Authentication & user management endpoints
├── seed.py             # Sample product data loader
├── requirements.txt    # Python dependencies
└── .env.example        # Environment variable template
```

---

## 2. Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| Web framework | Flask | 3.1.1 |
| ORM | Flask-SQLAlchemy | 3.1.1 |
| Migrations | Flask-Migrate (Alembic) | 4.1.0 |
| Authentication | Flask-JWT-Extended | 4.7.1 |
| Password hashing | bcrypt | 4.3.0 |
| Database driver | psycopg2-binary | 2.9.10 |
| HTTP client (M-Pesa) | requests | 2.32.3 |
| Env vars | python-dotenv | 1.1.0 |
| Database | PostgreSQL | any recent |

---

## 3. Setup & Installation

### Prerequisites

- Python 3.11+
- PostgreSQL running locally or remotely

### Step-by-step

```bash
# 1. Clone and enter the project
cd POS2

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
# Edit .env with your database credentials and secrets

# 5. Create the PostgreSQL database
psql -U postgres -c "CREATE DATABASE perfume_pos;"

# 6. Run database migrations
flask db init
flask db migrate -m "initial schema"
flask db upgrade

# 7. Seed sample products (optional)
python seed.py

# 8. Create the owner account (first run only)
# POST /auth/bootstrap  — see Section 7

# 9. Start the server
flask run
# or
python app.py
```

Server runs at `http://127.0.0.1:5000`

---

## 4. Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/perfume_pos` | PostgreSQL connection string |
| `SECRET_KEY` | `dev-secret-key` | Flask session secret — change in production |
| `JWT_SECRET_KEY` | `jwt-dev-secret-change-me` | JWT signing secret — change in production |
| `JWT_ACCESS_TOKEN_EXPIRES` | `900` | Access token lifetime in seconds (default: 15 min) |
| `JWT_REFRESH_TOKEN_EXPIRES` | `604800` | Refresh token lifetime in seconds (default: 7 days) |
| `LOGIN_MAX_ATTEMPTS` | `5` | Failed login attempts before lockout |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Lockout duration in minutes |
| `RESET_TOKEN_EXPIRES` | `1800` | Password reset token lifetime in seconds (default: 30 min) |
| `MPESA_CONSUMER_KEY` | _(empty)_ | Daraja API consumer key — leave blank for simulation mode |
| `MPESA_CONSUMER_SECRET` | _(empty)_ | Daraja API consumer secret |
| `MPESA_SHORTCODE` | `174379` | M-Pesa business shortcode (174379 = Daraja sandbox) |
| `MPESA_PASSKEY` | _(empty)_ | Daraja Lipa Na M-Pesa passkey |
| `MPESA_CALLBACK_URL` | `https://yourdomain.com/payments/confirm` | Public HTTPS URL Safaricom posts callbacks to |
| `MPESA_ENV` | `sandbox` | `sandbox` or `production` |

---

## 5. Database Models

### User

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `name` | String(100) | Required |
| `email` | String(120) | Unique, required |
| `password_hash` | String(72) | bcrypt hash |
| `role` | Enum | `owner` or `cashier` |
| `status` | Enum | `pending`, `active`, `inactive` |
| `created_at` | DateTime | UTC |

### Product

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `name` | String(120) | Unique, required |
| `price` | Numeric(10,2) | Required |
| `stock_quantity` | Integer | Cannot go below 0 |

### Sale

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `total_amount` | Numeric(10,2) | Calculated at creation |
| `payment_method` | Enum | `cash` or `mpesa` |
| `status` | Enum | `pending` or `completed` |
| `timestamp` | DateTime | UTC, set at creation |

### SaleItem

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `sale_id` | FK → Sale | |
| `product_id` | FK → Product | |
| `quantity` | Integer | |
| `price` | Numeric(10,2) | Price at time of sale (snapshot) |

### Payment

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `sale_id` | FK → Sale | Unique (one payment per sale) |
| `phone_number` | String(15) | M-Pesa only, stored as `2547XXXXXXXX` |
| `mpesa_checkout_id` | String(100) | Daraja `CheckoutRequestID` |
| `status` | Enum | `pending`, `completed`, `failed` |
| `timestamp` | DateTime | UTC |

### TokenBlocklist

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `jti` | String(36) | JWT ID — indexed for fast lookup |
| `created_at` | DateTime | UTC |

### LoginAttempt

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `email` | String(120) | Indexed |
| `attempts` | Integer | Increments on each failure |
| `locked_until` | DateTime | Null when not locked |

### PasswordResetToken

| Column | Type | Notes |
|--------|------|-------|
| `id` | Integer | Primary key |
| `user_id` | FK → User | |
| `token` | String(64) | 48-byte URL-safe random token, indexed |
| `expires_at` | DateTime | UTC |
| `used` | Boolean | Marked true after use or re-request |

---

## 6. Authentication & Authorization

All endpoints except the ones listed below require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Public endpoints (no token required)

| Endpoint | Description |
|----------|-------------|
| `POST /auth/bootstrap` | Create first owner account |
| `POST /auth/register` | Cashier self-registration |
| `POST /auth/login` | Obtain tokens |
| `POST /auth/password-reset/request` | Request a reset token |
| `POST /auth/password-reset/confirm` | Confirm reset with token |
| `POST /payments/confirm` | Daraja callback (called by Safaricom) |

### Role permissions

| Action | Owner | Cashier |
|--------|-------|---------|
| View products | ✅ | ✅ |
| Add / edit / delete products | ✅ | ❌ |
| Create sales | ✅ | ✅ |
| Process payments | ✅ | ✅ |
| View daily report | ✅ | ✅ |
| List / approve / deactivate cashiers | ✅ | ❌ |
| View own profile | ✅ | ✅ |
| Change own password | ✅ | ✅ |

### Token lifecycle

```
POST /auth/login
  → access_token  (15 min)
  → refresh_token (7 days)

When access_token expires (401):
  POST /auth/refresh  with refresh_token
    → new access_token + new refresh_token
    → old refresh_token is blocklisted

POST /auth/logout
  → current token (access or refresh) is blocklisted immediately
```

---

## 7. API Reference — Auth

### POST /auth/bootstrap

Creates the first owner account. Returns `403` if an owner already exists.

**Request**
```json
{
  "name": "Jane Wanjiku",
  "email": "jane@perfumeshop.co.ke",
  "password": "Secret@2025"
}
```

**Response `201`**
```json
{
  "message": "Owner account created.",
  "user": {
    "id": 1,
    "name": "Jane Wanjiku",
    "email": "jane@perfumeshop.co.ke",
    "role": "owner",
    "status": "active",
    "created_at": "2025-07-10T08:00:00"
  }
}
```

---

### POST /auth/register

Cashier self-registers. Account starts as `pending` and cannot log in until the owner approves it.

**Request**
```json
{
  "name": "Ali Hassan",
  "email": "ali@perfumeshop.co.ke",
  "password": "Cashier@99"
}
```

**Password rules:** min 8 characters, at least one uppercase letter, one lowercase letter, one number, one special character.

**Response `201`**
```json
{
  "message": "Registration successful. Await owner approval before logging in.",
  "user": { "id": 2, "name": "Ali Hassan", "role": "cashier", "status": "pending", ... }
}
```

---

### POST /auth/login

**Request**
```json
{
  "email": "ali@perfumeshop.co.ke",
  "password": "Cashier@99"
}
```

**Response `200`**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "user": { "id": 2, "name": "Ali Hassan", "role": "cashier", "status": "active", ... }
}
```

**Rate limiting:** After 5 failed attempts the account is locked for 15 minutes. Each failed response includes the number of remaining attempts.

**Error responses**

| Code | Reason |
|------|--------|
| `401` | Wrong email or password |
| `403` | Account pending or inactive |
| `429` | Account locked — too many failed attempts |

---

### POST /auth/logout

Blocklists the current token. Send either the access token or the refresh token.

**Headers:** `Authorization: Bearer <token>`

**Response `200`**
```json
{ "message": "Logged out successfully." }
```

---

### POST /auth/refresh

Exchange a valid refresh token for a new access + refresh token pair. The old refresh token is immediately blocklisted.

**Headers:** `Authorization: Bearer <refresh_token>`

**Response `200`**
```json
{
  "access_token": "<new_jwt>",
  "refresh_token": "<new_jwt>",
  "user": { ... }
}
```

---

### GET /auth/me

Returns the profile of the currently authenticated user.

**Headers:** `Authorization: Bearer <access_token>`

**Response `200`**
```json
{
  "id": 2,
  "name": "Ali Hassan",
  "email": "ali@perfumeshop.co.ke",
  "role": "cashier",
  "status": "active",
  "created_at": "2025-07-10T08:05:00"
}
```

---

### POST /auth/change-password

**Headers:** `Authorization: Bearer <access_token>`

**Request**
```json
{
  "current_password": "Cashier@99",
  "new_password": "NewPass@2025"
}
```

**Response `200`**
```json
{ "message": "Password updated successfully." }
```

---

### GET /auth/users

Owner only. List all cashier accounts. Filter by status with `?status=pending|active|inactive`.

**Headers:** `Authorization: Bearer <owner_access_token>`

**Response `200`**
```json
[
  { "id": 2, "name": "Ali Hassan", "role": "cashier", "status": "pending", ... },
  { "id": 3, "name": "Mary Njeri", "role": "cashier", "status": "active", ... }
]
```

---

### PATCH /auth/users/\<id\>/status

Owner only. Approve or deactivate a cashier.

**Headers:** `Authorization: Bearer <owner_access_token>`

**Request**
```json
{ "status": "active" }
```

`status` must be `"active"` or `"inactive"`.

**Response `200`**
```json
{
  "message": "Cashier 'Ali Hassan' approved.",
  "user": { "id": 2, "status": "active", ... }
}
```

---

### POST /auth/password-reset/request

Request a password reset token. Always returns `200` regardless of whether the email exists (prevents user enumeration).

**Request**
```json
{ "email": "ali@perfumeshop.co.ke" }
```

**Response `200`**
```json
{
  "message": "If that email is registered, a reset token has been issued.",
  "reset_token": "abc123...",
  "expires_in_seconds": 1800
}
```

> **Note:** `reset_token` is returned directly for development/testing. In production, remove it from the response and send it to the user's email instead.

---

### POST /auth/password-reset/confirm

**Request**
```json
{
  "token": "abc123...",
  "new_password": "Reset@2025"
}
```

**Response `200`**
```json
{ "message": "Password reset successful. Please log in again." }
```

**Error responses**

| Code | Reason |
|------|--------|
| `400` | Token missing, invalid, expired, or already used |
| `400` | New password same as current password |
| `400` | Password does not meet strength requirements |

---

## 8. API Reference — Products

All product endpoints require a valid JWT. Write operations (POST, PATCH, DELETE) are restricted to the `owner` role.

### GET /products

Returns all products.

**Headers:** `Authorization: Bearer <access_token>`

**Response `200`**
```json
[
  { "id": 1, "name": "Chanel No. 5 (50ml)", "price": 4500.00, "stock_quantity": 20 },
  { "id": 2, "name": "Dior Sauvage (100ml)", "price": 5200.00, "stock_quantity": 15 }
]
```

---

### POST /products

**Headers:** `Authorization: Bearer <owner_access_token>`

**Request**
```json
{
  "name": "Chanel No. 5 (50ml)",
  "price": 4500.00,
  "stock_quantity": 20
}
```

**Response `201`**
```json
{ "id": 1, "name": "Chanel No. 5 (50ml)", "price": 4500.00, "stock_quantity": 20 }
```

---

### PATCH /products/\<id\>

Update price and/or stock. Both fields are optional.

**Headers:** `Authorization: Bearer <owner_access_token>`

**Request**
```json
{ "price": 4800.00, "stock_quantity": 25 }
```

**Response `200`**
```json
{ "id": 1, "name": "Chanel No. 5 (50ml)", "price": 4800.00, "stock_quantity": 25 }
```

---

### DELETE /products/\<id\>

**Headers:** `Authorization: Bearer <owner_access_token>`

**Response `200`**
```json
{ "message": "Product 'Chanel No. 5 (50ml)' deleted" }
```

---

## 9. API Reference — Sales

### POST /sales

Creates a sale, calculates the total, and deducts stock immediately. The sale starts with `status: "pending"` until payment is confirmed.

**Headers:** `Authorization: Bearer <access_token>`

**Request**
```json
{
  "payment_method": "mpesa",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

`payment_method` must be `"cash"` or `"mpesa"`.

**Response `201`**
```json
{
  "id": 1,
  "total_amount": 12800.00,
  "payment_method": "mpesa",
  "status": "pending",
  "timestamp": "2025-07-10T09:15:00",
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "product_name": "Chanel No. 5 (50ml)",
      "quantity": 2,
      "price": 4500.00,
      "subtotal": 9000.00
    },
    {
      "id": 2,
      "product_id": 3,
      "product_name": "Versace Eros (50ml)",
      "quantity": 1,
      "price": 3800.00,
      "subtotal": 3800.00
    }
  ]
}
```

**Error responses**

| Code | Reason |
|------|--------|
| `400` | Missing items, invalid payment_method, quantity ≤ 0 |
| `400` | Insufficient stock — includes available quantity |
| `404` | Product ID not found |

---

## 10. API Reference — Payments

### POST /payments/cash

Completes a cash sale immediately. Sets both the payment and sale status to `completed`.

**Headers:** `Authorization: Bearer <access_token>`

**Request**
```json
{ "sale_id": 1 }
```

**Response `200`**
```json
{
  "message": "Cash payment recorded",
  "sale": { "id": 1, "status": "completed", ... }
}
```

---

### POST /payments/mpesa

Initiates an M-Pesa STK Push to the customer's phone. If `MPESA_CONSUMER_KEY` is not set, the push is simulated.

**Headers:** `Authorization: Bearer <access_token>`

**Request**
```json
{
  "sale_id": 2,
  "phone_number": "0712345678"
}
```

**Accepted phone formats**

| Input | Stored as |
|-------|-----------|
| `0712345678` | `254712345678` |
| `+254712345678` | `254712345678` |
| `254712345678` | `254712345678` |

**Response `200` — simulation mode**
```json
{
  "message": "STK Push simulated (no API keys configured)",
  "checkout_request_id": "SIMULATED",
  "payment": { "id": 1, "sale_id": 2, "status": "pending", ... }
}
```

**Response `200` — live mode**
```json
{
  "message": "STK Push sent. Awaiting customer confirmation.",
  "checkout_request_id": "ws_CO_07102025_...",
  "payment": { "id": 1, "sale_id": 2, "status": "pending", ... }
}
```

**Error responses**

| Code | Reason |
|------|--------|
| `400` | Sale payment method is not mpesa |
| `400` | Invalid phone number format |
| `409` | Sale already completed |
| `409` | Pending payment already exists for this sale |
| `502` | Daraja API error |

---

### GET /payments/mpesa/status/\<sale_id\>

Poll the M-Pesa payment status for a sale without hitting the Daraja API.

**Headers:** `Authorization: Bearer <access_token>`

**Response `200`**
```json
{
  "sale_id": 2,
  "sale_status": "pending",
  "payment_status": "pending",
  "checkout_request_id": "ws_CO_07102025_...",
  "phone_number": "254712345678",
  "amount": 12800.00,
  "timestamp": "2025-07-10T09:16:00"
}
```

---

### POST /payments/confirm

Confirms or fails an M-Pesa payment. Called automatically by Safaricom as a Daraja callback, or manually for testing.

**No authentication required** — this endpoint must be publicly accessible for Safaricom to reach it.

**Request — manual / testing**
```json
{
  "checkout_request_id": "ws_CO_07102025_...",
  "result_code": 0
}
```

`result_code: 0` = success. Any other value = failure.

**Request — full Daraja callback envelope (sent automatically by Safaricom)**
```json
{
  "Body": {
    "stkCallback": {
      "CheckoutRequestID": "ws_CO_07102025_...",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully."
    }
  }
}
```

**Response `200`**
```json
{
  "message": "Payment completed",
  "payment": { "id": 1, "sale_id": 2, "status": "completed", ... }
}
```

---

## 11. API Reference — Reports

### GET /reports/daily

Returns a summary of all completed sales for a given date. Defaults to today (UTC).

**Headers:** `Authorization: Bearer <access_token>`

**Query parameters**

| Param | Format | Example |
|-------|--------|---------|
| `date` | `YYYY-MM-DD` | `?date=2025-07-10` |

**Response `200`**
```json
{
  "date": "2025-07-10",
  "total_sales": 5,
  "total_revenue": 24500.00,
  "items_sold": 9,
  "breakdown": {
    "cash":  { "count": 2, "total": 9000.00 },
    "mpesa": { "count": 3, "total": 15500.00 }
  }
}
```

Only `completed` sales are included. Pending or failed sales are excluded.

---

## 12. M-Pesa Integration

The system uses the **Safaricom Daraja Lipa Na M-Pesa Online (STK Push)** API.

### Simulation mode

If `MPESA_CONSUMER_KEY` is left blank in `.env`, the system runs in simulation mode:
- `POST /payments/mpesa` returns `checkout_request_id: "SIMULATED"` without calling Daraja
- Use `POST /payments/confirm` with `checkout_request_id: "SIMULATED"` to complete the flow manually
- Useful for development and demos without real API credentials

### Live mode setup

1. Register at [developer.safaricom.co.ke](https://developer.safaricom.co.ke/)
2. Create an app and get your `Consumer Key` and `Consumer Secret`
3. Set `MPESA_ENV=sandbox` for testing, `MPESA_ENV=production` for live
4. Set `MPESA_CALLBACK_URL` to a publicly accessible HTTPS URL

For local development, expose your server with ngrok:

```bash
ngrok http 5000
# Copy the https URL and set:
# MPESA_CALLBACK_URL=https://<ngrok-id>.ngrok.io/payments/confirm
```

### STK Push flow

```
Cashier → POST /payments/mpesa
  → Daraja sends STK prompt to customer's phone
  → Customer enters M-Pesa PIN
  → Daraja POSTs result to MPESA_CALLBACK_URL (/payments/confirm)
  → Sale status updated to "completed"

Poll status anytime:
  GET /payments/mpesa/status/<sale_id>
```

---

## 13. Security Features

| Feature | Details |
|---------|---------|
| Password hashing | bcrypt with per-password salt |
| Password strength | Min 8 chars, uppercase, lowercase, number, special character |
| JWT access tokens | Short-lived (15 min), signed with `JWT_SECRET_KEY` |
| JWT refresh tokens | 7-day lifetime, rotated on every use |
| Token blocklist | Revoked JTIs stored in DB — checked on every request |
| Login rate limiting | 5 failed attempts → 15-minute lockout per email |
| User enumeration protection | Login and password reset return identical messages for unknown emails |
| Role-based access | Owner-only guards on product management and user management |
| Account approval | Cashiers cannot log in until owner sets status to `active` |
| Password reset tokens | Single-use, 30-minute expiry, previous tokens invalidated on re-request |

---

## 14. Business Rules

- Stock is deducted at **sale creation time**, not at payment confirmation
- A sale's status stays `pending` until payment is confirmed
- Cash sales are confirmed immediately via `POST /payments/cash`
- M-Pesa sales are confirmed via the `/payments/confirm` Daraja callback
- Stock cannot go below zero — `400` is returned with the available quantity
- Prices are snapshotted at sale time — changing a product price does not affect past sales
- Only one payment record is allowed per sale — duplicate STK pushes are blocked with `409`
- Only `completed` sales appear in daily reports

---

## 15. Error Reference

All error responses follow this format:

```json
{ "error": "Human-readable message" }
```

### HTTP status codes used

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request — validation error or business rule violation |
| `401` | Unauthenticated — missing, expired, or revoked token |
| `403` | Forbidden — insufficient role or account not active |
| `404` | Resource not found |
| `405` | Method not allowed |
| `409` | Conflict — duplicate resource or state violation |
| `429` | Too many requests — login account locked |
| `500` | Internal server error |
| `502` | Bad gateway — upstream M-Pesa API error |

### Common error messages

| Message | Endpoint | Cause |
|---------|----------|-------|
| `"name, price, and stock_quantity are required"` | POST /products | Missing fields |
| `"Product with this name already exists"` | POST /products | Duplicate name |
| `"stock_quantity cannot be negative"` | PATCH /products | Negative value |
| `"Insufficient stock for '...'. Available: N"` | POST /sales | Not enough stock |
| `"payment_method must be 'cash' or 'mpesa'"` | POST /sales | Invalid value |
| `"Sale already completed"` | POST /payments/* | Double payment attempt |
| `"A pending payment already exists for this sale"` | POST /payments/mpesa | Duplicate STK push |
| `"Invalid phone number. Use format: 07XXXXXXXX..."` | POST /payments/mpesa | Bad phone format |
| `"Invalid or expired reset token."` | POST /auth/password-reset/confirm | Token used or expired |
| `"Account locked due to too many failed attempts."` | POST /auth/login | Rate limit hit |
| `"Your account is awaiting owner approval."` | POST /auth/login | Status is pending |
| `"Token has been revoked. Please log in again."` | Any protected route | Logged out token used |
| `"Token has expired. Please refresh or log in again."` | Any protected route | Access token expired |
