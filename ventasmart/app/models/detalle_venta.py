from decimal import Decimal
from app import db


class DetalleVenta(db.Model):
    __tablename__ = "detalle_ventas"

    id = db.Column(db.Integer, primary_key=True)
    venta_id = db.Column(db.Integer, db.ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id = db.Column(db.Integer, db.ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    subtotal = db.Column(db.Numeric(14, 2), nullable=False, default=Decimal("0.00"))

    venta = db.relationship("Venta", back_populates="detalles")
    producto = db.relationship("Producto", back_populates="detalles")

    __table_args__ = (
        db.CheckConstraint("cantidad > 0", name="ck_detalle_cantidad_positiva"),
    )
