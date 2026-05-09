# Sequence - per-folder LoRA: train + generate (PowerShell)
# Repo root = parent of this script's folder (ml/).
#
# From repo root (Sequence\) or ml\:
#   .\research-folder-training.ps1 -FolderKey 36_Motherlode
#   .\research-folder-training.ps1
#
# Defaults target quality: SDXL 1024, 2000 steps, rank 16. Low VRAM / fast: -Base sd15 -MaxTrainSteps 800 -Resolution 512
# -SkipGenerate  |  -GenCount 8  (tune -MaxTrainSteps, -LoraRank, -Resolution if OOM)
# Train every folder that has images, one after another (not parallel):
#   .\research-folder-training.ps1 -TrainSequential
#
# List folder keys only (no menu):
#   .\research-folder-training.ps1 -List
# Interactive menu: run without -FolderKey (not with -List). Pick number or folder name; same as env+launch_train.
#   .\research-folder-training.ps1
#   .\research-folder-training.ps1 -Base sdxl
# -Base does not disable the menu; only -FolderKey or -List / -TrainSequential skip it.

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
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$trainRes = $Resolution
if ($Base -eq 'sdxl' -and -not $PSBoundParameters.ContainsKey('Resolution')) {
    $trainRes = 1024
}

if ($GenSteps -le 0) {
    if ($Base -eq 'sdxl') { $GenSteps = 32 } else { $GenSteps = 28 }
}
if ($GenGuidance -le 0) {
    if ($Base -eq 'sdxl') { $GenGuidance = 7.0 } else { $GenGuidance = 7.5 }
}

$Prompts = @{
    '1_Cyclical'                    = @{ I = 'a sksseq photograph, cyclical time versus linear progress, ritual return, seasonal feed, pinball loop without catharsis'; G = 'a sksseq photograph, calendar masquerade, repeated return, folk laughter and the feed as cycle' }
    '2_Grotta'                      = @{ I = 'a sksseq photograph, grotto and cave frame, URL world versus IRL, dark mode depths, mannered digital grotesque'; G = 'a sksseq photograph, underground chamber, screen-glow grotto, escape from the white cube' }
    '3_Carnivalesque'               = @{ I = 'a sksseq photograph, temporary inversion of order, carnival king and fool, Bakhtinian laughter, memes and sanctioned chaos'; G = 'a sksseq photograph, feast of misrule, crowning the jester, stream and square as carnival square' }
    '4_Mannerist'                   = @{ I = 'a sksseq photograph, mannerist anxiety of form, stretched proportions, stylized unease, filter and style-transfer excess'; G = 'a sksseq photograph, courtly gesture gone wrong, hyperdetail, elegant distortion' }
    '5_AITendencies'                = @{ I = 'a sksseq photograph, generative AI look, synthetic texture, latent interpolation, machine-authored surface'; G = 'a sksseq photograph, diffusion artifact, stylized AI sheen, prompt-culture imagery' }
    '6_NeuralDecay'                 = @{ I = 'a sksseq photograph, neural decay and glitch aesthetic, compression as signature, beautiful error in the latent'; G = 'a sksseq photograph, degraded signal, GAN tear, noise as expression' }
    '7_assemblage'                  = @{ I = 'a sksseq photograph, assemblage box, Cornell-like fragments, rough matter and quiet nostalgia, collage from scraps'; G = 'a sksseq photograph, shadow box, torn paper and object heap, archival dust' }
    '8_ Abjection'                  = @{ I = 'a sksseq photograph, abject object, moral stain on things, grotesque prop, deodand and cursed residue'; G = 'a sksseq photograph, unclean object, horror of the thing, evidence-table aesthetic' }
    '9_Return'                      = @{ I = 'a sksseq photograph, return and salvation narrative, tech eschatology, great-again myth, performative rescue ritual'; G = 'a sksseq photograph, golden age poster, saviour branding, national or tech redemption arc' }
    '10_Absurd'                     = @{ I = 'a sksseq photograph, theatre of the absurd, grotesque body, gallery institutional frame, uncanny performance'; G = 'a sksseq photograph, useless body, comic horror, Stelarc-adjacent gesture' }
    '11_Trolling'                   = @{ I = 'a sksseq photograph, trolling and meme war, anonymous edge, raid culture, provocation from the margin'; G = 'a sksseq photograph, shitpost energy, chat-log chaos, flame and irony' }
    '12_Scapegoat'                  = @{ I = 'a sksseq photograph, scapegoat and transferred blame, cancel ritual, deodand substitute, public guilt object'; G = 'a sksseq photograph, public pillory, figure of fault, mob and emblem' }
    '13_Lunapark'                   = @{ I = 'a sksseq photograph, lunapark and fairground mirror, social body in rides, funhouse optics'; G = 'a sksseq photograph, ferris and neon, crowd in the fun mirror, IP-park sheen' }
    '14_Carneval_PrevraceniRadu'   = @{ I = 'a sksseq photograph, carnival rule-breaking, misrule from inside the game, historical feast of fools energy'; G = 'a sksseq photograph, mask and reversal, ordered chaos, hacktivist grey zone' }
    '15_CarnivalOfCrisis'         = @{ I = 'a sksseq photograph, crisis carnival, laughter and horror at once, protest costume, hybrid display'; G = 'a sksseq photograph, street carnival under emergency, gas mask and glitter' }
    '16_PaedomorphicAlterations'  = @{ I = 'a sksseq photograph, paedomorphic face, neoteny filters, kawaii and juvenile traits on adults'; G = 'a sksseq photograph, baby-face ad smoothness, filter youth, uncanny child-adult' }
    '17_Manosphere'                 = @{ I = 'a sksseq photograph, manosphere and online male subculture imagery, forum aesthetics, red-pill layout clichés (critical distancing)'; G = 'a sksseq photograph, gym-bro and chart meme pasteboard, platform toxicity satire' }
    '18_Sabotage'                   = @{ I = 'a sksseq photograph, sabotage and quiet quit, industrial accident aesthetic, loop and withheld labour'; G = 'a sksseq photograph, wrench in the machine, office resistance, glitched clocking-in' }
    '19_Doadland'                   = @{ I = 'a sksseq photograph, deodand law, object seized for causing death, cursed evidence, property of the state'; G = 'a sksseq photograph, condemned object on stand, legal relic, seized engine' }
    '20_adulteration'               = @{ I = 'a sksseq photograph, adulteration and counterfeit substance, impure mix, product fakery, truth under the label'; G = 'a sksseq photograph, cut drugs and stretched truth, deepfake product shot' }
    '21_ModernJester'               = @{ I = 'a sksseq photograph, modern jester, stand-up and stream satire, court fool in feed form, grotesque hierarchy scramble'; G = 'a sksseq photograph, mic and crown swap, jester planet energy, licensed mockery' }
    '22_LowResolution'              = @{ I = 'a sksseq photograph, poor image, Hito Steyerl low-res spread, VHS and meme compression, dignity of the bad file'; G = 'a sksseq photograph, blocky recompress, third-generation jpg, pirate aesthetic' }
    '23_MacroMicro'                 = @{ I = 'a sksseq photograph, macro versus micro of same material, erode and dilate, pixel ecology, scale clash'; G = 'a sksseq photograph, brick wall extreme close and satellite far, Erode Dilate energy' }
    '24_LaughingStock'              = @{ I = 'a sksseq photograph, laughing stock, public humiliation as entertainment, reaction economy, Fassbinder exploitable feeling'; G = 'a sksseq photograph, stock public shame, cringe format, stage ridicule' }
    '25_Depese'                     = @{ I = 'a sksseq photograph, deposed ruler narrative, status strip, exiled figure, deplatforming as dethronement'; G = 'a sksseq photograph, fallen crown, press conference collapse, outcast at the gate' }
    '26_Lolcow'                     = @{ I = 'a sksseq photograph, lolcow and spectacle farm, audience milking conflict, parasocial arena'; G = 'a sksseq photograph, streamer car crash, chat as barn, public freak show' }
    '27_PhotogrammetryRig'         = @{ I = 'a sksseq photograph, photogrammetry rig, body as scan data, indexical truth machine, cold forensic mesh'; G = 'a sksseq photograph, cross-lit turntable, grey balls and calibration, medical gaze' }
    '28_MoralBankruptcy'           = @{ I = 'a sksseq photograph, moral bankruptcy, everyday fascism in family and office, Fassbinder bourgeois rot'; G = 'a sksseq photograph, respectability mask cracked, family dinner guignol' }
    '29_BakhtinianInversion'       = @{ I = 'a sksseq photograph, Bakhtinian inversion, licensed reversal, body versus official speech, dialogic chaos'; G = 'a sksseq photograph, fat Tuesday logic, parody of the court, licensed grotesque' }
    '30_SlotMachine'                = @{ I = 'a sksseq photograph, slot machine and variable reward, feed as casino skin, no catharsis only spin'; G = 'a sksseq photograph, loot box chrome, one more scroll, sweet spot light' }
    '31_Staccato'                   = @{ I = 'a sksseq photograph, staccato rhythm, abrupt cut, jagged time, short sharp visual beats'; G = 'a sksseq photograph, staccato edit, sudden silence then hit, choppy feed' }
    '32_StimmingToys'               = @{ I = 'a sksseq photograph, stimming toys, fidget surface, repetitive comfort object, neurodivergent play aesthetic'; G = 'a sksseq photograph, pop-it and spinner macro, hand-held loop' }
    '33_Toys'                       = @{ I = 'a sksseq photograph, toys and play matter, bright plastic, childhood signifiers twisted'; G = 'a sksseq photograph, toybox spill, action figure diorama' }
    '34_WheelOfFortune'             = @{ I = 'a sksseq photograph, wheel of fortune, game show fate, spin and segment, luck edited as narrative'; G = 'a sksseq photograph, big wheel on stage, contestant under lights' }
    '35_KuleshovEffect'            = @{ I = 'a sksseq photograph, Kuleshov effect, meaning from juxtaposition, edit creates emotion, film strip collision'; G = 'a sksseq photograph, soup bowl and coffin in sequence, Soviet montage test' }
    '36_Motherlode'                 = @{ I = 'a sksseq photograph, The Sims 4 screenshot, game UI, live mode, Simoleons money counter, green plumbob, motherlode cheat joke, in-game phone or build-buy HUD, maxis match humor'; G = 'a sksseq photograph, Sims 4 UI, simoleons bar, plumbob, typing motherlode in cheat bar, bright casual simulation game screencap' }
    '37_VibeSlotMachines'          = @{ I = 'a sksseq photograph, vibe coding and slot machine metaphor, luck surface, build versus gamble tension'; G = 'a sksseq photograph, code slot machine, developer roulette, terminal chrome' }
}

function Get-LoraSlug {
    param([string] $Key)
    $s = $Key -creplace '[^a-zA-Z0-9]+', '-'
    $s = $s.Trim('-').ToLowerInvariant()
    if ($s.Length -gt 40) { $s = $s.Substring(0, 40) }
    return "lora-$s"
}

if ($List) {
    $Prompts.Keys | Sort-Object | ForEach-Object { $_ }
    exit 0
}

function Test-FolderHasImages {
    param([string] $Dir)
    if (-not (Test-Path -LiteralPath $Dir -PathType Container)) { return $false }
    $ext = @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif')
    (Get-ChildItem -LiteralPath $Dir -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $ext -contains $_.Extension.ToLowerInvariant() }) | Select-Object -First 1
}

function Read-FolderKeyInteractive {
    $keys = [string[]](@($Prompts.Keys) | Sort-Object)
    Write-Host ""
    Write-Host '4_Research - pick a folder.  * = has images.  (no *) = no image files found yet.' -ForegroundColor Cyan
    Write-Host "Number = row in this list, not the folder name prefix. For 4_Mannerist type 4_Mannerist or the matching row number." -ForegroundColor DarkGray
    Write-Host ""
    for ($i = 0; $i -lt $keys.Count; $i++) {
        $k = $keys[$i]
        $num = $i + 1
        $dir = Join-Path $RepoRoot "public\4_Research\$k"
        $tag = if (Test-FolderHasImages -Dir $dir) { " *" } else { "   (no images yet)" }
        Write-Host ("  {0,3}  {1}{2}" -f $num, $k, $tag)
    }
    Write-Host ""
    $n = $keys.Count
    $prompt = "Number [1-$n] or exact key, e.g. 36_Motherlode"
    $in = Read-Host $prompt
    if ($null -eq $in) { return $null }
    $in = $in.Trim()
    if ($in -eq "") { return $null }
    if ($in -match '^\d+$') {
        $idx = [int]$in
        if ($idx -ge 1 -and $idx -le $keys.Count) { return $keys[$idx - 1] }
        Write-Host "Out of range." -ForegroundColor Red
        return $null
    }
    if ($Prompts.ContainsKey($in)) { return $in }
    Write-Host "Unknown key. Use -List to see names." -ForegroundColor Red
    return $null
}

if ($TrainSequential) {
    $ok = 0
    $skip = 0
    foreach ($k in ($Prompts.Keys | Sort-Object)) {
        $dir = Join-Path $RepoRoot "public\4_Research\$k"
        if (-not (Test-FolderHasImages -Dir $dir)) {
            Write-Host "skip (no images): $k" -ForegroundColor DarkGray
            $skip++
            continue
        }
        Write-Host "`n==== Sequential: $k ====" -ForegroundColor Magenta
        & $PSCommandPath -FolderKey $k -Base $Base -MaxTrainSteps $MaxTrainSteps -GenCount $GenCount -LoraRank $LoraRank -TrainBatch $TrainBatch -Resolution $trainRes -LearningRate $LearningRate -GenSteps $GenSteps -GenGuidance $GenGuidance -GenNegative $GenNegative -SkipGenerate:$SkipGenerate
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        $ok++
    }
    Write-Host "`nDone sequential: trained $ok folder(s), skipped $skip (empty)." -ForegroundColor Green
    exit 0
}

if (-not $List -and -not $TrainSequential -and [string]::IsNullOrWhiteSpace($FolderKey)) {
    $FolderKey = Read-FolderKeyInteractive
    if ([string]::IsNullOrWhiteSpace($FolderKey)) { exit 1 }
}

if (-not $Prompts.ContainsKey($FolderKey)) {
    Write-Error "Unknown folder key: $FolderKey. Use -List for valid keys."
}

$p = $Prompts[$FolderKey]
$loraDirName = Get-LoraSlug -Key $FolderKey
$srcPath = Join-Path $RepoRoot "public\4_Research\$FolderKey"
if (-not (Test-Path -LiteralPath $srcPath -PathType Container)) {
    Write-Error "Folder not found: $srcPath  (add images under public/4_Research/$FolderKey)"
}

$loraOut = "ml\outputs\$loraDirName"
$genRel = Join-Path "outputs" "gen-$loraDirName"

Set-Location $RepoRoot

$env:SEQUENCE_COLLECT_SRC = "public\4_Research\$FolderKey"
$env:SEQUENCE_REBUILD_FLAT = "1"
$env:INSTANCE_PROMPT = $p.I
$env:SEQUENCE_LORA_OUT = $loraOut
$env:MAX_TRAIN_STEPS = "$MaxTrainSteps"
$env:SEQUENCE_LORA_RANK = "$LoraRank"
$env:SEQUENCE_TRAIN_BATCH = "$TrainBatch"
$env:SEQUENCE_RESOLUTION = "$trainRes"
$env:SEQUENCE_LEARNING_RATE = $LearningRate
$env:SEQUENCE_BASE_MODEL = $Base
$env:RESUME = ""

Write-Host "Training: $FolderKey  (base=$Base, resolution=$trainRes)" -ForegroundColor Cyan
Write-Host "  SRC= $($env:SEQUENCE_COLLECT_SRC)" -ForegroundColor DarkGray
Write-Host "  OUT= $($env:SEQUENCE_LORA_OUT)" -ForegroundColor DarkGray
& (Join-Path $RepoRoot 'ml\launch_train.bat')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($SkipGenerate) { exit 0 }

$mlPython = Join-Path $RepoRoot 'ml\.venv\Scripts\python.exe'
$genPy = Join-Path $RepoRoot 'ml\generate.py'
$loraPath = Join-Path $RepoRoot "ml\outputs\$loraDirName"
$outPath = Join-Path $RepoRoot $genRel
Write-Host "Generate: $genRel" -ForegroundColor Cyan
$ga = @(
    '--base', $Base, '--lora', $loraPath, '--prompt', $p.G, '--out-dir', $outPath, '--count', "$GenCount",
    '--steps', "$GenSteps", '--guidance', "$GenGuidance"
)
if ($null -ne $GenNegative -and $GenNegative -ne '') { $ga += @('--negative', $GenNegative) }
& $mlPython $genPy @ga
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done. LoRA: ml\outputs\$loraDirName  |  images: $genRel"  -ForegroundColor Green
