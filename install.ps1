# ElevenVoice installer for Windows.
# Downloads the app, installs what it needs (Git, Bun, uv, Python packages) and starts it.
#
#   irm https://raw.githubusercontent.com/Hylanderry/ElevenVoice/main/install.ps1 | iex
#
# Install somewhere else:  $env:ELEVENVOICE_DIR = 'D:\Apps\ElevenVoice'; irm ... | iex
# Install without starting: $env:ELEVENVOICE_NO_START = '1'; irm ... | iex

$ErrorActionPreference = 'Stop'
$Repo = 'https://github.com/Hylanderry/ElevenVoice.git'
$Dir = if ($env:ELEVENVOICE_DIR) { $env:ELEVENVOICE_DIR } else { Join-Path $HOME 'ElevenVoice' }

function Have([string]$Command) { [bool](Get-Command $Command -ErrorAction SilentlyContinue) }
function Step([string]$Text) { Write-Host "`n==> $Text" -ForegroundColor Yellow }
function Run([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
}
function Refresh-Path {
    $env:Path = @(
        [Environment]::GetEnvironmentVariable('Path', 'Machine'),
        [Environment]::GetEnvironmentVariable('Path', 'User'),
        (Join-Path $HOME '.bun\bin'),
        (Join-Path $HOME '.local\bin')
    ) -join ';'
}

Step 'Checking tools'
if (-not (Have git)) {
    if (-not (Have winget)) { throw 'Git is missing. Install it from https://git-scm.com/download/win and run this again.' }
    Write-Host 'Installing Git...'
    Run winget @('install', '--id', 'Git.Git', '-e', '--source', 'winget', '--accept-package-agreements', '--accept-source-agreements')
    Refresh-Path
}
if (-not (Have bun)) {
    Write-Host 'Installing Bun (JavaScript runtime)...'
    Invoke-RestMethod https://bun.sh/install.ps1 | Invoke-Expression
    Refresh-Path
}
if (-not (Have uv)) {
    Write-Host 'Installing uv (Python manager)...'
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    Refresh-Path
}
foreach ($tool in 'git', 'bun', 'uv') {
    if (-not (Have $tool)) { throw "$tool is still not available. Open a new PowerShell window and run this again." }
}

Step "Downloading ElevenVoice to $Dir"
if (Test-Path (Join-Path $Dir '.git')) {
    Run git @('-C', $Dir, 'pull', '--ff-only')
} else {
    Run git @('clone', '--depth', '1', $Repo, $Dir)
}
Set-Location $Dir

Step 'Installing app dependencies'
Run bun @('install')

Step 'Installing the voice engine (Python, PyTorch; detects your GPU automatically)'
Run bun @('run', 'setup:api')

Write-Host "`nElevenVoice is installed in $Dir" -ForegroundColor Green
Write-Host "Start it later with:  cd `"$Dir`"; bun run desktop"
if ($env:ELEVENVOICE_NO_START -ne '1') {
    Step 'Starting ElevenVoice'
    Run bun @('run', 'desktop')
}
