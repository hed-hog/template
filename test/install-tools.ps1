# Recomendado: executar como Administrador
# Salve como setup-dev-tools.ps1 e rode em um PowerShell 7/Windows PowerShell

$ErrorActionPreference = "Stop"

function Test-IsAdmin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Warning "Execute este script como Administrador para evitar falhas em instalações via winget."
    exit 1
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path    = "$machinePath;$userPath"
}

function Assert-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Comando '$name' não encontrado no PATH."
    }
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [string]$Name = $Id
    )

    Write-Host ">>> Instalando $Name ($Id) via winget..." -ForegroundColor Cyan

    $installed = winget list --id $Id --exact --source winget 2>$null
    if ($LASTEXITCODE -eq 0 -and $installed) {
        Write-Host "    $Name já está instalado. Tentando upgrade..." -ForegroundColor Yellow
        winget upgrade --id $Id --exact --source winget --accept-package-agreements --accept-source-agreements --silent 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "    Sem upgrade disponível ou upgrade não aplicável para $Name." -ForegroundColor DarkYellow
        }
    } else {
        winget install --id $Id --exact --source winget --accept-package-agreements --accept-source-agreements --silent
    }

    Refresh-Path
}

Write-Host ">>> Validando winget..." -ForegroundColor Cyan
Assert-Command winget

# Garante atualização das fontes
winget source update
Refresh-Path

# 1) NVM for Windows
Install-WingetPackage -Id "CoreyButler.NVMforWindows" -Name "NVM for Windows"

# Algumas instalações via winget só entram no PATH após refresh/reabertura do shell
Refresh-Path
Assert-Command nvm

# 2) Node latest via nvm
Write-Host ">>> Instalando Node.js latest via nvm..." -ForegroundColor Cyan
nvm install latest
nvm use latest
Refresh-Path

Assert-Command node
Assert-Command npm

# 3) pnpm via npm
Write-Host ">>> Instalando pnpm via npm..." -ForegroundColor Cyan
npm install -g pnpm
Refresh-Path
Assert-Command pnpm

# 4) doctl, kubectl, terraform, helm via winget/source winget
Install-WingetPackage -Id "DigitalOcean.Doctl"   -Name "doctl"
Install-WingetPackage -Id "Kubernetes.kubectl"   -Name "kubectl"
Install-WingetPackage -Id "Hashicorp.Terraform"  -Name "Terraform"
Install-WingetPackage -Id "Helm.Helm"            -Name "Helm"

Refresh-Path

Write-Host ""
Write-Host ">>> Versões instaladas:" -ForegroundColor Green

$tools = @(
    @{ Name = "nvm";       Cmd = { nvm version } },
    @{ Name = "node";      Cmd = { node -v } },
    @{ Name = "npm";       Cmd = { npm -v } },
    @{ Name = "pnpm";      Cmd = { pnpm -v } },
    @{ Name = "doctl";     Cmd = { doctl version } },
    @{ Name = "kubectl";   Cmd = { kubectl version --client=true } },
    @{ Name = "terraform"; Cmd = { terraform version } },
    @{ Name = "helm";      Cmd = { helm version } }
)

foreach ($tool in $tools) {
    try {
        Write-Host "----- $($tool.Name) -----" -ForegroundColor Magenta
        & $tool.Cmd
    } catch {
        Write-Warning "Não foi possível validar $($tool.Name): $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Concluído." -ForegroundColor Green
Write-Host "Se algum comando ainda não for reconhecido, feche e abra o terminal novamente." -ForegroundColor Yellow