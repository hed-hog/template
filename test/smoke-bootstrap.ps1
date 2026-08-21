<#
.SYNOPSIS
  Valida o bootstrap do template — `hedhog new` (que ja chama `hedhog add core`)
  — contra a arvore LOCAL, antes do push.

.DESCRIPTION
  O `hedhog new` clona uma URL fixa (https://github.com/hed-hog/template.git,
  ver git.service.ts no @hed-hog/cli): rodado puro, ele testaria o que ja esta
  no GitHub, nao o seu commit local. Este script redireciona o clone para a
  arvore local usando o `insteadOf` do git via variaveis de ambiente
  (GIT_CONFIG_COUNT/KEY_0/VALUE_0), que o CLI propaga para o git filho porque
  o runner faz `env: { ...process.env, ... }`.

  Nada e escrito no repositorio: o redirect vive so no ambiente do processo
  (nenhum `git config` e gravado), o clone e read-only sobre a origem, e o
  projeto gerado fica FORA da arvore do repo, em
  %LOCALAPPDATA%\Temp\hedhog-smoke\<timestamp>. Ao final o script afirma que
  `git status --porcelain` continua vazio.

  Apenas o HEAD commitado e clonado — alteracoes nao commitadas NAO entram.
  Por isso o script aborta com working tree suja, salvo -AllowDirty.

  A sequencia de verificacao espelha .github/workflows/ci.yml.

.PARAMETER KeepSandbox
  Nao remove o diretorio do sandbox ao final (para inspecao).

.PARAMETER AllowDirty
  Prossegue mesmo com working tree suja (as alteracoes nao commitadas serao
  ignoradas pelo clone).

.PARAMETER ApiPort
  Porta em que a API do sandbox sobe. Default 3100.

.PARAMETER SkipUnitTests
  Pula `pnpm turbo run test` (etapa mais longa do pipeline).

.EXAMPLE
  pnpm test:bootstrap

.EXAMPLE
  pwsh -NoProfile -File ./test/smoke-bootstrap.ps1 -KeepSandbox -SkipUnitTests
#>
[CmdletBinding()]
param(
  [switch]$KeepSandbox,
  [switch]$AllowDirty,
  [int]$ApiPort = 3100,
  [switch]$SkipUnitTests
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
$ComposeProject  = 'hedhog-smoke'
$ProjectName     = 'smoke-app'
$TemplateRepoUrl = 'https://github.com/hed-hog/template.git'
$DbHost     = '127.0.0.1'
$DbPort     = 55432
$DbUser     = 'hedhog'
$DbPassword = 'changeme'
$DbName     = 'hedhog'
$RedisPort  = 56379

# ---------------------------------------------------------------------------
# Helpers de saida
# ---------------------------------------------------------------------------
$script:StepIndex = 0
function Write-Step {
  param([string]$Message)
  $script:StepIndex++
  Write-Host ''
  Write-Host ("[{0}] {1}" -f $script:StepIndex, $Message) -ForegroundColor Cyan
}
function Write-Ok   { param([string]$m) Write-Host "  OK    $m" -ForegroundColor Green }
function Write-Warn { param([string]$m) Write-Host "  AVISO $m" -ForegroundColor Yellow }
function Write-Fail { param([string]$m) Write-Host "  FALHA $m" -ForegroundColor Red }

# Executa um comando nativo e lanca excecao se o exit code for != 0.
# ($ErrorActionPreference = 'Stop' nao cobre comandos nativos.)
function Invoke-Native {
  param(
    [Parameter(Mandatory)][string]$File,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory,
    [string]$What
  )
  $label = if ($What) { $What } else { "$File $($Arguments -join ' ')" }
  if ($WorkingDirectory) { Push-Location $WorkingDirectory }
  try {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$label falhou (exit code $LASTEXITCODE)."
    }
  }
  finally {
    if ($WorkingDirectory) { Pop-Location }
  }
}

function Test-PortInUse {
  param([int]$Port)
  try {
    $null = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return $true
  }
  catch {
    return $false
  }
}

function New-Secret {
  [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
}

# ---------------------------------------------------------------------------
# Estado compartilhado com o teardown
# ---------------------------------------------------------------------------
$RepoRoot    = $null
$SandboxRoot = $null
$ProjectPath = $null
$ApiProcess  = $null
$ApiLog      = $null
$ApiErrLog   = $null
$ComposeFile = $null
$ComposeUp   = $false
$Succeeded   = $false
$Dirty       = $null
$Findings     = New-Object System.Collections.Generic.List[string]
$HardFailures = New-Object System.Collections.Generic.List[string]
$script:DeferredFailures = 0
$StartedAt   = Get-Date

try {
  # =========================================================================
  Write-Step 'Preflight'
  # =========================================================================
  $RepoRoot = & git rev-parse --show-toplevel 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $RepoRoot) {
    throw 'Este script precisa rodar dentro do repositorio do template.'
  }
  $RepoRoot = (Resolve-Path $RepoRoot).Path
  Write-Ok "Repo: $RepoRoot"

  $ComposeFile = Join-Path $RepoRoot 'test/docker-compose.smoke.yaml'
  if (-not (Test-Path $ComposeFile)) {
    throw "Arquivo de infra nao encontrado: $ComposeFile"
  }

  foreach ($tool in @('git', 'docker', 'node', 'pnpm', 'hedhog')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
      throw "'$tool' nao encontrado no PATH. Instale-o antes de rodar o smoke test (hedhog: npm i -g @hed-hog/cli)."
    }
  }
  Write-Ok 'git, docker, node, pnpm e hedhog disponiveis'

  # Somente o HEAD commitado e clonado.
  $Dirty = & git -C $RepoRoot status --porcelain
  if ($Dirty) {
    $dirtyCount = ($Dirty | Measure-Object).Count
    if ($AllowDirty) {
      Write-Warn "$dirtyCount arquivo(s) nao commitado(s) — NAO entram no teste (so o HEAD e clonado)."
    }
    else {
      Write-Fail "$dirtyCount arquivo(s) com alteracoes nao commitadas."
      Write-Host '        O clone usa apenas o HEAD commitado, entao essas alteracoes nao seriam testadas.' -ForegroundColor Red
      Write-Host '        Commite antes de rodar, ou use -AllowDirty para ignora-las conscientemente.' -ForegroundColor Red
      throw 'Working tree suja.'
    }
  }
  else {
    Write-Ok 'Working tree limpa'
  }

  # O que exatamente sera testado.
  $HeadSha  = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
  $HeadFull = (& git -C $RepoRoot rev-parse HEAD).Trim()
  $Branch   = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim()
  Write-Ok "Sera testado: $Branch @ $HeadSha"

  $Upstream = & git -C $RepoRoot rev-parse --abbrev-ref '@{upstream}' 2>$null
  if ($LASTEXITCODE -eq 0 -and $Upstream) {
    $Ahead = (& git -C $RepoRoot rev-list --count "$Upstream..HEAD").Trim()
    if ([int]$Ahead -gt 0) {
      Write-Ok "$Ahead commit(s) a frente de $Upstream — exatamente o que o push publicaria"
    }
    else {
      Write-Warn "Nenhum commit a frente de $Upstream (nada novo para validar)."
    }
  }

  if (Test-PortInUse -Port $ApiPort) {
    throw "A porta $ApiPort ja esta em uso (sua API de dev provavelmente esta no ar). Pare-a ou use -ApiPort."
  }
  foreach ($p in @($DbPort, $RedisPort)) {
    if (Test-PortInUse -Port $p) {
      throw "A porta $p (infra do smoke test) ja esta em uso. Libere-a e tente de novo."
    }
  }
  Write-Ok "Portas $ApiPort, $DbPort e $RedisPort livres"

  # =========================================================================
  Write-Step 'Subindo infra efemera (postgres + redis)'
  # =========================================================================
  Invoke-Native -File 'docker' -What 'docker compose up' -Arguments @(
    'compose', '-p', $ComposeProject, '-f', $ComposeFile, 'up', '-d', '--wait'
  )
  $ComposeUp = $true
  Write-Ok "postgres em $DbPort, redis em $RedisPort (project '$ComposeProject')"

  # =========================================================================
  Write-Step 'Preparando sandbox e redirecionando o clone para a arvore local'
  # =========================================================================
  $Stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
  $SandboxRoot = Join-Path $env:LOCALAPPDATA "Temp\hedhog-smoke\$Stamp"
  New-Item -ItemType Directory -Path $SandboxRoot -Force | Out-Null
  $ProjectPath = Join-Path $SandboxRoot $ProjectName
  Write-Ok "Sandbox: $SandboxRoot"

  # `insteadOf` escopado ao processo: nenhum git config e gravado em disco.
  $LocalUrl = $RepoRoot -replace '\\', '/'
  $env:GIT_CONFIG_COUNT   = '1'
  $env:GIT_CONFIG_KEY_0   = "url.$LocalUrl.insteadOf"
  $env:GIT_CONFIG_VALUE_0 = $TemplateRepoUrl

  # Prova que o redirect esta ativo antes de gastar tempo com o clone.
  $Resolved = & git ls-remote $TemplateRepoUrl HEAD 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $Resolved) {
    throw 'O redirect do clone nao resolveu. Verifique se o git e >= 2.31 (suporte a GIT_CONFIG_COUNT).'
  }
  $ResolvedSha = ([string]$Resolved -split '\s+')[0]
  if ($ResolvedSha -ne $HeadFull) {
    throw "O redirect apontou para $ResolvedSha, mas o HEAD local e $HeadFull. Abortando para nao testar o codigo errado."
  }
  Write-Ok "Redirect confirmado: $TemplateRepoUrl -> $LocalUrl (HEAD $HeadSha)"

  # =========================================================================
  Write-Step "Criando o projeto com 'hedhog new' (ja inclui 'hedhog add core')"
  # =========================================================================
  # --verbose, nunca -v: o CLI intercepta -v como --version e encerra.
  Invoke-Native -File 'hedhog' -WorkingDirectory $SandboxRoot -What 'hedhog new' -Arguments @(
    'new', $ProjectName,
    '--dbtype', 'postgres',
    '--dbhost', $DbHost,
    '--dbport', "$DbPort",
    '--dbuser', $DbUser,
    '--dbpassword', $DbPassword,
    '--dbname', $DbName,
    '--force',
    '--verbose'
  )

  if (-not (Test-Path $ProjectPath)) {
    throw "O 'hedhog new' terminou mas o diretorio '$ProjectPath' nao existe."
  }
  Write-Ok "Projeto criado em $ProjectPath"

  # =========================================================================
  Write-Step 'Verificando o resultado do bootstrap'
  # =========================================================================
  # -Deferred: registra a falha e segue em frente, para que UMA execucao revele
  # todos os problemas em vez de parar no primeiro. O exit code continua 1.
  function Assert-Bootstrap {
    param(
      [string]$Description,
      [bool]$Condition,
      [switch]$AsWarning,
      [switch]$Deferred
    )
    if ($Condition) {
      Write-Ok $Description
    }
    elseif ($AsWarning) {
      Write-Warn $Description
      $Findings.Add("AVISO: $Description")
    }
    elseif ($Deferred) {
      Write-Fail "$Description (seguindo mesmo assim)"
      $Findings.Add("FALHA: $Description")
      $script:DeferredFailures++
    }
    else {
      Write-Fail $Description
      $Findings.Add("FALHA: $Description")
      $HardFailures.Add($Description)
    }
  }

  Assert-Bootstrap 'libraries/core foi instalada' `
    (Test-Path (Join-Path $ProjectPath 'libraries/core/package.json'))

  $HedhogJsonPath = Join-Path $ProjectPath 'hedhog.json'
  $CoreRegistered = $false
  if (Test-Path $HedhogJsonPath) {
    $HedhogJson = Get-Content $HedhogJsonPath -Raw | ConvertFrom-Json
    $CoreRegistered = @($HedhogJson.libraries) -contains 'core'
  }
  Assert-Bootstrap "hedhog.json registra a lib 'core'" $CoreRegistered

  $ApiPkgPath = Join-Path $ProjectPath 'apps/api/package.json'
  $ApiPkg = Get-Content $ApiPkgPath -Raw | ConvertFrom-Json
  $HasCoreDep = $null -ne $ApiPkg.dependencies -and
    $ApiPkg.dependencies.PSObject.Properties.Name -contains '@hed-hog/core'
  Assert-Bootstrap 'apps/api depende de @hed-hog/core' $HasCoreDep

  $MigrationsDir = Join-Path $ProjectPath 'apps/api/prisma/migrations'
  $HasMigrations = (Test-Path $MigrationsDir) -and
    ((Get-ChildItem $MigrationsDir -Directory -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)
  Assert-Bootstrap 'apps/api/prisma/migrations foi gerado pelo add core' $HasMigrations

  # O ci.yml chama este script (ci.yml:141) mas o template nao o define — quem
  # deveria injeta-lo e o `add core`. Se faltar, o CI esta quebrado.
  $HasCopyAssets = $null -ne $ApiPkg.scripts -and
    $ApiPkg.scripts.PSObject.Properties.Name -contains 'copy:core-assets'
  Assert-Bootstrap "apps/api define o script 'copy:core-assets' (exigido por ci.yml)" `
    $HasCopyAssets -Deferred

  # O CLI grava as vars em apps/api/.example (sem o prefixo .env), entao o .env
  # efetivo tende a vir do postinstall/init-env com o default do template.
  $EnvPath = Join-Path $ProjectPath 'apps/api/.env'
  if (Test-Path $EnvPath) {
    $EffectiveUrl = (Select-String -Path $EnvPath -Pattern '^DATABASE_URL=' -ErrorAction SilentlyContinue |
      Select-Object -First 1).Line
    Write-Host "        DATABASE_URL gerado: $EffectiveUrl" -ForegroundColor DarkGray
    # O CLI normaliza 127.0.0.1 para localhost, entao aceitar as duas formas.
    Assert-Bootstrap 'DATABASE_URL gerado aponta para o banco passado nas flags' `
      ($EffectiveUrl -match ":$DbPort/" -and $EffectiveUrl -match '@(localhost|127\.0\.0\.1):') -AsWarning
  }
  else {
    Assert-Bootstrap 'apps/api/.env foi criado' $false -AsWarning
  }
  if (Test-Path (Join-Path $ProjectPath 'apps/api/.example')) {
    Write-Warn 'apps/api/.example criado (bug do CLI: deveria ser .env) — reportar em hedhog/commander.'
  }

  if ($HardFailures.Count -gt 0) {
    throw "Bootstrap incompleto: $($HardFailures -join '; ')"
  }

  # =========================================================================
  Write-Step 'Normalizando o ambiente do sandbox'
  # =========================================================================
  # Deixa o .env deterministico apontando para a infra efemera, preservando os
  # segredos ja gerados. Sem isso a API tentaria falar com o postgres 5444 do
  # stack de desenvolvimento.
  $EnvMap = [ordered]@{}
  if (Test-Path $EnvPath) {
    foreach ($line in Get-Content $EnvPath) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        $EnvMap[$Matches[1]] = $Matches[2]
      }
    }
  }
  foreach ($k in @('JWT_SECRET', 'PEPPER', 'ENCRYPTION_SECRET')) {
    if (-not $EnvMap.Contains($k) -or -not $EnvMap[$k] -or $EnvMap[$k] -match '^"?generate"?$') {
      $EnvMap[$k] = New-Secret
    }
  }
  # Sem isto o -ApiPort so mudava onde o health era consultado: a API le PORT
  # do .env e cairia na 3100 fixa, colidindo com o servidor de dev de quem
  # roda o teste (EADDRINUSE, depois de bootar inteira).
  $EnvMap['PORT']                 = "$ApiPort"
  $EnvMap['DATABASE_URL']         = "postgresql://${DbUser}:${DbPassword}@${DbHost}:${DbPort}/${DbName}"
  $EnvMap['REDIS_URL']            = "redis://${DbHost}:${RedisPort}"
  $EnvMap['JWT_EXPIRES_IN']       = '7d'
  $EnvMap['CORS_ALLOWED_ORIGINS'] = 'http://localhost:3200'
  ($EnvMap.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) |
    Set-Content -Path $EnvPath -Encoding utf8
  Write-Ok "apps/api/.env normalizado (api $ApiPort, db $DbPort, redis $RedisPort)"

  # A suite E2E faz muitos logins seguidos e bateria no rate limit de /auth
  # (mesma razao do ci.yml). Nunca usar em producao.
  $env:DISABLE_RATE_LIMIT = 'true'
  $env:API_URL = "http://localhost:$ApiPort"

  # =========================================================================
  Write-Step 'Instalando dependencias e buildando libs'
  # =========================================================================
  Invoke-Native -File 'pnpm' -WorkingDirectory $ProjectPath -What 'pnpm install' `
    -Arguments @('install', '--no-frozen-lockfile')
  Invoke-Native -File 'pnpm' -WorkingDirectory $ProjectPath -What 'pnpm run build:libs' `
    -Arguments @('run', 'build:libs')
  Write-Ok 'Dependencias instaladas e libs buildadas'

  # =========================================================================
  if ($SkipUnitTests) {
    Write-Step 'Testes unitarios: PULADOS (-SkipUnitTests)'
    Write-Warn 'O gate obrigatorio do ci.yml nao foi exercitado.'
    $Findings.Add('AVISO: testes unitarios pulados (-SkipUnitTests)')
  }
  else {
    Write-Step 'Testes unitarios (gate obrigatorio do ci.yml)'
    Invoke-Native -File 'pnpm' -WorkingDirectory $ProjectPath -What 'pnpm turbo run test' `
      -Arguments @('turbo', 'run', 'test')
    Write-Ok 'Testes unitarios passaram'
  }

  # =========================================================================
  Write-Step 'Buildando a API'
  # =========================================================================
  $ApiPath = Join-Path $ProjectPath 'apps/api'
  # `nest build` direto (nao `pnpm run build`) para pular o prebuild
  # `prisma:update`, que faria `prisma db pull` — mesma razao do ci.yml.
  $env:NODE_OPTIONS = '--max-old-space-size=4096'
  Invoke-Native -File 'pnpm' -WorkingDirectory $ApiPath -What 'nest build' `
    -Arguments @('exec', 'nest', 'build')
  if ($HasCopyAssets) {
    Invoke-Native -File 'pnpm' -WorkingDirectory $ApiPath -What 'pnpm run copy:core-assets' `
      -Arguments @('run', 'copy:core-assets')
  }
  else {
    Write-Warn 'copy:core-assets nao existe — passo pulado (ja registrado como falha).'
  }
  Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
  Write-Ok 'API compilada'

  # =========================================================================
  Write-Step 'Buildando o admin'
  # =========================================================================
  # Nenhum outro gate compila o Next: o ci.yml nao builda o admin e o
  # `turbo run test` so roda vitest. Um import que nao resolve — um package do
  # hub que nunca foi vendorizado em `packages/*`, um `@/generated/*` que so
  # existe la — passa por tudo e explode na primeira pagina do projeto gerado.
  # Foi assim que `@hed-hog/next-build-skew` chegou ao usuario em 21/08/2026.
  $AdminPath = Join-Path $ProjectPath 'apps/admin'
  $env:NODE_OPTIONS = '--max-old-space-size=4096'
  Invoke-Native -File 'pnpm' -WorkingDirectory $AdminPath -What 'next build' `
    -Arguments @('run', 'build')
  Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue
  Write-Ok 'Admin compilado'

  # =========================================================================
  Write-Step 'Aplicando migrations'
  # =========================================================================
  Invoke-Native -File 'pnpm' -WorkingDirectory $ApiPath -What 'pnpm prisma:deploy' `
    -Arguments @('run', 'prisma:deploy')
  Write-Ok 'Migrations aplicadas'

  # =========================================================================
  Write-Step 'Subindo a API compilada'
  # =========================================================================
  $ApiLog    = Join-Path $SandboxRoot 'api.log'
  $ApiErrLog = Join-Path $SandboxRoot 'api.err.log'
  # Via cmd.exe: `pnpm` no PATH resolve para pnpm.ps1, que o Start-Process nao
  # consegue executar ("nao e um aplicativo Win32 valido"). O cmd resolve
  # pnpm.CMD pelo PATHEXT, e o taskkill /T abaixo derruba a arvore inteira.
  $ApiProcess = Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', 'pnpm', 'run', 'start:prod') `
    -WorkingDirectory $ApiPath `
    -RedirectStandardOutput $ApiLog -RedirectStandardError $ApiErrLog `
    -PassThru -NoNewWindow
  Write-Ok "Servidor iniciado (PID $($ApiProcess.Id)), log em $ApiLog"

  $Ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    if ($ApiProcess.HasExited) { break }
    try {
      $r = Invoke-WebRequest -Uri "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      if ($r.StatusCode -eq 200) { $Ready = $true; break }
    }
    catch { }
    Start-Sleep -Seconds 2
  }
  if (-not $Ready) {
    throw "A API nao respondeu em http://localhost:$ApiPort/health dentro de 120s."
  }
  Write-Ok 'GET /health respondeu 200'

  # =========================================================================
  Write-Step 'Semeando a instalacao (POST /install)'
  # =========================================================================
  $InstallBody = @{
    appName  = 'HedHog'
    slogan   = 'Administration Panel'
    userName = 'Root User'
    email    = 'root@hedhog.com'
    password = 'changeme'
  } | ConvertTo-Json
  try {
    Invoke-WebRequest -Uri "http://localhost:$ApiPort/install" -Method POST `
      -Body $InstallBody -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Ok 'Aplicacao instalada'
  }
  catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 409) {
      Write-Warn 'Aplicacao ja instalada (409) — seguindo.'
    }
    else {
      throw "POST /install falhou (status $status): $($_.Exception.Message)"
    }
  }

  # =========================================================================
  Write-Step 'Rodando a suite E2E da API'
  # =========================================================================
  Invoke-Native -File 'pnpm' -WorkingDirectory $ApiPath -What 'pnpm test:e2e' `
    -Arguments @('run', 'test:e2e')
  Write-Ok 'Suite E2E passou'

  Write-Host ''
  if ($script:DeferredFailures -gt 0) {
    Write-Host '=================================================' -ForegroundColor Red
    Write-Host " PIPELINE COMPLETO, MAS COM $($script:DeferredFailures) FALHA(S)" -ForegroundColor Red
    Write-Host '=================================================' -ForegroundColor Red
  }
  else {
    $Succeeded = $true
    Write-Host '=================================================' -ForegroundColor Green
    Write-Host " BOOTSTRAP OK — $Branch @ $HeadSha pronto para push" -ForegroundColor Green
    Write-Host '=================================================' -ForegroundColor Green
  }
  if ($Findings.Count -gt 0) {
    Write-Host ''
    Write-Host 'Achados:' -ForegroundColor Yellow
    $Findings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
  }
}
catch {
  Write-Host ''
  Write-Host '=================================================' -ForegroundColor Red
  Write-Host ' BOOTSTRAP FALHOU' -ForegroundColor Red
  Write-Host '=================================================' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.ScriptStackTrace) { Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray }
}
finally {
  Write-Step 'Limpeza'

  # Mata a arvore de processos da API (pnpm -> node).
  if ($ApiProcess -and -not $ApiProcess.HasExited) {
    & taskkill /PID $ApiProcess.Id /T /F 2>&1 | Out-Null
    Write-Ok 'Servidor parado'
  }

  # Logs antes de apagar o sandbox.
  if (-not $Succeeded) {
    foreach ($log in @($ApiLog, $ApiErrLog)) {
      if ($log -and (Test-Path $log) -and (Get-Item $log).Length -gt 0) {
        Write-Host ''
        Write-Host "--- ultimas 60 linhas de $(Split-Path $log -Leaf) ---" -ForegroundColor DarkGray
        Get-Content $log -Tail 60 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
      }
    }
  }

  if ($ComposeUp) {
    & docker compose -p $ComposeProject -f $ComposeFile down -v 2>&1 | Out-Null
    Write-Ok "Infra efemera removida (project '$ComposeProject')"
  }

  # O redirect era so de ambiente — some com o processo, mas limpamos explicitamente.
  foreach ($v in @('GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0',
      'DISABLE_RATE_LIMIT', 'API_URL', 'NODE_OPTIONS')) {
    Remove-Item "Env:\$v" -ErrorAction SilentlyContinue
  }

  if ($SandboxRoot -and (Test-Path $SandboxRoot)) {
    if ($KeepSandbox) {
      Write-Warn "Sandbox preservado: $SandboxRoot"
    }
    else {
      Remove-Item $SandboxRoot -Recurse -Force -ErrorAction SilentlyContinue
      Write-Ok 'Sandbox removido'
    }
  }

  # Prova de que o repositorio nao foi tocado.
  if ($RepoRoot) {
    $After = & git -C $RepoRoot status --porcelain
    if ($After -and -not $Dirty) {
      Write-Fail 'O repositorio ficou sujo apos o teste:'
      $After | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
      $Succeeded = $false
    }
    else {
      Write-Ok 'Repositorio intacto'
    }
  }

  $Elapsed = (Get-Date) - $StartedAt
  Write-Host ''
  Write-Host ("Tempo total: {0}min {1}s" -f [math]::Floor($Elapsed.TotalMinutes), $Elapsed.Seconds)

  if ($Succeeded) { exit 0 } else { exit 1 }
}
