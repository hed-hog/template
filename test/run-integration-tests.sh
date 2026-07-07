#!/bin/bash

# API Integration Test Scenarios
# This file contains all test cases organized by feature

set -e

# Source the helper functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/api-integration-tests.sh"

echo "========================================"
echo "🚀 Running API Integration Tests"
echo "========================================"

# ===========================================
# AUTHENTICATION TESTS
# ===========================================
echo ""
echo "📁 Authentication Tests"
echo "========================================"

# Test 1: Login with invalid email (should fail)
test_login "invalid@example.com" "changeme" "400,401,500" "false"

# Test 2: Login with invalid password (should fail)
test_login "root@hedhog.com" "wrongpassword" "400,401,500" "false"

# Test 3: Login with valid credentials (should succeed)
test_login "root@hedhog.com" "changeme" "200,201" "true"

# Test 4: Verify token
test_endpoint \
  "Verify authentication token" \
  "GET" \
  "/auth/verify" \
  "" \
  "200" \
  "" \
  "true"

# ===========================================
# SETTINGS TESTS
# ===========================================
echo ""
echo "📁 Settings Tests"
echo "========================================"

# Test 5: Get initial settings (authenticated)
test_endpoint \
  "Get initial settings" \
  "GET" \
  "/setting/initial" \
  "" \
  "200" \
  "" \
  "true"

# ===========================================
# LOCALE TESTS
# ===========================================
echo ""
echo "📁 Locale Tests"
echo "========================================"

# Test 6: Get locales (public endpoint)
test_endpoint \
  "Get available locales" \
  "GET" \
  "/locale" \
  "" \
  "200" \
  "data" \
  "false"

# ===========================================
# USER TESTS (examples - customize as needed)
# ===========================================
echo ""
echo "📁 User Tests"
echo "========================================"

# Test 7: Get user list (authenticated, requires pagination)
test_endpoint \
  "Get user list" \
  "GET" \
  "/user?page=1&pageSize=10" \
  "" \
  "200" \
  "data" \
  "true"

# Test 8: Try to create user without required fields (should fail)
test_endpoint \
  "Create user without name (should fail)" \
  "POST" \
  "/user" \
  '{"email":"test@example.com"}' \
  "400,422" \
  "" \
  "true"

# ===========================================
# ROLE TESTS (examples - customize as needed)
# ===========================================
echo ""
echo "📁 Role Tests"
echo "========================================"

# Test 9: Get roles list
test_endpoint \
  "Get roles list" \
  "GET" \
  "/role?page=1&pageSize=10" \
  "" \
  "200" \
  "data" \
  "true"

# ===========================================
# SUMMARY
# ===========================================
echo ""
echo "========================================"
echo "✅ All integration tests passed!"
echo "========================================"
