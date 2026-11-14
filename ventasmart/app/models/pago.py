from datetime import datetime, timezone
from decimal import Decimal
from app import db


class Pago(db.Model):
    __tablename__ = "pagos"

    id = db.Column(db.Integer, primary_key=True)
    numero_pago = db.Column(db.String(40), unique=True, nullable=False, index=True)
    venta_id = db.Column(db.Integer, db.ForeignKey("ventas.id", ondelete="RESTRICT"), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    fecha = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    monto_pagado = db.Column(db.Numeric(14, 2), nullable=False)
    metodo_pago = db.Column(db.String(30), nullable=False)
    referencia = db.Column(db.String(120), nullable=False, default="")

    venta = db.relationship("Venta", back_populates="pagos")
    usuario = db.relationship("Usuario", back_populates="pagos")

    __table_args__ = (
        db.CheckConstraint("monto_pagado > 0", name="ck_pago_monto_positivo"),
    )
