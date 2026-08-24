# spike-orcad-com.ps1
# P0 spike: enumerate the OrCAD Capture 17.4 COM automation object model.
#
# Usage:
#   powershell -NoProfile -File scripts\spike-orcad-com.ps1
#   powershell -NoProfile -File scripts\spike-orcad-com.ps1 -OpenProject "D:\path\design.dsn"
#   powershell -NoProfile -File scripts\spike-orcad-com.ps1 -ProgID "Capture.Application"
#
# Output: spike-output\orcad-com-dump.json (structured) + orcad-com-dump.log (log)

param(
  [string]$OpenProject = '',
  [string]$ProgID = 'Capture.Application'
)

$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot '..\spike-output'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$logFile = Join-Path $outDir 'orcad-com-dump.log'
$jsonFile = Join-Path $outDir 'orcad-com-dump.json'
Remove-Item $logFile, $jsonFile -ErrorAction SilentlyContinue

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Get-Names($obj, [switch]$Property, [switch]$Method) {
  if ($null -eq $obj) { return @() }
  $m = Get-Member -InputObject $obj -ErrorAction SilentlyContinue
  $names = @()
  foreach ($x in $m) {
    if ($Property -and $x.MemberType -match 'Property') { $names += $x.Name }
    if ($Method -and $x.MemberType -match 'Method') { $names += $x.Name }
  }
  return ($names | Sort-Object -Unique)
}

function Get-Count($obj) {
  if ($null -eq $obj) { return $null }
  try { return $obj.Count } catch {
    try { return $obj.Length } catch { return $null }
  }
}

# Get the n-th item of a collection, tolerant of Item() vs direct index.
function Get-ItemAt($coll, [int]$i) {
  if ($null -eq $coll) { return $null }
  try { return $coll.Item($i) } catch {
    try { return $coll[$i] } catch { return $null }
  }
}

$report = [ordered]@{
  progid    = $ProgID
  startedAt = (Get-Date).ToString('o')
  com       = $null
  app       = $null
  projects  = $null
  design    = $null
}

Log "=== Create COM object: $ProgID ==="
try {
  $app = New-Object -ComObject $ProgID
  $report.com = 'OK'
  Log "COM object created OK"
} catch {
  $report.com = "FAILED: $($_.Exception.Message)"
  Log "COM create failed: $($_.Exception.Message)"
  $report | ConvertTo-Json -Depth 20 | Set-Content -Path $jsonFile -Encoding UTF8
  Log "Result written to $jsonFile"
  exit 1
}

# --- Application layer ---
$appInfo = [ordered]@{
  properties = @(Get-Names $app -Property)
  methods    = @(Get-Names $app -Method)
}
foreach ($p in 'Version','Visible','Path','Name') {
  try { $appInfo[$p] = $app.$p } catch { $appInfo[$p] = "<err: $($_.Exception.Message)>" }
}
$report.app = $appInfo
Log "App props: $($appInfo.properties.Count), methods: $($appInfo.methods.Count)"
Log ("App property names: " + ($appInfo.properties -join ', '))
Log ("App method names: " + ($appInfo.methods -join ', '))

# Try to hide the window if supported.
try { $app.Visible = $false } catch { }

# --- Open a project (optional) ---
if ($OpenProject) {
  Log "=== Open project: $OpenProject ==="
  try {
    $proj = $app.OpenProject($OpenProject)
    $report.openProject = "OK: $OpenProject"
    Log "OpenProject OK"
  } catch {
    $report.openProject = "FAILED: $($_.Exception.Message)"
    Log "OpenProject failed: $($_.Exception.Message)"
  }
}

# --- Project collection ---
$projInfo = $null
foreach ($collName in 'Projects','Designs','Session') {
  $coll = $null
  try { $coll = $app.$collName } catch { }
  if ($null -ne $coll) {
    $cnt = Get-Count $coll
    $projInfo = [ordered]@{ collectionName = $collName; count = $cnt; items = @() }
    Log "App exposes collection: $collName (Count=$cnt)"
    if ($cnt -gt 0) {
      for ($i = 0; $i -lt [Math]::Min($cnt, 5); $i++) {
        $item = Get-ItemAt $coll $i
        $entry = [ordered]@{ index = $i; name = $null; filename = $null }
        foreach ($p in 'Name','FileName','FullName') {
          try { $entry[$p.ToLower()] = $item.$p } catch { }
        }
        $projInfo.items += $entry
        Log "  [$i] name=$($entry.name) filename=$($entry.filename)"
      }
    }
    break
  }
}
$report.projects = $projInfo

# --- Drill into the first project / design ---
$design = $null
if ($null -ne $projInfo -and $projInfo.count -gt 0) {
  try {
    $projColl = $app.Projects
    $proj0 = Get-ItemAt $projColl 0
    $designColl = $proj0.Designs
    $dCnt = Get-Count $designColl
    Log "Project[0].Designs Count=$dCnt"
    if ($dCnt -gt 0) {
      $design = Get-ItemAt $designColl 0
    }
  } catch {
    Log "Drill into project failed: $($_.Exception.Message)"
  }
} elseif ($null -ne $app -and $null -ne (Get-Names $app -Property | Where-Object { $_ -eq 'Designs' })) {
  try {
    $designColl = $app.Designs
    if ((Get-Count $designColl) -gt 0) { $design = Get-ItemAt $designColl 0 }
  } catch { }
}

$designInfo = [ordered]@{ reachable = $false }
if ($null -ne $design) {
  $designInfo.reachable = $true
  $designInfo.properties = @(Get-Names $design -Property)
  foreach ($p in 'Name','FileName') {
    try { $designInfo[$p] = $design.$p } catch { }
  }

  # Nets
  try {
    $nets = $design.Nets
    $designInfo.nets = [ordered]@{ count = (Get-Count $nets); samples = @() }
    Log "Design Nets Count=$($designInfo.nets.count)"
    $nCnt = Get-Count $nets
    if ($nCnt -gt 0) {
      for ($i = 0; $i -lt [Math]::Min($nCnt, 10); $i++) {
        $net = Get-ItemAt $nets $i
        $s = [ordered]@{ name = $null; pins = $null }
        try { $s.name = $net.Name } catch { }
        try { $s.pins = (Get-Count $net.Pins) } catch { }
        $designInfo.nets.samples += $s
        Log "  net[$i] name=$($s.name) pins=$($s.pins)"
      }
    }
  } catch { $designInfo.nets = "ERR: $($_.Exception.Message)" }

  # Parts + Pins (pin type => detect power pin)
  try {
    $parts = $design.Parts
    $designInfo.parts = [ordered]@{ count = (Get-Count $parts); samples = @() }
    Log "Design Parts Count=$($designInfo.parts.count)"
    $pCnt = Get-Count $parts
    if ($pCnt -gt 0) {
      for ($i = 0; $i -lt [Math]::Min($pCnt, 8); $i++) {
        $part = Get-ItemAt $parts $i
        $pe = [ordered]@{ reference = $null; name = $null; pins = @() }
        try { $pe.reference = $part.Reference } catch { }
        try { $pe.name = $part.Name } catch { }
        try {
          $pins = $part.Pins
          $pcnt = Get-Count $pins
          if ($pcnt -gt 0) {
            for ($j = 0; $j -lt [Math]::Min($pcnt, 6); $j++) {
              $pin = Get-ItemAt $pins $j
              $pn = [ordered]@{ number = $null; name = $null; type = $null; typeName = $null; net = $null }
              try { $pn.number = $pin.Number } catch { }
              try { $pn.name = $pin.Name } catch { }
              try { $pn.type = $pin.Type } catch { }
              try { $pn.typeName = $pin.Type.ToString() } catch { }
              try { $pn.net = $pin.Net.Name } catch { }
              $pe.pins += $pn
            }
          }
        } catch { $pe.pins = "ERR: $($_.Exception.Message)" }
        $designInfo.parts.samples += $pe
        Log "  part[$i] ref=$($pe.reference) name=$($pe.name)"
      }
    }
  } catch { $designInfo.parts = "ERR: $($_.Exception.Message)" }

  # SchematicPages (hierarchy clues)
  try {
    $pages = $design.SchematicPages
    $designInfo.schematicPages = [ordered]@{ count = (Get-Count $pages); names = @() }
    $pgCnt = Get-Count $pages
    if ($pgCnt -gt 0) {
      for ($i = 0; $i -lt [Math]::Min($pgCnt, 20); $i++) {
        $pg = Get-ItemAt $pages $i
        try { $designInfo.schematicPages.names += $pg.Name } catch { }
      }
    }
    Log "Design SchematicPages Count=$($designInfo.schematicPages.count)"
  } catch { $designInfo.schematicPages = "ERR: $($_.Exception.Message)" }
}
$report.design = $designInfo

$report.finishedAt = (Get-Date).ToString('o')
$report | ConvertTo-Json -Depth 20 | Set-Content -Path $jsonFile -Encoding UTF8
Log "=== Done. Structured result: $jsonFile ==="
Log "=== Log: $logFile ==="
