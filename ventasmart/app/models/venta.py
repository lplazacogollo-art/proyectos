from datetime import datetime, timezone
from decimal import Decimal
from app import db


class Venta(db.Model):
    __tablename__ = "ventas"

    id = db.Column(db.Integer, primary_key=True)
    consecutivo = db.Column(db.String(40), unique=True, nullable=False, index=True)
    numero_comprobante = db.Column(db.String(40), unique=True, nullable=False, index=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    fecha = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    subtotal = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    descuento_porcentaje = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    descuento_monto = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    impuesto_porcentaje = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal("19.00"))
    impuestos = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    total_pagado = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    saldo_pendiente = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    estado_pago = db.Column(db.String(20), nullable=False, default="Pendiente")
    observaciones = db.Column(db.Text, nullable=False, default="")

    cliente = db.relationship("Cliente", back_populates="ventas")
    usuario = db.relationship("Usuario", back_populates="ventas")
    detalles = db.relationship(
        "DetalleVenta",
        back_populates="venta",
        cascade="all, delete-orphan",
        lazy="select",
    )
    pagos = db.relationship(
        "Pago",
        back_populates="venta",
        order_by="Pago.fecha.asc()",
        lazy="select",
    )
