import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { initDatabase, pool, withTransaction } from './src/server/db.js';
import {
  getSessionCookieOptions,
  requireAuth,
  SESSION_COOKIE,
  signSessionToken,
  type AuthedRequest,
} from './src/server/auth.js';
import { calcPercentageCents, fromCents, toCents } from './src/server/money.js';
import { buildInvoicePdfBuffer } from './src/server/pdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApiKey = '';
try {
  const fbCfg = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8')
  ) as { apiKey?: string };
  firebaseApiKey = fbCfg.apiKey || '';
} catch {
  firebaseApiKey = '';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_PAYMENT_METHODS = new Set(['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']);

function parsePositiveInt(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function computeProductStatus(cantidad: number, minimo: number): string {
  if (cantidad <= 0) return 'Agotado';
  if (cantidad <= minimo) return 'Bajo inventario';
  return 'Disponible';
}

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Healthcheck
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'neon-postgresql' });
    } catch {
      res.status(500).json({ status: 'error' });
    }
  });

  // ==================== AUTHENTICATION ====================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { correo, password } = req.body ?? {};
      if (!correo || !password) {
        res.status(400).json({ error: 'Ingresa tu correo electrónico y contraseña.' });
        return;
      }
      const normalizedEmail = String(correo).trim().toLowerCase();
      const result = await pool.query(
        'SELECT id, nombre, correo, password_hash, rol, activo FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
        [normalizedEmail]
      );
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Credenciales incorrectas.' });
        return;
      }
      const user = result.rows[0];
      if (!user.activo) {
        res.status(403).json({ error: 'Usuario desactivado.' });
        return;
      }
      const valid = await bcrypt.compare(String(password), user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Credenciales incorrectas.' });
        return;
      }

      const token = signSessionToken({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      });

      res.cookie(SESSION_COOKIE, token, getSessionCookieOptions(req));

      res.json({
        user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol },
        sessionToken: token,
        message: 'Sesión iniciada correctamente',
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Error interno al iniciar sesión.' });
    }
  });

  app.post('/api/auth/guest', async (req, res) => {
    try {
      const rawName = String(req.body?.nombre || '').trim();
      const displayName = rawName || 'Usuario Invitado';

      let user;
      if (!rawName) {
        const guestEmail = 'invitado@ventasmart.co';
        const existing = await pool.query(
          'SELECT id, nombre, correo, rol, activo FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
          [guestEmail]
        );
        if (existing.rows.length > 0) {
          user = existing.rows[0];
          if (!user.activo) {
            await pool.query('UPDATE usuarios SET activo = TRUE WHERE id = $1', [user.id]);
          }
        } else {
          const hash = await bcrypt.hash(`guest-${Date.now()}-${Math.random()}`, 10);
          const inserted = await pool.query(
            `INSERT INTO usuarios (nombre, correo, password_hash, rol)
             VALUES ($1, $2, $3, 'admin')
             RETURNING id, nombre, correo, rol`,
            [displayName, guestEmail, hash]
          );
          user = inserted.rows[0];
        }
      } else {
        const slug = rawName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '') || 'visitante';
        const guestEmail = `${slug}.${Date.now().toString(36)}@ventasmart.local`;
        const hash = await bcrypt.hash(`guest-${Date.now()}-${Math.random()}`, 10);
        const inserted = await pool.query(
          `INSERT INTO usuarios (nombre, correo, password_hash, rol)
           VALUES ($1, $2, $3, 'admin')
           RETURNING id, nombre, correo, rol`,
          [displayName, guestEmail, hash]
        );
        user = inserted.rows[0];
      }

      const token = signSessionToken({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      });

      res.cookie(SESSION_COOKIE, token, getSessionCookieOptions(req));

      res.json({
        user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol },
        sessionToken: token,
        message: 'Bienvenido a VentaSmart',
      });
    } catch (err) {
      console.error('Guest auth error:', err);
      res.status(500).json({ error: 'Error al ingresar a VentaSmart.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { nombre, correo, password } = req.body ?? {};
      const cleanNombre = String(nombre || '').trim() || 'Usuario VentaSmart';
      const rawEmail = String(correo || '').trim().toLowerCase();
      const cleanEmail = rawEmail
        ? EMAIL_REGEX.test(rawEmail)
          ? rawEmail
          : `${rawEmail.replace(/[^a-z0-9]+/g, '.')}.${Date.now().toString(36)}@ventasmart.local`
        : `usuario.${Date.now().toString(36)}@ventasmart.local`;

      const exists = await pool.query('SELECT id FROM usuarios WHERE LOWER(correo) = $1', [cleanEmail]);
      if (exists.rows.length > 0) {
        res.status(409).json({ error: 'Ya existe un usuario registrado con ese correo.' });
        return;
      }

      const rawPassword = String(password || '').trim() || `libre-${Date.now()}-${Math.random()}`;
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      const inserted = await pool.query(
        `INSERT INTO usuarios (nombre, correo, password_hash, rol)
         VALUES ($1, $2, $3, 'admin')
         RETURNING id, nombre, correo, rol`,
        [cleanNombre, cleanEmail, passwordHash]
      );
      const user = inserted.rows[0];
      const token = signSessionToken({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      });

      res.cookie(SESSION_COOKIE, token, getSessionCookieOptions(req));

      res.status(201).json({
        user,
        sessionToken: token,
        message: 'Bienvenido a VentaSmart',
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Error al ingresar usuario.' });
    }
  });

  app.post('/api/auth/google', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const accessToken = bearerToken || String(req.body?.accessToken || '').trim();
      const idToken = String(req.body?.idToken || '').trim();

      if (!accessToken && !idToken) {
        res.status(401).json({ error: 'Token de Google requerido.' });
        return;
      }

      let verifiedEmail: string | undefined;
      let emailVerified = false;
      let verifiedName: string | undefined;

      if (accessToken) {
        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (googleRes.ok) {
          const profile = (await googleRes.json()) as {
            email?: string;
            email_verified?: boolean;
            name?: string;
          };
          verifiedEmail = profile.email;
          emailVerified = profile.email_verified !== false;
          verifiedName = profile.name;
        }
      }

      if (!verifiedEmail && idToken && firebaseApiKey) {
        const fbRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }
        );
        if (fbRes.ok) {
          const fbJson = (await fbRes.json()) as {
            users?: Array<{ email?: string; emailVerified?: boolean; displayName?: string }>;
          };
          const fbUser = fbJson.users?.[0];
          if (fbUser?.email) {
            verifiedEmail = fbUser.email;
            emailVerified = fbUser.emailVerified !== false;
            verifiedName = fbUser.displayName;
          }
        }
      }

      if (!verifiedEmail) {
        res.status(401).json({ error: 'No se pudo verificar la cuenta de Google.' });
        return;
      }
      if (!emailVerified) {
        res.status(400).json({ error: 'Tu cuenta de Google debe tener un correo electrónico verificado.' });
        return;
      }

      const cleanEmail = verifiedEmail.trim().toLowerCase();
      const cleanName = (verifiedName || cleanEmail.split('@')[0]).trim();

      const userResult = await pool.query(
        'SELECT id, nombre, correo, rol, activo FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
        [cleanEmail]
      );

      let user;
      if (userResult.rows.length === 0) {
        const randomHash = await bcrypt.hash(
          `google-${cleanEmail}-${Date.now()}-${Math.random()}`,
          10
        );
        const inserted = await pool.query(
          `INSERT INTO usuarios (nombre, correo, password_hash, rol)
           VALUES ($1, $2, $3, 'admin')
           RETURNING id, nombre, correo, rol, activo`,
          [cleanName, cleanEmail, randomHash]
        );
        user = inserted.rows[0];
      } else {
        user = userResult.rows[0];
        if (!user.activo) {
          res.status(403).json({ error: 'Usuario desactivado.' });
          return;
        }
      }

      const token = signSessionToken({
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      });

      res.cookie(SESSION_COOKIE, token, getSessionCookieOptions(req));

      res.json({
        user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol },
        sessionToken: token,
        message: 'Sesión iniciada con Google correctamente',
      });
    } catch (err) {
      console.error('Google auth error:', err);
      res.status(500).json({ error: 'Error al autenticar con Google.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const opts = getSessionCookieOptions(req);
    res.clearCookie(SESSION_COOKIE, { path: opts.path, sameSite: opts.sameSite, secure: opts.secure });
    res.json({ message: 'Sesión cerrada correctamente' });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const result = await pool.query(
        'SELECT id, nombre, correo, rol, fecha_creacion FROM usuarios WHERE id = $1',
        [req.user!.id]
      );
      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Usuario no encontrado.' });
        return;
      }
      res.json({ user: result.rows[0] });
    } catch (err) {
      console.error('Auth me error:', err);
      res.status(500).json({ error: 'Error obteniendo usuario.' });
    }
  });

  // ==================== DASHBOARD ====================
  app.get('/api/dashboard', requireAuth, async (_req, res) => {
    try {
      const [
        todayRes,
        monthRes,
        totalSalesRes,
        clientsCountRes,
        productsCountRes,
        lowStockCountRes,
        monthlyChartRes,
        dailyPeriodRes,
        paymentMethodsRes,
        topProductsRes,
        recentSalesRes,
        recentClientsRes,
        lowStockListRes,
      ] = await Promise.all([
        pool.query(`SELECT COALESCE(SUM(total), 0)::float8 AS total, COUNT(*)::int AS count FROM ventas WHERE DATE(fecha AT TIME ZONE 'America/Bogota') = DATE(NOW() AT TIME ZONE 'America/Bogota')`),
        pool.query(`SELECT COALESCE(SUM(total), 0)::float8 AS total FROM ventas WHERE DATE_TRUNC('month', fecha AT TIME ZONE 'America/Bogota') = DATE_TRUNC('month', NOW() AT TIME ZONE 'America/Bogota')`),
        pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(total), 0)::float8 AS total FROM ventas`),
        pool.query(`SELECT COUNT(*)::int AS count FROM clientes`),
        pool.query(`SELECT COUNT(*)::int AS count FROM productos`),
        pool.query(`SELECT COUNT(*)::int AS count FROM productos WHERE cantidad_disponible <= stock_minimo`),
        pool.query(`
          SELECT TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes_key,
                 TO_CHAR(DATE_TRUNC('month', fecha), 'Mon YY') AS mes_label,
                 COALESCE(SUM(total), 0)::float8 AS total,
                 COUNT(*)::int AS cantidad
          FROM ventas
          WHERE fecha >= NOW() - INTERVAL '6 months'
          GROUP BY 1, 2
          ORDER BY 1 ASC
        `),
        pool.query(`
          SELECT TO_CHAR(DATE(fecha), 'DD/MM') AS dia,
                 DATE(fecha) AS fecha_ord,
                 COALESCE(SUM(total), 0)::float8 AS total
          FROM ventas
          WHERE fecha >= NOW() - INTERVAL '30 days'
          GROUP BY 1, 2
          ORDER BY 2 ASC
        `),
        pool.query(`
          SELECT metodo_pago, COALESCE(SUM(monto_pagado), 0)::float8 AS total, COUNT(*)::int AS cantidad
          FROM pagos
          GROUP BY metodo_pago
          ORDER BY total DESC
        `),
        pool.query(`
          SELECT p.nombre, p.codigo, SUM(dv.cantidad)::int AS unidades, COALESCE(SUM(dv.subtotal), 0)::float8 AS ingresos
          FROM detalle_ventas dv
          JOIN productos p ON p.id = dv.producto_id
          GROUP BY p.id, p.nombre, p.codigo
          ORDER BY unidades DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT v.id, v.consecutivo, v.numero_comprobante, v.fecha, v.total::float8, v.saldo_pendiente::float8, v.estado_pago,
                 c.nombre_completo AS cliente_nombre, c.numero_documento AS cliente_documento
          FROM ventas v
          JOIN clientes c ON c.id = v.cliente_id
          ORDER BY v.fecha DESC, v.id DESC
          LIMIT 6
        `),
        pool.query(`
          SELECT id, tipo_documento, numero_documento, nombre_completo, telefono, correo, fecha_registro
          FROM clientes
          ORDER BY fecha_registro DESC, id DESC
          LIMIT 5
        `),
        pool.query(`
          SELECT id, codigo, nombre, categoria, cantidad_disponible, stock_minimo, precio_venta::float8
          FROM productos
          WHERE cantidad_disponible <= stock_minimo
          ORDER BY cantidad_disponible ASC, id ASC
          LIMIT 6
        `),
      ]);

      res.json({
        stats: {
          ventas_hoy: todayRes.rows[0].total,
          ventas_hoy_count: todayRes.rows[0].count,
          ingresos_mes: monthRes.rows[0].total,
          total_ventas: totalSalesRes.rows[0].count,
          ingresos_totales: totalSalesRes.rows[0].total,
          clientes_registrados: clientsCountRes.rows[0].count,
          productos_registrados: productsCountRes.rows[0].count,
          productos_bajo_inventario: lowStockCountRes.rows[0].count,
        },
        charts: {
          ventas_por_mes: monthlyChartRes.rows,
          ingresos_por_periodo: dailyPeriodRes.rows,
          metodos_pago: paymentMethodsRes.rows,
          productos_mas_vendidos: topProductsRes.rows,
        },
        tables: {
          ultimas_ventas: recentSalesRes.rows,
          ultimos_clientes: recentClientsRes.rows,
          productos_bajo_inventario: lowStockListRes.rows.map((p) => ({
            ...p,
            estado: computeProductStatus(p.cantidad_disponible, p.stock_minimo),
          })),
        },
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.status(500).json({ error: 'Error cargando el dashboard.' });
    }
  });

  // ==================== CLIENTES ====================
  app.get('/api/clientes', requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      let result;
      if (q) {
        result = await pool.query(
          `SELECT c.*, COUNT(v.id)::int AS total_compras, COALESCE(SUM(v.total), 0)::float8 AS monto_compras
           FROM clientes c
           LEFT JOIN ventas v ON v.cliente_id = c.id
           WHERE c.nombre_completo ILIKE $1 OR c.numero_documento ILIKE $1 OR c.correo ILIKE $1
           GROUP BY c.id
           ORDER BY c.fecha_registro DESC, c.id DESC`,
          [`%${q}%`]
        );
      } else {
        result = await pool.query(
          `SELECT c.*, COUNT(v.id)::int AS total_compras, COALESCE(SUM(v.total), 0)::float8 AS monto_compras
           FROM clientes c
           LEFT JOIN ventas v ON v.cliente_id = c.id
           GROUP BY c.id
           ORDER BY c.fecha_registro DESC, c.id DESC`
        );
      }
      res.json({ clientes: result.rows });
    } catch (err) {
      console.error('Clientes list error:', err);
      res.status(500).json({ error: 'Error consultando clientes.' });
    }
  });

  app.post('/api/clientes', requireAuth, async (req, res) => {
    try {
      const { tipo_documento, numero_documento, nombre_completo, telefono, correo, direccion } = req.body ?? {};
      if (!tipo_documento || !numero_documento || !nombre_completo || !telefono || !correo || !direccion) {
        res.status(400).json({ error: 'Todos los campos del cliente son obligatorios.' });
        return;
      }
      const docClean = String(numero_documento).trim();
      const emailClean = String(correo).trim().toLowerCase();
      if (docClean.length < 5) {
        res.status(400).json({ error: 'El número de documento debe tener al menos 5 caracteres.' });
        return;
      }
      if (!EMAIL_REGEX.test(emailClean)) {
        res.status(400).json({ error: 'El correo electrónico ingresado no es válido.' });
        return;
      }

      const dup = await pool.query('SELECT id FROM clientes WHERE numero_documento = $1', [docClean]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'El cliente ya se encuentra registrado' });
        return;
      }

      const inserted = await pool.query(
        `INSERT INTO clientes (tipo_documento, numero_documento, nombre_completo, telefono, correo, direccion)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          String(tipo_documento).trim(),
          docClean,
          String(nombre_completo).trim(),
          String(telefono).trim(),
          emailClean,
          String(direccion).trim(),
        ]
      );

      res.status(201).json({
        cliente: inserted.rows[0],
        message: 'Cliente agregado correctamente',
      });
    } catch (err) {
      console.error('Create cliente error:', err);
      res.status(500).json({ error: 'No se pudo registrar el cliente.' });
    }
  });

  app.put('/api/clientes/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de cliente inválido.' });
        return;
      }
      const { tipo_documento, numero_documento, nombre_completo, telefono, correo, direccion } = req.body ?? {};
      if (!tipo_documento || !numero_documento || !nombre_completo || !telefono || !correo || !direccion) {
        res.status(400).json({ error: 'Todos los campos del cliente son obligatorios.' });
        return;
      }
      const docClean = String(numero_documento).trim();
      const emailClean = String(correo).trim().toLowerCase();
      if (!EMAIL_REGEX.test(emailClean)) {
        res.status(400).json({ error: 'El correo electrónico no es válido.' });
        return;
      }
      const dup = await pool.query('SELECT id FROM clientes WHERE numero_documento = $1 AND id <> $2', [docClean, id]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'El cliente ya se encuentra registrado' });
        return;
      }

      const updated = await pool.query(
        `UPDATE clientes
         SET tipo_documento = $1, numero_documento = $2, nombre_completo = $3,
             telefono = $4, correo = $5, direccion = $6
         WHERE id = $7
         RETURNING *`,
        [
          String(tipo_documento).trim(),
          docClean,
          String(nombre_completo).trim(),
          String(telefono).trim(),
          emailClean,
          String(direccion).trim(),
          id,
        ]
      );
      if (updated.rows.length === 0) {
        res.status(404).json({ error: 'Cliente no encontrado.' });
        return;
      }
      res.json({ cliente: updated.rows[0], message: 'Registro actualizado correctamente' });
    } catch (err) {
      console.error('Update cliente error:', err);
      res.status(500).json({ error: 'Error actualizando cliente.' });
    }
  });

  app.delete('/api/clientes/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de cliente inválido.' });
        return;
      }
      const salesRef = await pool.query('SELECT id FROM ventas WHERE cliente_id = $1 LIMIT 1', [id]);
      if (salesRef.rows.length > 0) {
        res.status(409).json({ error: 'No es posible eliminar un cliente con ventas registradas.' });
        return;
      }
      const del = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
      if (del.rows.length === 0) {
        res.status(404).json({ error: 'Cliente no encontrado.' });
        return;
      }
      res.json({ message: 'Cliente eliminado correctamente' });
    } catch (err) {
      console.error('Delete cliente error:', err);
      res.status(500).json({ error: 'Error eliminando cliente.' });
    }
  });

  app.get('/api/clientes/:id/historial', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de cliente inválido.' });
        return;
      }
      const clientRes = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
      if (clientRes.rows.length === 0) {
        res.status(404).json({ error: 'Cliente no encontrado.' });
        return;
      }
      const ventasRes = await pool.query(
        `SELECT id, consecutivo, numero_comprobante, fecha, total::float8, total_pagado::float8, saldo_pendiente::float8, estado_pago
         FROM ventas WHERE cliente_id = $1 ORDER BY fecha DESC`,
        [id]
      );
      res.json({ cliente: clientRes.rows[0], ventas: ventasRes.rows });
    } catch (err) {
      console.error('Cliente history error:', err);
      res.status(500).json({ error: 'Error consultando historial del cliente.' });
    }
  });

  // ==================== PRODUCTOS ====================
  app.get('/api/productos', requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const categoria = String(req.query.categoria || '').trim();
      const estado = String(req.query.estado || '').trim();

      const params: unknown[] = [];
      const conditions: string[] = [];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(nombre ILIKE $${params.length} OR codigo ILIKE $${params.length} OR descripcion ILIKE $${params.length})`);
      }
      if (categoria && categoria !== 'Todas') {
        params.push(categoria);
        conditions.push(`categoria = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT id, codigo, nombre, descripcion, categoria,
                precio_compra::float8, precio_venta::float8,
                cantidad_disponible, stock_minimo, fecha_creacion
         FROM productos ${where}
         ORDER BY id DESC`,
        params
      );

      let rows = result.rows.map((p) => ({
        ...p,
        estado: computeProductStatus(p.cantidad_disponible, p.stock_minimo),
      }));

      if (estado && estado !== 'Todos') {
        rows = rows.filter((r) => r.estado === estado);
      }

      const catRes = await pool.query('SELECT DISTINCT categoria FROM productos ORDER BY categoria ASC');
      res.json({
        productos: rows,
        categorias: catRes.rows.map((r) => r.categoria),
      });
    } catch (err) {
      console.error('Productos list error:', err);
      res.status(500).json({ error: 'Error consultando productos.' });
    }
  });

  app.post('/api/productos', requireAuth, async (req, res) => {
    try {
      const { codigo, nombre, descripcion, categoria, precio_compra, precio_venta, cantidad_disponible, stock_minimo } = req.body ?? {};
      if (!codigo || !nombre || !categoria || precio_compra === undefined || precio_venta === undefined) {
        res.status(400).json({ error: 'Los campos código, nombre, categoría y precios son obligatorios.' });
        return;
      }
      const pCompra = Number(precio_compra);
      const pVenta = Number(precio_venta);
      const qty = Number(cantidad_disponible ?? 0);
      const minStock = Number(stock_minimo ?? 5);

      if (pCompra < 0 || pVenta < 0 || qty < 0 || minStock < 0 || !Number.isInteger(qty) || !Number.isInteger(minStock)) {
        res.status(400).json({ error: 'Precios y cantidades deben ser valores numéricos válidos no negativos.' });
        return;
      }

      const dup = await pool.query('SELECT id FROM productos WHERE UPPER(codigo) = UPPER($1)', [String(codigo).trim()]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'Ya existe un producto con ese código.' });
        return;
      }

      const inserted = await pool.query(
        `INSERT INTO productos (codigo, nombre, descripcion, categoria, precio_compra, precio_venta, cantidad_disponible, stock_minimo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, codigo, nombre, descripcion, categoria, precio_compra::float8, precio_venta::float8, cantidad_disponible, stock_minimo, fecha_creacion`,
        [
          String(codigo).trim().toUpperCase(),
          String(nombre).trim(),
          String(descripcion ?? '').trim(),
          String(categoria).trim(),
          pCompra,
          pVenta,
          qty,
          minStock,
        ]
      );

      const prod = inserted.rows[0];
      const warning = qty <= minStock ? 'El producto tiene pocas existencias' : null;
      res.status(201).json({
        producto: { ...prod, estado: computeProductStatus(prod.cantidad_disponible, prod.stock_minimo) },
        message: 'Producto agregado correctamente',
        warning,
      });
    } catch (err) {
      console.error('Create producto error:', err);
      res.status(500).json({ error: 'Error registrando producto.' });
    }
  });

  app.put('/api/productos/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
      }
      const { codigo, nombre, descripcion, categoria, precio_compra, precio_venta, cantidad_disponible, stock_minimo } = req.body ?? {};
      if (!codigo || !nombre || !categoria || precio_compra === undefined || precio_venta === undefined) {
        res.status(400).json({ error: 'Faltan campos obligatorios del producto.' });
        return;
      }
      const pCompra = Number(precio_compra);
      const pVenta = Number(precio_venta);
      const qty = Number(cantidad_disponible ?? 0);
      const minStock = Number(stock_minimo ?? 5);

      if (pCompra < 0 || pVenta < 0 || qty < 0 || minStock < 0 || !Number.isInteger(qty) || !Number.isInteger(minStock)) {
        res.status(400).json({ error: 'Valores numéricos inválidos.' });
        return;
      }

      const dup = await pool.query('SELECT id FROM productos WHERE UPPER(codigo) = UPPER($1) AND id <> $2', [String(codigo).trim(), id]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'Otro producto ya utiliza ese código.' });
        return;
      }

      const updated = await pool.query(
        `UPDATE productos
         SET codigo = $1, nombre = $2, descripcion = $3, categoria = $4,
             precio_compra = $5, precio_venta = $6, cantidad_disponible = $7, stock_minimo = $8
         WHERE id = $9
         RETURNING id, codigo, nombre, descripcion, categoria, precio_compra::float8, precio_venta::float8, cantidad_disponible, stock_minimo, fecha_creacion`,
        [
          String(codigo).trim().toUpperCase(),
          String(nombre).trim(),
          String(descripcion ?? '').trim(),
          String(categoria).trim(),
          pCompra,
          pVenta,
          qty,
          minStock,
          id,
        ]
      );

      if (updated.rows.length === 0) {
        res.status(404).json({ error: 'Producto no encontrado.' });
        return;
      }
      const prod = updated.rows[0];
      const warning = qty <= minStock ? 'El producto tiene pocas existencias' : null;
      res.json({
        producto: { ...prod, estado: computeProductStatus(prod.cantidad_disponible, prod.stock_minimo) },
        message: 'Registro actualizado correctamente',
        warning,
      });
    } catch (err) {
      console.error('Update producto error:', err);
      res.status(500).json({ error: 'Error actualizando producto.' });
    }
  });

  app.delete('/api/productos/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de producto inválido.' });
        return;
      }
      const ref = await pool.query('SELECT id FROM detalle_ventas WHERE producto_id = $1 LIMIT 1', [id]);
      if (ref.rows.length > 0) {
        res.status(409).json({ error: 'No es posible eliminar un producto que ya posee ventas asociadas.' });
        return;
      }
      const del = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
      if (del.rows.length === 0) {
        res.status(404).json({ error: 'Producto no encontrado.' });
        return;
      }
      res.json({ message: 'Producto eliminado correctamente' });
    } catch (err) {
      console.error('Delete producto error:', err);
      res.status(500).json({ error: 'Error eliminando producto.' });
    }
  });

  // ==================== VENTAS (POS + HISTORIAL + PDF) ====================
  app.get('/api/ventas', requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const fechaInicio = String(req.query.fecha_inicio || '').trim();
      const fechaFin = String(req.query.fecha_fin || '').trim();
      const clienteId = String(req.query.cliente_id || '').trim();
      const estado = String(req.query.estado || '').trim();

      const params: unknown[] = [];
      const conditions: string[] = [];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(v.consecutivo ILIKE $${params.length} OR v.numero_comprobante ILIKE $${params.length} OR c.nombre_completo ILIKE $${params.length} OR c.numero_documento ILIKE $${params.length})`);
      }
      if (fechaInicio) {
        if (!DATE_REGEX.test(fechaInicio)) {
          res.status(400).json({ error: 'Formato de fecha inicial inválido.' });
          return;
        }
        params.push(fechaInicio);
        conditions.push(`DATE(v.fecha AT TIME ZONE 'America/Bogota') >= $${params.length}::date`);
      }
      if (fechaFin) {
        if (!DATE_REGEX.test(fechaFin)) {
          res.status(400).json({ error: 'Formato de fecha final inválido.' });
          return;
        }
        params.push(fechaFin);
        conditions.push(`DATE(v.fecha AT TIME ZONE 'America/Bogota') <= $${params.length}::date`);
      }
      if (clienteId && clienteId !== 'Todos') {
        const cid = parsePositiveInt(clienteId);
        if (!cid) {
          res.status(400).json({ error: 'Filtro de cliente inválido.' });
          return;
        }
        params.push(cid);
        conditions.push(`v.cliente_id = $${params.length}`);
      }
      if (estado && estado !== 'Todos') {
        params.push(estado);
        conditions.push(`v.estado_pago = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT v.id, v.consecutivo, v.numero_comprobante, v.cliente_id, v.fecha,
                v.subtotal::float8, v.descuento_porcentaje::float8, v.descuento_monto::float8,
                v.impuesto_porcentaje::float8, v.impuestos::float8, v.total::float8,
                v.total_pagado::float8, v.saldo_pendiente::float8, v.estado_pago, v.observaciones,
                c.nombre_completo AS cliente_nombre, c.tipo_documento AS cliente_tipo_doc,
                c.numero_documento AS cliente_documento
         FROM ventas v
         JOIN clientes c ON c.id = v.cliente_id
         ${where}
         ORDER BY v.fecha DESC, v.id DESC`,
        params
      );

      res.json({ ventas: result.rows });
    } catch (err) {
      console.error('Ventas list error:', err);
      res.status(500).json({ error: 'Error consultando ventas.' });
    }
  });

  app.get('/api/ventas/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de venta inválido.' });
        return;
      }
      const ventaRes = await pool.query(
        `SELECT v.id, v.consecutivo, v.numero_comprobante, v.cliente_id, v.fecha,
                v.subtotal::float8, v.descuento_porcentaje::float8, v.descuento_monto::float8,
                v.impuesto_porcentaje::float8, v.impuestos::float8, v.total::float8,
                v.total_pagado::float8, v.saldo_pendiente::float8, v.estado_pago, v.observaciones,
                c.tipo_documento, c.numero_documento, c.nombre_completo, c.telefono, c.correo, c.direccion,
                u.nombre AS vendedor_nombre
         FROM ventas v
         JOIN clientes c ON c.id = v.cliente_id
         LEFT JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.id = $1`,
        [id]
      );
      if (ventaRes.rows.length === 0) {
        res.status(404).json({ error: 'Venta no encontrada.' });
        return;
      }

      const [detallesRes, pagosRes] = await Promise.all([
        pool.query(
          `SELECT dv.id, dv.producto_id, dv.cantidad, dv.precio_unitario::float8, dv.subtotal::float8,
                  p.codigo, p.nombre AS producto_nombre
           FROM detalle_ventas dv
           JOIN productos p ON p.id = dv.producto_id
           WHERE dv.venta_id = $1
           ORDER BY dv.id ASC`,
          [id]
        ),
        pool.query(
          `SELECT id, numero_pago, fecha, monto_pagado::float8, metodo_pago, referencia
           FROM pagos
           WHERE venta_id = $1
           ORDER BY fecha ASC, id ASC`,
          [id]
        ),
      ]);

      res.json({
        venta: ventaRes.rows[0],
        detalles: detallesRes.rows,
        pagos: pagosRes.rows,
      });
    } catch (err) {
      console.error('Venta detail error:', err);
      res.status(500).json({ error: 'Error consultando detalle de venta.' });
    }
  });

  app.post('/api/ventas', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const {
        cliente_id,
        items,
        descuento_porcentaje = 0,
        aplicar_impuesto = true,
        impuesto_porcentaje,
        pago_inicial = 0,
        metodo_pago = 'Efectivo',
        referencia = '',
        observaciones = '',
      } = req.body ?? {};

      const clientIdNum = parsePositiveInt(cliente_id);
      if (!clientIdNum || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'No se pudo registrar la venta. Selecciona un cliente y al menos un producto.' });
        return;
      }

      const descPct = Number(descuento_porcentaje);
      if (!Number.isFinite(descPct) || descPct < 0 || descPct > 100) {
        res.status(400).json({ error: 'El porcentaje de descuento es inválido.' });
        return;
      }

      const pagoInicialNum = Number(pago_inicial || 0);
      if (!Number.isFinite(pagoInicialNum) || pagoInicialNum < 0) {
        res.status(400).json({ error: 'El monto de pago inicial es inválido.' });
        return;
      }

      const cleanMetodo = String(metodo_pago || 'Efectivo');
      if (pagoInicialNum > 0 && !ALLOWED_PAYMENT_METHODS.has(cleanMetodo)) {
        res.status(400).json({ error: 'Método de pago inválido.' });
        return;
      }

      const outcome = await withTransaction(async (client) => {
        // 1. Validar cliente
        const cliRes = await client.query('SELECT id, nombre_completo FROM clientes WHERE id = $1', [clientIdNum]);
        if (cliRes.rows.length === 0) {
          throw new Error('CLIENT_NOT_FOUND');
        }

        // Configuracion comercial (consecutivo, impuesto, descuento maximo)
        const cfgRes = await client.query('SELECT * FROM configuracion ORDER BY id ASC LIMIT 1 FOR UPDATE');
        const cfg = cfgRes.rows[0];
        const maxDesc = Number(cfg.descuento_maximo ?? 100);
        if (descPct > maxDesc) {
          throw new Error(`MAX_DISCOUNT:${maxDesc}`);
        }

        const taxPct = aplicar_impuesto
          ? Number(impuesto_porcentaje !== undefined ? impuesto_porcentaje : cfg.porcentaje_impuesto)
          : 0;
        if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
          throw new Error('INVALID_TAX');
        }

        // Consolidate duplicate product IDs in cart
        const qtyMap = new Map<number, number>();
        for (const raw of items) {
          const pid = Number(raw.producto_id);
          const qty = Number(raw.cantidad);
          if (!Number.isInteger(pid) || !Number.isInteger(qty) || qty <= 0) {
            throw new Error('INVALID_ITEM');
          }
          qtyMap.set(pid, (qtyMap.get(pid) || 0) + qty);
        }

        // 2. Verificar existencias & calcular subtotal server-side con precisión en centavos
        let subtotalCents = 0;
        const resolvedItems: Array<{ productoId: number; nombre: string; cantidad: number; precioUnitarioCents: number; subtotalCents: number; newStock: number; stockMinimo: number }> = [];

        for (const [productoId, cantidad] of qtyMap.entries()) {
          const prodRes = await client.query(
            'SELECT id, nombre, precio_venta, cantidad_disponible, stock_minimo FROM productos WHERE id = $1 FOR UPDATE',
            [productoId]
          );
          if (prodRes.rows.length === 0) {
            throw new Error('PRODUCT_NOT_FOUND');
          }
          const prod = prodRes.rows[0];
          if (prod.cantidad_disponible < cantidad) {
            throw new Error(`INSUFFICIENT_STOCK:${prod.nombre}`);
          }
          const unitCents = toCents(prod.precio_venta);
          const lineCents = unitCents * cantidad;
          subtotalCents += lineCents;
          resolvedItems.push({
            productoId,
            nombre: prod.nombre,
            cantidad,
            precioUnitarioCents: unitCents,
            subtotalCents: lineCents,
            newStock: prod.cantidad_disponible - cantidad,
            stockMinimo: prod.stock_minimo,
          });
        }

        // 3. Calcular descuento, impuestos y total
        const descCents = calcPercentageCents(subtotalCents, descPct);
        const taxableCents = Math.max(0, subtotalCents - descCents);
        const taxCents = calcPercentageCents(taxableCents, taxPct);
        const totalCents = taxableCents + taxCents;

        const pagoCents = toCents(pagoInicialNum);
        if (pagoCents > totalCents) {
          throw new Error('PAYMENT_EXCEEDS');
        }

        const saldoCents = totalCents - pagoCents;
        const estadoPago = saldoCents === 0 ? 'Pagado' : pagoCents > 0 ? 'Parcial' : 'Pendiente';

        // 4. Generar consecutivo
        const nextSeq = Number(cfg.consecutivo_actual) + 1;
        await client.query('UPDATE configuracion SET consecutivo_actual = $1 WHERE id = $2', [nextSeq, cfg.id]);
        const pref = cfg.prefijo_consecutivo || 'VS';
        const consecutivo = `${pref}-${String(nextSeq).padStart(6, '0')}`;
        const comprobante = `COMP-${String(nextSeq).padStart(6, '0')}`;

        // 5. Registrar venta
        const saleRes = await client.query(
          `INSERT INTO ventas (
            consecutivo, numero_comprobante, cliente_id, usuario_id,
            subtotal, descuento_porcentaje, descuento_monto,
            impuesto_porcentaje, impuestos, total,
            total_pagado, saldo_pendiente, estado_pago, observaciones
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING id, consecutivo, numero_comprobante, total::float8, total_pagado::float8, saldo_pendiente::float8, estado_pago`,
          [
            consecutivo,
            comprobante,
            Number(cliente_id),
            req.user!.id,
            fromCents(subtotalCents),
            descPct,
            fromCents(descCents),
            taxPct,
            fromCents(taxCents),
            fromCents(totalCents),
            fromCents(pagoCents),
            fromCents(saldoCents),
            estadoPago,
            String(observaciones || '').trim(),
          ]
        );
        const venta = saleRes.rows[0];

        // 6 & 7. Registrar detalle e inventario
        const lowStockWarnings: string[] = [];
        for (const item of resolvedItems) {
          await client.query(
            `INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
             VALUES ($1,$2,$3,$4,$5)`,
            [venta.id, item.productoId, item.cantidad, fromCents(item.precioUnitarioCents), fromCents(item.subtotalCents)]
          );
          await client.query(
            'UPDATE productos SET cantidad_disponible = $1 WHERE id = $2',
            [item.newStock, item.productoId]
          );
          if (item.newStock <= item.stockMinimo) {
            lowStockWarnings.push(item.nombre);
          }
        }

        // 8. Registrar pago inicial si existe
        if (pagoCents > 0) {
          const seqRes = await client.query(`SELECT nextval(pg_get_serial_sequence('pagos', 'id'))::int AS next_id`);
          const nextPayId = seqRes.rows[0].next_id;
          const numeroPago = `PAG-${String(nextPayId).padStart(6, '0')}`;
          await client.query(
            `INSERT INTO pagos (id, numero_pago, venta_id, usuario_id, monto_pagado, metodo_pago, referencia)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [nextPayId, numeroPago, venta.id, req.user!.id, fromCents(pagoCents), cleanMetodo, String(referencia || '').trim()]
          );
        }

        const warnings: string[] = [];
        if (lowStockWarnings.length > 0) {
          warnings.push(`El producto tiene pocas existencias (${lowStockWarnings.join(', ')})`);
        }
        if (saldoCents > 0) {
          warnings.push('La venta tiene un saldo pendiente');
        }

        return { venta, warnings };
      });

      res.status(201).json({
        venta: outcome.venta,
        message: 'Venta registrada exitosamente',
        warnings: outcome.warnings,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('INSUFFICIENT_STOCK:')) {
        const prodName = msg.split(':')[1];
        res.status(409).json({ error: `No hay existencias suficientes para ${prodName}` });
        return;
      }
      if (msg === 'PAYMENT_EXCEEDS') {
        res.status(400).json({ error: 'El pago supera el saldo pendiente' });
        return;
      }
      if (msg.startsWith('MAX_DISCOUNT:')) {
        res.status(400).json({ error: `El descuento máximo configurado es ${msg.split(':')[1]}%.` });
        return;
      }
      if (msg === 'CLIENT_NOT_FOUND' || msg === 'PRODUCT_NOT_FOUND' || msg === 'INVALID_ITEM' || msg === 'INVALID_TAX') {
        res.status(400).json({ error: 'No se pudo registrar la venta. Verifica los datos ingresados.' });
        return;
      }
      console.error('Create sale error:', err);
      res.status(500).json({ error: 'No se pudo registrar la venta' });
    }
  });

  app.get('/api/ventas/:id/pdf', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveInt(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'ID de comprobante inválido.' });
        return;
      }
      const ventaRes = await pool.query(
        `SELECT v.id, v.consecutivo, v.numero_comprobante, v.fecha,
                v.subtotal::float8, v.descuento_porcentaje::float8, v.descuento_monto::float8,
                v.impuesto_porcentaje::float8, v.impuestos::float8, v.total::float8,
                v.total_pagado::float8, v.saldo_pendiente::float8, v.estado_pago, v.observaciones,
                c.tipo_documento, c.numero_documento, c.nombre_completo, c.telefono, c.correo, c.direccion
         FROM ventas v
         JOIN clientes c ON c.id = v.cliente_id
         WHERE v.id = $1`,
        [id]
      );
      if (ventaRes.rows.length === 0) {
        res.status(404).json({ error: 'Comprobante no encontrado.' });
        return;
      }
      const row = ventaRes.rows[0];
      const [detRes, pagRes, cfgRes] = await Promise.all([
        pool.query(
          `SELECT p.codigo, p.nombre AS producto_nombre, dv.cantidad, dv.precio_unitario::float8, dv.subtotal::float8
           FROM detalle_ventas dv
           JOIN productos p ON p.id = dv.producto_id
           WHERE dv.venta_id = $1 ORDER BY dv.id ASC`,
          [id]
        ),
        pool.query(
          `SELECT numero_pago, fecha, monto_pagado::float8, metodo_pago, referencia
           FROM pagos WHERE venta_id = $1 ORDER BY fecha ASC`,
          [id]
        ),
        pool.query('SELECT nombre_comercial, nit, direccion, telefono, correo FROM configuracion ORDER BY id ASC LIMIT 1'),
      ]);

      const buffer = await buildInvoicePdfBuffer({
        venta: row,
        cliente: {
          tipo_documento: row.tipo_documento,
          numero_documento: row.numero_documento,
          nombre_completo: row.nombre_completo,
          telefono: row.telefono,
          correo: row.correo,
          direccion: row.direccion,
        },
        empresa: cfgRes.rows[0],
        detalles: detRes.rows,
        pagos: pagRes.rows,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${row.numero_comprobante}.pdf"`);
      res.send(buffer);
    } catch (err) {
      console.error('PDF error:', err);
      res.status(500).json({ error: 'Error generando el comprobante PDF.' });
    }
  });

  // ==================== PAGOS ====================
  app.get('/api/pagos', requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const metodo = String(req.query.metodo || '').trim();
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (q) {
        params.push(`%${q}%`);
        conditions.push(`(p.numero_pago ILIKE $${params.length} OR v.consecutivo ILIKE $${params.length} OR c.nombre_completo ILIKE $${params.length} OR p.referencia ILIKE $${params.length})`);
      }
      if (metodo && metodo !== 'Todos') {
        params.push(metodo);
        conditions.push(`p.metodo_pago = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const [pagosRes, pendientesRes] = await Promise.all([
        pool.query(
          `SELECT p.id, p.numero_pago, p.venta_id, p.fecha, p.monto_pagado::float8, p.metodo_pago, p.referencia,
                  v.consecutivo, v.numero_comprobante, v.total::float8 AS venta_total, v.saldo_pendiente::float8 AS venta_saldo,
                  v.estado_pago, c.nombre_completo AS cliente_nombre, c.numero_documento AS cliente_documento
           FROM pagos p
           JOIN ventas v ON v.id = p.venta_id
           JOIN clientes c ON c.id = v.cliente_id
           ${where}
           ORDER BY p.fecha DESC, p.id DESC`,
          params
        ),
        pool.query(
          `SELECT v.id, v.consecutivo, v.numero_comprobante, v.fecha, v.total::float8, v.total_pagado::float8, v.saldo_pendiente::float8, v.estado_pago,
                  c.nombre_completo AS cliente_nombre, c.numero_documento AS cliente_documento
           FROM ventas v
           JOIN clientes c ON c.id = v.cliente_id
           WHERE v.saldo_pendiente > 0
           ORDER BY v.fecha DESC`
        ),
      ]);

      res.json({ pagos: pagosRes.rows, ventas_pendientes: pendientesRes.rows });
    } catch (err) {
      console.error('Pagos list error:', err);
      res.status(500).json({ error: 'Error consultando pagos.' });
    }
  });

  app.post('/api/pagos', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { venta_id, monto_pagado, metodo_pago, referencia = '' } = req.body ?? {};
      const ventaIdNum = parsePositiveInt(venta_id);
      const monto = Number(monto_pagado);
      const cleanMetodo = String(metodo_pago || '');
      if (!ventaIdNum || !Number.isFinite(monto) || monto <= 0 || !ALLOWED_PAYMENT_METHODS.has(cleanMetodo)) {
        res.status(400).json({ error: 'Selecciona una venta, un método de pago válido y un monto mayor a 0.' });
        return;
      }

      const result = await withTransaction(async (client) => {
        const saleRes = await client.query(
          'SELECT id, total, total_pagado, saldo_pendiente FROM ventas WHERE id = $1 FOR UPDATE',
          [ventaIdNum]
        );
        if (saleRes.rows.length === 0) {
          throw new Error('SALE_NOT_FOUND');
        }
        const sale = saleRes.rows[0];
        const montoCents = toCents(monto);
        const saldoCents = toCents(sale.saldo_pendiente);
        const totalPagadoCents = toCents(sale.total_pagado);

        if (montoCents > saldoCents) {
          throw new Error('PAYMENT_EXCEEDS');
        }

        const newPagadoCents = totalPagadoCents + montoCents;
        const newSaldoCents = saldoCents - montoCents;
        const newEstado = newSaldoCents === 0 ? 'Pagado' : 'Parcial';

        const seqRes = await client.query(`SELECT nextval(pg_get_serial_sequence('pagos', 'id'))::int AS next_id`);
        const nextPayId = seqRes.rows[0].next_id;
        const numeroPago = `PAG-${String(nextPayId).padStart(6, '0')}`;

        const payInsert = await client.query(
          `INSERT INTO pagos (id, numero_pago, venta_id, usuario_id, monto_pagado, metodo_pago, referencia)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, numero_pago, venta_id, fecha, monto_pagado::float8, metodo_pago, referencia`,
          [nextPayId, numeroPago, ventaIdNum, req.user!.id, fromCents(montoCents), cleanMetodo, String(referencia || '').trim()]
        );

        await client.query(
          `UPDATE ventas SET total_pagado = $1, saldo_pendiente = $2, estado_pago = $3 WHERE id = $4`,
          [fromCents(newPagadoCents), fromCents(newSaldoCents), newEstado, ventaIdNum]
        );

        return {
          pago: payInsert.rows[0],
          warning: newSaldoCents > 0 ? 'La venta tiene un saldo pendiente' : null,
        };
      });

      res.status(201).json({
        pago: result.pago,
        message: 'Pago registrado',
        warning: result.warning,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'PAYMENT_EXCEEDS') {
        res.status(400).json({ error: 'El pago supera el saldo pendiente' });
        return;
      }
      if (msg === 'SALE_NOT_FOUND') {
        res.status(404).json({ error: 'Venta asociada no encontrada.' });
        return;
      }
      console.error('Create pago error:', err);
      res.status(500).json({ error: 'Error registrando pago.' });
    }
  });

  // ==================== REPORTES ====================
  app.get('/api/reportes', requireAuth, async (req, res) => {
    try {
      const fechaInicio = String(req.query.fecha_inicio || '').trim();
      const fechaFin = String(req.query.fecha_fin || '').trim();
      if ((fechaInicio && !DATE_REGEX.test(fechaInicio)) || (fechaFin && !DATE_REGEX.test(fechaFin))) {
        res.status(400).json({ error: 'Formato de fecha inválido. Usa AAAA-MM-DD.' });
        return;
      }

      const params: unknown[] = [];
      const conditions: string[] = [];
      if (fechaInicio) {
        params.push(fechaInicio);
        conditions.push(`DATE(v.fecha AT TIME ZONE 'America/Bogota') >= $${params.length}::date`);
      }
      if (fechaFin) {
        params.push(fechaFin);
        conditions.push(`DATE(v.fecha AT TIME ZONE 'America/Bogota') <= $${params.length}::date`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const payParams: unknown[] = [];
      const payConditions: string[] = [];
      if (fechaInicio) {
        payParams.push(fechaInicio);
        payConditions.push(`DATE(p.fecha AT TIME ZONE 'America/Bogota') >= $${payParams.length}::date`);
      }
      if (fechaFin) {
        payParams.push(fechaFin);
        payConditions.push(`DATE(p.fecha AT TIME ZONE 'America/Bogota') <= $${payParams.length}::date`);
      }
      const payWhere = payConditions.length ? `WHERE ${payConditions.join(' AND ')}` : '';

      const [resumenRes, diariasRes, semanalesRes, mensualesRes, topProdRes, topCliRes, metodosRes, detalleRes] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS total_operaciones,
                  COALESCE(SUM(v.total), 0)::float8 AS ingresos_totales,
                  COALESCE(SUM(v.total_pagado), 0)::float8 AS total_recaudado,
                  COALESCE(SUM(v.saldo_pendiente), 0)::float8 AS cartera_pendiente
           FROM ventas v ${where}`,
          params
        ),
        pool.query(
          `SELECT TO_CHAR(DATE(v.fecha AT TIME ZONE 'America/Bogota'), 'YYYY-MM-DD') AS periodo,
                  COUNT(*)::int AS operaciones,
                  COALESCE(SUM(v.total), 0)::float8 AS ingresos
           FROM ventas v ${where}
           GROUP BY 1 ORDER BY 1 DESC LIMIT 15`,
          params
        ),
        pool.query(
          `SELECT TO_CHAR(DATE_TRUNC('week', v.fecha AT TIME ZONE 'America/Bogota'), 'YYYY-MM-DD') AS semana,
                  COUNT(*)::int AS operaciones,
                  COALESCE(SUM(v.total), 0)::float8 AS ingresos
           FROM ventas v ${where}
           GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
          params
        ),
        pool.query(
          `SELECT TO_CHAR(DATE_TRUNC('month', v.fecha AT TIME ZONE 'America/Bogota'), 'YYYY-MM') AS mes,
                  COUNT(*)::int AS operaciones,
                  COALESCE(SUM(v.total), 0)::float8 AS ingresos
           FROM ventas v ${where}
           GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
          params
        ),
        pool.query(
          `SELECT pr.codigo, pr.nombre, pr.categoria,
                  SUM(dv.cantidad)::int AS unidades,
                  COALESCE(SUM(dv.subtotal), 0)::float8 AS ingresos
           FROM detalle_ventas dv
           JOIN ventas v ON v.id = dv.venta_id
           JOIN productos pr ON pr.id = dv.producto_id
           ${where}
           GROUP BY pr.id, pr.codigo, pr.nombre, pr.categoria
           ORDER BY unidades DESC, ingresos DESC LIMIT 10`,
          params
        ),
        pool.query(
          `SELECT c.tipo_documento, c.numero_documento, c.nombre_completo,
                  COUNT(v.id)::int AS compras,
                  COALESCE(SUM(v.total), 0)::float8 AS monto_total
           FROM ventas v
           JOIN clientes c ON c.id = v.cliente_id
           ${where}
           GROUP BY c.id, c.tipo_documento, c.numero_documento, c.nombre_completo
           ORDER BY monto_total DESC LIMIT 10`,
          params
        ),
        pool.query(
          `SELECT p.metodo_pago, COUNT(*)::int AS operaciones, COALESCE(SUM(p.monto_pagado), 0)::float8 AS total
           FROM pagos p ${payWhere}
           GROUP BY p.metodo_pago ORDER BY total DESC`,
          payParams
        ),
        pool.query(
          `SELECT v.consecutivo, v.numero_comprobante, v.fecha, c.nombre_completo AS cliente,
                  v.subtotal::float8, v.descuento_monto::float8, v.impuestos::float8, v.total::float8,
                  v.total_pagado::float8, v.saldo_pendiente::float8, v.estado_pago
           FROM ventas v
           JOIN clientes c ON c.id = v.cliente_id
           ${where}
           ORDER BY v.fecha DESC`,
          params
        ),
      ]);

      res.json({
        resumen: resumenRes.rows[0],
        ventas_diarias: diariasRes.rows.reverse(),
        ventas_semanales: semanalesRes.rows.reverse(),
        ventas_mensuales: mensualesRes.rows.reverse(),
        productos_mas_vendidos: topProdRes.rows,
        clientes_frecuentes: topCliRes.rows,
        metodos_pago: metodosRes.rows,
        operaciones: detalleRes.rows,
      });
    } catch (err) {
      console.error('Reportes error:', err);
      res.status(500).json({ error: 'Error generando reportes.' });
    }
  });

  app.get('/api/reportes/csv', requireAuth, async (req, res) => {
    try {
      const fechaInicio = String(req.query.fecha_inicio || '').trim();
      const fechaFin = String(req.query.fecha_fin || '').trim();
      if ((fechaInicio && !DATE_REGEX.test(fechaInicio)) || (fechaFin && !DATE_REGEX.test(fechaFin))) {
        res.status(400).json({ error: 'Formato de fecha inválido. Usa AAAA-MM-DD.' });
        return;
      }
      const params: unknown[] = [];
      const conditions: string[] = [];
      if (fechaInicio) {
        params.push(fechaInicio);
        conditions.push(`DATE(v.fecha AT TIME ZONE 'America/Bogota') >= $${params.length}::date`);
      }
      if (fechaFin) {
        params.push(fechaFin);
        conditions.push(`DATE(v.fecha AT TIME ZONE 'America/Bogota') <= $${params.length}::date`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT v.consecutivo, v.numero_comprobante, v.fecha, c.nombre_completo, c.numero_documento,
                v.subtotal::float8, v.descuento_monto::float8, v.impuestos::float8, v.total::float8,
                v.total_pagado::float8, v.saldo_pendiente::float8, v.estado_pago
         FROM ventas v
         JOIN clientes c ON c.id = v.cliente_id
         ${where}
         ORDER BY v.fecha DESC`,
        params
      );

      const header = 'Consecutivo,Comprobante,Fecha,Cliente,Documento,Subtotal,Descuento,Impuestos,Total,Pagado,SaldoPendiente,Estado\n';
      const lines = result.rows.map((r) => {
        const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        return [
          esc(r.consecutivo),
          esc(r.numero_comprobante),
          esc(new Date(r.fecha).toISOString()),
          esc(r.nombre_completo),
          esc(r.numero_documento),
          r.subtotal,
          r.descuento_monto,
          r.impuestos,
          r.total,
          r.total_pagado,
          r.saldo_pendiente,
          esc(r.estado_pago),
        ].join(',');
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="reporte_ventasmart.csv"');
      res.send('\uFEFF' + header + lines.join('\n'));
    } catch (err) {
      console.error('CSV export error:', err);
      res.status(500).json({ error: 'Error exportando reporte CSV.' });
    }
  });

  // ==================== CONFIGURACIÓN ====================
  app.get('/api/configuracion', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const [cfgRes, userRes] = await Promise.all([
        pool.query(`
          SELECT id, nombre_comercial, nit, direccion, telefono, correo,
                 porcentaje_impuesto::float8, descuento_maximo::float8,
                 prefijo_consecutivo, consecutivo_actual, fecha_actualizacion
          FROM configuracion ORDER BY id ASC LIMIT 1
        `),
        pool.query('SELECT id, nombre, correo, rol FROM usuarios WHERE id = $1', [req.user!.id]),
      ]);
      res.json({
        configuracion: cfgRes.rows[0],
        usuario: userRes.rows[0],
      });
    } catch (err) {
      console.error('Get config error:', err);
      res.status(500).json({ error: 'Error consultando configuración.' });
    }
  });

  app.put('/api/configuracion', requireAuth, async (req, res) => {
    try {
      const {
        nombre_comercial,
        nit,
        direccion,
        telefono,
        correo,
        porcentaje_impuesto,
        descuento_maximo,
        prefijo_consecutivo,
        consecutivo_actual,
      } = req.body ?? {};

      if (!nombre_comercial || !nit || !direccion || !telefono || !correo) {
        res.status(400).json({ error: 'Los datos del negocio son obligatorios.' });
        return;
      }

      const tax = Number(porcentaje_impuesto);
      const maxDesc = Number(descuento_maximo);
      const cons = Number(consecutivo_actual);
      if (tax < 0 || tax > 100 || maxDesc < 0 || maxDesc > 100 || !Number.isInteger(cons) || cons < 0) {
        res.status(400).json({ error: 'Valores comerciales inválidos.' });
        return;
      }

      const updated = await pool.query(
        `UPDATE configuracion
         SET nombre_comercial = $1, nit = $2, direccion = $3, telefono = $4, correo = $5,
             porcentaje_impuesto = $6, descuento_maximo = $7, prefijo_consecutivo = $8,
             consecutivo_actual = $9, fecha_actualizacion = NOW()
         WHERE id = (SELECT id FROM configuracion ORDER BY id ASC LIMIT 1)
         RETURNING id, nombre_comercial, nit, direccion, telefono, correo,
                   porcentaje_impuesto::float8, descuento_maximo::float8,
                   prefijo_consecutivo, consecutivo_actual, fecha_actualizacion`,
        [
          String(nombre_comercial).trim(),
          String(nit).trim(),
          String(direccion).trim(),
          String(telefono).trim(),
          String(correo).trim(),
          tax,
          maxDesc,
          String(prefijo_consecutivo || 'VS').trim().toUpperCase(),
          cons,
        ]
      );

      res.json({
        configuracion: updated.rows[0],
        message: 'Registro actualizado correctamente',
      });
    } catch (err) {
      console.error('Update config error:', err);
      res.status(500).json({ error: 'Error actualizando configuración.' });
    }
  });

  app.put('/api/configuracion/perfil', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { nombre, correo, password_actual, password_nueva } = req.body ?? {};
      if (!nombre || !correo) {
        res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
        return;
      }
      const cleanEmail = String(correo).trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        res.status(400).json({ error: 'El correo electrónico no es válido.' });
        return;
      }

      const dup = await pool.query('SELECT id FROM usuarios WHERE LOWER(correo) = $1 AND id <> $2', [cleanEmail, req.user!.id]);
      if (dup.rows.length > 0) {
        res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario.' });
        return;
      }

      if (password_nueva) {
        if (String(password_nueva).length < 6) {
          res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
          return;
        }
        const curRes = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [req.user!.id]);
        const valid = await bcrypt.compare(String(password_actual || ''), curRes.rows[0].password_hash);
        if (!valid) {
          res.status(400).json({ error: 'La contraseña actual no coincide.' });
          return;
        }
        const newHash = await bcrypt.hash(String(password_nueva), 10);
        await pool.query(
          'UPDATE usuarios SET nombre = $1, correo = $2, password_hash = $3 WHERE id = $4',
          [String(nombre).trim(), cleanEmail, newHash, req.user!.id]
        );
      } else {
        await pool.query(
          'UPDATE usuarios SET nombre = $1, correo = $2 WHERE id = $3',
          [String(nombre).trim(), cleanEmail, req.user!.id]
        );
      }

      const userRes = await pool.query('SELECT id, nombre, correo, rol FROM usuarios WHERE id = $1', [req.user!.id]);
      const updatedUser = userRes.rows[0];
      const token = signSessionToken(updatedUser);
      res.cookie(SESSION_COOKIE, token, getSessionCookieOptions(req));

      res.json({
        usuario: updatedUser,
        sessionToken: token,
        message: 'Registro actualizado correctamente',
      });
    } catch (err) {
      console.error('Update perfil error:', err);
      res.status(500).json({ error: 'Error actualizando perfil.' });
    }
  });

  // Vite middleware in dev / static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VentaSmart running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
