from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from config import Config
from models import db, TokenBlocklist
from routes import api
from auth import auth


def create_app(config=Config):
    app = Flask(__name__)
    app.config.from_object(config)

    # ✅ FIXED CORS (correct place)
    CORS(
        app,
        origins=["http://localhost:3000", "http://127.0.0.1:3000",
                 "http://localhost:3001", "http://127.0.0.1:3001",
                 "http://localhost:3002", "http://127.0.0.1:3002",
                 "http://localhost:3003", "http://127.0.0.1:3003"],
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    )

    db.init_app(app)
    Migrate(app, db)
    jwt = JWTManager(app)

    # ✅ IMPORTANT: add prefix
    app.register_blueprint(api, url_prefix="/api")
    app.register_blueprint(auth)

    # ── JWT Blocklist ──
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        return TokenBlocklist.query.filter_by(jti=jwt_payload["jti"]).first() is not None

    @jwt.revoked_token_loader
    def revoked_token_response(jwt_header, jwt_payload):
        return jsonify({"error": "Token has been revoked. Please log in again."}), 401

    @jwt.expired_token_loader
    def expired_token_response(jwt_header, jwt_payload):
        return jsonify({"error": "Token has expired. Please refresh or log in again."}), 401

    @jwt.unauthorized_loader
    def missing_token_response(reason):
        return jsonify({"error": "Authentication required.", "detail": reason}), 401

    # ── Errors ──
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)