import re
import time
from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models import Usuario

auth_bp = Blueprint("auth", __name__)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        correo = (request.form.get("correo") or "").strip().lower()
        password = request.form.get("password") or ""

        if not correo or not password:
            flash("Ingresa tu correo electrónico y contraseña.", "danger")
            return render_template("login.html")

        user = Usuario.query.filter(db.func.lower(Usuario.correo) == correo).first()
        if not user or not user.check_password(password):
            flash("Credenciales incorrectas.", "danger")
            return render_template("login.html")

        if not user.activo:
            flash("Tu cuenta se encuentra desactivada.", "danger")
            return render_template("login.html")

        login_user(user)
        flash("Sesión iniciada correctamente.", "success")
        next_page = request.args.get("next")
        return redirect(next_page or url_for("dashboard.index"))

    return render_template("login.html")


@auth_bp.route("/guest-login", methods=["POST"])
def guest_login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    guest_email = "invitado@ventasmart.co"
    user = Usuario.query.filter(db.func.lower(Usuario.correo) == guest_email).first()
    if not user:
        user = Usuario(nombre="Usuario Invitado", correo=guest_email, rol="admin")
        user.set_password(f"guest-{int(time.time())}")
        db.session.add(user)
        db.session.commit()
    elif not user.activo:
        user.activo = True
        db.session.commit()

    login_user(user)
    flash("Bienvenido a VentaSmart", "success")
    return redirect(url_for("dashboard.index"))


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))

    if request.method == "POST":
        nombre = (request.form.get("nombre") or "").strip() or "Usuario VentaSmart"
        raw_correo = (request.form.get("correo") or "").strip().lower()
        password = (request.form.get("password") or "").strip()

        if raw_correo:
            if EMAIL_RE.match(raw_correo):
                correo = raw_correo
            else:
                slug = re.sub(r"[^a-z0-9]+", ".", raw_correo).strip(".") or "usuario"
                correo = f"{slug}.{int(time.time())}@ventasmart.local"
        else:
            correo = f"usuario.{int(time.time())}@ventasmart.local"

        if Usuario.query.filter(db.func.lower(Usuario.correo) == correo).first():
            flash("Ya existe un usuario registrado con ese correo.", "danger")
            return render_template("register.html")

        user = Usuario(nombre=nombre, correo=correo, rol="admin")
        user.set_password(password or f"libre-{int(time.time())}")
        db.session.add(user)
        db.session.commit()

        login_user(user)
        flash("Bienvenido a VentaSmart", "success")
        return redirect(url_for("dashboard.index"))

    return render_template("register.html")


@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Has cerrado sesión correctamente.", "success")
    return redirect(url_for("auth.login"))
