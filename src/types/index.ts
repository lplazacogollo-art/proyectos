export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

export interface Cliente {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombre_completo: string;
  telefono: string;
  correo: string;
  direccion: string;
  fecha_registro: string;
  total_compras?: number;
  monto_compras?: number;
}

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio_compra: number;
  precio_venta: number;
  cantidad_disponible: number;
  stock_minimo: number;
  estado: 'Disponible' | 'Bajo inventario' | 'Agotado';
  fecha_creacion: string;
}

export interface Venta {
  id: number;
  consecutivo: string;
  numero_comprobante: string;
  cliente_id: number;
  cliente_nombre?: string;
  cliente_tipo_doc?: string;
  cliente_documento?: string;
  fecha: string;
  subtotal: number;
  descuento_porcentaje: number;
  descuento_monto: number;
  impuesto_porcentaje: number;
  impuestos: number;
  total: number;
  total_pagado: number;
  saldo_pendiente: number;
  estado_pago: 'Pagado' | 'Parcial' | 'Pendiente';
  observaciones: string;
}

export interface DetalleVentaItem {
  id: number;
  producto_id: number;
  codigo: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface Pago {
  id: number;
  numero_pago: string;
  venta_id: number;
  fecha: string;
  monto_pagado: number;
  metodo_pago: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Otro';
  referencia: string;
  consecutivo?: string;
  numero_comprobante?: string;
  venta_total?: number;
  venta_saldo?: number;
  estado_pago?: string;
  cliente_nombre?: string;
  cliente_documento?: string;
}

export interface Configuracion {
  id: number;
  nombre_comercial: string;
  nit: string;
  direccion: string;
  telefono: string;
  correo: string;
  porcentaje_impuesto: number;
  descuento_maximo: number;
  prefijo_consecutivo: string;
  consecutivo_actual: number;
}

export interface FlashMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  text: string;
}

export type NavSection =
  | 'dashboard'
  | 'clientes'
  | 'productos'
  | 'ventas'
  | 'pagos'
  | 'facturas'
  | 'reportes'
  | 'configuracion';
