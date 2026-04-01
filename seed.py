"""Run: python seed.py"""
from app import app
from models import db, Product

PRODUCTS = [
    {"name": "Chanel No. 5 (50ml)", "price": 4500.00, "stock_quantity": 20},
    {"name": "Dior Sauvage (100ml)", "price": 5200.00, "stock_quantity": 15},
    {"name": "Versace Eros (50ml)", "price": 3800.00, "stock_quantity": 25},
    {"name": "Tom Ford Black Orchid (50ml)", "price": 7500.00, "stock_quantity": 10},
    {"name": "Gucci Bloom (100ml)", "price": 4200.00, "stock_quantity": 18},
    {"name": "Armani Acqua di Gio (100ml)", "price": 4800.00, "stock_quantity": 12},
]

with app.app_context():
    db.create_all()
    added = 0
    for data in PRODUCTS:
        if not Product.query.filter_by(name=data["name"]).first():
            db.session.add(Product(**data))
            added += 1
    db.session.commit()
    print(f"Seeded {added} product(s). Total products: {Product.query.count()}")
