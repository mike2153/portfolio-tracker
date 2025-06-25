import os
import django
from django.apps import apps


def pytest_configure():
    """Ensure Django is configured before tests are collected."""
    # Set up path for Django imports
    import sys
    from pathlib import Path
    backend_path = Path(__file__).parent / "backend"
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))
    
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    if not apps.ready:
        django.setup() 