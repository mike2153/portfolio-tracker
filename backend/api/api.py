# api/api.py
from ninja import NinjaAPI
from .views import router as api_router
from .dashboard_views import dashboard_api_router

api = NinjaAPI()

api.add_router("/", api_router)
api.add_router("/", dashboard_api_router)

@api.get("/hello")
def hello(request):
    return {"message": "Hello from Django Ninja - FinTech MVP API is running!"} 