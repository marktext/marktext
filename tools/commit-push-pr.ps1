<# Commit current changes, push the current branch, and create a PR against upstream. #>
param(
  [Parameter(Mandatory = $true)]
  [string]$CommitMessage,

  [string]$PullRequestTitle = '',

  [string]$PullRequestBody = '',

  [string]$PushRemote = 'lorraine40',

  [string]$BaseRepo = 'marktext/marktext',

  [string]$BaseBranch = 'develop',

  [switch]$SkipPullRequest
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [string[]]$Arguments = @()
  )

  $display = @($FilePath) + $Arguments
  Write-Host (">> {0}" -f ($display -join ' '))
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw ("Command failed with exit code {0}: {1}" -f $LASTEXITCODE, $FilePath)
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$branch = (git branch --show-current).Trim()
if (-not $branch) {
  throw 'Could not determine the current git branch.'
}

$statusLines = @(git status --short)
if ($statusLines.Count -eq 0) {
  throw 'Working tree is clean. Nothing to commit.'
}

if (-not $PullRequestTitle) {
  $PullRequestTitle = $CommitMessage
}

Invoke-Step 'git' @('add', '--all')
Invoke-Step 'git' @('commit', '-m', $CommitMessage)
Invoke-Step 'git' @('push', $PushRemote, $branch)

if ($SkipPullRequest) {
  Write-Host 'Skipped pull request creation.'
  exit 0
}

$headRef = "{0}:{1}" -f $PushRemote, $branch
$prLookup = gh pr list --repo $BaseRepo --head $headRef --base $BaseBranch --json number,url --state open
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to query existing pull requests.'
}

$existingPrs = $prLookup | ConvertFrom-Json
if ($existingPrs.Count -gt 0) {
  Write-Host ("Open pull request already exists: {0}" -f $existingPrs[0].url)
  exit 0
}

$prArgs = @(
  'pr',
  'create',
  '--repo', $BaseRepo,
  '--base', $BaseBranch,
  '--head', $headRef,
  '--title', $PullRequestTitle
)

if ($PullRequestBody) {
  $prArgs += @('--body', $PullRequestBody)
} else {
  $prArgs += '--fill'
}

Write-Host (">> gh {0}" -f ($prArgs -join ' '))
& gh @prArgs
if ($LASTEXITCODE -ne 0) {
  throw 'Failed to create pull request.'
}
