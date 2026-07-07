# Script para testar a API localmente (simula o workflow do GitHub Actions)

Write-Host "🚀 Iniciando teste local da API..." -ForegroundColor Cyan

# 1. Verificar se o Docker está rodando
Write-Host "`n📦 Verificando Docker..." -ForegroundColor Yellow
if (-not (docker ps 2>$null)) {
    Write-Host "❌ Docker não está rodando. Inicie o Docker Desktop e tente novamente." -ForegroundColor Red
    exit 1
}

# 2. Verificar se o PostgreSQL está rodando
Write-Host "`n🐘 Verificando PostgreSQL..." -ForegroundColor Yellow
$postgres = docker ps --filter "name=lab-postgres" --format "{{.Names}}"
if (-not $postgres) {
    Write-Host "⚠️  PostgreSQL não está rodando. Iniciando..." -ForegroundColor Yellow
    docker-compose up -d
    Start-Sleep -Seconds 10
}

# 3. Configurar ambiente
Write-Host "`n⚙️  Configurando ambiente..." -ForegroundColor Yellow
Set-Location apps/api

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "✅ Arquivo .env criado" -ForegroundColor Green
}

# 4. Aplicar migrações
Write-Host "`n📊 Aplicando migrações do banco de dados..." -ForegroundColor Yellow
pnpm prisma:deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao aplicar migrações" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# 5. Gerar Prisma Client
Write-Host "`n🔧 Gerando Prisma Client..." -ForegroundColor Yellow
pnpm prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao gerar Prisma Client" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# 6. Verificar se já existe servidor rodando
Write-Host "`n🔍 Verificando servidor existente..." -ForegroundColor Yellow
$existingServer = Get-NetTCPConnection -LocalPort 3100 -ErrorAction SilentlyContinue
if ($existingServer) {
    Write-Host "⚠️  Servidor já está rodando na porta 3100" -ForegroundColor Yellow
    $useExisting = Read-Host "Usar servidor existente? (S/n)"
    if ($useExisting -ne "n" -and $useExisting -ne "N") {
        Write-Host "✅ Usando servidor existente" -ForegroundColor Green
        $serverPid = $null
    } else {
        Write-Host "❌ Pare o servidor existente e tente novamente" -ForegroundColor Red
        Set-Location ../..
        exit 1
    }
} else {
    # 7. Iniciar servidor
    Write-Host "`n🚀 Iniciando servidor API..." -ForegroundColor Yellow
    $serverProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; pnpm dev" -PassThru -WindowStyle Minimized
    $serverPid = $serverProcess.Id
    Write-Host "✅ Servidor iniciado (PID: $serverPid)" -ForegroundColor Green

    # Aguardar servidor inicializar
    Write-Host "`n⏳ Aguardando servidor inicializar..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    $serverReady = $false

    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3100/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $serverReady = $true
                break
            }
        } catch {}
        Start-Sleep -Seconds 2
        $attempt++
        Write-Host "." -NoNewline
    }

    Write-Host ""

    if (-not $serverReady) {
        Write-Host "❌ Servidor não respondeu no tempo esperado" -ForegroundColor Red
        if ($serverPid) { Stop-Process -Id $serverPid -Force }
        Set-Location ../..
        exit 1
    }

    Write-Host "✅ Servidor pronto!" -ForegroundColor Green
}

# 8. Chamar endpoint /install
Write-Host "`n🔐 Inicializando aplicação (/install)..." -ForegroundColor Yellow
try {
    $body = @{
        appName = "HedHog"
        slogan = "Administration Panel"
        userName = "Root User"
        email = "root@hedhog.com"
        password = "changeme"
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
    }

    $response = Invoke-WebRequest -Uri "http://localhost:3100/install" `
        -Method POST `
        -Body $body `
        -Headers $headers `
        -UseBasicParsing `
        -ErrorAction Stop

    Write-Host "✅ Aplicação inicializada" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        Write-Host "⚠️  Aplicação já está inicializada (409 Conflict)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Erro ao inicializar: $_" -ForegroundColor Red
    }
}

# 9. Rodar testes
Write-Host "`n🧪 Executando testes E2E..." -ForegroundColor Yellow
$env:API_URL = "http://localhost:3100"
pnpm test:e2e

$testResult = $LASTEXITCODE

# 10. Limpar
if ($serverPid) {
    Write-Host "`n🛑 Parando servidor..." -ForegroundColor Yellow
    Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Servidor parado" -ForegroundColor Green
}

Set-Location ../..

# Resultado final
Write-Host "`n" -NoNewline
if ($testResult -eq 0) {
    Write-Host "✅ TODOS OS TESTES PASSARAM!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ ALGUNS TESTES FALHARAM" -ForegroundColor Red
    exit 1
}
