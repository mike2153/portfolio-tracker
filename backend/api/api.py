# api/api.py
from ninja import NinjaAPI
from .views import router as api_router
from .dashboard_views import dashboard_api_router
from .auth import require_auth

api = NinjaAPI()

api.add_router("/", api_router, auth=require_auth)
api.add_router("/dashboard", dashboard_api_router, auth=require_auth)

@api.get("/hello")
def hello(request):
    return {"message": "Hello from Django Ninja - FinTech MVP API is running!"} 