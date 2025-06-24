# api/api.py
from ninja import NinjaAPI
from .views import router as api_router
from .auth import SupabaseBearer

# Instantiate API without global auth; endpoints can attach SupabaseBearer individually if needed
api = NinjaAPI()

api.add_router("/", api_router)

@api.get("/hello")
def hello(request):
    return {"message": "Hello from Django Ninja - FinTech MVP API is running!"} 