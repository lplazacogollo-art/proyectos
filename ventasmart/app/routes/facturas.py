from flask import Blueprint, render_template, request, send_file
from flask_login import login_required
from sqlalchemy import or_
from app import db
from app.models import Venta, Cliente, Configuracion
from app.services.pdf_service import generar_comprobante_pdf

facturas_bp = Blueprint("facturas", __name__, url_prefix="/facturas")


@facturas_bp.route("/")
@login_required
def index():
    q = (request.args.get("q") or "").strip()
    fecha_inicio = (request.args.get("fecha_inicio") or "").strip()
    fecha_fin = (request.args.get("fecha_fin") or "").strip()
    cliente_id = request.args.get("cliente_id") or ""

    query = Venta.query.join(Cliente)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Venta.consecutivo.ilike(like),
                Venta.numero_comprobante.ilike(like),
                Cliente.nombre_completo.ilike(like),
            )
        )
    if fecha_inicio:
        query = query.filter(db.func.date(Venta.fecha) >= fecha_inicio)
    if fecha_fin:
        query = query.filter(db.func.date(Venta.fecha) <= fecha_fin)
    if cliente_id and cliente_id != "Todos":
        query = query.filter(Venta.cliente_id == int(cliente_id))

    ventas = query.order_by(Venta.fecha.desc()).all()
    clientes = Cliente.query.order_by(Cliente.nombre_completo.asc()).all()
    return render_template(
        "facturas/index.html",
        ventas=ventas,
        clientes=clientes,
        q=q,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        cliente_sel=cliente_id,
    )


@facturas_bp.route("/<int:venta_id>/pdf")
@login_required
def descargar_pdf(venta_id: int):
    venta = db.get_or_404(Venta, venta_id)
    cfg = Configuracion.query.first()
    pdf_buffer = generar_comprobante_pdf(venta, cfg)
    return send_file(
        pdf_buffer,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{venta.numero_comprobante}.pdf",
    )
