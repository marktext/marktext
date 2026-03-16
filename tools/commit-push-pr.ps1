<# Commit current changes, push the current branch, and create a PR against upstream. #>
param(
  [Parameter(Mandatory = $true)]
  [string]$CommitMessage,

  [string]$PullRequestTitle = '',

  [string]$PullRequestBody = '',

  [string]$PushRemote = '',

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

function Get-RepositorySlug {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RemoteName
  )

  $remoteUrl = (git remote get-url $RemoteName).Trim()
  if (-not $remoteUrl) {
    throw ("Could not resolve remote URL for '{0}'." -f $RemoteName)
  }

  if ($remoteUrl -match 'github\.com[:/](.+?)/(.+?)(?:\.git)?$') {
    return "{0}/{1}" -f $matches[1], $matches[2]
  }

  throw ("Remote '{0}' does not point to a GitHub repository." -f $RemoteName)
}

function Resolve-PushRemote {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRepo
  )

  $remotes = @(git remote)
  foreach ($remote in $remotes) {
    $slug = Get-RepositorySlug -RemoteName $remote
    $repoJson = gh repo view $slug --json isFork,parent,nameWithOwner 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $repoJson) {
      continue
    }

    $repo = $repoJson | ConvertFrom-Json
    $parentSlug = if ($repo.parent) {
      "{0}/{1}" -f $repo.parent.owner.login, $repo.parent.name
    } else {
      ''
    }

    if ($repo.isFork -and $parentSlug -eq $TargetRepo) {
      return $remote
    }
  }

  throw ("Could not find a git remote that is a fork of {0}. Pass -PushRemote explicitly." -f $TargetRepo)
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

if (-not $PushRemote) {
  $PushRemote = Resolve-PushRemote -TargetRepo $BaseRepo
}

if (-not (git remote | Where-Object { $_ -eq $PushRemote })) {
  throw ("Git remote '{0}' does not exist." -f $PushRemote)
}

Invoke-Step 'git' @('add', '--all')
Invoke-Step 'git' @('commit', '-m', $CommitMessage)
Invoke-Step 'git' @('push', $PushRemote, $branch)

if ($SkipPullRequest) {
  Write-Host 'Skipped pull request creation.'
  exit 0
}

$pushRepoSlug = Get-RepositorySlug -RemoteName $PushRemote
$headOwner = $pushRepoSlug.Split('/')[0]
$headRef = "{0}:{1}" -f $headOwner, $branch
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
