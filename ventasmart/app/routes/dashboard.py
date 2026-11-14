from datetime import datetime, timedelta, timezone
from flask import Blueprint, render_template
from flask_login import login_required
from sqlalchemy import func
from app import db
from app.models import Cliente, Producto, Venta, DetalleVenta, Pago

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/")
@login_required
def index():
    now = datetime.now(timezone.utc)
    inicio_hoy = now.replace(hour=0, minute=0, second=0, microsecond=0)
    inicio_mes = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    hace_30_dias = now - timedelta(days=30)

    ventas_hoy = (
        db.session.query(func.coalesce(func.sum(Venta.total), 0))
        .filter(Venta.fecha >= inicio_hoy)
        .scalar()
    )
    ingresos_mes = (
        db.session.query(func.coalesce(func.sum(Venta.total), 0))
        .filter(Venta.fecha >= inicio_mes)
        .scalar()
    )
    total_ventas = Venta.query.count()
    total_clientes = Cliente.query.count()
    total_productos = Producto.query.count()
    bajo_inventario = Producto.query.filter(
        Producto.cantidad_disponible <= Producto.stock_minimo
    ).count()

    # Gráficos
    ventas_recientes = Venta.query.filter(Venta.fecha >= hace_30_dias).order_by(Venta.fecha.asc()).all()
    por_mes: dict[str, float] = {}
    por_dia: dict[str, float] = {}
    for v in Venta.query.order_by(Venta.fecha.asc()).all():
        if v.fecha:
            m_key = v.fecha.strftime("%Y-%m")
            por_mes[m_key] = por_mes.get(m_key, 0.0) + float(v.total)
    for v in ventas_recientes:
        if v.fecha:
            d_key = v.fecha.strftime("%d/%m")
            por_dia[d_key] = por_dia.get(d_key, 0.0) + float(v.total)

    metodos = (
        db.session.query(Pago.metodo_pago, func.coalesce(func.sum(Pago.monto_pagado), 0))
        .group_by(Pago.metodo_pago)
        .all()
    )

    top_productos = (
        db.session.query(Producto.nombre, func.coalesce(func.sum(DetalleVenta.cantidad), 0).label("unidades"))
        .join(DetalleVenta, DetalleVenta.producto_id == Producto.id)
        .group_by(Producto.id, Producto.nombre)
        .order_by(func.sum(DetalleVenta.cantidad).desc())
        .limit(5)
        .all()
    )

    ultimas_ventas = Venta.query.order_by(Venta.fecha.desc()).limit(6).all()
    ultimos_clientes = Cliente.query.order_by(Cliente.fecha_registro.desc()).limit(5).all()
    productos_bajos = (
        Producto.query.filter(Producto.cantidad_disponible <= Producto.stock_minimo)
        .order_by(Producto.cantidad_disponible.asc())
        .limit(6)
        .all()
    )

    return render_template(
        "dashboard.html",
        ventas_hoy=ventas_hoy,
        ingresos_mes=ingresos_mes,
        total_ventas=total_ventas,
        total_clientes=total_clientes,
        total_productos=total_productos,
        bajo_inventario=bajo_inventario,
        chart_mes_labels=list(por_mes.keys())[-6:],
        chart_mes_values=list(por_mes.values())[-6:],
        chart_dia_labels=list(por_dia.keys()),
        chart_dia_values=list(por_dia.values()),
        chart_metodos_labels=[m[0] for m in metodos],
        chart_metodos_values=[float(m[1]) for m in metodos],
        chart_prod_labels=[p[0] for p in top_productos],
        chart_prod_values=[int(p[1]) for p in top_productos],
        ultimas_ventas=ultimas_ventas,
        ultimos_clientes=ultimos_clientes,
        productos_bajos=productos_bajos,
    )
