# Probe matrix for https://github.com/marktext/marktext/issues/5119
# `marktext file.md` -> "Invalid file descriptor to ICU data received."
#
# The ICU failure happens inside Chromium startup, long before any MarkText JS
# runs, so `--version` (handled in src/main/cli/index.ts) is a GUI-free probe:
#   prints "MarkText: x.y.z" -> Chromium started fine
#   dies with the ICU log    -> reproduced
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$VER = '0.19.1'
$ROOT = 'C:\r5119'
$SHIMS = "$ROOT\shims"
New-Item -ItemType Directory -Force -Path $ROOT, $SHIMS | Out-Null

$script:results = @()

function Probe {
  param([string]$Label, [string]$Exe)
  Write-Host "::group::probe $Label"
  Write-Host "exe : $Exe"
  if (-not (Test-Path -LiteralPath $Exe)) {
    Write-Host 'MISSING'
    $script:results += [pscustomobject]@{ Label = $Label; Verdict = 'MISSING'; Exit = ''; Exe = $Exe }
    Write-Host '::endgroup::'
    return
  }
  try {
    $it = Get-Item -LiteralPath $Exe -Force
    Write-Host ("link: {0} -> {1}" -f $it.LinkType, ($it.Target -join ','))
  } catch {}
  $dir = Split-Path -Parent $Exe
  Write-Host ("icudtl.dat next to exe: {0}" -f (Test-Path (Join-Path $dir 'icudtl.dat')))

  $out = Join-Path $env:RUNNER_TEMP "$Label.out"
  $err = Join-Path $env:RUNNER_TEMP "$Label.err"
  Remove-Item $out, $err -ErrorAction SilentlyContinue
  $code = 'START-FAILED'
  try {
    $p = Start-Process -FilePath $Exe -ArgumentList '--version' -PassThru -NoNewWindow `
      -RedirectStandardOutput $out -RedirectStandardError $err
    if ($p.WaitForExit(60000)) { $code = $p.ExitCode } else { $code = 'TIMEOUT'; $p.Kill() }
  } catch {
    Write-Host ("start error: {0}" -f $_.Exception.Message)
  }
  Start-Sleep -Milliseconds 500
  $so = if (Test-Path $out) { Get-Content $out -Raw } else { '' }
  $se = if (Test-Path $err) { Get-Content $err -Raw } else { '' }
  if ($null -eq $so) { $so = '' }
  if ($null -eq $se) { $se = '' }

  $verdict = if (($so + $se) -match 'ICU data') { 'ICU-ERROR' }
  elseif ($so -match 'MarkText:') { 'OK' }
  else { 'OTHER' }
  Write-Host ("exit={0} verdict={1}" -f $code, $verdict)
  Write-Host "--- stdout ---`n$so"
  Write-Host "--- stderr ---`n$se"
  $script:results += [pscustomobject]@{ Label = $Label; Verdict = $verdict; Exit = "$code"; Exe = $Exe }
  Write-Host '::endgroup::'
}

# ---------------------------------------------------------------- release zip
Write-Host '::group::download release zip'
$zip = "$ROOT\mt.zip"
Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/marktext/marktext/releases/download/v$VER/marktext-win-x64-$VER.zip" -OutFile $zip
Expand-Archive -Path $zip -DestinationPath "$ROOT\zip" -Force
Get-ChildItem "$ROOT\zip" | Select-Object Mode, Length, Name | Format-Table | Out-String | Write-Host
Write-Host '::endgroup::'

$zipExe = "$ROOT\zip\marktext.exe"
Probe 'A-zip-direct' $zipExe

New-Item -ItemType SymbolicLink -Path "$SHIMS\mt-sym.exe" -Target $zipExe -Force -ErrorAction SilentlyContinue | Out-Null
Probe 'B-zip-symlink' "$SHIMS\mt-sym.exe"

New-Item -ItemType HardLink -Path "$SHIMS\mt-hard.exe" -Target $zipExe -Force -ErrorAction SilentlyContinue | Out-Null
Probe 'C-zip-hardlink' "$SHIMS\mt-hard.exe"

Copy-Item $zipExe "$SHIMS\mt-copy.exe" -Force
Probe 'D-zip-exe-copy' "$SHIMS\mt-copy.exe"

# ------------------------------------------------------------------- .cmd shim
$wrapper = "$SHIMS\mt-wrap.cmd"
"@echo off`r`n`"$zipExe`" %*" | Set-Content -Path $wrapper -Encoding ASCII
Write-Host '::group::probe E-cmd-wrapper'
$out = Join-Path $env:RUNNER_TEMP 'E.out'
cmd.exe /c "`"$wrapper`" --version" > $out 2>&1
Write-Host ("exit={0}" -f $LASTEXITCODE)
$so = Get-Content $out -Raw
Write-Host "--- output ---`n$so"
$script:results += [pscustomobject]@{
  Label   = 'E-cmd-wrapper'
  Verdict = if ("$so" -match 'ICU data') { 'ICU-ERROR' } elseif ("$so" -match 'MarkText:') { 'OK' } else { 'OTHER' }
  Exit    = "$LASTEXITCODE"; Exe = $wrapper
}
Write-Host '::endgroup::'

# ----------------------------------------------------------------------- scoop
Write-Host '::group::scoop install marktext'
try {
  Invoke-WebRequest -UseBasicParsing -Uri 'https://get.scoop.sh' -OutFile "$ROOT\scoop.ps1"
  & "$ROOT\scoop.ps1" -RunAsAdmin
  $env:Path = "$env:USERPROFILE\scoop\shims;$env:Path"
  scoop bucket add extras
  scoop install marktext
  scoop config | Out-String | Write-Host
  Get-ChildItem "$env:USERPROFILE\scoop\shims" -Filter 'marktext*' -Force |
    Select-Object Mode, Length, Name | Format-Table | Out-String | Write-Host
  Get-ChildItem "$env:USERPROFILE\scoop\shims\marktext.shim" -ErrorAction SilentlyContinue |
    ForEach-Object { Get-Content $_.FullName | Write-Host }
} catch { Write-Host ("scoop failed: {0}" -f $_.Exception.Message) }
Write-Host ('where.exe marktext -> ' + ((where.exe marktext 2>&1) -join ' | '))
Write-Host '::endgroup::'
$scoopShim = (Get-Command marktext -ErrorAction SilentlyContinue).Source
if ($scoopShim) { Probe 'F-scoop-shim' $scoopShim }
else { $script:results += [pscustomobject]@{ Label = 'F-scoop-shim'; Verdict = 'NOT-ON-PATH'; Exit = ''; Exe = '' } }

# ------------------------------------------------------------------ chocolatey
Write-Host '::group::choco install marktext'
try { choco install marktext -y --no-progress --ignore-checksums } catch { Write-Host $_.Exception.Message }
Write-Host ('where.exe marktext -> ' + ((where.exe marktext 2>&1) -join ' | '))
Get-ChildItem 'C:\ProgramData\chocolatey\bin' -Filter 'mark*' -ErrorAction SilentlyContinue |
  Select-Object Name | Format-Table | Out-String | Write-Host
Write-Host '::endgroup::'

$nsisExe = "$env:LOCALAPPDATA\Programs\marktext\marktext.exe"
Probe 'G-nsis-installed' $nsisExe
New-Item -ItemType SymbolicLink -Path "$SHIMS\mt-nsis-sym.exe" -Target $nsisExe -Force -ErrorAction SilentlyContinue | Out-Null
Probe 'H-nsis-symlink' "$SHIMS\mt-nsis-sym.exe"

# ------------------------------------------------------------------ open a file
Write-Host '::group::open note.md with the working exe'
$note = "$ROOT\note.md"
'# hello from 5119' | Set-Content $note -Encoding UTF8
try {
  $p = Start-Process -FilePath $zipExe -ArgumentList $note -PassThru -NoNewWindow `
    -RedirectStandardOutput "$env:RUNNER_TEMP\open.out" -RedirectStandardError "$env:RUNNER_TEMP\open.err"
  $exited = $p.WaitForExit(25000)
  Write-Host ("exited within 25s: {0}" -f $exited)
  if (-not $exited) {
    Get-Process -Id $p.Id | Select-Object Id, MainWindowTitle | Format-Table | Out-String | Write-Host
    $p.Kill()
  }
  Write-Host ("stdout: " + (Get-Content "$env:RUNNER_TEMP\open.out" -Raw -ErrorAction SilentlyContinue))
  Write-Host ("stderr: " + (Get-Content "$env:RUNNER_TEMP\open.err" -Raw -ErrorAction SilentlyContinue))
} catch { Write-Host $_.Exception.Message }
Write-Host '::endgroup::'

Write-Host '================ SUMMARY ================'
$script:results | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
