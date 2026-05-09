# Writes Ostris ai-toolkit config\sequence_ostris.yml with your dataset path — no manual YAML pasting.
# Requires: git clone of https://github.com/ostris/ai-toolkit into $AiToolkitRoot (default below).
#
#   cd ...\Sequence
#   .\ostris-dataset-config.ps1 -FolderKey 12_Scapegoat
#   .\ostris-dataset-config.ps1 -FolderKey 36_Motherlode -TemplateFile train_lora_flex2_24gb_no_controls.yaml
#   .\ostris-dataset-config.ps1 -Run
#
# Default template is bundled under ml/ostris-templates/ (Flex2 without auto controls — no onnx/dwpose).
# Other templates: ai-toolkit\config\examples\. Use -ListTemplates for that folder.

[CmdletBinding()]
param(
    [string] $FolderKey,
    [string] $DatasetPath,
    [string] $AiToolkitRoot = (Join-Path $env:USERPROFILE 'ai-work\ai-toolkit'),
    [string] $TemplateFile = 'train_lora_flex2_24gb_no_controls.yaml',
    [string] $OutName = 'sequence_ostris.yml',
    [switch] $ListTemplates,
    [switch] $Run
)

$ErrorActionPreference = 'Stop'
$ZimageImagesRoot = Join-Path $env:USERPROFILE 'ai-work\zimage_from_research\images'
$BundledTemplates = Join-Path $PSScriptRoot 'ostris-templates'

if ($ListTemplates) {
    $ex = Join-Path $AiToolkitRoot 'config\examples'
    if (-not (Test-Path -LiteralPath $ex -PathType Container)) {
        Write-Error "Not found: $ex  (clone ai-toolkit first)"
    }
    Write-Host "ai-toolkit config\examples:" -ForegroundColor Cyan
    Get-ChildItem -LiteralPath $ex -Filter '*.yml' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
    Get-ChildItem -LiteralPath $ex -Filter '*.yaml' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
    if (Test-Path -LiteralPath $BundledTemplates -PathType Container) {
        Write-Host ""
        Write-Host "Sequence ml\ostris-templates (use as -TemplateFile name):" -ForegroundColor Cyan
        Get-ChildItem -LiteralPath $BundledTemplates -Filter '*.yaml' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
        Get-ChildItem -LiteralPath $BundledTemplates -Filter '*.yml' -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }
    }
    exit 0
}

$outPath = Join-Path $AiToolkitRoot "config\$OutName"

if (-not (Test-Path -LiteralPath $AiToolkitRoot -PathType Container)) {
    $hint = "cd (Join-Path `$env:USERPROFILE 'ai-work'); git clone https://github.com/ostris/ai-toolkit.git"
    Write-Error ('Ostris not found: {0}. Git clone: {1}' -f $AiToolkitRoot, $hint)
}

if ($Run -and -not $FolderKey -and -not $DatasetPath) {
    if (-not (Test-Path -LiteralPath $outPath -PathType Leaf)) {
        Write-Error ('No config yet: {0}. Run this script first without -Run, with -FolderKey or -DatasetPath.' -f $outPath)
    }
    $py = Join-Path $AiToolkitRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $py -PathType Leaf)) {
        Write-Error (('Python not found: {0} — create venv in ai-toolkit first (zimage-toolkit page).' -f $py))
    }
    Push-Location $AiToolkitRoot
    try {
        & $py (Join-Path $AiToolkitRoot 'run.py') $outPath
        exit $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

$templatePath = $null
if ([System.IO.Path]::IsPathRooted($TemplateFile) -and (Test-Path -LiteralPath $TemplateFile -PathType Leaf)) {
    $templatePath = $TemplateFile
} else {
    $bundledTry = Join-Path $BundledTemplates $TemplateFile
    if (Test-Path -LiteralPath $bundledTry -PathType Leaf) {
        $templatePath = $bundledTry
    } else {
        $templatePath = Join-Path $AiToolkitRoot "config\examples\$TemplateFile"
    }
}
if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
    Write-Error (('Template not found: {0}. Use -ListTemplates, bundled name from ml\ostris-templates, or full path.' -f $templatePath))
}

if ($DatasetPath) {
    $ds = $DatasetPath
} elseif ($FolderKey) {
    $ds = Join-Path $ZimageImagesRoot $FolderKey
} else {
    Write-Error 'Provide -FolderKey (e.g. 12_Scapegoat) or -DatasetPath to an image folder, or -Run alone to re-run the last written config.'
}

if (-not (Test-Path -LiteralPath $ds -PathType Container)) {
    Write-Error (('Dataset folder does not exist: {0}. Run zimage-research.ps1 for that folder first, or change -DatasetPath.' -f $ds))
}

$dsUnix = ($ds -replace '\\', '/')
Copy-Item -LiteralPath $templatePath -Destination $outPath -Force
$lines = [System.Collections.ArrayList]@()
$replaced = $false
$rx = '^\s*-\s*folder_path:\s*'
Get-Content -LiteralPath $outPath -Encoding UTF8 | ForEach-Object {
    $line = $_
    if (-not $replaced -and $line -match $rx) {
        [void]$lines.Add(('{0}{1}{2}{1}' -f $Matches[0], [char]34, $dsUnix))
        $replaced = $true
    } else {
        [void]$lines.Add($line)
    }
}
if (-not $replaced) {
    Write-Warning "No 'folder_path:' line found; first 80 lines of template follow."
    Get-Content -LiteralPath $templatePath -TotalCount 80
    throw 'Refusing to continue: use another -TemplateFile (use -ListTemplates to pick one).'
}
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($outPath, [string[]]$lines.ToArray(), $utf8NoBom)
Write-Host "Wrote: $outPath" -ForegroundColor Green
Write-Host "  (first) folder_path -> $dsUnix" -ForegroundColor Gray

if (-not $Run) {
    Write-Host ""
    Write-Host "Run training (after venv in ai-toolkit):" -ForegroundColor Yellow
    Write-Host "  cd `"$AiToolkitRoot`"" -ForegroundColor Gray
    Write-Host "  .\.venv\Scripts\Activate.ps1" -ForegroundColor Gray
    Write-Host "  python run.py config\$OutName" -ForegroundColor Gray
    Write-Host "Or:  .\ostris-dataset-config.ps1 -Run" -ForegroundColor DarkGray
    exit 0
}

$py = Join-Path $AiToolkitRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $py -PathType Leaf)) {
    Write-Error (('Python not found: {0} — create venv in ai-toolkit first (zimage-toolkit page).' -f $py))
}
Push-Location $AiToolkitRoot
try {
    & $py (Join-Path $AiToolkitRoot 'run.py') $outPath
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
