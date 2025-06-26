#!/usr/bin/env python3
"""
Debug script to test the KPI dashboard endpoint with detailed logging
"""
import os
import sys
import requests
import json
from pprint import pprint

# Add Django setup
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

def test_kpi_endpoint():
    """Test the KPI dashboard endpoint directly"""
    
    print("🔍 Testing Dashboard KPI Endpoint")
    print("=" * 50)
    
    # Test URL
    base_url = "http://localhost:8000"
    endpoint = f"{base_url}/api/dashboard/overview"
    
    print(f"📡 Testing endpoint: {endpoint}")
    
    # Test headers for debugging
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'KPI-Debug-Test/1.0'
    }
    
    try:
        print("🚀 Making request...")
        response = requests.get(endpoint, headers=headers, timeout=30)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📊 Response Headers: {dict(response.headers)}")
        print(f"📊 Response URL: {response.url}")
        
        if response.status_code == 200:
            print("✅ Request successful!")
            try:
                data = response.json()
                print("📋 Response Data Structure:")
                pprint(data, width=120, depth=4)
                
                # Validate KPI structure
                expected_fields = ['marketValue', 'totalProfit', 'irr', 'passiveIncome']
                print(f"\n🔍 Validating expected fields: {expected_fields}")
                
                for field in expected_fields:
                    if field in data:
                        field_data = data[field]
                        print(f"✅ {field}: {type(field_data)} - {field_data}")
                        
                        # Check KPI structure
                        if isinstance(field_data, dict):
                            kpi_fields = ['value', 'sub_label', 'is_positive']
                            missing = [f for f in kpi_fields if f not in field_data]
                            if missing:
                                print(f"⚠️  {field} missing: {missing}")
                            else:
                                print(f"✅ {field} structure valid")
                    else:
                        print(f"❌ Missing field: {field}")
                        
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                print(f"📄 Raw response: {response.text[:1000]}...")
                
        elif response.status_code == 401:
            print("🔐 Authentication required - this is expected")
            print(f"📄 Response: {response.text}")
            
        elif response.status_code == 500:
            print("❌ Server error!")
            print(f"📄 Error response: {response.text}")
            
        else:
            print(f"⚠️  Unexpected status: {response.status_code}")
            print(f"📄 Response: {response.text}")
            
    except requests.RequestException as e:
        print(f"❌ Request failed: {e}")
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()

def test_backend_health():
    """Test basic backend health"""
    print("\n🏥 Testing Backend Health")
    print("=" * 30)
    
    try:
        # Test Django admin
        response = requests.get("http://localhost:8000/admin/", timeout=10)
        print(f"📊 Django Admin: {response.status_code} - {'✅ OK' if response.status_code in [200, 302] else '❌ Error'}")
        
        # Test API root
        response = requests.get("http://localhost:8000/api/", timeout=10)
        print(f"📊 API Root: {response.status_code} - {'✅ OK' if response.status_code in [200, 404] else '❌ Error'}")
        
    except Exception as e:
        print(f"❌ Backend health check failed: {e}")

if __name__ == "__main__":
    test_backend_health()
    test_kpi_endpoint()
    print("\n🎯 Debug test completed!") 