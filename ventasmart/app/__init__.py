from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_migrate import Migrate

from config import Config

db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()
migrate = Migrate()

login_manager.login_view = "auth.login"
login_manager.login_message = "Inicia sesión para acceder a este módulo."
login_manager.login_message_category = "warning"


def format_cop(valor) -> str:
    """Formatea valores numéricos en Pesos Colombianos: $150.000"""
    try:
        num = int(round(float(valor or 0)))
    except (TypeError, ValueError):
        num = 0
    abs_str = f"{abs(num):,}".replace(",", ".")
    return f"-${abs_str}" if num < 0 else f"${abs_str}"


def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    migrate.init_app(app, db)

    app.jinja_env.filters["cop"] = format_cop

    from app.models import Usuario, Configuracion

    @login_manager.user_loader
    def load_user(user_id: str):
        return db.session.get(Usuario, int(user_id))

    @app.context_processor
    def inject_empresa():
        cfg = None
        try:
            cfg = Configuracion.query.first()
        except Exception:
            cfg = None
        return {"empresa_cfg": cfg}

    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.clientes import clientes_bp
    from app.routes.productos import productos_bp
    from app.routes.ventas import ventas_bp
    from app.routes.pagos import pagos_bp
    from app.routes.facturas import facturas_bp
    from app.routes.reportes import reportes_bp
    from app.routes.configuracion import configuracion_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(clientes_bp)
    app.register_blueprint(productos_bp)
    app.register_blueprint(ventas_bp)
    app.register_blueprint(pagos_bp)
    app.register_blueprint(facturas_bp)
    app.register_blueprint(reportes_bp)
    app.register_blueprint(configuracion_bp)

    return app
