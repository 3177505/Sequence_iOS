# Runs ml\research-folder-training.ps1 — use from repo root (Sequence\) or from ml\.
[CmdletBinding()]
param(
    [string] $FolderKey,
    [int] $MaxTrainSteps = 2000,
    [int] $GenCount = 8,
    [int] $LoraRank = 16,
    [int] $TrainBatch = 1,
    [int] $Resolution = 512,
    [string] $LearningRate = '1e-4',
    [ValidateSet('sd15', 'sdxl')]
    [string] $Base = 'sdxl',
    [int] $GenSteps = 0,
    [double] $GenGuidance = 0,
    [string] $GenNegative = 'blurry, low quality, worst quality, jpeg artifacts, deformed, bad anatomy, duplicate, watermark, text, extra fingers',
    [switch] $SkipGenerate,
    [switch] $List,
    [switch] $TrainSequential
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'ml\research-folder-training.ps1') @PSBoundParameters
