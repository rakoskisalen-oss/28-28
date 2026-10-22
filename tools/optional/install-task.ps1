<#
  【备用方案】把每日同步注册成 Windows 计划任务。

  正式方案是 GitHub Actions（见 .github/workflows/sync.yml），云端跑，不依赖本机开机。
  这个脚本只在「不想用 GitHub、只想在本机跑」时使用。

  用 XML 定义任务（而不是 /TR 字符串），好处是能关掉「只用电池不启动」的限制，
  笔记本拔了电源也照跑。注册走 schtasks，不依赖 PowerShell 的 ScheduledTasks 模块。

  用法（在项目根目录执行）：
    powershell -ExecutionPolicy Bypass -File tools\optional\install-task.ps1
    powershell -ExecutionPolicy Bypass -File tools\optional\install-task.ps1 -Times 09:00,21:00
    powershell -ExecutionPolicy Bypass -File tools\optional\install-task.ps1 -Remove
    powershell -ExecutionPolicy Bypass -File tools\optional\install-task.ps1 -DryRun

  以当前用户身份运行，不需要管理员权限；电脑需开机。
#>
param(
  [string[]]$Times = @("10:00", "22:00"),
  [string]$NodePath = "",
  [switch]$Remove,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $root "tools\sync.mjs"
$taskBase = "28-28 sync"

if (-not (Test-Path $script)) { throw "找不到 $script" }

if ($Remove) {
  for ($i = 1; $i -le 9; $i++) {
    $name = if ($i -eq 1) { $taskBase } else { "$taskBase $i" }
    schtasks /Delete /TN $name /F 2>&1 | Out-Null
  }
  Write-Host "已移除「$taskBase」相关计划任务。"
  exit 0
}

if (-not $NodePath) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $NodePath = $cmd.Source }
}
if (-not $NodePath -or -not (Test-Path $NodePath)) {
  throw "找不到 node.exe。请加 -NodePath 指定完整路径（例如 DeepSeek Harness 自带的 runtime）。"
}

$userId = "$env:USERDOMAIN\$env:USERNAME"
$today = (Get-Date).ToString("yyyy-MM-dd")
$esc = { param($s) [System.Security.SecurityElement]::Escape([string]$s) }

function New-SyncTaskXml {
  param([string]$startTime)

  $node = & $esc $NodePath
  $argsXml = '"' + (& $esc $script) + '"'
  $desc = & $esc "28/28 站点每日数据同步：Tibo 的 28 天挑战"
  $uid = & $esc $userId

  @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>$desc</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>${today}T${startTime}:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$uid</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$node</Command>
      <Arguments>$argsXml</Arguments>
    </Exec>
  </Actions>
</Task>
"@
}

$xmlDir = Join-Path $env:TEMP "28-28-task"
if (-not (Test-Path $xmlDir)) { New-Item -ItemType Directory -Path $xmlDir -Force | Out-Null }

for ($i = 0; $i -lt $Times.Count; $i++) {
  $name = if ($i -eq 0) { $taskBase } else { "$taskBase $($i + 1)" }
  $xml = New-SyncTaskXml -startTime $Times[$i]

  # 先确认 XML 是合法的，避免把坏文件喂给 schtasks
  $null = [xml]$xml

  $xmlFile = Join-Path $xmlDir ("{0}.xml" -f ($name -replace '[^\w\-]', '_'))
  [System.IO.File]::WriteAllText($xmlFile, $xml, [System.Text.Encoding]::Unicode)

  if ($DryRun) {
    Write-Host "=== $name  ($($Times[$i]))  →  $xmlFile"
    Write-Host $xml
    continue
  }

  $out = schtasks /Create /TN $name /XML $xmlFile /F 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "XML 方式注册「$name」失败，退回 /TR 方式（电池模式下不会运行）：$out"
    $tr = '"' + $NodePath + '" "' + $script + '"'
    schtasks /Create /TN $name /TR $tr /SC DAILY /ST $Times[$i] /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "注册「$name」失败" }
  }
  Write-Host "✓ $name → 每天 $($Times[$i])"
}

if (-not $DryRun) {
  Write-Host ""
  Write-Host "查看：schtasks /Query /TN `"$taskBase`" /V /FO LIST"
  Write-Host "立即跑一次：schtasks /Run /TN `"$taskBase`""
  Write-Host "运行日志：logs\sync.log"
  Write-Host "卸载：powershell -File tools\install-task.ps1 -Remove"
}
