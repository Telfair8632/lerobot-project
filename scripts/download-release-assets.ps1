# Download the large Release assets of this repository and restore them to their paths (PowerShell).
param([string]$Repo = "")

$ErrorActionPreference = "Stop"

if (-not $Repo) {
    $url = git remote get-url origin 2>$null
    if ($url) { $Repo = ($url -replace '.*github.com[:/]','' -replace '\.git$','') }
}
if (-not $Repo) {
    Write-Error "Usage: powershell -File scripts/download-release-assets.ps1 -Repo <owner/repo>"
    exit 1
}

function Fetch([string]$Asset, [string]$Dest) {
    Write-Host "==> $Asset -> $Dest"
    $dir = Split-Path $Dest -Parent
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    gh release download assets-v1 --repo $Repo --Pattern $Asset --output $Dest
}

Fetch "checkpoint-050000-pretrained-model.safetensors" "checkpoints/050000/pretrained_model/model.safetensors"
Fetch "checkpoint-050000-optimizer-state.safetensors"  "checkpoints/050000/training_state/optimizer_state.safetensors"
Fetch "checkpoint-050000-clean-model.safetensors"      "checkpoints/050000_clean/model.safetensors"

$tmp = New-TemporaryFile
Fetch "dataset-rgb-pick-place-v1.zip" $tmp
Write-Host "==> Unpacking the dataset into data/rgb_pick_place_v1"
New-Item -ItemType Directory -Force -Path data | Out-Null
Expand-Archive -Path $tmp -DestinationPath data -Force
Remove-Item $tmp

Write-Host "Done."
