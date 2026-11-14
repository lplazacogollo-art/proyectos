"""Migración inicial de VentaSmart en PostgreSQL (Neon)

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("correo", sa.String(length=150), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("rol", sa.String(length=30), nullable=False, server_default="admin"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "clientes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tipo_documento", sa.String(length=20), nullable=False),
        sa.Column("numero_documento", sa.String(length=40), nullable=False, unique=True),
        sa.Column("nombre_completo", sa.String(length=180), nullable=False),
        sa.Column("telefono", sa.String(length=40), nullable=False),
        sa.Column("correo", sa.String(length=150), nullable=False),
        sa.Column("direccion", sa.String(length=255), nullable=False),
        sa.Column("fecha_registro", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "productos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("codigo", sa.String(length=50), nullable=False, unique=True),
        sa.Column("nombre", sa.String(length=180), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False, server_default=""),
        sa.Column("categoria", sa.String(length=100), nullable=False),
        sa.Column("precio_compra", sa.Numeric(14, 2), nullable=False),
        sa.Column("precio_venta", sa.Numeric(14, 2), nullable=False),
        sa.Column("cantidad_disponible", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stock_minimo", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "configuracion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre_comercial", sa.String(length=180), nullable=False),
        sa.Column("nit", sa.String(length=50), nullable=False),
        sa.Column("direccion", sa.String(length=255), nullable=False),
        sa.Column("telefono", sa.String(length=50), nullable=False),
        sa.Column("correo", sa.String(length=150), nullable=False),
        sa.Column("porcentaje_impuesto", sa.Numeric(5, 2), nullable=False, server_default="19.00"),
        sa.Column("descuento_maximo", sa.Numeric(5, 2), nullable=False, server_default="30.00"),
        sa.Column("prefijo_consecutivo", sa.String(length=20), nullable=False, server_default="VS"),
        sa.Column("consecutivo_actual", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("fecha_actualizacion", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "ventas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("consecutivo", sa.String(length=40), nullable=False, unique=True),
        sa.Column("numero_comprobante", sa.String(length=40), nullable=False, unique=True),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("descuento_porcentaje", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        sa.Column("descuento_monto", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("impuesto_porcentaje", sa.Numeric(5, 2), nullable=False, server_default="19.00"),
        sa.Column("impuestos", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_pagado", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("saldo_pendiente", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
        sa.Column("estado_pago", sa.String(length=20), nullable=False, server_default="Pendiente"),
        sa.Column("observaciones", sa.Text(), nullable=False, server_default=""),
    )

    op.create_table(
        "detalle_ventas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("venta_id", sa.Integer(), sa.ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("producto_id", sa.Integer(), sa.ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(14, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
    )

    op.create_table(
        "pagos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("numero_pago", sa.String(length=40), nullable=False, unique=True),
        sa.Column("venta_id", sa.Integer(), sa.ForeignKey("ventas.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("monto_pagado", sa.Numeric(14, 2), nullable=False),
        sa.Column("metodo_pago", sa.String(length=30), nullable=False),
        sa.Column("referencia", sa.String(length=120), nullable=False, server_default=""),
    )


def downgrade():
    op.drop_table("pagos")
    op.drop_table("detalle_ventas")
    op.drop_table("ventas")
    op.drop_table("configuracion")
    op.drop_table("productos")
    op.drop_table("clientes")
    op.drop_table("usuarios")
