import re
import secrets
from datetime import datetime, timezone, timedelta
from flask_sqlalchemy import SQLAlchemy
from bcrypt import hashpw, checkpw, gensalt

db = SQLAlchemy()


class TokenBlocklist(db.Model):
    """Stores revoked JWT JTIs for logout and refresh token rotation."""
    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


class LoginAttempt(db.Model):
    """Tracks failed login attempts per email for brute-force protection."""
    __tablename__ = "login_attempts"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    def is_locked(self) -> bool:
        if self.locked_until and datetime.now(timezone.utc) < self.locked_until:
            return True
        return False

    def seconds_until_unlock(self) -> int:
        if self.locked_until:
            delta = self.locked_until - datetime.now(timezone.utc)
            return max(0, int(delta.total_seconds()))
        return 0

    def record_failure(self, max_attempts: int, lockout_minutes: int):
        self.attempts += 1
        if self.attempts >= max_attempts:
            self.locked_until = datetime.now(timezone.utc) + timedelta(minutes=lockout_minutes)

    def reset(self):
        self.attempts = 0
        self.locked_until = None


class PasswordResetToken(db.Model):
    """Single-use password reset tokens."""
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)

    user = db.relationship("User")

    @staticmethod
    def generate(user_id: int, expires_seconds: int) -> "PasswordResetToken":
        return PasswordResetToken(
            user_id=user_id,
            token=secrets.token_urlsafe(48),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_seconds),
        )

    def is_valid(self) -> bool:
        return not self.used and datetime.now(timezone.utc) < self.expires_at


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True)
    password_hash = db.Column(db.String(72), nullable=False)
    role = db.Column(db.Enum("owner", "cashier", name="user_role_enum"), nullable=False, default="cashier")
    status = db.Column(db.Enum("pending", "active", "inactive", name="user_status_enum"), nullable=False, default="pending")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # ── Validation ────────────────────────────────────────────────────────
    @staticmethod
    def validate_email(email: str) -> bool:
        return bool(re.match(r"^[\w.+-]+@[\w-]+\.[\w.]+$", email))

    @staticmethod
    def validate_password(password: str) -> list[str]:
        """Returns list of validation errors. Empty list = valid."""
        errors = []
        if len(password) < 8:
            errors.append("at least 8 characters")
        if not re.search(r"[A-Z]", password):
            errors.append("at least one uppercase letter")
        if not re.search(r"[a-z]", password):
            errors.append("at least one lowercase letter")
        if not re.search(r"\d", password):
            errors.append("at least one number")
        if not re.search(r"[^\w]", password):
            errors.append("at least one special character")
        return errors

    def set_password(self, password: str):
        self.password_hash = hashpw(password.encode(), gensalt()).decode()

    def check_password(self, password: str) -> bool:
        return checkpw(password.encode(), self.password_hash.encode())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    image_url = db.Column(db.String(300), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    sale_items = db.relationship("SaleItem", back_populates="product", passive_deletes=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": float(self.price),
            "stock_quantity": self.stock_quantity,
            "image_url": self.image_url,
            "is_active": self.is_active,
        }


class Sale(db.Model):
    __tablename__ = "sales"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.Enum("cash", "mpesa", name="payment_method_enum"), nullable=False)
    status = db.Column(db.Enum("pending", "completed", "cancelled", name="sale_status_enum"), default="pending")
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    notes = db.Column(db.Text, nullable=True)  # Optional sale notes
    customer_ref = db.Column(db.String(100), nullable=True)  # Customer reference or name

    user = db.relationship("User")
    items = db.relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payment = db.relationship("Payment", back_populates="sale", uselist=False)

    def restore_stock(self):
        """Return each sale item's quantity back to its product's stock."""
        for item in self.items:
            item.product.stock_quantity += item.quantity

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "cashier_name": self.user.name if self.user else None,
            "total_amount": float(self.total_amount),
            "payment_method": self.payment_method,
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
            "notes": self.notes,
            "customer_ref": self.customer_ref,
            "items": [item.to_dict() for item in self.items],
        }


class SaleItem(db.Model):
    __tablename__ = "sale_items"

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sales.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)   # price at time of sale

    sale = db.relationship("Sale", back_populates="items")
    product = db.relationship("Product", back_populates="sale_items")

    def to_dict(self):
        return {
            "id": self.id,
            "product_id": self.product_id,
            "product_name": self.product.name,
            "quantity": self.quantity,
            "price": float(self.price),
            "subtotal": float(self.price * self.quantity),
        }


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sales.id"), nullable=False, unique=True)
    phone_number = db.Column(db.String(15))                # M-Pesa only, stored as 2547XXXXXXXX
    merchant_request_id = db.Column(db.String(100))        # MerchantRequestID from Daraja STK response
    mpesa_checkout_id = db.Column(db.String(100))          # CheckoutRequestID from Daraja STK response
    mpesa_receipt_number = db.Column(db.String(20))        # MpesaReceiptNumber from successful callback
    status = db.Column(db.Enum("pending", "completed", "failed", name="payment_status_enum"), default="pending")
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sale = db.relationship("Sale", back_populates="payment")

    def to_dict(self):
        return {
            "id": self.id,
            "sale_id": self.sale_id,
            "phone_number": self.phone_number,
            "merchant_request_id": self.merchant_request_id,
            "mpesa_checkout_id": self.mpesa_checkout_id,
            "mpesa_receipt_number": self.mpesa_receipt_number,
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
        }


class Settings(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(120), nullable=True)
    business_address = db.Column(db.Text, nullable=True)
    tax_rate = db.Column(db.Numeric(5, 2), default=0)
    currency = db.Column(db.String(3), default="KES")
    receipt_footer = db.Column(db.Text, nullable=True)
    low_stock_threshold = db.Column(db.Integer, default=5)
    enable_mpesa = db.Column(db.Boolean, default=True)
    enable_cash = db.Column(db.Boolean, default=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "business_name": self.business_name,
            "business_address": self.business_address,
            "tax_rate": float(self.tax_rate),
            "currency": self.currency,
            "receipt_footer": self.receipt_footer,
            "low_stock_threshold": self.low_stock_threshold,
            "enable_mpesa": self.enable_mpesa,
            "enable_cash": self.enable_cash,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
