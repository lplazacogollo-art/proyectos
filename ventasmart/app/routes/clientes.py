import re
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from sqlalchemy import or_
from app import db
from app.models import Cliente

clientes_bp = Blueprint("clientes", __name__, url_prefix="/clientes")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@clientes_bp.route("/")
@login_required
def index():
    q = (request.args.get("q") or "").strip()
    query = Cliente.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Cliente.nombre_completo.ilike(like),
                Cliente.numero_documento.ilike(like),
                Cliente.correo.ilike(like),
            )
        )
    clientes = query.order_by(Cliente.fecha_registro.desc()).all()
    return render_template("clientes/index.html", clientes=clientes, q=q)


@clientes_bp.route("/crear", methods=["POST"])
@login_required
def crear():
    tipo_doc = (request.form.get("tipo_documento") or "").strip()
    num_doc = (request.form.get("numero_documento") or "").strip()
    nombre = (request.form.get("nombre_completo") or "").strip()
    telefono = (request.form.get("telefono") or "").strip()
    correo = (request.form.get("correo") or "").strip().lower()
    direccion = (request.form.get("direccion") or "").strip()

    if not all([tipo_doc, num_doc, nombre, telefono, correo, direccion]):
        flash("Todos los campos del cliente son obligatorios.", "danger")
        return redirect(url_for("clientes.index"))

    if len(num_doc) < 5:
        flash("El número de documento debe tener al menos 5 caracteres.", "danger")
        return redirect(url_for("clientes.index"))

    if not EMAIL_RE.match(correo):
        flash("El correo electrónico ingresado no es válido.", "danger")
        return redirect(url_for("clientes.index"))

    if Cliente.query.filter_by(numero_documento=num_doc).first():
        flash("El cliente ya se encuentra registrado", "danger")
        return redirect(url_for("clientes.index"))

    cliente = Cliente(
        tipo_documento=tipo_doc,
        numero_documento=num_doc,
        nombre_completo=nombre,
        telefono=telefono,
        correo=correo,
        direccion=direccion,
    )
    db.session.add(cliente)
    db.session.commit()
    flash("Cliente agregado correctamente", "success")
    return redirect(url_for("clientes.index"))


@clientes_bp.route("/editar/<int:cliente_id>", methods=["POST"])
@login_required
def editar(cliente_id: int):
    cliente = db.get_or_404(Cliente, cliente_id)
    tipo_doc = (request.form.get("tipo_documento") or "").strip()
    num_doc = (request.form.get("numero_documento") or "").strip()
    nombre = (request.form.get("nombre_completo") or "").strip()
    telefono = (request.form.get("telefono") or "").strip()
    correo = (request.form.get("correo") or "").strip().lower()
    direccion = (request.form.get("direccion") or "").strip()

    if not all([tipo_doc, num_doc, nombre, telefono, correo, direccion]) or not EMAIL_RE.match(correo):
        flash("Datos inválidos al actualizar cliente.", "danger")
        return redirect(url_for("clientes.index"))

    dup = Cliente.query.filter(
        Cliente.numero_documento == num_doc, Cliente.id != cliente.id
    ).first()
    if dup:
        flash("El cliente ya se encuentra registrado", "danger")
        return redirect(url_for("clientes.index"))

    cliente.tipo_documento = tipo_doc
    cliente.numero_documento = num_doc
    cliente.nombre_completo = nombre
    cliente.telefono = telefono
    cliente.correo = correo
    cliente.direccion = direccion
    db.session.commit()
    flash("Registro actualizado correctamente", "success")
    return redirect(url_for("clientes.index"))


@clientes_bp.route("/eliminar/<int:cliente_id>", methods=["POST"])
@login_required
def eliminar(cliente_id: int):
    cliente = db.get_or_404(Cliente, cliente_id)
    if cliente.ventas:
        flash("No se puede eliminar un cliente con ventas registradas.", "danger")
        return redirect(url_for("clientes.index"))
    db.session.delete(cliente)
    db.session.commit()
    flash("Registro actualizado correctamente", "success")
    return redirect(url_for("clientes.index"))
