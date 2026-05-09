# Sequence - Z-Image (Ostris) prep from 4_Research: export flat images + .txt sidecars (PowerShell)
# Does not clone ai-toolkit or run run.py - that stays in your ai-work/ai-toolkit clone.
#
#   cd ...\Sequence
#   .\zimage-research.ps1
#   (or: cd ...\Sequence\ml  then  .\zimage-research.ps1)
#   .\zimage-research.ps1 -FolderKey 36_Motherlode
#   .\zimage-research.ps1 -List
#   .\zimage-research.ps1 -ExportFullTree
#
# Output: %USERPROFILE%\ai-work\zimage_from_research\images\<folder>  (or ...\full_tree_export for -ExportFullTree)

[CmdletBinding()]
param(
    [string] $FolderKey,
    [string] $CaptionText,
    [switch] $List,
    [switch] $SkipCaptions,
    [switch] $ExportFullTree
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ImagesRoot = Join-Path $env:USERPROFILE 'ai-work\zimage_from_research\images'

function Get-ResearchSubfolders {
    $root = Join-Path $RepoRoot 'public\4_Research'
    if (-not (Test-Path -LiteralPath $root -PathType Container)) {
        return @()
    }
    Get-ChildItem -LiteralPath $root -Directory | Sort-Object { $_.Name } | ForEach-Object { $_.Name }
}

function Read-ZimageFolderInteractive {
    $names = @(Get-ResearchSubfolders)
    if ($names.Count -eq 0) {
        Write-Host "No folders under public\4_Research" -ForegroundColor Red
        return $null
    }
    Write-Host ""
    Write-Host "4_Research folders (pick one for Z-Image export)" -ForegroundColor Cyan
    Write-Host "The number is the row in this list, not the folder prefix (4 is the 4th row, not 4_Mannerist). Type the full name to be sure, e.g. 4_Mannerist" -ForegroundColor DarkGray
    Write-Host ""
    for ($i = 0; $i -lt $names.Count; $i++) {
        Write-Host ("  {0,3}  {1}" -f ($i + 1), $names[$i])
    }
    Write-Host ""
    $in = Read-Host "Number [1-$($names.Count)] or exact folder name"
    if ($null -eq $in) { return $null }
    $in = $in.Trim()
    if ($in -eq "") { return $null }
    if ($in -match '^\d+$') {
        $idx = [int]$in
        if ($idx -ge 1 -and $idx -le $names.Count) { return $names[$idx - 1] }
        Write-Host "Out of range." -ForegroundColor Red
        return $null
    }
    if ($names -contains $in) { return $in }
    Write-Host "Unknown folder. Use -List." -ForegroundColor Red
    return $null
}

function Test-Python {
    try {
        $null = & python --version 2>&1
        if ($LASTEXITCODE -ne 0) { return $false }
        return $true
    } catch {
        return $false
    }
}

function Write-ZimageNextSteps {
    param([string] $DatasetDir)
    Write-Host ""
    Write-Host "Done. Dataset folder:" -ForegroundColor Green
    Write-Host "  $DatasetDir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Ostris config (no YAML pasting) from Sequence repo:" -ForegroundColor Yellow
    Write-Host "  cd (path to Sequence root)" -ForegroundColor Gray
    Write-Host "  .\ostris-dataset-config.ps1 -ListTemplates" -ForegroundColor Gray
    Write-Host '  .\ostris-dataset-config.ps1 -FolderKey YOUR_FOLDER -TemplateFile FILE_FROM_LIST.yaml -Run' -ForegroundColor Gray
    Write-Host "Or: .\ostris-dataset-config.ps1 -Run   to repeat last config." -ForegroundColor DarkGray
}

if (-not (Test-Python)) {
    Write-Error "python not on PATH. Install Python and try again (or use full path to python.exe)."
}

if ($List) {
    Get-ResearchSubfolders
    exit 0
}

Set-Location $RepoRoot

if ($ExportFullTree) {
    $dst = Join-Path $ImagesRoot 'full_tree_export'
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Write-Host "Export full 4_Research tree to: $dst" -ForegroundColor Cyan
    & python (Join-Path $RepoRoot 'ml\collect_instance_images.py') `
        --src (Join-Path $RepoRoot 'public\4_Research') `
        --dst $dst
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if (-not $SkipCaptions) {
        $cap = if ($CaptionText) { $CaptionText } else { 'a sksseq research photograph, detailed' }
        & python (Join-Path $RepoRoot 'ml\zimage_sidecar_captions.py') --dir $dst --text $cap
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    Write-ZimageNextSteps -DatasetDir $dst
    exit 0
}

if ([string]::IsNullOrWhiteSpace($FolderKey)) {
    $FolderKey = Read-ZimageFolderInteractive
    if ([string]::IsNullOrWhiteSpace($FolderKey)) { exit 1 }
}

$srcPath = Join-Path $RepoRoot "public\4_Research\$FolderKey"
if (-not (Test-Path -LiteralPath $srcPath -PathType Container)) {
    Write-Error "Folder not found: $srcPath"
}

$dst = Join-Path $ImagesRoot $FolderKey
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Write-Host "Export: $srcPath" -ForegroundColor Cyan
Write-Host "   ->  $dst" -ForegroundColor Cyan
& python (Join-Path $RepoRoot 'ml\collect_instance_images.py') --src $srcPath --dst $dst
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $SkipCaptions) {
    $cap = $CaptionText
    if (-not $cap) {
        $cap = "a sksseq research photograph, detailed, research folder $FolderKey"
    }
    & python (Join-Path $RepoRoot 'ml\zimage_sidecar_captions.py') --dir $dst --text $cap
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-ZimageNextSteps -DatasetDir $dst
