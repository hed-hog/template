#!/usr/bin/env pwsh
# Validation script for Docker build

Write-Host "🔍 Validating Docker build prerequisites..." -ForegroundColor Cyan
Write-Host ""

$errors = @()

# Check if we're in the monorepo root
if (-not (Test-Path "pnpm-workspace.yaml")) {
    $errors += "❌ Not in monorepo root. Run from e:\HedHogV2\lab"
}

# Check critical files
$criticalFiles = @(
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    "apps/admin/package.json",
    "apps/admin/next.config.ts",
    "apps/admin/Dockerfile",
    "apps/admin/.dockerignore"
)

foreach ($file in $criticalFiles) {
    if (-not (Test-Path $file)) {
        $errors += "❌ Missing critical file: $file"
    } else {
        Write-Host "✅ Found: $file" -ForegroundColor Green
    }
}

# Check if next.config.ts supports standalone output for Docker builds
$nextConfig = Get-Content "apps/admin/next.config.ts" -Raw
if (
    $nextConfig -notmatch "output:\s*['\"\"]standalone['\"\"]" -and
    $nextConfig -notmatch "NEXT_STANDALONE"
) {
    $errors += "⚠️  Warning: next.config.ts may not enable standalone output for Docker builds"
}

# Check packages
Write-Host ""
Write-Host "📦 Checking required workspace packages..." -ForegroundColor Yellow

$packages = @(
    "packages/api-types",
    "packages/api-pagination",
    "packages/next-app-provider"
)

foreach ($pkg in $packages) {
    $pkgJson = Join PathParam $pkg "package.json"
    if (Test-Path $pkgJson) {
        Write-Host "  ✅ $pkg" -ForegroundColor Green
    } else {
        $errors += "❌ Missing package: $pkgJson"
    }
}

# Skip checking libraries (admin doesn't use them)
Write-Host ""
Write-Host "ℹ️  Admin app only uses 3 workspace packages (api-types, api-pagination, next-app-provider)" -ForegroundColor Cyan

# Check Docker
Write-Host ""
Write-Host "🐳 Checking Docker..." -ForegroundColor Yellow

try {
    $dockerVersion = docker --version
    Write-Host "  ✅ Docker: $dockerVersion" -ForegroundColor Green
} catch {
    $errors += "❌ Docker not found or not running"
}

# Check .dockerignore
Write-Host ""
Write-Host "📝 Checking .dockerignore..." -ForegroundColor Yellow

$dockerignore = Get-Content "apps/admin/.dockerignore" -Raw
if ($dockerignore -match '\*\*/node_modules') {
    Write-Host "  ✅ node_modules excluded" -ForegroundColor Green
} else {
    $errors += "⚠️  Warning: .dockerignore may not exclude node_modules properly"
}

if ($dockerignore -match '\*\*/\.next') {
    Write-Host "  ✅ .next excluded" -ForegroundColor Green
} else {
    $errors += "⚠️  Warning: .dockerignore may not exclude .next properly"
}

# Check disk space
Write-Host ""
Write-Host "💾 Checking disk space..." -ForegroundColor Yellow

$drive = (Get-Location).Drive
$freeSpace = [math]::Round((Get-PSDrive $drive.Name).Free / 1GB, 2)
Write-Host "  Free space on ${drive}: ${freeSpace}GB" -ForegroundColor Cyan

if ($freeSpace -lt 10) {
    $errors += "⚠️  Warning: Low disk space. Docker builds need ~10GB minimum"
}

# Summary
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

if ($errors.Count -eq 0) {
    Write-Host "✅ All checks passed! Ready to build Docker image." -ForegroundColor Green
    Write-Host ""
    Write-Host "Run:" -ForegroundColor Yellow
    Write-Host "  docker build -f apps/admin/Dockerfile -t hedhog-admin:latest ." -ForegroundColor White
    Write-Host ""
    Write-Host "Or use the build script:" -ForegroundColor Yellow
    Write-Host "  .\apps\admin\build-docker.ps1" -ForegroundColor White
    exit 0
} else {
    Write-Host "❌ Validation failed with $($errors.Count) error(s):" -ForegroundColor Red
    Write-Host ""
    foreach ($error in $errors) {
        Write-Host "  $error" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Fix the errors above before building." -ForegroundColor Yellow
    exit 1
}
