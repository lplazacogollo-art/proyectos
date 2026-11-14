import csv
from io import StringIO
from flask import Blueprint, render_template, request, Response
from flask_login import login_required
from sqlalchemy import func
from app import db
from app.models import Venta, DetalleVenta, Producto, Cliente, Pago

reportes_bp = Blueprint("reportes", __name__, url_prefix="/reportes")


def _filtered_sales_query(fecha_inicio: str, fecha_fin: str):
    q = Venta.query
    if fecha_inicio:
        q = q.filter(db.func.date(Venta.fecha) >= fecha_inicio)
    if fecha_fin:
        q = q.filter(db.func.date(Venta.fecha) <= fecha_fin)
    return q


@reportes_bp.route("/")
@login_required
def index():
    fecha_inicio = (request.args.get("fecha_inicio") or "").strip()
    fecha_fin = (request.args.get("fecha_fin") or "").strip()

    ventas = _filtered_sales_query(fecha_inicio, fecha_fin).order_by(Venta.fecha.desc()).all()
    ingresos_totales = sum(float(v.total) for v in ventas)
    total_recaudado = sum(float(v.total_pagado) for v in ventas)
    cantidad_ops = len(ventas)

    diarias: dict[str, float] = {}
    semanales: dict[str, float] = {}
    mensuales: dict[str, float] = {}
    for v in reversed(ventas):
        if not v.fecha:
            continue
        d_k = v.fecha.strftime("%Y-%m-%d")
        s_k = v.fecha.strftime("%Y-W%W")
        m_k = v.fecha.strftime("%Y-%m")
        diarias[d_k] = diarias.get(d_k, 0.0) + float(v.total)
        semanales[s_k] = semanales.get(s_k, 0.0) + float(v.total)
        mensuales[m_k] = mensuales.get(m_k, 0.0) + float(v.total)

    top_prod_q = (
        db.session.query(
            Producto.codigo,
            Producto.nombre,
            func.sum(DetalleVenta.cantidad).label("unidades"),
            func.sum(DetalleVenta.subtotal).label("ingresos"),
        )
        .join(DetalleVenta, DetalleVenta.producto_id == Producto.id)
        .join(Venta, Venta.id == DetalleVenta.venta_id)
    )
    if fecha_inicio:
        top_prod_q = top_prod_q.filter(db.func.date(Venta.fecha) >= fecha_inicio)
    if fecha_fin:
        top_prod_q = top_prod_q.filter(db.func.date(Venta.fecha) <= fecha_fin)
    top_productos = (
        top_prod_q.group_by(Producto.id, Producto.codigo, Producto.nombre)
        .order_by(func.sum(DetalleVenta.cantidad).desc())
        .limit(10)
        .all()
    )

    top_cli_q = (
        db.session.query(
            Cliente.nombre_completo,
            Cliente.numero_documento,
            func.count(Venta.id).label("compras"),
            func.sum(Venta.total).label("monto"),
        )
        .join(Venta, Venta.cliente_id == Cliente.id)
    )
    if fecha_inicio:
        top_cli_q = top_cli_q.filter(db.func.date(Venta.fecha) >= fecha_inicio)
    if fecha_fin:
        top_cli_q = top_cli_q.filter(db.func.date(Venta.fecha) <= fecha_fin)
    top_clientes = (
        top_cli_q.group_by(Cliente.id, Cliente.nombre_completo, Cliente.numero_documento)
        .order_by(func.sum(Venta.total).desc())
        .limit(10)
        .all()
    )

    metodos_q = db.session.query(
        Pago.metodo_pago, func.count(Pago.id), func.sum(Pago.monto_pagado)
    )
    if fecha_inicio:
        metodos_q = metodos_q.filter(db.func.date(Pago.fecha) >= fecha_inicio)
    if fecha_fin:
        metodos_q = metodos_q.filter(db.func.date(Pago.fecha) <= fecha_fin)
    metodos = metodos_q.group_by(Pago.metodo_pago).all()

    return render_template(
        "reportes/index.html",
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        ingresos_totales=ingresos_totales,
        total_recaudado=total_recaudado,
        cantidad_ops=cantidad_ops,
        ventas=ventas,
        diarias=diarias,
        semanales=semanales,
        mensuales=mensuales,
        top_productos=top_productos,
        top_clientes=top_clientes,
        metodos=metodos,
    )


@reportes_bp.route("/exportar-csv")
@login_required
def exportar_csv():
    fecha_inicio = (request.args.get("fecha_inicio") or "").strip()
    fecha_fin = (request.args.get("fecha_fin") or "").strip()
    ventas = _filtered_sales_query(fecha_inicio, fecha_fin).order_by(Venta.fecha.desc()).all()

    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(["Consecutivo", "Comprobante", "Fecha", "Cliente", "Subtotal", "Descuento", "Impuestos", "Total", "Pagado", "Saldo", "Estado"])
    for v in ventas:
        writer.writerow([
            v.consecutivo,
            v.numero_comprobante,
            v.fecha.isoformat() if v.fecha else "",
            v.cliente.nombre_completo,
            v.subtotal,
            v.descuento_monto,
            v.impuestos,
            v.total,
            v.total_pagado,
            v.saldo_pendiente,
            v.estado_pago,
        ])

    return Response(
        "\ufeff" + si.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=reporte_ventasmart.csv"},
    )
