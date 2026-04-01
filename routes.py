import base64
import requests
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from models import db, Product, Sale, SaleItem, Payment

api = Blueprint("api", __name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def err(msg, code=400):
    return jsonify({"error": msg}), code


def normalize_phone(phone: str) -> str | None:
    """Normalize to 2547XXXXXXXX format. Returns None if invalid."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+"):
        phone = phone[1:]
    if phone.startswith("07") or phone.startswith("01"):
        phone = "254" + phone[1:]
    if phone.startswith("254") and len(phone) == 12 and phone.isdigit():
        return phone
    return None


def get_mpesa_token():
    key = current_app.config["MPESA_CONSUMER_KEY"]
    secret = current_app.config["MPESA_CONSUMER_SECRET"]
    env = current_app.config["MPESA_ENV"]
    base_url = "https://sandbox.safaricom.co.ke" if env == "sandbox" else "https://api.safaricom.co.ke"

    credentials = base64.b64encode(f"{key}:{secret}".encode()).decode()
    resp = requests.get(
        f"{base_url}/oauth/v1/generate?grant_type=client_credentials",
        headers={"Authorization": f"Basic {credentials}"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"], base_url


# ─── Products ────────────────────────────────────────────────────────────────

@api.get("/products")
def list_products():
    return jsonify([p.to_dict() for p in Product.query.all()])


@api.post("/products")
def create_product():
    data = request.get_json() or {}
    if not all(k in data for k in ("name", "price", "stock_quantity")):
        return err("name, price, and stock_quantity are required")

    if Product.query.filter_by(name=data["name"]).first():
        return err("Product with this name already exists", 409)

    product = Product(name=data["name"], price=data["price"], stock_quantity=data["stock_quantity"])
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@api.patch("/products/<int:product_id>")
def update_product(product_id):
    product = db.get_or_404(Product, product_id)
    data = request.get_json() or {}

    if "price" in data:
        product.price = data["price"]
    if "stock_quantity" in data:
        if data["stock_quantity"] < 0:
            return err("stock_quantity cannot be negative")
        product.stock_quantity = data["stock_quantity"]

    db.session.commit()
    return jsonify(product.to_dict())


@api.delete("/products/<int:product_id>")
def delete_product(product_id):
    product = db.get_or_404(Product, product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": f"Product '{product.name}' deleted"})


# ─── Sales ───────────────────────────────────────────────────────────────────

@api.post("/sales")
def create_sale():
    """
    Body: { "payment_method": "cash|mpesa", "items": [{"product_id": 1, "quantity": 2}] }
    """
    data = request.get_json() or {}
    items_data = data.get("items", [])
    payment_method = data.get("payment_method")

    if not items_data:
        return err("items list is required")
    if payment_method not in ("cash", "mpesa"):
        return err("payment_method must be 'cash' or 'mpesa'")

    total = 0
    resolved_items = []

    for entry in items_data:
        product = db.session.get(Product, entry.get("product_id"))
        if not product:
            return err(f"Product id {entry.get('product_id')} not found", 404)

        qty = entry.get("quantity", 0)
        if qty <= 0:
            return err(f"Quantity for product '{product.name}' must be greater than zero")
        if product.stock_quantity < qty:
            return err(f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity}")

        total += float(product.price) * qty
        resolved_items.append((product, qty))

    # Deduct stock and build sale
    sale = Sale(total_amount=total, payment_method=payment_method, status="pending")
    db.session.add(sale)
    db.session.flush()   # get sale.id before commit

    for product, qty in resolved_items:
        product.stock_quantity -= qty
        db.session.add(SaleItem(sale_id=sale.id, product_id=product.id, quantity=qty, price=product.price))

    db.session.commit()
    return jsonify(sale.to_dict()), 201


# ─── Payments ────────────────────────────────────────────────────────────────

@api.post("/payments/cash")
def pay_cash():
    """Body: { "sale_id": 1 }"""
    data = request.get_json() or {}
    sale = db.get_or_404(Sale, data.get("sale_id"))

    if sale.payment_method != "cash":
        return err("Sale payment method is not cash")
    if sale.status == "completed":
        return err("Sale already completed", 409)

    payment = Payment(sale_id=sale.id, status="completed")
    sale.status = "completed"
    db.session.add(payment)
    db.session.commit()
    return jsonify({"message": "Cash payment recorded", "sale": sale.to_dict()})


@api.post("/payments/mpesa")
def initiate_mpesa():
    """
    Body: { "sale_id": 1, "phone_number": "2547XXXXXXXX" }
    Initiates Daraja STK Push. Falls back to simulation if keys are not configured.
    """
    data = request.get_json() or {}
    sale = db.get_or_404(Sale, data.get("sale_id"))
    phone = data.get("phone_number", "").strip()

    if sale.payment_method != "mpesa":
        return err("Sale payment method is not mpesa")
    if sale.status == "completed":
        return err("Sale already completed", 409)
    if not phone:
        return err("phone_number is required")

    phone = normalize_phone(phone)
    if not phone:
        return err("Invalid phone number. Use format: 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX")

    # Prevent duplicate STK push on the same sale
    existing = Payment.query.filter_by(sale_id=sale.id).first()
    if existing and existing.status == "pending":
        return err("A pending payment already exists for this sale. Confirm or wait before retrying.", 409)
    if existing and existing.status == "completed":
        return err("Sale already paid", 409)

    consumer_key = current_app.config["MPESA_CONSUMER_KEY"]

    # ── Simulation mode (no API keys configured) ──────────────────────────
    if not consumer_key:
        payment = Payment(sale_id=sale.id, phone_number=phone, mpesa_checkout_id="SIMULATED", status="pending")
        db.session.add(payment)
        db.session.commit()
        return jsonify({
            "message": "STK Push simulated (no API keys configured)",
            "checkout_request_id": "SIMULATED",
            "payment": payment.to_dict(),
        })

    # ── Live Daraja STK Push ───────────────────────────────────────────────
    try:
        token, base_url = get_mpesa_token()
        shortcode = current_app.config["MPESA_SHORTCODE"]
        passkey = current_app.config["MPESA_PASSKEY"]
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        password = base64.b64encode(f"{shortcode}{passkey}{timestamp}".encode()).decode()

        payload = {
            "BusinessShortCode": shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(float(sale.total_amount)),
            "PartyA": phone,
            "PartyB": shortcode,
            "PhoneNumber": phone,
            "CallBackURL": current_app.config["MPESA_CALLBACK_URL"],
            "AccountReference": f"Sale-{sale.id}",
            "TransactionDesc": "Perfume POS Payment",
        }

        resp = requests.post(
            f"{base_url}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()

        checkout_id = result.get("CheckoutRequestID")
        payment = Payment(sale_id=sale.id, phone_number=phone, mpesa_checkout_id=checkout_id, status="pending")
        db.session.add(payment)
        db.session.commit()

        return jsonify({
            "message": "STK Push sent. Awaiting customer confirmation.",
            "checkout_request_id": checkout_id,
            "payment": payment.to_dict(),
        })

    except requests.RequestException as exc:
        return err(f"M-Pesa API error: {str(exc)}", 502)


@api.get("/payments/mpesa/status/<int:sale_id>")
def mpesa_payment_status(sale_id):
    """Poll M-Pesa payment status for a given sale."""
    sale = db.get_or_404(Sale, sale_id)
    if sale.payment_method != "mpesa":
        return err("Sale is not an M-Pesa sale")

    payment = Payment.query.filter_by(sale_id=sale_id).first()
    if not payment:
        return err("No M-Pesa payment initiated for this sale", 404)

    return jsonify({
        "sale_id": sale_id,
        "sale_status": sale.status,
        "payment_status": payment.status,
        "checkout_request_id": payment.mpesa_checkout_id,
        "phone_number": payment.phone_number,
        "amount": float(sale.total_amount),
        "timestamp": payment.timestamp.isoformat(),
    })


@api.post("/payments/confirm")
def confirm_mpesa():
    """
    Safaricom callback body OR manual confirmation:
    { "checkout_request_id": "...", "result_code": 0 }
    result_code 0 = success, anything else = failure.
    """
    data = request.get_json() or {}

    # Support both Daraja callback envelope and direct JSON
    body = data.get("Body", {}).get("stkCallback", data)
    checkout_id = body.get("CheckoutRequestID") or data.get("checkout_request_id")
    result_code = body.get("ResultCode", data.get("result_code", 1))

    if not checkout_id:
        return err("checkout_request_id is required")

    payment = Payment.query.filter_by(mpesa_checkout_id=checkout_id).first()
    if not payment:
        return err("Payment not found", 404)
    if payment.status == "completed":
        return jsonify({"message": "Payment already confirmed"}), 200

    if str(result_code) == "0":
        payment.status = "completed"
        payment.sale.status = "completed"
    else:
        payment.status = "failed"

    db.session.commit()
    return jsonify({"message": f"Payment {payment.status}", "payment": payment.to_dict()})


# ─── Reports ─────────────────────────────────────────────────────────────────

@api.get("/reports/daily")
def daily_report():
    """Optional query param: ?date=YYYY-MM-DD (defaults to today UTC)"""
    date_str = request.args.get("date")
    try:
        report_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.now(timezone.utc).date()
    except ValueError:
        return err("Invalid date format. Use YYYY-MM-DD")

    sales = Sale.query.filter(
        db.func.date(Sale.timestamp) == report_date,
        Sale.status == "completed",
    ).all()

    total_revenue = sum(float(s.total_amount) for s in sales)
    items_sold = sum(item.quantity for s in sales for item in s.items)
    cash_total = sum(float(s.total_amount) for s in sales if s.payment_method == "cash")
    mpesa_total = sum(float(s.total_amount) for s in sales if s.payment_method == "mpesa")

    return jsonify({
        "date": report_date.isoformat(),
        "total_sales": len(sales),
        "total_revenue": round(total_revenue, 2),
        "items_sold": items_sold,
        "breakdown": {
            "cash": {"count": sum(1 for s in sales if s.payment_method == "cash"), "total": round(cash_total, 2)},
            "mpesa": {"count": sum(1 for s in sales if s.payment_method == "mpesa"), "total": round(mpesa_total, 2)},
        },
    })
