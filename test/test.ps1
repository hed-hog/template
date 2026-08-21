# =============================================================================
# Configuration
# =============================================================================
$API_BASE_URL = "http://localhost:3100"
$LOGIN_EMAIL = "root@hedhog.com"
$LOGIN_PASSWORD = "changeme"
# =============================================================================
# Test API Login
# =============================================================================
Write-Host "🧪 Testing API Login..." -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# Check if API is running
# -----------------------------------------------------------------------------
try {
    $healthCheck = Invoke-WebRequest -Uri "$API_BASE_URL/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ API is running" -ForegroundColor Green
} catch {
    Write-Host "❌ API is not running at $API_BASE_URL" -ForegroundColor Red
    Write-Host "Please start the API with: cd apps/api; pnpm dev" -ForegroundColor Yellow
    exit 1
}

# -----------------------------------------------------------------------------
# Attempt login
# -----------------------------------------------------------------------------
$loginBody = @{
    email = $LOGIN_EMAIL
    password = $LOGIN_PASSWORD
} | ConvertTo-Json

Write-Host "`n🔐 Attempting login..." -ForegroundColor Yellow
Write-Host "Email: $LOGIN_EMAIL" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest `
        -Uri "$API_BASE_URL/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -UseBasicParsing `
        -ErrorAction Stop

    $responseData = $response.Content | ConvertFrom-Json

    Write-Host "`n📋 Login response:" -ForegroundColor Cyan
    Write-Host ($responseData | ConvertTo-Json -Depth 10) -ForegroundColor Gray

    # -----------------------------------------------------------------------------
    # Validate response
    # -----------------------------------------------------------------------------
    $token = if ($responseData.accessToken) { 
        $responseData.accessToken 
    } else { 
        $responseData.access_token 
    }
    
    if ($token) {
        Write-Host "`n✅ Login successful!" -ForegroundColor Green
        Write-Host "Access token: $($token.Substring(0, 20))..." -ForegroundColor Gray
        exit 0
    } else {
        Write-Host "`n❌ Login failed: no access token in response" -ForegroundColor Red
        exit 1
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "`n❌ Login request failed" -ForegroundColor Red
    Write-Host "Status Code: $statusCode" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Gray
    }
    
    exit 1
}
