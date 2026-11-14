from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app import format_cop
from app.models import Venta, Configuracion


def generar_comprobante_pdf(venta: Venta, cfg: Configuracion | None) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
    )

    styles = getSampleStyleSheet()
    navy = colors.HexColor("#172554")
    blue = colors.HexColor("#2563EB")
    slate_900 = colors.HexColor("#0F172A")
    slate_500 = colors.HexColor("#64748B")
    bg_light = colors.HexColor("#F8FAFC")
    border_col = colors.HexColor("#E2E8F0")

    title_style = ParagraphStyle(
        "VSTitle", parent=styles["Heading1"], fontSize=16, textColor=colors.white, leading=20
    )
    sub_white = ParagraphStyle(
        "VSSubWhite", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#CBD5E1"), leading=12
    )
    right_white = ParagraphStyle(
        "VSRightWhite", parent=styles["Normal"], fontSize=11, textColor=colors.white, alignment=2, leading=14
    )
    label_style = ParagraphStyle(
        "VSLabel", parent=styles["Normal"], fontSize=8, textColor=slate_500, leading=11
    )
    body_style = ParagraphStyle(
        "VSBody", parent=styles["Normal"], fontSize=9, textColor=slate_900, leading=13
    )

    empresa_nombre = cfg.nombre_comercial if cfg else "VentaSmart Colombia S.A.S."
    empresa_nit = cfg.nit if cfg else "901.458.720-4"
    empresa_dir = cfg.direccion if cfg else "Cra. 15 # 88-64, Bogotá D.C."
    empresa_tel = cfg.telefono if cfg else "+57 (601) 745 8920"
    empresa_mail = cfg.correo if cfg else "facturacion@ventasmart.co"

    elements = []

    # Encabezado corporativo
    header_table = Table(
        [[
            Paragraph(f"<b>VentaSmart</b><br/><font size='9'>{empresa_nombre}</font>", title_style),
            Paragraph(
                f"<font size='8' color='#93C5FD'><b>COMPROBANTE INTERNO DE VENTA</b></font><br/>"
                f"<b>{venta.numero_comprobante}</b><br/>"
                f"<font size='8'>Venta: {venta.consecutivo}</font>",
                right_white,
            ),
        ]],
        colWidths=[105 * mm, 78 * mm],
    )
    header_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), navy),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ])
    )
    elements.append(header_table)
    elements.append(Spacer(1, 6 * mm))

    # Datos emisor y cliente
    fecha_str = venta.fecha.strftime("%d/%m/%Y %H:%M") if venta.fecha else ""
    info_table = Table(
        [[
            Paragraph(
                f"<b>DATOS DEL NEGOCIO</b><br/>"
                f"{empresa_nombre}<br/>NIT: {empresa_nit}<br/>{empresa_dir}<br/>{empresa_tel} · {empresa_mail}",
                body_style,
            ),
            Paragraph(
                f"<b>DATOS DEL CLIENTE</b><br/>"
                f"{venta.cliente.nombre_completo}<br/>"
                f"{venta.cliente.tipo_documento}: {venta.cliente.numero_documento}<br/>"
                f"{venta.cliente.direccion}<br/>"
                f"{venta.cliente.telefono} · {venta.cliente.correo}<br/>"
                f"<b>Fecha:</b> {fecha_str}",
                body_style,
            ),
        ]],
        colWidths=[91 * mm, 92 * mm],
    )
    info_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg_light),
            ("BOX", (0, 0), (0, 0), 0.75, border_col),
            ("BOX", (1, 0), (1, 0), 0.75, border_col),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    elements.append(info_table)
    elements.append(Spacer(1, 6 * mm))

    # Tabla de productos
    rows = [["Código", "Producto", "Cant.", "Precio Unit.", "Subtotal"]]
    for d in venta.detalles:
        rows.append([
            d.producto.codigo,
            d.producto.nombre,
            str(d.cantidad),
            format_cop(d.precio_unitario),
            format_cop(d.subtotal),
        ])

    prod_table = Table(rows, colWidths=[28 * mm, 76 * mm, 18 * mm, 30 * mm, 31 * mm])
    prod_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, border_col),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, bg_light]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(prod_table)
    elements.append(Spacer(1, 6 * mm))

    # Totales
    totals_rows = [
        ["Subtotal:", format_cop(venta.subtotal)],
        [f"Descuento ({venta.descuento_porcentaje}%):", f"-{format_cop(venta.descuento_monto)}"],
        [f"Impuestos ({venta.impuesto_porcentaje}%):", format_cop(venta.impuestos)],
        ["TOTAL VENTA:", format_cop(venta.total)],
        ["Total pagado:", format_cop(venta.total_pagado)],
        ["Saldo pendiente:", format_cop(venta.saldo_pendiente)],
        ["Estado de pago:", venta.estado_pago],
    ]
    totals_table = Table(totals_rows, colWidths=[50 * mm, 36 * mm], hAlign="RIGHT")
    totals_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg_light),
            ("BOX", (0, 0), (-1, -1), 0.75, border_col),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 3), (-1, 3), navy),
            ("LINEABOVE", (0, 3), (-1, 3), 0.75, border_col),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(totals_table)
    elements.append(Spacer(1, 5 * mm))

    # Historial de pagos
    if venta.pagos:
        pay_rows = [["N° Pago", "Fecha", "Método", "Referencia", "Monto"]]
        for p in venta.pagos:
            pay_rows.append([
                p.numero_pago,
                p.fecha.strftime("%d/%m/%Y %H:%M") if p.fecha else "",
                p.metodo_pago,
                p.referencia or "—",
                format_cop(p.monto_pagado),
            ])
        pay_table = Table(pay_rows, colWidths=[30 * mm, 38 * mm, 32 * mm, 45 * mm, 38 * mm])
        pay_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), blue),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (4, 0), (4, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.5, border_col),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        elements.append(Paragraph("<b>HISTORIAL DE PAGOS</b>", label_style))
        elements.append(Spacer(1, 2 * mm))
        elements.append(pay_table)
        elements.append(Spacer(1, 6 * mm))

    # Nota de documento interno (no factura electrónica DIAN)
    disclaimer = Table(
        [[
            Paragraph(
                "<b>COMPROBANTE INTERNO DE VENTA — DOCUMENTO ADMINISTRATIVO Y ACADÉMICO</b><br/>"
                "Este comprobante interno ha sido generado por VentaSmart para control comercial interno "
                "y no constituye una factura electrónica de venta validada por la DIAN.",
                ParagraphStyle("Disclaimer", parent=styles["Normal"], fontSize=8, textColor=navy, leading=11),
            )
        ]],
        colWidths=[183 * mm],
    )
    disclaimer.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#BFDBFE")),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    elements.append(disclaimer)

    doc.build(elements)
    buffer.seek(0)
    return buffer
