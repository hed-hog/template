# HedHog Test Project Initialization Script
# This script creates a new test project and adds required libraries

#Requires -Version 5.1
$ErrorActionPreference = "Stop"

# Start timer
$StartTime = Get-Date

# ============================================
# Configuration
# ============================================
$PROJECT_NAME = "test-project"
$DB_CONFIG = @{
  Type     = "postgres"
  Host     = "localhost"
  Port     = "5432"
  User     = "hedhog"
  Password = "changeme"
  Name     = "hedhog"
}
$LIBRARIES = @("category", "contact", "contact-us", "faq", "tag", "content")

# ============================================
# Helper Functions
# ============================================
function Write-Step {
  param([string]$Message)
  Write-Host "`n→ $Message" -ForegroundColor Cyan
}

function Write-Success {
  param([string]$Message)
  Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
  param([string]$Message)
  Write-Host "✗ $Message" -ForegroundColor Red
}

function Invoke-Command {
  param(
    [string]$Command,
    [string]$ErrorMessage
  )
  
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    Write-Error $ErrorMessage
    exit 1
  }
}

# ============================================
# Main Script
# ============================================
try {
  # Clean up existing project
  if (Test-Path ".\$PROJECT_NAME") {
    Write-Step "Removing existing project directory..."
    Remove-Item ".\$PROJECT_NAME" -Recurse -Force
    Write-Success "Cleanup complete"
  }

  # Install HedHog CLI globally
  Write-Step "Installing @hed-hog/cli globally..."
  Invoke-Command "npm i -g @hed-hog/cli" "Failed to install HedHog CLI"
  Write-Success "CLI installed"

  # Verify CLI installation
  Write-Step "Verifying CLI installation..."
  hedhog --version
  Write-Success "CLI verified"

  # Create new project
  Write-Step "Creating new HedHog project: $PROJECT_NAME"
  $createCommand = "hedhog new $PROJECT_NAME " +
    "--dbtype $($DB_CONFIG.Type) " +
    "--dbhost $($DB_CONFIG.Host) " +
    "--dbport $($DB_CONFIG.Port) " +
    "--dbuser $($DB_CONFIG.User) " +
    "--dbpassword $($DB_CONFIG.Password) " +
    "--dbname $($DB_CONFIG.Name) " +
    "--force"
  
  Invoke-Command $createCommand "Failed to create project"
  Write-Success "Project created"

  # Navigate to project directory
  Set-Location ".\$PROJECT_NAME"

  # Add libraries
  Write-Step "Adding libraries: $($LIBRARIES -join ', ')"
  $addCommand = "hedhog add $($LIBRARIES -join ' ')"
  Invoke-Command $addCommand "Failed to add libraries"
  Write-Success "Libraries added"

  # Calculate execution time
  $EndTime = Get-Date
  $Duration = $EndTime - $StartTime
  $Minutes = [math]::Floor($Duration.TotalMinutes)
  $Seconds = $Duration.Seconds

  # Success message
  Write-Host "`n========================================" -ForegroundColor Cyan
  Write-Success "Project initialized successfully!"
  Write-Host "Total execution time: $Minutes min $Seconds sec" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
}
catch {
  Write-Error "Unexpected error: $_"
  exit 1
}