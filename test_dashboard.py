#!/usr/bin/env python3
"""
Test script to verify dashboard API endpoints are working correctly.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(endpoint_name, url):
    print(f"\n=== Testing {endpoint_name} ===")
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

def main():
    print("🚀 Testing Dashboard API Endpoints")
    
    endpoints = [
        ("Overview", f"{BASE_URL}/api/dashboard/overview"),
        ("Allocation", f"{BASE_URL}/api/dashboard/allocation"),
        ("Gainers", f"{BASE_URL}/api/dashboard/gainers"),
        ("Losers", f"{BASE_URL}/api/dashboard/losers"),
        ("Dividend Forecast", f"{BASE_URL}/api/dashboard/dividend-forecast"),
        ("FX Rates", f"{BASE_URL}/api/fx/latest"),
    ]
    
    results = []
    for name, url in endpoints:
        success = test_endpoint(name, url)
        results.append((name, success))
    
    print("\n" + "="*50)
    print("📊 SUMMARY")
    print("="*50)
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{name:20} {status}")

if __name__ == "__main__":
    main() 