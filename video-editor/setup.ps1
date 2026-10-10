# Set up the vertical-drama editor on a new Windows machine.
# Usage:  powershell -ExecutionPolicy Bypass -File video-editor\setup.ps1
# Downloads: ffmpeg (winget, ~200 MB if missing), pip packages (faster-whisper, numpy), and on first transcribe the
# Whisper "small" model (~460 MB). HyperFrames (npm, pinned 0.8.143) is fetched by npx on first render.
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }
Refresh-Path

Write-Host "== ffmpeg"
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    Refresh-Path
}
ffmpeg -version | Select-Object -First 1

Write-Host "== node (need 22+)"
$nodeVer = (& node --version) 2>$null
if (-not $nodeVer) { Write-Warning "Node.js missing: winget install OpenJS.NodeJS.LTS"; exit 1 }
Write-Host $nodeVer
if ([int]($nodeVer.TrimStart('v').Split('.')[0]) -lt 22) { Write-Warning "Node 22+ required for HyperFrames"; exit 1 }

Write-Host "== chrome (HyperFrames uses the system Chrome)"
if (-not (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe")) { Write-Warning "Chrome not found in the default location; run 'npx hyperframes@0.8.143 doctor' after setup" }

Write-Host "== python venv"
if (-not (Test-Path ".venv")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -q --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -q faster-whisper numpy
& .\.venv\Scripts\python.exe -I -c "import faster_whisper, numpy; print('faster-whisper', faster_whisper.__version__)"

Write-Host "== Thai fonts (Microsoft Leelawadee UI, copied from this machine, not committed)"
New-Item -ItemType Directory -Force graphics\fonts | Out-Null
foreach ($f in "LeelawUI.ttf","LeelaUIb.ttf") {
    if (-not (Test-Path "C:\Windows\Fonts\$f")) { Write-Warning "$f not found in C:\Windows\Fonts"; exit 1 }
    Copy-Item "C:\Windows\Fonts\$f" graphics\fonts\ -Force
}

Write-Host "== hyperframes doctor"
Set-Location graphics
npx --yes hyperframes@0.8.143 telemetry disable | Out-Null
npx --yes hyperframes@0.8.143 doctor
Write-Host "Setup done. Next: read HANDOFF.md section 3, then run drama_edit.py on an episode folder."
