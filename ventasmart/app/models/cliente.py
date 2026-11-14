from datetime import datetime, timezone
from app import db


class Cliente(db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    tipo_documento = db.Column(db.String(20), nullable=False)
    numero_documento = db.Column(db.String(40), unique=True, nullable=False, index=True)
    nombre_completo = db.Column(db.String(180), nullable=False)
    telefono = db.Column(db.String(40), nullable=False)
    correo = db.Column(db.String(150), nullable=False)
    direccion = db.Column(db.String(255), nullable=False)
    fecha_registro = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    ventas = db.relationship(
        "Venta",
        back_populates="cliente",
        order_by="Venta.fecha.desc()",
        lazy="select",
    )
