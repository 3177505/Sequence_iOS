# Runs ml\zimage-research.ps1 — use from repo root (Sequence\) or from ml\.
[CmdletBinding()]
param(
    [string] $FolderKey,
    [string] $CaptionText,
    [switch] $List,
    [switch] $SkipCaptions,
    [switch] $ExportFullTree
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'ml\zimage-research.ps1') @PSBoundParameters
