# _verify_vsix.ps1 — RT Flow Min VSIX 内容检 · 哈希验 · 道法自然
# 用法: powershell -ExecutionPolicy Bypass -File _verify_vsix.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$pkg = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = $pkg.version
$vsix = "$here\$($pkg.publisher).$($pkg.name)-$ver.vsix"
if (-not (Test-Path $vsix)) { Write-Error "VSIX not found: $vsix"; exit 1 }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($vsix)
try {
  Write-Host "=== VSIX 内容 ==="
  $ok = $true
  foreach ($e in $zip.Entries) {
    Write-Host ("  {0,-40} {1,8} bytes" -f $e.FullName, $e.Length)
  }
  # 关键文件存在性
  foreach ($need in @("[Content_Types].xml", "extension.vsixmanifest", "extension/package.json", "extension/extension.js", "extension/dao_stuck.js", "extension/_vscdb_helper.py", "extension/media/icon.png")) {
    if (-not ($zip.Entries | Where-Object { $_.FullName -eq $need })) {
      Write-Host "  MISSING: $need"
      $ok = $false
    }
  }
  # 哈希验证 (extension 内文件 vs 源目录)
  Write-Host "=== 哈希验证 ==="
  foreach ($e in $zip.Entries) {
    if ($e.FullName -like "extension/*") {
      $rel = $e.FullName.Substring("extension/".Length)
      $src = Join-Path $here $rel
      if (Test-Path $src) {
        $sr = [System.IO.MemoryStream]::new()
        $es = $e.Open(); $es.CopyTo($sr); $es.Close()
        $h1 = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new($sr.ToArray())) -Algorithm SHA256).Hash
        $h2 = (Get-FileHash $src -Algorithm SHA256).Hash
        $st = if ($h1 -eq $h2) { "MATCH" } else { "DIFF!"; $ok = $false }
        Write-Host ("  {0,-40} {1}" -f $rel, $st)
      }
    }
  }
} finally {
  $zip.Dispose()
}
Write-Host ""
if ($ok) { Write-Host "VERIFY OK: $vsix" } else { Write-Host "VERIFY FAIL"; exit 1 }
