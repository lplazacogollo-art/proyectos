import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno.');
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      correo VARCHAR(150) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol VARCHAR(30) NOT NULL DEFAULT 'admin',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      tipo_documento VARCHAR(20) NOT NULL,
      numero_documento VARCHAR(40) UNIQUE NOT NULL,
      nombre_completo VARCHAR(180) NOT NULL,
      telefono VARCHAR(40) NOT NULL,
      correo VARCHAR(150) NOT NULL,
      direccion VARCHAR(255) NOT NULL,
      fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) UNIQUE NOT NULL,
      nombre VARCHAR(180) NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      categoria VARCHAR(100) NOT NULL,
      precio_compra NUMERIC(14, 2) NOT NULL CHECK (precio_compra >= 0),
      precio_venta NUMERIC(14, 2) NOT NULL CHECK (precio_venta >= 0),
      cantidad_disponible INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
      stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      id SERIAL PRIMARY KEY,
      nombre_comercial VARCHAR(180) NOT NULL DEFAULT 'VentaSmart Colombia S.A.S.',
      nit VARCHAR(50) NOT NULL DEFAULT '901.458.720-4',
      direccion VARCHAR(255) NOT NULL DEFAULT 'Cra. 15 # 88-64, Oficina 402, Bogotá D.C.',
      telefono VARCHAR(50) NOT NULL DEFAULT '+57 (601) 745 8920',
      correo VARCHAR(150) NOT NULL DEFAULT 'facturacion@ventasmart.co',
      porcentaje_impuesto NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
      descuento_maximo NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
      prefijo_consecutivo VARCHAR(20) NOT NULL DEFAULT 'VS',
      consecutivo_actual INTEGER NOT NULL DEFAULT 1000,
      fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY,
      consecutivo VARCHAR(40) UNIQUE NOT NULL,
      numero_comprobante VARCHAR(40) UNIQUE NOT NULL,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
      descuento_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
      descuento_monto NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (descuento_monto >= 0),
      impuesto_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 19.00 CHECK (impuesto_porcentaje >= 0),
      impuestos NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
      total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
      total_pagado NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_pagado >= 0),
      saldo_pendiente NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (saldo_pendiente >= 0),
      estado_pago VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
      observaciones TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS detalle_ventas (
      id SERIAL PRIMARY KEY,
      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      precio_unitario NUMERIC(14, 2) NOT NULL CHECK (precio_unitario >= 0),
      subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0)
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id SERIAL PRIMARY KEY,
      numero_pago VARCHAR(40) UNIQUE NOT NULL,
      venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE RESTRICT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      monto_pagado NUMERIC(14, 2) NOT NULL CHECK (monto_pagado > 0),
      metodo_pago VARCHAR(30) NOT NULL,
      referencia VARCHAR(120) NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_venta ON detalle_ventas(venta_id);
    CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);
  `);

  const cfgCheck = await pool.query('SELECT id FROM configuracion LIMIT 1');
  if (cfgCheck.rows.length === 0) {
    await pool.query(`
      INSERT INTO configuracion (
        nombre_comercial, nit, direccion, telefono, correo,
        porcentaje_impuesto, descuento_maximo, prefijo_consecutivo, consecutivo_actual
      ) VALUES (
        'VentaSmart Colombia S.A.S.',
        '901.458.720-4',
        'Cra. 15 # 88-64, Oficina 402, Bogotá D.C.',
        '+57 (601) 745 8920',
        'facturacion@ventasmart.co',
        19.00,
        30.00,
        'VS',
        1005
      )
    `);
  }

  const userCheck = await pool.query('SELECT id FROM usuarios LIMIT 1');
  if (userCheck.rows.length === 0) {
    await seedInitialData();
  }
}

async function seedInitialData(): Promise<void> {
  const adminHash = await bcrypt.hash('Admin2026*', 10);
  const sellerHash = await bcrypt.hash('Vendedor2026*', 10);

  await withTransaction(async (client) => {
    const u1 = await client.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      ['Laura Sofía Martínez', 'admin@ventasmart.co', adminHash, 'admin']
    );
    await client.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4)`,
      ['Carlos Andrés Gómez', 'ventas@ventasmart.co', sellerHash, 'vendedor']
    );
    const adminId = u1.rows[0].id;

    const clientesData = [
      ['NIT', '900312456-1', 'Distribuidora Andina S.A.S.', '3104567890', 'compras@andinasas.co', 'Av. El Dorado # 68C-61, Bogotá'],
      ['CC', '1018452901', 'Camila Andrea Restrepo', '3158901234', 'camila.restrepo@correo.co', 'Cra. 43A # 14-27, Medellín'],
      ['NIT', '800945123-8', 'Soluciones Tecnológicas del Valle Ltda.', '3182345678', 'gerencia@solvalle.co', 'Calle 10N # 4-48, Cali'],
      ['CC', '79845120', 'Juan Camilo Mendoza', '3006784321', 'jcmendoza@empresas.co', 'Cra. 54 # 72-110, Barranquilla'],
      ['CE', '459812', 'Valentina Morales Peña', '3209876543', 'valen.morales@estudio.co', 'Calle 93 # 12-40, Bogotá'],
      ['NIT', '901223890-3', 'Comercializadora Caribe Express S.A.S.', '3123450987', 'pagos@caribeexpress.co', 'Av. Pedro de Heredia # 31-15, Cartagena'],
    ];

    const clientIds: number[] = [];
    for (const c of clientesData) {
      const res = await client.query(
        `INSERT INTO clientes (tipo_documento, numero_documento, nombre_completo, telefono, correo, direccion)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        c
      );
      clientIds.push(res.rows[0].id);
    }

    const productosData = [
      ['PROD-001', 'Portátil Empresarial Pro 14"', 'Procesador i7 16GB RAM SSD 512GB', 'Tecnología', 2450000, 3290000, 14, 4],
      ['PROD-002', 'Monitor IPS 27" QHD', 'Resolución 2560x1440 75Hz USB-C', 'Tecnología', 780000, 1120000, 4, 5],
      ['PROD-003', 'Impresora Térmica POS 80mm', 'Conexión USB y Red Ethernet corte automático', 'Punto de Venta', 290000, 460000, 9, 3],
      ['PROD-004', 'Lector de Código de Barras 2D', 'Inalámbrico con base recargable', 'Punto de Venta', 145000, 240000, 3, 5],
      ['PROD-005', 'Silla Ergonómica Ejecutiva Mesh', 'Soporte lumbar ajustable y brazos 3D', 'Mobiliario', 420000, 680000, 12, 4],
      ['PROD-006', 'Teclado Mecánico Corporativo', 'Layout español inalámbrico batería recargable', 'Accesorios', 120000, 195000, 25, 6],
      ['PROD-007', 'Licencia Antivirus Anual Pymes', 'Protección 5 equipos gestión en la nube', 'Software', 180000, 310000, 30, 5],
      ['PROD-008', 'UPS Interactiva 1200VA', 'Respaldo eléctrico 6 tomas reguladas', 'Infraestructura', 260000, 415000, 0, 3],
    ];

    const prodIds: { id: number; price: number }[] = [];
    for (const p of productosData) {
      const res = await client.query(
        `INSERT INTO productos (codigo, nombre, descripcion, categoria, precio_compra, precio_venta, cantidad_disponible, stock_minimo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, precio_venta`,
        p
      );
      prodIds.push({ id: res.rows[0].id, price: Number(res.rows[0].precio_venta) });
    }

    // Seed 5 realistic sales across recent months/days
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

    const seedSales = [
      {
        consecutivo: 'VS-001001',
        comprobante: 'COMP-001001',
        clienteId: clientIds[0],
        fecha: daysAgo(45),
        descPct: 5,
        items: [{ prodIdx: 0, qty: 2 }, { prodIdx: 1, qty: 2 }],
        pagos: [{ monto: 9974970, metodo: 'Transferencia', ref: 'TRF-88412' }],
      },
      {
        consecutivo: 'VS-001002',
        comprobante: 'COMP-001002',
        clienteId: clientIds[2],
        fecha: daysAgo(28),
        descPct: 0,
        items: [{ prodIdx: 2, qty: 3 }, { prodIdx: 3, qty: 3 }],
        pagos: [{ monto: 2499000, metodo: 'Tarjeta', ref: 'POS-9912' }],
      },
      {
        consecutivo: 'VS-001003',
        comprobante: 'COMP-001003',
        clienteId: clientIds[1],
        fecha: daysAgo(12),
        descPct: 10,
        items: [{ prodIdx: 4, qty: 2 }, { prodIdx: 5, qty: 4 }],
        pagos: [{ monto: 1200000, metodo: 'Efectivo', ref: 'CAJA-001' }],
      },
      {
        consecutivo: 'VS-001004',
        comprobante: 'COMP-001004',
        clienteId: clientIds[3],
        fecha: daysAgo(3),
        descPct: 0,
        items: [{ prodIdx: 6, qty: 5 }, { prodIdx: 5, qty: 2 }],
        pagos: [{ monto: 2308600, metodo: 'Transferencia', ref: 'NEQ-4410' }],
      },
      {
        consecutivo: 'VS-001005',
        comprobante: 'COMP-001005',
        clienteId: clientIds[5],
        fecha: daysAgo(0),
        descPct: 0,
        items: [{ prodIdx: 0, qty: 1 }, { prodIdx: 2, qty: 2 }],
        pagos: [],
      },
    ];

    let pagoSeq = 1;
    for (const s of seedSales) {
      let subtotal = 0;
      for (const it of s.items) {
        subtotal += prodIds[it.prodIdx].price * it.qty;
      }
      const descMonto = Math.round(subtotal * (s.descPct / 100));
      const baseGravable = subtotal - descMonto;
      const impuestos = Math.round(baseGravable * 0.19);
      const total = baseGravable + impuestos;
      const pagado = s.pagos.reduce((acc, p) => acc + p.monto, 0);
      const saldo = Math.max(0, total - pagado);
      const estado = saldo === 0 ? 'Pagado' : pagado > 0 ? 'Parcial' : 'Pendiente';

      const vRes = await client.query(
        `INSERT INTO ventas (
          consecutivo, numero_comprobante, cliente_id, usuario_id, fecha,
          subtotal, descuento_porcentaje, descuento_monto, impuesto_porcentaje,
          impuestos, total, total_pagado, saldo_pendiente, estado_pago, observaciones
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          s.consecutivo, s.comprobante, s.clienteId, adminId, s.fecha,
          subtotal, s.descPct, descMonto, 19, impuestos, total, pagado, saldo, estado,
          'Operación comercial inicial de demostración'
        ]
      );
      const ventaId = vRes.rows[0].id;

      for (const it of s.items) {
        const p = prodIds[it.prodIdx];
        await client.query(
          `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
           VALUES ($1,$2,$3,$4,$5)`,
          [ventaId, p.id, it.qty, p.price, p.price * it.qty]
        );
      }

      for (const p of s.pagos) {
        const numPago = `PAG-${String(pagoSeq++).padStart(6, '0')}`;
        await client.query(
          `INSERT INTO pagos (numero_pago, venta_id, usuario_id, fecha, monto_pagado, metodo_pago, referencia)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [numPago, ventaId, adminId, s.fecha, p.monto, p.metodo, p.ref]
        );
      }
    }
  });
}
