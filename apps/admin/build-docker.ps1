#!/usr/bin/env pwsh
# Build script for Admin Docker image

param(
    [string]$Tag = "hedhog-admin:latest",
    [switch]$NoCache,
    [switch]$Push,
    [string]$Registry = "",
    [switch]$SkipValidation
)

Write-Host "🐳 Building Admin Docker Image" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Run validation unless skipped
if (-not $SkipValidation) {
    Write-Host "🔍 Running pre-build validation..." -ForegroundColor Yellow
    & "$PSScriptRoot\validate-docker.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Validation failed! Fix errors before building." -ForegroundColor Red
        Write-Host "   Use -SkipValidation to bypass checks (not recommended)" -ForegroundColor Yellow
        exit 1
    }
    Write-Host ""
}

# Ensure we're in the monorepo root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent (Split-Path -Parent $scriptPath)
Set-Location $rootPath

Write-Host "📁 Working directory: $rootPath" -ForegroundColor Yellow
Write-Host "🏷️  Image tag: $Tag" -ForegroundColor Yellow
Write-Host ""

# Build arguments
$buildArgs = @(
    "build",
    "-f", "apps/admin/Dockerfile",
    "-t", $Tag
)

if ($NoCache) {
    Write-Host "⚠️  Building without cache" -ForegroundColor Yellow
    $buildArgs += "--no-cache"
}

$buildArgs += "."

Write-Host "🔨 Building image..." -ForegroundColor Green
Write-Host "Command: docker $($buildArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

docker @buildArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build successful!" -ForegroundColor Green

# Push to registry if requested
if ($Push) {
    if ($Registry) {
        $fullTag = "$Registry/$Tag"
        Write-Host ""
        Write-Host "🏷️  Tagging image as: $fullTag" -ForegroundColor Yellow
        docker tag $Tag $fullTag
        
        Write-Host "📤 Pushing to registry..." -ForegroundColor Yellow
        docker push $fullTag
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Push failed!" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "✅ Push successful!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Registry not specified. Use -Registry parameter" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Image information:" -ForegroundColor Cyan
docker images $Tag

Write-Host ""
Write-Host "🚀 To run the container:" -ForegroundColor Cyan
Write-Host "   docker run -d -p 3200:3200 --name hedhog-admin $Tag" -ForegroundColor White

Write-Host ""
Write-Host "📝 For more options, see:" -ForegroundColor Cyan
Write-Host "   apps/admin/DOCKERFILE.md" -ForegroundColor White
Write-Host "   apps/admin/DEPLOY.md" -ForegroundColor White
