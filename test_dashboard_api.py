#!/usr/bin/env python3
"""
Simple test script to verify the enhanced dashboard API endpoint is working
"""
import requests
import json
import sys

def test_dashboard_api():
    """Test the enhanced dashboard API endpoint"""
    
    # API endpoint
    base_url = "http://localhost:8000"
    endpoint = f"{base_url}/api/dashboard/overview"
    
    print(f"🧪 Testing Enhanced Dashboard API")
    print(f"📡 Endpoint: {endpoint}")
    print("-" * 50)
    
    try:
        # Make the API request (without auth for now)
        print("📡 Making API request...")
        response = requests.get(endpoint, timeout=10)
        
        print(f"📊 Response Status: {response.status_code}")
        print(f"📊 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ API call successful!")
            
            try:
                data = response.json()
                print("📋 Response Data:")
                print(json.dumps(data, indent=2))
                
                # Validate the response structure
                expected_fields = ['marketValue', 'totalProfit', 'irr', 'passiveIncome']
                missing_fields = []
                
                for field in expected_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"⚠️  Missing fields: {missing_fields}")
                else:
                    print("✅ All expected fields present!")
                    
                    # Check each KPI structure
                    for field_name in expected_fields:
                        field_data = data.get(field_name, {})
                        if isinstance(field_data, dict):
                            has_value = 'value' in field_data
                            has_sub_label = 'sub_label' in field_data
                            has_is_positive = 'is_positive' in field_data
                            
                            print(f"📊 {field_name}: value={has_value}, sub_label={has_sub_label}, is_positive={has_is_positive}")
                            if has_value:
                                print(f"   📈 Value: {field_data['value']}")
                            if has_sub_label:
                                print(f"   📝 Sub-label: {field_data['sub_label']}")
                        else:
                            print(f"❌ {field_name} is not a dict: {type(field_data)}")
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"📄 Raw response: {response.text[:500]}...")
                
        elif response.status_code == 401:
            print("🔐 Authentication required - this is expected without auth token")
            print("📄 Response:", response.text)
            
        elif response.status_code == 404:
            print("❌ Endpoint not found - check if the backend is running")
            print("📄 Response:", response.text)
            
        else:
            print(f"❌ API call failed with status {response.status_code}")
            print(f"📄 Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the backend server running on localhost:8000?")
        return False
        
    except requests.exceptions.Timeout:
        print("❌ Request timeout - backend may be slow or unresponsive")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    
    return True

def test_dashboard_endpoints():
    """Test multiple dashboard endpoints"""
    
    endpoints = [
        "/api/dashboard/overview",
        "/api/dashboard/allocation",
        "/api/dashboard/gainers",
        "/api/dashboard/losers",
    ]
    
    base_url = "http://localhost:8000"
    
    print(f"🧪 Testing Multiple Dashboard Endpoints")
    print("-" * 50)
    
    results = {}
    
    for endpoint in endpoints:
        url = f"{base_url}{endpoint}"
        print(f"\n📡 Testing: {endpoint}")
        
        try:
            response = requests.get(url, timeout=5)
            results[endpoint] = {
                'status': response.status_code,
                'success': response.status_code in [200, 401]  # 401 is expected without auth
            }
            
            if response.status_code == 200:
                print(f"✅ Success: {response.status_code}")
            elif response.status_code == 401:
                print(f"🔐 Auth Required: {response.status_code} (expected)")
            else:
                print(f"❌ Failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
            results[endpoint] = {'status': 'error', 'success': False}
    
    print(f"\n📊 Summary:")
    print("-" * 30)
    for endpoint, result in results.items():
        status = "✅" if result['success'] else "❌"
        print(f"{status} {endpoint}: {result['status']}")

if __name__ == "__main__":
    print("🚀 Enhanced Dashboard API Test Suite")
    print("=" * 50)
    
    # Test main dashboard endpoint
    test_dashboard_api()
    
    print("\n" + "=" * 50)
    
    # Test all dashboard endpoints
    test_dashboard_endpoints()
    
    print("\n🏁 Test suite completed!") 