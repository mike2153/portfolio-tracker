# api/api.py
from ninja import NinjaAPI

api = NinjaAPI()

@api.get("/hello")
def hello(request):
    return {"message": "Hello from Django Ninja - FinTech MVP API is running!"} 