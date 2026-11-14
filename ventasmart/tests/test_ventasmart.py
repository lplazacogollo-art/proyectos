from decimal import Decimal
import pytest
from config import TestConfig
from app import create_app, db
from app.models import Usuario, Cliente, Producto, Configuracion
from app.services.ventas_service import (
    registrar_venta_transaccional,
    registrar_pago_transaccional,
    VentaServiceError,
)
from app.services.pdf_service import generar_comprobante_pdf


@pytest.fixture()
def app_ctx():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        cfg = Configuracion()
        db.session.add(cfg)
        user = Usuario(nombre="Admin Test", correo="admin@test.co", rol="admin")
        user.set_password("Secret123*")
        db.session.add(user)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client_http(app_ctx):
    return app_ctx.test_client()


def test_crud_cliente_y_producto(app_ctx, client_http):
    # Login
    client_http.post("/login", data={"correo": "admin@test.co", "password": "Secret123*"})

    # Registro y edición de cliente
    res = client_http.post(
        "/clientes/crear",
        data={
            "tipo_documento": "CC",
            "numero_documento": "10203040",
            "nombre_completo": "Ana Lucía Torres",
            "telefono": "3101112233",
            "correo": "ana@correo.co",
            "direccion": "Calle 10 # 5-20",
        },
        follow_redirects=True,
    )
    assert res.status_code == 200
    cli = Cliente.query.filter_by(numero_documento="10203040").first()
    assert cli is not None

    client_http.post(
        f"/clientes/editar/{cli.id}",
        data={
            "tipo_documento": "CC",
            "numero_documento": "10203040",
            "nombre_completo": "Ana Lucía Torres Editado",
            "telefono": "3109998877",
            "correo": "ana@correo.co",
            "direccion": "Calle 10 # 5-20",
        },
    )
    db.session.refresh(cli)
    assert cli.nombre_completo == "Ana Lucía Torres Editado"

    # Registro y edición de producto
    client_http.post(
        "/productos/crear",
        data={
            "codigo": "SKU-100",
            "nombre": "Monitor 24",
            "descripcion": "Full HD",
            "categoria": "Tecnología",
            "precio_compra": "500000",
            "precio_venta": "800000",
            "cantidad_disponible": "10",
            "stock_minimo": "3",
        },
    )
    prod = Producto.query.filter_by(codigo="SKU-100").first()
    assert prod is not None
    assert prod.estado == "Disponible"


def test_venta_calculos_inventario_pagos_y_pdf(app_ctx):
    user = Usuario.query.first()
    cli = Cliente(
        tipo_documento="NIT",
        numero_documento="900555111-1",
        nombre_completo="Empresa Demo S.A.S.",
        telefono="3001234567",
        correo="empresa@demo.co",
        direccion="Cra 7 # 71-21",
    )
    prod = Producto(
        codigo="POS-01",
        nombre="Impresora POS",
        categoria="Hardware",
        precio_compra=Decimal("200000"),
        precio_venta=Decimal("500000"),
        cantidad_disponible=5,
        stock_minimo=2,
    )
    db.session.add_all([cli, prod])
    db.session.commit()

    # Validación de existencias insuficientes
    with pytest.raises(VentaServiceError, match="No hay existencias suficientes"):
        registrar_venta_transaccional(
            cliente_id=cli.id,
            usuario_id=user.id,
            items=[{"producto_id": prod.id, "cantidad": 6}],
        )

    # Venta válida: 2 x 500.000 = 1.000.000, desc 10% = 100.000 -> base 900.000, IVA 19% = 171.000 -> total 1.071.000
    venta, _ = registrar_venta_transaccional(
        cliente_id=cli.id,
        usuario_id=user.id,
        items=[{"producto_id": prod.id, "cantidad": 2}],
        descuento_porcentaje=Decimal("10"),
        aplicar_impuesto=True,
        impuesto_porcentaje=Decimal("19"),
        pago_inicial=Decimal("500000"),
        metodo_pago="Transferencia",
        referencia="TRF-001",
    )

    assert venta.subtotal == Decimal("1000000.00")
    assert venta.descuento_monto == Decimal("100000.00")
    assert venta.impuestos == Decimal("171000.00")
    assert venta.total == Decimal("1071000.00")
    assert venta.saldo_pendiente == Decimal("571000.00")
    assert venta.estado_pago == "Parcial"

    db.session.refresh(prod)
    assert prod.cantidad_disponible == 3

    # Validar que pago superior al saldo falla
    with pytest.raises(VentaServiceError, match="El pago supera el saldo pendiente"):
        registrar_pago_transaccional(
            venta_id=venta.id,
            usuario_id=user.id,
            monto_pagado=Decimal("600000"),
            metodo_pago="Efectivo",
        )

    # Registrar pago restante
    registrar_pago_transaccional(
        venta_id=venta.id,
        usuario_id=user.id,
        monto_pagado=Decimal("571000"),
        metodo_pago="Efectivo",
    )
    db.session.refresh(venta)
    assert venta.saldo_pendiente == Decimal("0.00")
    assert venta.estado_pago == "Pagado"

    # Generación de comprobante PDF con ReportLab
    cfg = Configuracion.query.first()
    pdf_buf = generar_comprobante_pdf(venta, cfg)
    assert pdf_buf.getvalue().startswith(b"%PDF-")
