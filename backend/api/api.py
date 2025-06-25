# api/api.py
from ninja import NinjaAPI
from .views import router as api_router
from .dashboard_views import dashboard_api_router

# Initialise API instance once
api = NinjaAPI()

_registered_prefixes = set()

def _safe_add_router(prefix: str, router_obj):
    """Register router only once per prefix regardless of Ninja internal storage."""
    if prefix in _registered_prefixes:
        return
    # Avoid locking the original router object to this API so that tests can
    # reuse it.  Newer versions of Django-Ninja provide Router.clone().
    try:
        router_to_attach = router_obj.clone()  # type: ignore[attr-defined]
    except AttributeError:
        router_to_attach = router_obj

    api.add_router(prefix, router_to_attach)
    _registered_prefixes.add(prefix)

    # If we had to attach the *original* router (clone unavailable), detach it
    # so that test suites can re-attach it to their own NinjaAPI instances.
    if router_to_attach is router_obj and hasattr(router_obj, '_api'):
        try:
            router_obj._api = None  # type: ignore[attr-defined]
        except Exception:
            pass

_safe_add_router("/", api_router)
_safe_add_router("/dashboard", dashboard_api_router)

@api.get("/hello")
def hello(request):
    return {"message": "Hello from Django Ninja - FinTech MVP API is running!"} 