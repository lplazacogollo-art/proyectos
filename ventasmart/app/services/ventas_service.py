from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from sqlalchemy import func
from app import db
from app.models import Cliente, Producto, Venta, DetalleVenta, Pago, Configuracion


class VentaServiceError(Exception):
    """Error controlado en operaciones transaccionales de ventas y pagos."""


def _q2(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def registrar_venta_transaccional(
    *,
    cliente_id: int,
    usuario_id: int | None,
    items: list[dict[str, Any]],
    descuento_porcentaje: Decimal = Decimal("0.00"),
    aplicar_impuesto: bool = True,
    impuesto_porcentaje: Decimal | None = None,
    pago_inicial: Decimal = Decimal("0.00"),
    metodo_pago: str = "Efectivo",
    referencia: str = "",
    observaciones: str = "",
) -> tuple[Venta, list[str]]:
    """
    Ejecuta en una transacción atómica de base de datos:
    1. Validar el cliente.
    2. Verificar existencias.
    3. Calcular subtotales, descuento, impuestos y total con Decimal.
    4. Generar el consecutivo interno.
    5. Registrar la venta.
    6. Registrar el detalle de venta.
    7. Actualizar el inventario.
    8. Registrar el pago inicial si existe.
    9. Confirmar la transacción.
    """
    if not items:
        raise VentaServiceError("No se pudo registrar la venta")

    warnings: list[str] = []

    try:
        # 1. Validar cliente
        cliente = db.session.get(Cliente, cliente_id)
        if not cliente:
            raise VentaServiceError("No se pudo registrar la venta")

        # Obtener o crear configuración comercial
        cfg = Configuracion.query.with_for_update().first()
        if not cfg:
            cfg = Configuracion()
            db.session.add(cfg)
            db.session.flush()

        desc_pct = _q2(Decimal(str(descuento_porcentaje or "0")))
        if desc_pct < Decimal("0") or desc_pct > Decimal(str(cfg.descuento_maximo)):
            raise VentaServiceError(
                f"El descuento no puede superar el {cfg.descuento_maximo}% configurado."
            )

        tax_pct = (
            _q2(Decimal(str(impuesto_porcentaje if impuesto_porcentaje is not None else cfg.porcentaje_impuesto)))
            if aplicar_impuesto
            else Decimal("0.00")
        )
        if tax_pct < Decimal("0") or tax_pct > Decimal("100"):
            raise VentaServiceError("El porcentaje de impuesto es inválido.")

        # Consolidar cantidades por producto
        cantidades_por_prod: dict[int, int] = {}
        for raw in items:
            pid = int(raw["producto_id"])
            qty = int(raw["cantidad"])
            if qty <= 0:
                raise VentaServiceError("Las cantidades deben ser mayores a cero.")
            cantidades_por_prod[pid] = cantidades_por_prod.get(pid, 0) + qty

        # 2. Verificar existencias y calcular subtotal
        subtotal = Decimal("0.00")
        resolved: list[tuple[Producto, int, Decimal, Decimal]] = []

        for pid, qty in cantidades_por_prod.items():
            prod = Producto.query.filter_by(id=pid).with_for_update().first()
            if not prod:
                raise VentaServiceError("No se pudo registrar la venta")
            if prod.cantidad_disponible < qty:
                raise VentaServiceError("No hay existencias suficientes")

            unit_price = _q2(Decimal(str(prod.precio_venta)))
            line_subtotal = _q2(unit_price * Decimal(qty))
            subtotal += line_subtotal
            resolved.append((prod, qty, unit_price, line_subtotal))

        # 3. Calcular descuento, impuestos y total
        descuento_monto = _q2(subtotal * desc_pct / Decimal("100"))
        base_gravable = max(Decimal("0.00"), subtotal - descuento_monto)
        impuestos = _q2(base_gravable * tax_pct / Decimal("100"))
        total = _q2(base_gravable + impuestos)

        pago_ini = _q2(Decimal(str(pago_inicial or "0")))
        if pago_ini < Decimal("0.00"):
            raise VentaServiceError("El monto de pago inicial no puede ser negativo.")
        if pago_ini > total:
            raise VentaServiceError("El pago supera el saldo pendiente")

        saldo_pendiente = _q2(total - pago_ini)
        if saldo_pendiente == Decimal("0.00"):
            estado_pago = "Pagado"
        elif pago_ini > Decimal("0.00"):
            estado_pago = "Parcial"
            warnings.append("La venta tiene un saldo pendiente")
        else:
            estado_pago = "Pendiente"
            warnings.append("La venta tiene un saldo pendiente")

        # 4. Generar consecutivo
        cfg.consecutivo_actual = int(cfg.consecutivo_actual) + 1
        prefijo = cfg.prefijo_consecutivo or "VS"
        consecutivo = f"{prefijo}-{cfg.consecutivo_actual:06d}"
        comprobante = f"COMP-{cfg.consecutivo_actual:06d}"

        # 5. Registrar venta
        venta = Venta(
            consecutivo=consecutivo,
            numero_comprobante=comprobante,
            cliente_id=cliente.id,
            usuario_id=usuario_id,
            subtotal=subtotal,
            descuento_porcentaje=desc_pct,
            descuento_monto=descuento_monto,
            impuesto_porcentaje=tax_pct,
            impuestos=impuestos,
            total=total,
            total_pagado=pago_ini,
            saldo_pendiente=saldo_pendiente,
            estado_pago=estado_pago,
            observaciones=(observaciones or "").strip(),
        )
        db.session.add(venta)
        db.session.flush()

        # 6 y 7. Registrar detalle y actualizar inventario
        for prod, qty, unit_price, line_sub in resolved:
            detalle = DetalleVenta(
                venta_id=venta.id,
                producto_id=prod.id,
                cantidad=qty,
                precio_unitario=unit_price,
                subtotal=line_sub,
            )
            db.session.add(detalle)
            prod.cantidad_disponible = prod.cantidad_disponible - qty
            if prod.cantidad_disponible <= prod.stock_minimo:
                warnings.append(f"El producto tiene pocas existencias ({prod.nombre})")

        # 8. Registrar pago inicial si existe
        if pago_ini > Decimal("0.00"):
            max_id = db.session.query(func.coalesce(func.max(Pago.id), 0)).scalar() or 0
            numero_pago = f"PAG-{int(max_id) + 1:06d}"
            pago = Pago(
                numero_pago=numero_pago,
                venta_id=venta.id,
                usuario_id=usuario_id,
                monto_pagado=pago_ini,
                metodo_pago=metodo_pago or "Efectivo",
                referencia=(referencia or "").strip(),
            )
            db.session.add(pago)

        # 9. Confirmar transacción
        db.session.commit()
        return venta, warnings
    except VentaServiceError:
        db.session.rollback()
        raise
    except Exception as exc:
        db.session.rollback()
        raise VentaServiceError("No se pudo registrar la venta") from exc


def registrar_pago_transaccional(
    *,
    venta_id: int,
    usuario_id: int | None,
    monto_pagado: Decimal,
    metodo_pago: str,
    referencia: str = "",
) -> tuple[Pago, str | None]:
    monto = _q2(Decimal(str(monto_pagado)))
    if monto <= Decimal("0.00"):
        raise VentaServiceError("El monto del pago debe ser mayor a cero.")

    try:
        venta = Venta.query.filter_by(id=venta_id).with_for_update().first()
        if not venta:
            raise VentaServiceError("La venta seleccionada no existe.")

        saldo_actual = _q2(Decimal(str(venta.saldo_pendiente)))
        if monto > saldo_actual:
            raise VentaServiceError("El pago supera el saldo pendiente")

        max_id = db.session.query(func.coalesce(func.max(Pago.id), 0)).scalar() or 0
        numero_pago = f"PAG-{int(max_id) + 1:06d}"

        pago = Pago(
            numero_pago=numero_pago,
            venta_id=venta.id,
            usuario_id=usuario_id,
            monto_pagado=monto,
            metodo_pago=metodo_pago,
            referencia=(referencia or "").strip(),
        )
        db.session.add(pago)

        venta.total_pagado = _q2(Decimal(str(venta.total_pagado)) + monto)
        venta.saldo_pendiente = _q2(saldo_actual - monto)
        venta.estado_pago = "Pagado" if venta.saldo_pendiente == Decimal("0.00") else "Parcial"

        warning = "La venta tiene un saldo pendiente" if venta.saldo_pendiente > Decimal("0.00") else None
        db.session.commit()
        return pago, warning
    except VentaServiceError:
        db.session.rollback()
        raise
    except Exception as exc:
        db.session.rollback()
        raise VentaServiceError("No se pudo registrar el pago.") from exc
