from datetime import datetime, timezone
from decimal import Decimal
from app import db


class Producto(db.Model):
    __tablename__ = "productos"

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(50), unique=True, nullable=False, index=True)
    nombre = db.Column(db.String(180), nullable=False)
    descripcion = db.Column(db.Text, nullable=False, default="")
    categoria = db.Column(db.String(100), nullable=False)
    precio_compra = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    precio_venta = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    cantidad_disponible = db.Column(db.Integer, nullable=False, default=0)
    stock_minimo = db.Column(db.Integer, nullable=False, default=5)
    fecha_creacion = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    detalles = db.relationship("DetalleVenta", back_populates="producto", lazy="dynamic")

    __table_args__ = (
        db.CheckConstraint("precio_compra >= 0", name="ck_producto_precio_compra"),
        db.CheckConstraint("precio_venta >= 0", name="ck_producto_precio_venta"),
        db.CheckConstraint("cantidad_disponible >= 0", name="ck_producto_cantidad"),
        db.CheckConstraint("stock_minimo >= 0", name="ck_producto_stock_min"),
    )

    @property
    def estado(self) -> str:
        if self.cantidad_disponible <= 0:
            return "Agotado"
        if self.cantidad_disponible <= self.stock_minimo:
            return "Bajo inventario"
        return "Disponible"
