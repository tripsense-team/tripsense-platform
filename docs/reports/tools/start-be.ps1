param([string[]]$Services)
# Starts the given services with a small JVM heap. Prod env comes from env/.env.shared.
$ErrorActionPreference = 'Stop'
$Services = @($Services | ForEach-Object { $_ -split ',' } | Where-Object { $_ })  # -File passes "a,b,c" as one string
$root = 'D:\capstone\tripsense-platform'
$logs = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null

Get-Content "$root\env\.env.shared" | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $v = $Matches[2].Trim()
    if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
    [Environment]::SetEnvironmentVariable($Matches[1], $v, 'Process')
  }
}
# Cap memory: dev machine is shared with IDE + emulator.
$env:JAVA_TOOL_OPTIONS = '-Xmx320m -Xss512k -XX:+UseSerialGC -XX:TieredStopAtLevel=1'

function Start-Svc($name, $dir, $argList) {
  Start-Process -FilePath cmd.exe -ArgumentList $argList -WorkingDirectory $dir -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs "$name.log") -RedirectStandardError (Join-Path $logs "$name.err.log") | Out-Null
  "started $name"
}
function Wait-Port($port, $sec) {
  $end = (Get-Date).AddSeconds($sec)
  while ((Get-Date) -lt $end) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}

foreach ($s in $Services) {
  switch ($s) {
    'ai-service' { Start-Svc $s "$root\services\ai-service" '/c npm run dev' }
    'web'        { Start-Svc $s "$root\apps\web\tripsense" '/c npm run dev' }
    default      { Start-Svc $s "$root\services\$s" '/c .\mvnw.cmd -q spring-boot:run' }
  }
  if ($s -eq 'discovery-server') { if (-not (Wait-Port 8761 240)) { throw 'discovery-server did not come up' } }
}
"launch commands issued: $($Services -join ', ')"
