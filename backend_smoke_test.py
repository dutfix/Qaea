#!/usr/bin/env python3
"""
Backend smoke test for EAS PREBUILD verification
Tests basic auth and API endpoints
"""
import requests
import sys

BASE_URL = "http://localhost:8001/api"

# Test credentials from memory/test_credentials.md
QA1_EMAIL = "qa_mello_1@linguatest.com"
QA1_PASSWORD = "Mello1234!"

def test_auth_login():
    """Test POST /auth/login"""
    print("Testing POST /auth/login...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": QA1_EMAIL, "password": QA1_PASSWORD}
    )
    print(f"  Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  FAIL: Expected 200, got {response.status_code}")
        print(f"  Response: {response.text}")
        return None
    
    data = response.json()
    if "token" not in data:
        print(f"  FAIL: Response missing 'token' key")
        print(f"  Response: {data}")
        return None
    
    print(f"  PASS: Got token")
    return data["token"]

def test_auth_me(token):
    """Test GET /auth/me"""
    print("Testing GET /auth/me...")
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"  Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  FAIL: Expected 200, got {response.status_code}")
        return False
    
    print(f"  PASS: Got user data")
    return True

def test_users_partners(token):
    """Test GET /users/partners"""
    print("Testing GET /users/partners...")
    response = requests.get(
        f"{BASE_URL}/users/partners",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"  Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  FAIL: Expected 200, got {response.status_code}")
        return False
    
    print(f"  PASS: Got partners list")
    return True

def test_moments(token):
    """Test GET /moments"""
    print("Testing GET /moments...")
    response = requests.get(
        f"{BASE_URL}/moments",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"  Status: {response.status_code}")
    if response.status_code != 200:
        print(f"  FAIL: Expected 200, got {response.status_code}")
        return False
    
    print(f"  PASS: Got moments list")
    return True

def main():
    print("=" * 60)
    print("BACKEND SMOKE TEST - EAS PREBUILD VERIFICATION")
    print("=" * 60)
    print()
    
    # Test login
    token = test_auth_login()
    if not token:
        print("\n❌ FAIL: Login failed")
        sys.exit(1)
    print()
    
    # Test /auth/me
    if not test_auth_me(token):
        print("\n❌ FAIL: /auth/me failed")
        sys.exit(1)
    print()
    
    # Test /users/partners
    if not test_users_partners(token):
        print("\n❌ FAIL: /users/partners failed")
        sys.exit(1)
    print()
    
    # Test /moments
    if not test_moments(token):
        print("\n❌ FAIL: /moments failed")
        sys.exit(1)
    print()
    
    print("=" * 60)
    print("✅ ALL BACKEND SMOKE TESTS PASSED (4/4)")
    print("=" * 60)
    sys.exit(0)

if __name__ == "__main__":
    main()
