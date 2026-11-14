# VentaSmart — Sistema de Facturación y Gestión de Ventas (Python Flask + Neon PostgreSQL)

Sistema administrativo completo para la gestión de clientes, inventario de productos, punto de venta (POS) transaccional, registro de pagos multi-abono, comprobantes internos PDF con ReportLab y reportes comerciales dinámicos en pesos colombianos (COP).

## Estructura del Proyecto

```
ventasmart/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── usuario.py
│   │   ├── cliente.py
│   │   ├── producto.py
│   │   ├── venta.py
│   │   ├── detalle_venta.py
│   │   ├── pago.py
│   │   └── configuracion.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── dashboard.py
│   │   ├── clientes.py
│   │   ├── productos.py
│   │   ├── ventas.py
│   │   ├── pagos.py
│   │   ├── facturas.py
│   │   ├── reportes.py
│   │   └── configuracion.py
│   ├── services/
│   │   ├── ventas_service.py
│   │   └── pdf_service.py
│   ├── templates/
│   └── static/
├── migrations/
├── tests/
├── config.py
├── run.py
├── requirements.txt
└── .env.example
```

## Instalación y Ejecución Local

1. **Crear entorno virtual e instalar dependencias:**
   ```bash
   cd ventasmart
   python -m venv venv
   source venv/bin/activate   # En Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configurar Neon PostgreSQL en `.env`:**
   ```bash
   cp .env.example .env
   # Edita .env y asigna tu cadena de conexión de Neon en DATABASE_URL y SECRET_KEY
   ```

3. **Aplicar migraciones a Neon:**
   ```bash
   flask db upgrade
   ```

4. **Ejecutar la aplicación Flask:**
   ```bash
   python run.py
   ```
   Abre `http://127.0.0.1:5000` en tu navegador.

5. **Ejecutar pruebas automatizadas:**
   ```bash
   pytest -v
   ```
