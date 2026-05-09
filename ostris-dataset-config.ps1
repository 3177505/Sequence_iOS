# Runs ml\ostris-dataset-config.ps1 — use from repo root (Sequence\) or from ml\.
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
& (Join-Path $PSScriptRoot 'ml\ostris-dataset-config.ps1') @PSBoundParameters
