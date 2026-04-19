from datetime import timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from models import db, User, TokenBlocklist, LoginAttempt, PasswordResetToken

auth = Blueprint("auth", __name__, url_prefix="/auth")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def err(msg, code=400):
    return jsonify({"error": msg}), code


def owner_required():
    if get_jwt().get("role") != "owner":
        return err("Owner access required", 403)
    return None


def _issue_tokens(user: User) -> dict:
    access_expires = timedelta(seconds=current_app.config["JWT_ACCESS_TOKEN_EXPIRES"])
    refresh_expires = timedelta(seconds=current_app.config["JWT_REFRESH_TOKEN_EXPIRES"])
    claims = {"role": user.role, "name": user.name}
    return {
        "access_token": create_access_token(str(user.id), expires_delta=access_expires, additional_claims=claims),
        "refresh_token": create_refresh_token(str(user.id), expires_delta=refresh_expires, additional_claims=claims),
        "user": user.to_dict(),
    }


def _get_or_create_attempt(email: str) -> LoginAttempt:
    attempt = LoginAttempt.query.filter_by(email=email).first()
    if not attempt:
        attempt = LoginAttempt(email=email)
        db.session.add(attempt)
    return attempt


# ─── Bootstrap ───────────────────────────────────────────────────────────────

@auth.post("/bootstrap")
def bootstrap_owner():
    """Creates the first owner account. Disabled once any owner exists."""
    if User.query.filter_by(role="owner").first():
        return err("Owner account already exists. Use /auth/login.", 403)

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not all([name, email, password]):
        return err("name, email, and password are required")
    if len(name) < 2:
        return err("name must be at least 2 characters")
    if not User.validate_email(email):
        return err("Invalid email address")

    pw_errors = User.validate_password(password)
    if pw_errors:
        return err(f"Password must contain: {', '.join(pw_errors)}")

    owner = User(name=name, email=email, role="owner", status="active")
    owner.set_password(password)
    db.session.add(owner)
    db.session.commit()
    return jsonify({"message": "Owner account created.", "user": owner.to_dict()}), 201


# ─── Register ────────────────────────────────────────────────────────────────

@auth.post("/register")
def register():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not all([name, email, password]):
        return err("name, email, and password are required")
    if len(name) < 2:
        return err("name must be at least 2 characters")
    if not User.validate_email(email):
        return err("Invalid email address")
    if User.query.filter_by(email=email).first():
        return err("An account with this email already exists", 409)

    pw_errors = User.validate_password(password)
    if pw_errors:
        return err(f"Password must contain: {', '.join(pw_errors)}")

    user = User(name=name, email=email, role="cashier", status="pending")
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({
        "message": "Registration successful. Await owner approval before logging in.",
        "user": user.to_dict(),
    }), 201


# ─── Login (with rate limiting) ───────────────────────────────────────────────

@auth.post("/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return err("email and password are required")

    attempt = _get_or_create_attempt(email)

    # Check lockout before touching the DB for the user
    if attempt.is_locked():
        secs = attempt.seconds_until_unlock()
        return err(f"Account locked due to too many failed attempts. Try again in {secs}s.", 429)

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        attempt.record_failure(
            current_app.config["LOGIN_MAX_ATTEMPTS"],
            current_app.config["LOGIN_LOCKOUT_MINUTES"],
        )
        db.session.commit()
        remaining = max(0, current_app.config["LOGIN_MAX_ATTEMPTS"] - attempt.attempts)
        if attempt.is_locked():
            return err(f"Too many failed attempts. Account locked for {current_app.config['LOGIN_LOCKOUT_MINUTES']} minutes.", 429)
        return err(f"Invalid email or password. {remaining} attempt(s) remaining.", 401)

    if user.status == "pending":
        return err("Your account is awaiting owner approval.", 403)
    if user.status == "inactive":
        return err("Your account has been deactivated. Contact the owner.", 403)

    # Successful login — reset attempt counter
    attempt.reset()
    db.session.commit()

    return jsonify(_issue_tokens(user))


# ─── Logout (blocklist access + refresh tokens) ───────────────────────────────

@auth.post("/logout")
@jwt_required(verify_type=False)
def logout():
    jti = get_jwt()["jti"]
    db.session.add(TokenBlocklist(jti=jti))
    db.session.commit()
    return jsonify({"message": "Logged out successfully."})


# ─── Refresh (rotate refresh token) ──────────────────────────────────────────

@auth.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    """
    Exchange a valid refresh token for a new access + refresh token pair.
    The old refresh token is blocklisted (rotation).
    """
    old_jti = get_jwt()["jti"]
    db.session.add(TokenBlocklist(jti=old_jti))   # revoke old refresh token

    user = db.get_or_404(User, int(get_jwt_identity()))

    if user.status != "active":
        db.session.commit()
        return err("Account is not active.", 403)

    db.session.commit()
    return jsonify(_issue_tokens(user))


# ─── Password reset — request ─────────────────────────────────────────────────

@auth.post("/password-reset/request")
def request_password_reset():
    """
    Body: { "email": "..." }
    Always returns 200 to prevent user enumeration.
    In production, email the token to the user. Here it is returned directly
    so the flow can be tested without an email service.
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return err("email is required")

    user = User.query.filter_by(email=email).first()

    # Always respond the same way regardless of whether the email exists
    if not user:
        return jsonify({"message": "If that email is registered, a reset token has been issued."})

    # Invalidate any existing unused tokens for this user
    PasswordResetToken.query.filter_by(user_id=user.id, used=False).update({"used": True})

    reset_token = PasswordResetToken.generate(user.id, current_app.config["RESET_TOKEN_EXPIRES"])
    db.session.add(reset_token)
    db.session.commit()

    # TODO: in production, send reset_token.token via email instead of returning it
    return jsonify({
        "message": "If that email is registered, a reset token has been issued.",
        "reset_token": reset_token.token,   # remove this line in production
        "expires_in_seconds": current_app.config["RESET_TOKEN_EXPIRES"],
    })


# ─── Password reset — confirm ─────────────────────────────────────────────────

@auth.post("/password-reset/confirm")
def confirm_password_reset():
    """Body: { "token": "...", "new_password": "..." }"""
    data = request.get_json() or {}
    token_str = data.get("token") or ""
    new_pw = data.get("new_password") or ""

    if not token_str or not new_pw:
        return err("token and new_password are required")

    reset_token = PasswordResetToken.query.filter_by(token=token_str).first()

    if not reset_token or not reset_token.is_valid():
        return err("Invalid or expired reset token.", 400)

    pw_errors = User.validate_password(new_pw)
    if pw_errors:
        return err(f"Password must contain: {', '.join(pw_errors)}")

    user = reset_token.user
    if user.check_password(new_pw):
        return err("New password must differ from current password.")

    user.set_password(new_pw)
    reset_token.used = True

    # Blocklist all active JWTs for this user by logging them out everywhere
    # (not possible without token storage — handled by short access token TTL)

    db.session.commit()
    return jsonify({"message": "Password reset successful. Please log in again."})


# ─── Owner: list cashiers ─────────────────────────────────────────────────────

@auth.post("/users")
@jwt_required()
def create_cashier():
    """Create a new cashier account. Owner-only."""
    if (guard := owner_required()):
        return guard

    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not all([name, email, password]):
        return err("name, email, and password are required")
    if len(name) < 2:
        return err("name must be at least 2 characters")
    if not User.validate_email(email):
        return err("Invalid email address")
    if User.query.filter_by(email=email).first():
        return err("An account with this email already exists", 409)

    pw_errors = User.validate_password(password)
    if pw_errors:
        return err(f"Password must contain: {', '.join(pw_errors)}")

    cashier = User(name=name, email=email, role="cashier", status="active")
    cashier.set_password(password)
    db.session.add(cashier)
    db.session.commit()
    return jsonify({"message": f"Cashier '{name}' created successfully.", "user": cashier.to_dict()}), 201


@auth.get("/users")
@jwt_required()
def list_users():
    if (guard := owner_required()):
        return guard

    status_filter = request.args.get("status")
    query = User.query.filter(User.role == "cashier")
    if status_filter in ("pending", "active", "inactive"):
        query = query.filter(User.status == status_filter)

    return jsonify([u.to_dict() for u in query.order_by(User.created_at.desc()).all()])


@auth.get("/users/<int:user_id>")
@jwt_required()
def get_user(user_id):
    if (guard := owner_required()):
        return guard

    user = db.get_or_404(User, user_id)
    if user.role != "cashier":
        return err("User not found", 404)
    return jsonify(user.to_dict())


@auth.patch("/users/<int:user_id>")
@jwt_required()
def update_cashier(user_id):
    """Edit cashier name or email. Owner-only."""
    if (guard := owner_required()):
        return guard

    user = db.get_or_404(User, user_id)
    if user.role != "cashier":
        return err("User not found", 404)

    data = request.get_json() or {}
    
    if "name" in data:
        name = (data["name"] or "").strip()
        if len(name) < 2:
            return err("name must be at least 2 characters")
        user.name = name
    
    if "email" in data:
        email = (data["email"] or "").strip().lower()
        if not User.validate_email(email):
            return err("Invalid email address")
        if email != user.email and User.query.filter_by(email=email).first():
            return err("An account with this email already exists", 409)
        user.email = email

    db.session.commit()
    return jsonify({"message": f"Cashier '{user.name}' updated.", "user": user.to_dict()})


# ─── Owner: activate / deactivate cashier ────────────────────────────────────

@auth.patch("/users/<int:user_id>/status")
@jwt_required()
def set_user_status(user_id):
    if (guard := owner_required()):
        return guard

    user = db.get_or_404(User, user_id)
    if user.role == "owner":
        return err("Cannot change status of another owner.", 403)

    data = request.get_json() or {}
    new_status = data.get("status")
    if new_status not in ("active", "inactive"):
        return err("status must be 'active' or 'inactive'")

    user.status = new_status
    db.session.commit()

    action = "approved" if new_status == "active" else "deactivated"
    return jsonify({"message": f"Cashier '{user.name}' {action}.", "user": user.to_dict()})


@auth.post("/users/<int:user_id>/reset-password")
@jwt_required()
def reset_cashier_password(user_id):
    """Reset a cashier's password to a temporary one. Owner-only."""
    if (guard := owner_required()):
        return guard

    user = db.get_or_404(User, user_id)
    if user.role != "cashier":
        return err("User not found", 404)

    data = request.get_json() or {}
    new_password = data.get("password") or ""

    if not new_password:
        return err("password is required")

    pw_errors = User.validate_password(new_password)
    if pw_errors:
        return err(f"Password must contain: {', '.join(pw_errors)}")

    user.set_password(new_password)
    db.session.commit()
    return jsonify({"message": f"Password reset for '{user.name}'.", "user": user.to_dict()})


@auth.delete("/users/<int:user_id>")
@jwt_required()
def delete_cashier(user_id):
    """Delete a cashier account. Owner-only."""
    if (guard := owner_required()):
        return guard

    user = db.get_or_404(User, user_id)
    if user.role != "cashier":
        return err("User not found", 404)

    user_name = user.name
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": f"Cashier '{user_name}' deleted successfully."})



# ─── Me / change password ─────────────────────────────────────────────────────

@auth.get("/me")
@jwt_required()
def me():
    user = db.get_or_404(User, int(get_jwt_identity()))
    return jsonify(user.to_dict())


@auth.post("/change-password")
@jwt_required()
def change_password():
    user = db.get_or_404(User, int(get_jwt_identity()))
    data = request.get_json() or {}
    current = data.get("current_password") or ""
    new_pw = data.get("new_password") or ""

    if not current or not new_pw:
        return err("current_password and new_password are required")
    if not user.check_password(current):
        return err("Current password is incorrect.", 401)
    if current == new_pw:
        return err("New password must differ from current password.")

    pw_errors = User.validate_password(new_pw)
    if pw_errors:
        return err(f"Password must contain: {', '.join(pw_errors)}")

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({"message": "Password updated successfully."})
