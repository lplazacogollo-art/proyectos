from decimal import Decimal
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from sqlalchemy import or_
from app import db
from app.models import Producto

productos_bp = Blueprint("productos", __name__, url_prefix="/productos")


@productos_bp.route("/")
@login_required
def index():
    q = (request.args.get("q") or "").strip()
    categoria = (request.args.get("categoria") or "").strip()
    query = Producto.query

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Producto.nombre.ilike(like), Producto.codigo.ilike(like)))
    if categoria and categoria != "Todas":
        query = query.filter(Producto.categoria == categoria)

    productos = query.order_by(Producto.id.desc()).all()
    categorias = [
        c[0] for c in db.session.query(Producto.categoria).distinct().order_by(Producto.categoria).all()
    ]
    return render_template(
        "productos/index.html",
        productos=productos,
        categorias=categorias,
        q=q,
        categoria_sel=categoria,
    )


@productos_bp.route("/crear", methods=["POST"])
@login_required
def crear():
    codigo = (request.form.get("codigo") or "").strip().upper()
    nombre = (request.form.get("nombre") or "").strip()
    descripcion = (request.form.get("descripcion") or "").strip()
    categoria = (request.form.get("categoria") or "").strip()

    try:
        precio_compra = Decimal(request.form.get("precio_compra") or "0")
        precio_venta = Decimal(request.form.get("precio_venta") or "0")
        cantidad = int(request.form.get("cantidad_disponible") or "0")
        stock_minimo = int(request.form.get("stock_minimo") or "5")
    except Exception:
        flash("Valores numéricos inválidos en el producto.", "danger")
        return redirect(url_for("productos.index"))

    if not codigo or not nombre or not categoria or precio_compra < 0 or precio_venta < 0 or cantidad < 0 or stock_minimo < 0:
        flash("Verifica los campos obligatorios del producto.", "danger")
        return redirect(url_for("productos.index"))

    if Producto.query.filter(db.func.upper(Producto.codigo) == codigo).first():
        flash("Ya existe un producto registrado con ese código.", "danger")
        return redirect(url_for("productos.index"))

    prod = Producto(
        codigo=codigo,
        nombre=nombre,
        descripcion=descripcion,
        categoria=categoria,
        precio_compra=precio_compra,
        precio_venta=precio_venta,
        cantidad_disponible=cantidad,
        stock_minimo=stock_minimo,
    )
    db.session.add(prod)
    db.session.commit()
    flash("Producto agregado correctamente", "success")
    if cantidad <= stock_minimo:
        flash("El producto tiene pocas existencias", "warning")
    return redirect(url_for("productos.index"))


@productos_bp.route("/editar/<int:producto_id>", methods=["POST"])
@login_required
def editar(producto_id: int):
    prod = db.get_or_404(Producto, producto_id)
    codigo = (request.form.get("codigo") or "").strip().upper()
    nombre = (request.form.get("nombre") or "").strip()
    descripcion = (request.form.get("descripcion") or "").strip()
    categoria = (request.form.get("categoria") or "").strip()

    try:
        precio_compra = Decimal(request.form.get("precio_compra") or "0")
        precio_venta = Decimal(request.form.get("precio_venta") or "0")
        cantidad = int(request.form.get("cantidad_disponible") or "0")
        stock_minimo = int(request.form.get("stock_minimo") or "5")
    except Exception:
        flash("Valores numéricos inválidos.", "danger")
        return redirect(url_for("productos.index"))

    dup = Producto.query.filter(
        db.func.upper(Producto.codigo) == codigo, Producto.id != prod.id
    ).first()
    if dup:
        flash("Otro producto ya utiliza ese código.", "danger")
        return redirect(url_for("productos.index"))

    prod.codigo = codigo
    prod.nombre = nombre
    prod.descripcion = descripcion
    prod.categoria = categoria
    prod.precio_compra = precio_compra
    prod.precio_venta = precio_venta
    prod.cantidad_disponible = cantidad
    prod.stock_minimo = stock_minimo
    db.session.commit()
    flash("Registro actualizado correctamente", "success")
    if cantidad <= stock_minimo:
        flash("El producto tiene pocas existencias", "warning")
    return redirect(url_for("productos.index"))


@productos_bp.route("/eliminar/<int:producto_id>", methods=["POST"])
@login_required
def eliminar(producto_id: int):
    prod = db.get_or_404(Producto, producto_id)
    if prod.detalles.count() > 0:
        flash("No es posible eliminar un producto asociado a ventas.", "danger")
        return redirect(url_for("productos.index"))
    db.session.delete(prod)
    db.session.commit()
    flash("Registro actualizado correctamente", "success")
    return redirect(url_for("productos.index"))
