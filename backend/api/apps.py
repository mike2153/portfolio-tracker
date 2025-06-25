from django.apps import AppConfig


class ApiConfig(AppConfig):
    """Connect the legacy 'api' app name to the real backend.api package."""

    default_auto_field = 'django.db.models.BigAutoField'
    # Register under its full Python path so Django matches models correctly
    name = 'api'
    label = 'api'
