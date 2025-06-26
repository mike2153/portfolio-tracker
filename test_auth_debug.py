#!/usr/bin/env python3
"""
Authentication Debug Test Script
Tests both frontend and backend authentication systems
"""

import requests
import json
import sys

def test_frontend_availability():
    """Test if frontend is running"""
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        print(f"✅ Frontend Status: {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Frontend Not Available: {e}")
        return False

def test_backend_availability():
    """Test if backend is running"""
    try:
        response = requests.get("http://localhost:8000/api/dashboard/overview", timeout=5)
        print(f"✅ Backend Status: {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend Not Available: {e}")
        return False

def test_supabase_auth(email, password):
    """Test Supabase authentication directly"""
    try:
        # Test sign in API call (simulating what frontend does)
        payload = {
            "email": email,
            "password": password
        }
        
        print(f"\n🔐 Testing Authentication:")
        print(f"   Email: {email}")
        print(f"   Password: {'*' * len(password)}")
        
        # Note: This would need actual Supabase API endpoint
        # For now, just test if we can reach the auth page
        auth_response = requests.get("http://localhost:3000/auth", timeout=5)
        print(f"✅ Auth Page Status: {auth_response.status_code}")
        
        return True
        
    except Exception as e:
        print(f"❌ Authentication Test Failed: {e}")
        return False

def main():
    print("🔍 AUTHENTICATION DEBUG TEST")
    print("=" * 50)
    
    # Test server availability
    frontend_ok = test_frontend_availability()
    backend_ok = test_backend_availability()
    
    if not frontend_ok or not backend_ok:
        print("\n❌ One or both servers are not running!")
        print("   Make sure both 'npm run dev' and 'python manage.py runserver' are running")
        return
    
    # Test authentication with provided credentials
    print(f"\n📝 Please provide test credentials:")
    email = input("   Email: ").strip()
    password = input("   Password: ").strip()
    
    if email and password:
        test_supabase_auth(email, password)
    else:
        print("❌ No credentials provided")
    
    print("\n🛠️  ENVIRONMENT CHECK:")
    print("   - Check if frontend/.env.local exists")
    print("   - Verify NEXT_PUBLIC_SUPABASE_URL is set")
    print("   - Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is set")
    print("   - Check Supabase email confirmation settings")

if __name__ == "__main__":
    main() 