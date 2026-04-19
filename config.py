import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/perfume_pos")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")

    # M-Pesa Daraja API
    MPESA_CONSUMER_KEY = os.getenv("MPESA_CONSUMER_KEY", "")
    MPESA_CONSUMER_SECRET = os.getenv("MPESA_CONSUMER_SECRET", "")
    MPESA_SHORTCODE = os.getenv("MPESA_SHORTCODE", "174379")           # Sandbox shortcode
    MPESA_PASSKEY = os.getenv("MPESA_PASSKEY", "")
    MPESA_CALLBACK_URL = os.getenv("MPESA_CALLBACK_URL", "https://yourdomain.com/payments/confirm")
    MPESA_ENV = os.getenv("MPESA_ENV", "sandbox")                      # sandbox | production
    # CustomerPayBillOnline (paybill) | CustomerBuyGoodsOnline (till)
    MPESA_TRANSACTION_TYPE = os.getenv("MPESA_TRANSACTION_TYPE", "CustomerPayBillOnline")
    # PartyB = till number if using till, otherwise same as MPESA_SHORTCODE
    MPESA_PARTY_B = os.getenv("MPESA_PARTY_B", os.getenv("MPESA_SHORTCODE", "174379"))

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-dev-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 900))     # 15 min
    JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES", 604800)) # 7 days

    # Login rate limiting
    LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", 5))
    LOGIN_LOCKOUT_MINUTES = int(os.getenv("LOGIN_LOCKOUT_MINUTES", 15))

    # Password reset token expiry (seconds)
    RESET_TOKEN_EXPIRES = int(os.getenv("RESET_TOKEN_EXPIRES", 1800))  # 30 min
