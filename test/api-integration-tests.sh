#!/bin/bash

# API Integration Tests Helper Script
# Usage: ./api-integration-tests.sh

set -e

BASE_URL="http://localhost:3100"
TOKEN_FILE="/tmp/access_token.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to load access token
load_token() {
  if [ -f "$TOKEN_FILE" ]; then
    cat "$TOKEN_FILE"
  else
    echo ""
  fi
}

# Main test function
# Usage: test_endpoint "Test Name" "METHOD" "/path" '{"data":"json"}' "200,201" "validation_pattern"
test_endpoint() {
  local test_name="$1"
  local method="$2"
  local path="$3"
  local data="$4"
  local expected_codes="$5"  # Comma-separated list like "200,201"
  local validation_pattern="$6"  # Optional: grep pattern to validate in response
  local requires_auth="${7:-false}"
  
  echo ""
  echo "🧪 Test: $test_name"
  echo "   Method: $method $path"
  
  # Build curl command
  local curl_cmd="curl -s -X $method ${BASE_URL}${path}"
  curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
  
  # Add auth header if required
  if [ "$requires_auth" = "true" ]; then
    local token=$(load_token)
    if [ -z "$token" ]; then
      echo -e "${RED}❌ Authentication required but no token found${NC}"
      return 1
    fi
    curl_cmd="$curl_cmd -H 'Authorization: Bearer $token'"
  fi
  
  # Add data if provided
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -d '$data'"
  fi
  
  # Execute request
  local response_file="/tmp/test_response_$$.json"
  http_code=$(eval "$curl_cmd -o $response_file -w '%{http_code}'")
  
  echo "   Status: $http_code"
  
  # Check if status code matches expected
  local code_match=false
  IFS=',' read -ra CODES <<< "$expected_codes"
  for expected_code in "${CODES[@]}"; do
    if [ "$http_code" -eq "$expected_code" ]; then
      code_match=true
      break
    fi
  done
  
  if [ "$code_match" = false ]; then
    echo -e "${RED}❌ Expected HTTP $expected_codes, got $http_code${NC}"
    echo "   Response:"
    cat "$response_file" | jq '.' 2>/dev/null || cat "$response_file"
    rm -f "$response_file"
    return 1
  fi
  
  # Validate response content if pattern provided
  if [ -n "$validation_pattern" ]; then
    if grep -q "$validation_pattern" "$response_file"; then
      echo -e "${GREEN}✅ Validation passed: '$validation_pattern' found in response${NC}"
    else
      echo -e "${RED}❌ Validation failed: '$validation_pattern' not found in response${NC}"
      echo "   Response:"
      cat "$response_file" | jq '.' 2>/dev/null || cat "$response_file"
      rm -f "$response_file"
      return 1
    fi
  else
    echo -e "${GREEN}✅ Test passed${NC}"
  fi
  
  # Show response preview
  if command -v jq &> /dev/null; then
    echo "   Response preview:"
    cat "$response_file" | jq '.' | head -10
  fi
  
  rm -f "$response_file"
  return 0
}

# Function to save token from response
save_token_from_response() {
  local response_file="$1"
  local token=$(cat "$response_file" | jq -r '.accessToken' 2>/dev/null)
  if [ -n "$token" ] && [ "$token" != "null" ]; then
    echo "$token" > "$TOKEN_FILE"
    echo -e "${GREEN}🔑 Access token saved${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  No accessToken found in response${NC}"
    return 1
  fi
}

# Custom test function for login (saves token)
test_login() {
  local email="$1"
  local password="$2"
  local expected_codes="$3"
  local should_succeed="${4:-true}"
  
  echo ""
  echo "🔐 Test: Login with $email"
  
  local response_file="/tmp/login_response_$$.json"
  http_code=$(curl -s -X POST "${BASE_URL}/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    -o "$response_file" \
    -w '%{http_code}')
  
  echo "   Status: $http_code"
  
  # Check if status code matches expected
  local code_match=false
  IFS=',' read -ra CODES <<< "$expected_codes"
  for expected_code in "${CODES[@]}"; do
    if [ "$http_code" -eq "$expected_code" ]; then
      code_match=true
      break
    fi
  done
  
  if [ "$code_match" = false ]; then
    echo -e "${RED}❌ Expected HTTP $expected_codes, got $http_code${NC}"
    cat "$response_file" | jq '.' 2>/dev/null || cat "$response_file"
    rm -f "$response_file"
    return 1
  fi
  
  # If should succeed, save token
  if [ "$should_succeed" = "true" ]; then
    if grep -q "accessToken" "$response_file"; then
      save_token_from_response "$response_file"
      echo -e "${GREEN}✅ Login successful${NC}"
    else
      echo -e "${RED}❌ Login response missing accessToken${NC}"
      rm -f "$response_file"
      return 1
    fi
  else
    echo -e "${GREEN}✅ Login correctly rejected${NC}"
  fi
  
  rm -f "$response_file"
  return 0
}

# Export functions for use in workflow
export -f test_endpoint
export -f test_login
export -f load_token
export -f save_token_from_response
