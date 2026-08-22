# _pack_vsix.ps1 — RT Flow Min 打包脚本 · 自 package.json 取版本 · 道法自然
# 用法: powershell -ExecutionPolicy Bypass -File _pack_vsix.ps1
# 产出: devaid.rt-flow-min-<version>.vsix (本目录)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# 自 package.json 取版本 (一处定义 · 全文一致)
# PS 5.1 需显式 -Encoding UTF8 (否则按系统 ANSI 读 → 中文乱码 → JSON 解析失败)
$pkg = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = $pkg.version
$name = $pkg.name
$pub = $pkg.publisher
$out = "$here\$pub.$name-$ver.vsix"
Write-Host "pack: $pub.$name v$ver"

# 构造 VSIX (zip 格式 · 标准清单)
$tmp = Join-Path $env:TEMP "rtflow-min-vsix-$PID"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

# [Content_Types].xml
@'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="text/javascript" />
  <Default Extension="md" ContentType="text/markdown" />
  <Default Extension="txt" ContentType="text/plain" />
  <Default Extension="py" ContentType="text/x-python" />
  <Default Extension="ps1" ContentType="text/plain" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="xml" ContentType="text/xml" />
</Types>
'@ | Out-File -LiteralPath "$tmp\[Content_Types].xml" -Encoding utf8 -Force

# extension.vsixmanifest
$engine = $pkg.engines.vscode
$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="$name" Version="$ver" Publisher="$pub" />
    <DisplayName>$($pkg.displayName)</DisplayName>
    <Description xml:space="preserve">$($pkg.description)</Description>
    <Tags>dao,wam,rt-flow,min,devin,windsurf</Tags>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="$engine" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
    </Properties>
    <License>extension/LICENSE.txt</License>
    <Readme>extension/README.md</Readme>
    <Icon>extension/media/icon.png</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" Version="[1.85.0,)" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" />
  </Assets>
</PackageManifest>
"@
$manifest | Out-File -LiteralPath "$tmp\extension.vsixmanifest" -Encoding utf8 -Force

# 收集扩展文件 (排除脚本/文档/备份)
$files = Get-ChildItem $here -File | Where-Object {
  $_.Name -notlike "*.vsix" -and
  $_.Name -notlike "_pack_vsix.ps1" -and
  $_.Name -notlike "_verify_vsix.ps1" -and
  $_.Name -notlike ".vscodeignore" -and
  $_.Name -notlike "*.bak*"
}
$media = Get-ChildItem "$here\media" -File -ErrorAction SilentlyContinue

# 压缩 (zip → vsix)
if (Test-Path $out) { Remove-Item $out -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
function Add-ZipEntry($zip, $file, $entryName) {
  $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
  $es = $entry.Open()
  $fs = [System.IO.File]::OpenRead($file)
  try { $fs.CopyTo($es) } finally { $fs.Close(); $es.Close() }
}
try {
  Add-ZipEntry $zip "$tmp\[Content_Types].xml" "[Content_Types].xml"
  Add-ZipEntry $zip "$tmp\extension.vsixmanifest" "extension.vsixmanifest"
  foreach ($f in $files) {
    Add-ZipEntry $zip $f.FullName "extension/$($f.Name)"
    Write-Host "  + extension/$($f.Name) ($($f.Length) bytes)"
  }
  foreach ($f in $media) {
    Add-ZipEntry $zip $f.FullName "extension/media/$($f.Name)"
    Write-Host "  + extension/media/$($f.Name) ($($f.Length) bytes)"
  }
} finally {
  $zip.Dispose()
}
Remove-Item $tmp -Recurse -Force
$size = (Get-Item $out).Length
Write-Host "OK: $out ($size bytes)"
