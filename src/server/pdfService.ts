import PDFDocument from 'pdfkit';
import { formatCOP } from './money.js';

export interface PdfSaleData {
  venta: {
    id: number;
    consecutivo: string;
    numero_comprobante: string;
    fecha: string;
    subtotal: number;
    descuento_porcentaje: number;
    descuento_monto: number;
    impuesto_porcentaje: number;
    impuestos: number;
    total: number;
    total_pagado: number;
    saldo_pendiente: number;
    estado_pago: string;
    observaciones: string;
  };
  cliente: {
    tipo_documento: string;
    numero_documento: string;
    nombre_completo: string;
    telefono: string;
    correo: string;
    direccion: string;
  };
  empresa: {
    nombre_comercial: string;
    nit: string;
    direccion: string;
    telefono: string;
    correo: string;
  };
  detalles: Array<{
    codigo: string;
    producto_nombre: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  pagos: Array<{
    numero_pago: string;
    fecha: string;
    monto_pagado: number;
    metodo_pago: string;
    referencia: string;
  }>;
}

export function buildInvoicePdfBuffer(data: PdfSaleData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 45 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const { venta, cliente, empresa, detalles, pagos } = data;
    const navy = '#172554';
    const primaryBlue = '#2563EB';
    const slate900 = '#0F172A';
    const slate500 = '#64748B';
    const border = '#E2E8F0';
    const bgLight = '#F8FAFC';

    // Top Header Banner
    doc.rect(45, 42, 522, 76).fill(navy);
    // Logo mark
    doc.roundedRect(62, 58, 42, 42, 8).fill(primaryBlue);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('VS', 69, 71);

    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('VentaSmart', 116, 58);
    doc.fillColor('#CBD5E1').font('Helvetica').fontSize(9)
      .text(empresa.nombre_comercial, 116, 80)
      .text(`NIT: ${empresa.nit}  |  Tel: ${empresa.telefono}`, 116, 93);

    doc.fillColor('#93C5FD').font('Helvetica-Bold').fontSize(9)
      .text('COMPROBANTE INTERNO DE VENTA', 350, 56, { width: 202, align: 'right' });
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14)
      .text(venta.numero_comprobante, 350, 71, { width: 202, align: 'right' });
    doc.fillColor('#CBD5E1').font('Helvetica').fontSize(9)
      .text(`Venta: ${venta.consecutivo}`, 350, 91, { width: 202, align: 'right' });

    // Metadata & Client boxes
    let y = 134;
    doc.roundedRect(45, y, 254, 96, 6).fillAndStroke(bgLight, border);
    doc.roundedRect(313, y, 254, 96, 6).fillAndStroke(bgLight, border);

    doc.fillColor(slate500).font('Helvetica-Bold').fontSize(8).text('DATOS DEL EMISOR', 58, y + 12);
    doc.fillColor(slate900).font('Helvetica-Bold').fontSize(10).text(empresa.nombre_comercial, 58, y + 26, { width: 228 });
    doc.fillColor(slate500).font('Helvetica').fontSize(8.5)
      .text(`NIT: ${empresa.nit}`, 58, y + 42)
      .text(empresa.direccion, 58, y + 55, { width: 228 })
      .text(`${empresa.correo}  |  ${empresa.telefono}`, 58, y + 70, { width: 228 });

    doc.fillColor(slate500).font('Helvetica-Bold').fontSize(8).text('DATOS DEL CLIENTE', 326, y + 12);
    doc.fillColor(slate900).font('Helvetica-Bold').fontSize(10).text(cliente.nombre_completo, 326, y + 26, { width: 228 });
    doc.fillColor(slate500).font('Helvetica').fontSize(8.5)
      .text(`${cliente.tipo_documento}: ${cliente.numero_documento}`, 326, y + 42)
      .text(cliente.direccion, 326, y + 55, { width: 228 })
      .text(`${cliente.correo}  |  ${cliente.telefono}`, 326, y + 70, { width: 228 });

    // Date & Status bar
    y = 242;
    const fechaStr = new Date(venta.fecha).toLocaleString('es-CO', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    doc.roundedRect(45, y, 522, 28, 5).fillAndStroke('#FFFFFF', border);
    doc.fillColor(slate500).font('Helvetica').fontSize(8.5)
      .text(`Fecha de emisión: ${fechaStr}`, 58, y + 9)
      .text(`Estado de pago: ${venta.estado_pago.toUpperCase()}`, 350, y + 9, { width: 204, align: 'right' });

    // Products Table Header
    y = 284;
    doc.rect(45, y, 522, 24).fill(navy);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    doc.text('CÓDIGO', 54, y + 8, { width: 70 });
    doc.text('PRODUCTO', 128, y + 8, { width: 188 });
    doc.text('CANT.', 320, y + 8, { width: 45, align: 'right' });
    doc.text('VR. UNITARIO', 370, y + 8, { width: 92, align: 'right' });
    doc.text('SUBTOTAL', 466, y + 8, { width: 92, align: 'right' });

    y += 24;
    detalles.forEach((item, idx) => {
      if (y > 650) {
        doc.addPage();
        y = 50;
      }
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : bgLight;
      doc.rect(45, y, 522, 22).fillAndStroke(rowBg, border);
      doc.fillColor(slate500).font('Helvetica').fontSize(8.5).text(item.codigo, 54, y + 7, { width: 70 });
      doc.fillColor(slate900).font('Helvetica').fontSize(8.5).text(item.producto_nombre, 128, y + 7, { width: 188, ellipsis: true });
      doc.fillColor(slate900).font('Helvetica').fontSize(8.5).text(String(item.cantidad), 320, y + 7, { width: 45, align: 'right' });
      doc.fillColor(slate900).font('Helvetica').fontSize(8.5).text(formatCOP(item.precio_unitario), 370, y + 7, { width: 92, align: 'right' });
      doc.fillColor(slate900).font('Helvetica-Bold').fontSize(8.5).text(formatCOP(item.subtotal), 466, y + 7, { width: 92, align: 'right' });
      y += 22;
    });

    // Totals & Payments Section
    y += 14;
    if (y > 600) {
      doc.addPage();
      y = 50;
    }

    // Left: Payments history
    doc.fillColor(slate900).font('Helvetica-Bold').fontSize(9).text('HISTORIAL DE PAGOS', 45, y);
    let payY = y + 16;
    if (pagos.length === 0) {
      doc.fillColor(slate500).font('Helvetica').fontSize(8.5).text('Sin abonos registrados hasta la fecha.', 45, payY);
      payY += 16;
    } else {
      pagos.forEach((p) => {
        const pFecha = new Date(p.fecha).toLocaleDateString('es-CO');
        doc.fillColor(slate900).font('Helvetica-Bold').fontSize(8).text(`${p.numero_pago} (${p.metodo_pago})`, 45, payY);
        doc.fillColor(slate500).font('Helvetica').fontSize(8)
          .text(`${pFecha} ${p.referencia ? '· Ref: ' + p.referencia : ''}`, 45, payY + 10);
        doc.fillColor('#065F46').font('Helvetica-Bold').fontSize(8.5)
          .text(formatCOP(p.monto_pagado), 210, payY + 3, { width: 85, align: 'right' });
        payY += 25;
      });
    }

    // Right: Totals Card
    const totX = 330;
    doc.roundedRect(totX, y, 237, 134, 6).fillAndStroke(bgLight, border);
    let ty = y + 12;
    const drawTotRow = (label: string, val: string, bold = false, color = slate900) => {
      doc.fillColor(slate500).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).text(label, totX + 14, ty);
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(val, totX + 115, ty, { width: 108, align: 'right' });
      ty += 18;
    };

    drawTotRow('Subtotal:', formatCOP(venta.subtotal));
    drawTotRow(`Descuento (${Number(venta.descuento_porcentaje)}%):`, `-${formatCOP(venta.descuento_monto)}`);
    drawTotRow(`Impuestos (${Number(venta.impuesto_porcentaje)}%):`, formatCOP(venta.impuestos));
    doc.moveTo(totX + 14, ty - 4).lineTo(totX + 223, ty - 4).strokeColor(border).stroke();
    drawTotRow('TOTAL VENTA:', formatCOP(venta.total), true, navy);
    drawTotRow('Total pagado:', formatCOP(venta.total_pagado), false, '#065F46');
    drawTotRow('Saldo pendiente:', formatCOP(venta.saldo_pendiente), true, Number(venta.saldo_pendiente) > 0 ? '#B45309' : '#065F46');

    // Footer Disclaimer
    let footerY = Math.max(payY + 24, y + 154);
    if (footerY > 685) {
      doc.addPage();
      footerY = 50;
    }
    doc.roundedRect(45, footerY, 522, 46, 5).fillAndStroke('#EFF6FF', '#BFDBFE');
    doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(8.5)
      .text('COMPROBANTE INTERNO DE VENTA — USO ADMINISTRATIVO Y ACADÉMICO', 58, footerY + 10);
    doc.fillColor('#1E40AF').font('Helvetica').fontSize(8)
      .text('Este documento es un soporte interno generado por VentaSmart y NO constituye una factura electrónica de venta validada por la DIAN.', 58, footerY + 23, { width: 496 });

    doc.end();
  });
}
