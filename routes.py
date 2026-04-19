import base64
import secrets
import requests
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models import db, Product, Sale, SaleItem, Payment, Settings, User

api = Blueprint("api", __name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def err(msg, code=400):
    return jsonify({"error": msg}), code


def owner_only():
    """Returns error response if caller is not an owner, else None."""
    if get_jwt().get("role") != "owner":
        return err("Owner access required", 403)
    return None


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


def _make_checkout_id() -> str:
    """Generate a Daraja-style CheckoutRequestID e.g. ws_CO_10072025091523172396192."""
    ts = datetime.now(timezone.utc).strftime("%d%m%Y%H%M%S")
    rand = secrets.randbelow(10 ** 12)
    return f"ws_CO_{ts}{rand:012d}"


def _make_merchant_id() -> str:
    """Generate a Daraja-style MerchantRequestID e.g. 29115-34620561-1."""
    return f"{secrets.randbelow(99999):05d}-{secrets.randbelow(99999999):08d}-1"


def _make_receipt_number() -> str:
    """Generate a realistic M-Pesa receipt number e.g. NLJ7RT61SV."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"
    return "".join(secrets.choice(chars) for _ in range(10))


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
@jwt_required()
def list_products():
    query = Product.query

    search = (request.args.get("search") or "").strip()
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))

    if request.args.get("low_stock") in ("1", "true", "yes"):
        query = query.filter(Product.stock_quantity <= 5)

    min_price = request.args.get("min_price")
    if min_price is not None and min_price != "":
        try:
            query = query.filter(Product.price >= float(min_price))
        except ValueError:
            return err("min_price must be a valid number")

    max_price = request.args.get("max_price")
    if max_price is not None and max_price != "":
        try:
            query = query.filter(Product.price <= float(max_price))
        except ValueError:
            return err("max_price must be a valid number")

    return jsonify([p.to_dict() for p in query.order_by(Product.name).all()])


@api.get("/products/<int:product_id>")
@jwt_required()
def get_product(product_id):
    product = db.get_or_404(Product, product_id)
    return jsonify(product.to_dict())


@api.post("/products")
@jwt_required()
def create_product():
    if (guard := owner_only()): return guard
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
@jwt_required()
def update_product(product_id):
    if (guard := owner_only()): return guard
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
@jwt_required()
def delete_product(product_id):
    if (guard := owner_only()): return guard
    product = db.get_or_404(Product, product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": f"Product '{product.name}' deleted"})


# ─── Sales ───────────────────────────────────────────────────────────────────

@api.post("/sales")
@jwt_required()
def create_sale():
    identity = get_jwt_identity()
    if not identity:
        return err("Invalid authentication", 401)
    try:
        user_id = int(identity)
    except ValueError:
        return err("Invalid user identity", 401)
    
    user = db.get_or_404(User, user_id)  # Verify user exists
    
    data = request.get_json() or {}
    items_data = data.get("items", [])
    payment_method = data.get("payment_method")
    notes = data.get("notes")
    customer_ref = data.get("customer_ref")

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

    sale = Sale(user_id=user_id, total_amount=total, payment_method=payment_method, status="pending", notes=notes, customer_ref=customer_ref)
    db.session.add(sale)
    db.session.flush()

    for product, qty in resolved_items:
        product.stock_quantity -= qty
        db.session.add(SaleItem(sale_id=sale.id, product_id=product.id, quantity=qty, price=product.price))

    db.session.commit()
    return jsonify(sale.to_dict()), 201


@api.get("/sales")
@jwt_required()
def list_sales():
    query = Sale.query

    status_filter = request.args.get("status")
    if status_filter in ("pending", "completed", "cancelled"):
        query = query.filter(Sale.status == status_filter)

    payment_method = request.args.get("payment_method")
    if payment_method in ("cash", "mpesa"):
        query = query.filter(Sale.payment_method == payment_method)

    date_str = request.args.get("date")
    if date_str:
        try:
            report_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            query = query.filter(db.func.date(Sale.timestamp) == report_date)
        except ValueError:
            return err("Invalid date format. Use YYYY-MM-DD")

    # Order by timestamp first, then apply limit
    sales_query = query.order_by(Sale.timestamp.desc())

    # Add limit parameter for homepage recent sales
    limit = request.args.get("limit")
    if limit:
        try:
            limit = int(limit)
            if limit < 1 or limit > 100:
                return err("limit must be between 1 and 100")
            sales_query = sales_query.limit(limit)
        except ValueError:
            return err("limit must be a valid integer")

    sales = sales_query.all()
    return jsonify([sale.to_dict() for sale in sales])


@api.get("/sales/<int:sale_id>")
@jwt_required()
def get_sale(sale_id):
    sale = db.get_or_404(Sale, sale_id)
    payload = sale.to_dict()
    if sale.payment:
        payload["payment"] = sale.payment.to_dict()
    return jsonify(payload)


# ─── Sale cancellation ───────────────────────────────────────────────────────

@api.post("/sales/<int:sale_id>/cancel")
@jwt_required()
def cancel_sale(sale_id):
    sale = db.get_or_404(Sale, sale_id)

    if sale.status == "completed":
        return err("Cannot cancel a completed sale.", 409)
    if sale.status == "cancelled":
        return err("Sale is already cancelled.", 409)
    if sale.payment and sale.payment.status == "pending":
        return err(
            "A payment is currently pending for this sale. "
            "Wait for it to complete or fail before cancelling.",
            409,
        )

    sale.restore_stock()
    sale.status = "cancelled"
    if sale.payment:
        sale.payment.status = "failed"

    db.session.commit()
    return jsonify({"message": f"Sale #{sale.id} cancelled and stock restored.", "sale": sale.to_dict()})


# ─── Payments ────────────────────────────────────────────────────────────────

@api.post("/payments/cash")
@jwt_required()
def pay_cash():
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
@jwt_required()
def initiate_mpesa():
    """
    Body: { "sale_id": 1, "phone_number": "07XXXXXXXX" }
    Sends a live Daraja STK Push. If MPESA_CONSUMER_KEY is not set,
    falls into simulation mode — use POST /payments/mpesa/simulate to complete.
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

    existing = Payment.query.filter_by(sale_id=sale.id).first()
    if existing and existing.status == "pending":
        return err("A pending payment already exists for this sale. Confirm or wait before retrying.", 409)
    if existing and existing.status == "completed":
        return err("Sale already paid", 409)
    if existing and existing.status == "failed":
        db.session.delete(existing)
        db.session.flush()

    consumer_key = current_app.config["MPESA_CONSUMER_KEY"]

    # ── Simulation mode ───────────────────────────────────────────────────
    if not consumer_key:
        checkout_id = _make_checkout_id()
        merchant_id = _make_merchant_id()
        payment = Payment(
            sale_id=sale.id,
            phone_number=phone,
            merchant_request_id=merchant_id,
            mpesa_checkout_id=checkout_id,
            status="pending",
        )
        db.session.add(payment)
        db.session.commit()
        return jsonify({
            "message": "STK Push simulated. Use POST /payments/mpesa/simulate to complete or fail.",
            "checkout_request_id": checkout_id,
            "merchant_request_id": merchant_id,
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
            "TransactionType": current_app.config.get("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline"),
            "Amount": int(float(sale.total_amount)),
            "PartyA": phone,
            "PartyB": current_app.config.get("MPESA_PARTY_B", shortcode),
            "PhoneNumber": phone,
            "CallBackURL": current_app.config["MPESA_CALLBACK_URL"],
            "AccountReference": f"Sale-{sale.id}"[:12],
            "TransactionDesc": "POS Payment"[:13],
        }

        resp = requests.post(
            f"{base_url}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()

        if result.get("ResponseCode") != "0":
            return err(f"M-Pesa rejected the request: {result.get('ResponseDescription', 'Unknown error')}", 502)

        checkout_id = result.get("CheckoutRequestID")
        merchant_request_id = result.get("MerchantRequestID")
        payment = Payment(
            sale_id=sale.id,
            phone_number=phone,
            merchant_request_id=merchant_request_id,
            mpesa_checkout_id=checkout_id,
            status="pending",
        )
        db.session.add(payment)
        db.session.commit()

        return jsonify({
            "message": "STK Push sent. Awaiting customer confirmation.",
            "checkout_request_id": checkout_id,
            "merchant_request_id": merchant_request_id,
            "payment": payment.to_dict(),
        })

    except requests.RequestException as exc:
        return err(f"M-Pesa API error: {str(exc)}", 502)


@api.post("/payments/mpesa/simulate")
@jwt_required()
def simulate_mpesa():
    """
    Simulates the Safaricom callback for a pending payment.
    Only works when MPESA_CONSUMER_KEY is not set (simulation mode).

    Body: { "checkout_request_id": "ws_CO_...", "result_code": 0 }
      result_code 0  = customer paid successfully
      result_code 1  = insufficient funds
      result_code 1032 = cancelled by user
      result_code 2001 = wrong PIN
    """
    if current_app.config["MPESA_CONSUMER_KEY"]:
        return err("Simulate endpoint is only available in simulation mode (no MPESA_CONSUMER_KEY set).", 403)

    data = request.get_json() or {}
    checkout_id = data.get("checkout_request_id")
    result_code = int(data.get("result_code", 0))

    if not checkout_id:
        return err("checkout_request_id is required")

    payment = Payment.query.filter_by(mpesa_checkout_id=checkout_id).first()
    if not payment:
        return err("Payment not found", 404)
    if payment.status != "pending":
        return err(f"Payment is already {payment.status}", 409)

    # Build the exact Daraja callback envelope
    if result_code == 0:
        receipt = _make_receipt_number()
        ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        callback = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": payment.merchant_request_id,
                    "CheckoutRequestID": checkout_id,
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount",             "Value": float(payment.sale.total_amount)},
                            {"Name": "MpesaReceiptNumber", "Value": receipt},
                            {"Name": "TransactionDate",    "Value": int(ts)},
                            {"Name": "PhoneNumber",        "Value": int(payment.phone_number)},
                        ]
                    },
                }
            }
        }
    else:
        result_descriptions = {
            1:    "The balance is insufficient for the transaction.",
            1032: "Request cancelled by user.",
            2001: "The initiator information is invalid.",
        }
        callback = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": payment.merchant_request_id,
                    "CheckoutRequestID": checkout_id,
                    "ResultCode": result_code,
                    "ResultDesc": result_descriptions.get(result_code, "An error occurred."),
                }
            }
        }

    # Feed the callback through the real confirm endpoint logic
    body = callback["Body"]["stkCallback"]
    if result_code == 0:
        payment.status = "completed"
        payment.sale.status = "completed"
        items = body.get("CallbackMetadata", {}).get("Item", [])
        for item in items:
            if item.get("Name") == "MpesaReceiptNumber":
                payment.mpesa_receipt_number = str(item.get("Value", ""))
                break
    else:
        payment.status = "failed"
        payment.sale.restore_stock()

    db.session.commit()

    return jsonify({
        "message": f"Simulation complete. Payment {payment.status}.",
        "simulated_callback": callback,
        "payment": payment.to_dict(),
    })


@api.get("/payments/mpesa/status/<int:sale_id>")
@jwt_required()
def mpesa_payment_status(sale_id):
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
        "merchant_request_id": payment.merchant_request_id,
        "mpesa_receipt_number": payment.mpesa_receipt_number,
        "phone_number": payment.phone_number,
        "amount": float(sale.total_amount),
        "timestamp": payment.timestamp.isoformat(),
    })


@api.post("/payments/confirm")
def confirm_mpesa():
    """
    Daraja callback endpoint — called automatically by Safaricom.
    Also accepts manual flat JSON for testing:
      { "checkout_request_id": "ws_CO_...", "result_code": 0 }
    """
    data = request.get_json() or {}

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
        items = body.get("CallbackMetadata", {}).get("Item", [])
        for item in items:
            if item.get("Name") == "MpesaReceiptNumber":
                payment.mpesa_receipt_number = str(item.get("Value", ""))
                break
    else:
        payment.status = "failed"
        payment.sale.restore_stock()

    db.session.commit()
    return jsonify({"message": f"Payment {payment.status}", "payment": payment.to_dict()})


# ─── Reports ─────────────────────────────────────────────────────────────────

@api.get("/reports/daily")
@jwt_required()
def daily_report():
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
            "cash":  {"count": sum(1 for s in sales if s.payment_method == "cash"),  "total": round(cash_total, 2)},
            "mpesa": {"count": sum(1 for s in sales if s.payment_method == "mpesa"), "total": round(mpesa_total, 2)},
        },
    })


@api.get("/reports/weekly")
@jwt_required()
def weekly_report():
    date_str = request.args.get("date")
    try:
        if date_str:
            start_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            today = datetime.now(timezone.utc).date()
            start_date = today - timedelta(days=today.weekday())  # Monday of current week
    except ValueError:
        return err("Invalid date format. Use YYYY-MM-DD")

    end_date = start_date + timedelta(days=6)
    sales = Sale.query.filter(
        db.func.date(Sale.timestamp) >= start_date,
        db.func.date(Sale.timestamp) <= end_date,
        Sale.status == "completed",
    ).all()

    total_revenue = sum(float(s.total_amount) for s in sales)
    items_sold = sum(item.quantity for s in sales for item in s.items)
    cash_total = sum(float(s.total_amount) for s in sales if s.payment_method == "cash")
    mpesa_total = sum(float(s.total_amount) for s in sales if s.payment_method == "mpesa")

    return jsonify({
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_sales": len(sales),
        "total_revenue": round(total_revenue, 2),
        "items_sold": items_sold,
        "breakdown": {
            "cash":  {"count": sum(1 for s in sales if s.payment_method == "cash"),  "total": round(cash_total, 2)},
            "mpesa": {"count": sum(1 for s in sales if s.payment_method == "mpesa"), "total": round(mpesa_total, 2)},
        },
    })


@api.get("/reports/monthly")
@jwt_required()
def monthly_report():
    date_str = request.args.get("date")
    try:
        if date_str:
            report_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        else:
            report_date = datetime.now(timezone.utc).date()
    except ValueError:
        return err("Invalid date format. Use YYYY-MM-DD")

    start_date = report_date.replace(day=1)
    next_month = start_date.replace(month=start_date.month % 12 + 1, day=1) if start_date.month < 12 else start_date.replace(year=start_date.year + 1, month=1, day=1)
    end_date = next_month - timedelta(days=1)

    sales = Sale.query.filter(
        db.func.date(Sale.timestamp) >= start_date,
        db.func.date(Sale.timestamp) <= end_date,
        Sale.status == "completed",
    ).all()

    total_revenue = sum(float(s.total_amount) for s in sales)
    items_sold = sum(item.quantity for s in sales for item in s.items)
    cash_total = sum(float(s.total_amount) for s in sales if s.payment_method == "cash")
    mpesa_total = sum(float(s.total_amount) for s in sales if s.payment_method == "mpesa")

    return jsonify({
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_sales": len(sales),
        "total_revenue": round(total_revenue, 2),
        "items_sold": items_sold,
        "breakdown": {
            "cash":  {"count": sum(1 for s in sales if s.payment_method == "cash"),  "total": round(cash_total, 2)},
            "mpesa": {"count": sum(1 for s in sales if s.payment_method == "mpesa"), "total": round(mpesa_total, 2)},
        },
    })


@api.get("/reports/top-products")
@jwt_required()
def top_products_report():
    limit = int(request.args.get("limit", 10))
    if limit < 1 or limit > 100:
        return err("limit must be between 1 and 100")

    # Aggregate sales by product
    result = db.session.query(
        Product.name,
        db.func.sum(SaleItem.quantity).label("total_quantity"),
        db.func.sum(SaleItem.price * SaleItem.quantity).label("total_revenue")
    ).join(SaleItem, Product.id == SaleItem.product_id).join(Sale, SaleItem.sale_id == Sale.id).filter(
        Sale.status == "completed"
    ).group_by(Product.id, Product.name).order_by(db.desc("total_quantity")).limit(limit).all()

    return jsonify([
        {
            "name": row.name,
            "total_quantity": int(row.total_quantity),
            "total_revenue": round(float(row.total_revenue), 2)
        } for row in result
    ])


@api.get("/reports/cashflow")
@jwt_required()
def cashflow_report():
    days = int(request.args.get("days", 30))
    if days < 1 or days > 365:
        return err("days must be between 1 and 365")

    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    sales = Sale.query.filter(
        Sale.timestamp >= start_date,
        Sale.status == "completed",
    ).order_by(Sale.timestamp).all()

    daily_totals = {}
    for sale in sales:
        date_key = sale.timestamp.date().isoformat()
        if date_key not in daily_totals:
            daily_totals[date_key] = {"cash": 0, "mpesa": 0}
        daily_totals[date_key][sale.payment_method] += float(sale.total_amount)

    return jsonify({
        "start_date": start_date.date().isoformat(),
        "days": days,
        "daily_totals": daily_totals,
    })


# ─── Inventory Management ─────────────────────────────────────────────────────

@api.patch("/products/<int:product_id>/stock")
@jwt_required()
def adjust_stock(product_id):
    if (guard := owner_only()): return guard
    product = db.get_or_404(Product, product_id)
    data = request.get_json() or {}
    adjustment = data.get("adjustment")
    reason = data.get("reason", "")

    if adjustment is None:
        return err("adjustment is required")
    try:
        adjustment = int(adjustment)
    except ValueError:
        return err("adjustment must be an integer")

    new_stock = product.stock_quantity + adjustment
    if new_stock < 0:
        return err("Stock cannot go below zero")

    product.stock_quantity = new_stock
    db.session.commit()
    return jsonify({
        "message": f"Stock adjusted by {adjustment}. New stock: {new_stock}",
        "product": product.to_dict(),
    })


@api.get("/products/low-stock")
@jwt_required()
def low_stock_products():
    threshold = int(request.args.get("threshold", 5))
    if threshold < 0:
        return err("threshold must be non-negative")

    products = Product.query.filter(Product.stock_quantity <= threshold).order_by(Product.stock_quantity).all()
    return jsonify([p.to_dict() for p in products])


@api.post("/products/bulk-import")
@jwt_required()
def bulk_import_products():
    if (guard := owner_only()): return guard
    data = request.get_json() or {}
    products_data = data.get("products", [])

    if not products_data:
        return err("products list is required")

    imported = []
    errors = []

    for i, prod_data in enumerate(products_data):
        try:
            name = prod_data.get("name", "").strip()
            price = prod_data.get("price")
            stock_quantity = prod_data.get("stock_quantity", 0)

            if not name or price is None:
                errors.append(f"Row {i+1}: name and price are required")
                continue

            if Product.query.filter_by(name=name).first():
                errors.append(f"Row {i+1}: Product '{name}' already exists")
                continue

            product = Product(name=name, price=price, stock_quantity=stock_quantity)
            db.session.add(product)
            imported.append(product.to_dict())
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    if imported:
        db.session.commit()

    return jsonify({
        "imported": len(imported),
        "errors": errors,
        "products": imported,
    })


@api.get("/inventory/value")
@jwt_required()
def inventory_value():
    result = db.session.query(
        db.func.sum(Product.price * Product.stock_quantity).label("total_value"),
        db.func.count(Product.id).label("total_products")
    ).first()

    return jsonify({
        "total_value": round(float(result.total_value or 0), 2),
        "total_products": int(result.total_products or 0),
    })


# ─── Sales Enhancements ──────────────────────────────────────────────────────

@api.post("/sales/<int:sale_id>/refund")
@jwt_required()
def refund_sale(sale_id):
    sale = db.get_or_404(Sale, sale_id)

    if sale.status != "completed":
        return err("Only completed sales can be refunded", 409)

    data = request.get_json() or {}
    refund_amount = data.get("refund_amount")
    reason = data.get("reason", "")

    if refund_amount is None:
        refund_amount = float(sale.total_amount)
    else:
        refund_amount = float(refund_amount)
        if refund_amount <= 0 or refund_amount > float(sale.total_amount):
            return err("Invalid refund amount")

    # For simplicity, mark as refunded and restore stock
    sale.status = "cancelled"  # Or add a "refunded" status
    sale.restore_stock()

    db.session.commit()
    return jsonify({
        "message": f"Sale #{sale.id} refunded for KES {refund_amount:.2f}",
        "sale": sale.to_dict(),
    })


@api.get("/sales/<int:sale_id>/receipt")
@jwt_required()
def get_sale_receipt(sale_id):
    sale = db.get_or_404(Sale, sale_id)

    if sale.status != "completed":
        return err("Receipt only available for completed sales", 404)

    receipt = {
        "sale_id": sale.id,
        "timestamp": sale.timestamp.isoformat(),
        "customer_ref": sale.customer_ref,
        "cashier_name": sale.user.name if sale.user else "Unknown",
        "payment_method": sale.payment_method,
        "total_amount": float(sale.total_amount),
        "items": [item.to_dict() for item in sale.items],
        "notes": sale.notes,
    }

    if sale.payment and sale.payment.mpesa_receipt_number:
        receipt["receipt_number"] = sale.payment.mpesa_receipt_number

    return jsonify(receipt)


# ─── Settings ────────────────────────────────────────────────────────────────

@api.get("/settings")
@jwt_required()
def get_settings():
    if (guard := owner_only()): return guard
    settings = Settings.query.first()
    if not settings:
        # Return default settings if none exist
        return jsonify({
            "business_name": "",
            "business_address": "",
            "tax_rate": 0,
            "currency": "KES",
            "receipt_footer": "",
            "low_stock_threshold": 5,
            "enable_mpesa": True,
            "enable_cash": True,
        })
    return jsonify(settings.to_dict())


@api.put("/settings")
@jwt_required()
def update_settings():
    if (guard := owner_only()): return guard
    data = request.get_json() or {}

    settings = Settings.query.first()
    if not settings:
        settings = Settings()

    # Update fields
    settings.business_name = data.get("business_name", settings.business_name)
    settings.business_address = data.get("business_address", settings.business_address)
    settings.tax_rate = data.get("tax_rate", settings.tax_rate or 0)
    settings.currency = data.get("currency", settings.currency or "KES")
    settings.receipt_footer = data.get("receipt_footer", settings.receipt_footer)
    settings.low_stock_threshold = data.get("low_stock_threshold", settings.low_stock_threshold or 5)
    settings.enable_mpesa = data.get("enable_mpesa", settings.enable_mpesa if settings.enable_mpesa is not None else True)
    settings.enable_cash = data.get("enable_cash", settings.enable_cash if settings.enable_cash is not None else True)

    db.session.add(settings)
    db.session.commit()

    return jsonify(settings.to_dict())
