from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)

    sale_items = db.relationship("SaleItem", back_populates="product")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": float(self.price),
            "stock_quantity": self.stock_quantity,
        }


class Sale(db.Model):
    __tablename__ = "sales"

    id = db.Column(db.Integer, primary_key=True)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.Enum("cash", "mpesa", name="payment_method_enum"), nullable=False)
    status = db.Column(db.Enum("pending", "completed", name="sale_status_enum"), default="pending")
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    items = db.relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    payment = db.relationship("Payment", back_populates="sale", uselist=False)

    def to_dict(self):
        return {
            "id": self.id,
            "total_amount": float(self.total_amount),
            "payment_method": self.payment_method,
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
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
    phone_number = db.Column(db.String(15))                # M-Pesa only
    mpesa_checkout_id = db.Column(db.String(100))          # CheckoutRequestID from Daraja
    status = db.Column(db.Enum("pending", "completed", "failed", name="payment_status_enum"), default="pending")
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    sale = db.relationship("Sale", back_populates="payment")

    def to_dict(self):
        return {
            "id": self.id,
            "sale_id": self.sale_id,
            "phone_number": self.phone_number,
            "status": self.status,
            "timestamp": self.timestamp.isoformat(),
        }
