
$f = "components/dashboard/sidebar.tsx"
$braceDepth = 0
$skipUntilNav = $false
$inNavSection = $false
$inFunc = $false
$lines = Get-Content $f
$newLines = New-Object System.Collections.Generic.List[string]
foreach ($line in $lines) {
  # Skip the SidebarSections function
  if ($line -match "^function SidebarSections") { $inFunc = $true; continue }
  if ($inFunc) {
    if ($line -match "^}\s*$") { $inFunc = $false }
    continue
  }
  # Skip the old nav section in Sidebar component
  if ($line -match "^\s+<SidebarSections") { $skipUntilNav = $true; continue }
  if ($skipUntilNav -and $line -match "^\s+</nav>") { $skipUntilNav = $false; continue }
  if ($skipUntilNav) { continue }
  $newLines.Add($line)}
$newLines | Set-Content -Path $f -Encoding UTF8
