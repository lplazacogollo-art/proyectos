from decimal import Decimal
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import Pago, Venta
from app.services.ventas_service import registrar_pago_transaccional, VentaServiceError

pagos_bp = Blueprint("pagos", __name__, url_prefix="/pagos")


@pagos_bp.route("/", methods=["GET", "POST"])
@login_required
def index():
    if request.method == "POST":
        try:
            venta_id = int(request.form.get("venta_id") or 0)
            monto = Decimal(request.form.get("monto_pagado") or "0")
            metodo = request.form.get("metodo_pago") or "Efectivo"
            referencia = request.form.get("referencia") or ""

            _, warning = registrar_pago_transaccional(
                venta_id=venta_id,
                usuario_id=current_user.id,
                monto_pagado=monto,
                metodo_pago=metodo,
                referencia=referencia,
            )
            flash("Pago registrado", "success")
            if warning:
                flash(warning, "warning")
            return redirect(url_for("pagos.index"))
        except VentaServiceError as err:
            flash(str(err), "danger")
        except Exception:
            flash("Error procesando el pago.", "danger")

    pagos = Pago.query.order_by(Pago.fecha.desc()).all()
    ventas_pendientes = (
        Venta.query.filter(Venta.saldo_pendiente > 0).order_by(Venta.fecha.desc()).all()
    )
    return render_template(
        "pagos/index.html",
        pagos=pagos,
        ventas_pendientes=ventas_pendientes,
    )
