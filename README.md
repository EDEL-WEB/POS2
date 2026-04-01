# Perfume Shop POS — Flask API

A backend REST API for a perfume shop Point of Sale system built with Flask, SQLAlchemy, and PostgreSQL.

---

## Project Structure

```
POS2/
├── app.py          # Flask app factory + entry point
├── config.py       # Configuration (env vars)
├── models.py       # SQLAlchemy models
├── routes.py       # All API endpoints
├── seed.py         # Sample data loader
├── requirements.txt
└── .env.example
```

---

## Setup

### 1. Create and activate a virtual environment

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials and (optionally) M-Pesa keys
```

### 4. Create the PostgreSQL database

```bash
psql -U postgres -c "CREATE DATABASE perfume_pos;"
```

### 5. Run database migrations

```bash
flask db init
flask db migrate -m "initial schema"
flask db upgrade
```

### 6. Seed sample products

```bash
python seed.py
```

### 7. Start the server

```bash
flask run
# or
python app.py
```

Server runs at `http://127.0.0.1:5000`

---

## API Reference

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/products` | List all products |
| POST | `/products` | Add a product |
| PATCH | `/products/<id>` | Update price or stock |
| DELETE | `/products/<id>` | Delete a product |

**POST /products**
```json
{ "name": "Chanel No. 5 (50ml)", "price": 4500.00, "stock_quantity": 20 }
```

**PATCH /products/1**
```json
{ "price": 4800.00, "stock_quantity": 25 }
```

---

### Sales

**POST /sales** — Create a sale (deducts stock immediately)
```json
{
  "payment_method": "mpesa",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```
Returns a `sale` object with `status: "pending"`.

---

### Payments

**POST /payments/cash** — Complete a cash sale instantly
```json
{ "sale_id": 1 }
```

**POST /payments/mpesa** — Initiate M-Pesa STK Push
```json
{ "sale_id": 2, "phone_number": "0712345678" }
```
- `phone_number` accepts `07XXXXXXXX`, `2547XXXXXXXX`, or `+2547XXXXXXXX` — all normalized automatically.
- If `MPESA_CONSUMER_KEY` is not set, the push is **simulated** and returns `checkout_request_id: "SIMULATED"`.
- If keys are configured, a real STK Push is sent via Safaricom Daraja API.
- Returns `409` if a pending or completed payment already exists for the sale.

**GET /payments/mpesa/status/\<sale_id\>** — Poll M-Pesa payment status
```json
{
  "sale_id": 2,
  "sale_status": "pending",
  "payment_status": "pending",
  "checkout_request_id": "ws_CO_...",
  "phone_number": "254712345678",
  "amount": 5200.00,
  "timestamp": "2025-07-10T10:30:00"
}
```

**POST /payments/confirm** — Confirm M-Pesa payment (Daraja callback or manual)
```json
{ "checkout_request_id": "ws_CO_...", "result_code": 0 }
```
`result_code: 0` = success, any other value = failure.

Daraja sends this automatically to `MPESA_CALLBACK_URL`. The endpoint also accepts the full Daraja callback envelope.

---

### Reports

**GET /reports/daily** — Today's completed sales summary

**GET /reports/daily?date=2025-07-10** — Summary for a specific date

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

---

## M-Pesa Integration Notes

- Uses **Safaricom Daraja STK Push** (Lipa Na M-Pesa Online).
- Set `MPESA_ENV=sandbox` for testing with the [Daraja sandbox](https://developer.safaricom.co.ke/).
- `MPESA_CALLBACK_URL` must be a publicly accessible HTTPS URL. Use [ngrok](https://ngrok.com/) during local development:
  ```bash
  ngrok http 5000
  # then set MPESA_CALLBACK_URL=https://<ngrok-id>.ngrok.io/payments/confirm
  ```
- If no API keys are provided, the system runs in **simulation mode** — useful for development and demos.

---

## Business Rules

- Stock is deducted at sale creation time.
- A sale's status stays `pending` until payment is confirmed.
- Cash sales are confirmed immediately via `POST /payments/cash`.
- M-Pesa sales are confirmed via the `/payments/confirm` callback.
- Stock cannot go below zero — the API returns a `400` error if stock is insufficient.
