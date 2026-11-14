import json
from decimal import Decimal
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app import db
from app.models import Cliente, Producto, Venta, Configuracion
from app.services.ventas_service import registrar_venta_transaccional, VentaServiceError

ventas_bp = Blueprint("ventas", __name__, url_prefix="/ventas")


@ventas_bp.route("/pos", methods=["GET", "POST"])
@login_required
def pos():
    if request.method == "POST":
        try:
            cliente_id = int(request.form.get("cliente_id") or 0)
            items_raw = request.form.get("items_json") or "[]"
            items = json.loads(items_raw)
            descuento_pct = Decimal(request.form.get("descuento_porcentaje") or "0")
            aplicar_impuesto = request.form.get("aplicar_impuesto") == "on"
            impuesto_pct = Decimal(request.form.get("impuesto_porcentaje") or "19")
            pago_inicial = Decimal(request.form.get("pago_inicial") or "0")
            metodo_pago = request.form.get("metodo_pago") or "Efectivo"
            referencia = request.form.get("referencia") or ""
            observaciones = request.form.get("observaciones") or ""

            venta, warnings = registrar_venta_transaccional(
                cliente_id=cliente_id,
                usuario_id=current_user.id,
                items=items,
                descuento_porcentaje=descuento_pct,
                aplicar_impuesto=aplicar_impuesto,
                impuesto_porcentaje=impuesto_pct,
                pago_inicial=pago_inicial,
                metodo_pago=metodo_pago,
                referencia=referencia,
                observaciones=observaciones,
            )
            flash("Venta registrada exitosamente", "success")
            for w in warnings:
                flash(w, "warning")
            return redirect(url_for("ventas.detalle", venta_id=venta.id))
        except VentaServiceError as err:
            flash(str(err), "danger")
        except Exception:
            flash("No se pudo registrar la venta", "danger")

    clientes = Cliente.query.order_by(Cliente.nombre_completo.asc()).all()
    productos = Producto.query.order_by(Producto.nombre.asc()).all()
    cfg = Configuracion.query.first()
    return render_template("ventas/pos.html", clientes=clientes, productos=productos, cfg=cfg)


@ventas_bp.route("/<int:venta_id>")
@login_required
def detalle(venta_id: int):
    venta = db.get_or_404(Venta, venta_id)
    return render_template("ventas/detalle.html", venta=venta)
