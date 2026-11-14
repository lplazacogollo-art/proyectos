from datetime import datetime, timezone
from decimal import Decimal
from app import db


class Configuracion(db.Model):
    __tablename__ = "configuracion"

    id = db.Column(db.Integer, primary_key=True)
    nombre_comercial = db.Column(db.String(180), nullable=False, default="VentaSmart Colombia S.A.S.")
    nit = db.Column(db.String(50), nullable=False, default="901.458.720-4")
    direccion = db.Column(db.String(255), nullable=False, default="Cra. 15 # 88-64, Oficina 402, Bogotá D.C.")
    telefono = db.Column(db.String(50), nullable=False, default="+57 (601) 745 8920")
    correo = db.Column(db.String(150), nullable=False, default="facturacion@ventasmart.co")
    porcentaje_impuesto = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal("19.00"))
    descuento_maximo = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal("30.00"))
    prefijo_consecutivo = db.Column(db.String(20), nullable=False, default="VS")
    consecutivo_actual = db.Column(db.Integer, nullable=False, default=1000)
    fecha_actualizacion = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
