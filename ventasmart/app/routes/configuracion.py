from decimal import Decimal, InvalidOperation
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app import db
from app.models import Configuracion, Usuario

configuracion_bp = Blueprint("configuracion", __name__, url_prefix="/configuracion")


@configuracion_bp.route("/", methods=["GET", "POST"])
@login_required
def index():
    cfg = Configuracion.query.first()
    if not cfg:
        cfg = Configuracion()
        db.session.add(cfg)
        db.session.commit()

    if request.method == "POST":
        accion = request.form.get("accion")
        if accion == "negocio":
            try:
                impuesto = Decimal(request.form.get("porcentaje_impuesto") or "19")
                desc_max = Decimal(request.form.get("descuento_maximo") or "30")
                consecutivo = int(request.form.get("consecutivo_actual") or cfg.consecutivo_actual)
            except (InvalidOperation, ValueError):
                flash("Los valores numéricos de impuesto, descuento y consecutivo deben ser válidos.", "danger")
                return redirect(url_for("configuracion.index"))

            if impuesto < 0 or impuesto > 100 or desc_max < 0 or desc_max > 100 or consecutivo < 0:
                flash("Impuesto y descuento deben estar entre 0 y 100, y el consecutivo no puede ser negativo.", "danger")
                return redirect(url_for("configuracion.index"))

            cfg.nombre_comercial = (request.form.get("nombre_comercial") or cfg.nombre_comercial).strip()
            cfg.nit = (request.form.get("nit") or cfg.nit).strip()
            cfg.direccion = (request.form.get("direccion") or cfg.direccion).strip()
            cfg.telefono = (request.form.get("telefono") or cfg.telefono).strip()
            cfg.correo = (request.form.get("correo") or cfg.correo).strip()
            cfg.porcentaje_impuesto = impuesto
            cfg.descuento_maximo = desc_max
            cfg.prefijo_consecutivo = (request.form.get("prefijo_consecutivo") or "VS").strip().upper()
            cfg.consecutivo_actual = consecutivo
            db.session.commit()
            flash("Registro actualizado correctamente", "success")
        elif accion == "usuario":
            nombre = (request.form.get("nombre") or "").strip()
            correo = (request.form.get("correo") or "").strip().lower()
            pwd_actual = request.form.get("password_actual") or ""
            pwd_nueva = request.form.get("password_nueva") or ""

            if not nombre or not correo:
                flash("Nombre y correo son obligatorios.", "danger")
                return redirect(url_for("configuracion.index"))

            dup = Usuario.query.filter(
                db.func.lower(Usuario.correo) == correo, Usuario.id != current_user.id
            ).first()
            if dup:
                flash("Ese correo ya pertenece a otro usuario.", "danger")
                return redirect(url_for("configuracion.index"))

            current_user.nombre = nombre
            current_user.correo = correo
            if pwd_nueva:
                if len(pwd_nueva) < 6:
                    flash("La nueva contraseña debe tener al menos 6 caracteres.", "danger")
                    return redirect(url_for("configuracion.index"))
                if not current_user.check_password(pwd_actual):
                    flash("La contraseña actual no coincide.", "danger")
                    return redirect(url_for("configuracion.index"))
                current_user.set_password(pwd_nueva)

            db.session.commit()
            flash("Registro actualizado correctamente", "success")

        return redirect(url_for("configuracion.index"))

    return render_template("configuracion/index.html", cfg=cfg)
