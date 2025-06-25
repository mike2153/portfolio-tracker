from pathlib import Path
from django.apps import AppConfig
import importlib
import sys


class ApiConfig(AppConfig):
    """Connect the legacy 'api' app name to the real backend.api package."""

    default_auto_field = 'django.db.models.BigAutoField'
    # Register under its full Python path so Django matches models correctly
    name = 'backend.api'
    label = 'api'
    path = str(Path(__file__).parent)  # Ensure Django can locate migrations/templates

    def ready(self):
        """Expose backend.api submodules under the legacy 'api.' namespace."""
        backend_base = 'backend.api'
        for sub in (
            'models',
            'middleware',
            'alpha_vantage_service',
            'services',
        ):
            try:
                mod = importlib.import_module(f'{backend_base}.{sub}')
                sys.modules.setdefault(f'api.{sub}', mod)
            except ModuleNotFoundError:
                # Optional module may not exist; skip
                continue
