"""Compatibility shim so legacy imports like `import api.models` continue to work.

It simply re-exports the package located at `backend.api`.
"""
import importlib
import sys

_backend_api = importlib.import_module('backend.api')
# Expose all attributes of backend.api at this namespace
for _name in dir(_backend_api):
    if not _name.startswith('__'):
        globals()[_name] = getattr(_backend_api, _name)

# Ensure `sys.modules['api']` refers to this shim so `import api` works
sys.modules.setdefault('api', _backend_api)

# Make this module appear as a package whose search path is that of backend.api
__path__ = _backend_api.__path__  # type: ignore
__spec__.submodule_search_locations = __path__  # type: ignore

# Pre-register middleware submodule so Django can import 'api.middleware.*'
import importlib as _importlib
try:
    _mw_mod = _importlib.import_module('backend.api.middleware')
    sys.modules.setdefault('api.middleware', _mw_mod)
except ModuleNotFoundError:
    pass

# We intentionally avoid importing backend.api submodules here to prevent
# triggering Django model import before the app registry is ready.  Any code
# that needs, e.g., `import api.models` will automatically cause Python to
# look up that submodule; our `__getattr__` below proxies it lazily.

def __getattr__(name):
    """Dynamically proxy attribute access to backend.api submodules."""
    module_name = f'backend.api.{name}'
    try:
        module = importlib.import_module(module_name)
        sys.modules[f'api.{name}'] = module
        return module
    except ModuleNotFoundError as exc:
        raise AttributeError(name) from exc

# ------------------------------------------------------------------------------------
# Dynamically expose backend.api submodules under the legacy `api.` namespace so that
# imports such as `import api.alpha_vantage_service` or `from api.services import ...`
# keep working without duplicating code.
# ------------------------------------------------------------------------------------

import types as _types

def _register_submodule(alias: str, real_path: str):
    """Map alias (e.g. 'api.alpha_vantage_service') to real module path."""
    import importlib as _il
    try:
        mod = _il.import_module(real_path)
        sys.modules[alias] = mod
    except ModuleNotFoundError:
        pass

# apps submodule – provide ApiConfig
_register_submodule('api.apps', 'backend.api.apps')

# Frequently imported implementation modules
_register_submodule('api.alpha_vantage_service', 'backend.api.alpha_vantage_service')
_register_submodule('api.services', 'backend.api.services') 