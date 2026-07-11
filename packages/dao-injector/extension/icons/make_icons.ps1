# 生 icon · 印 88 · 道之朴 · 三规 (16/48/128)
# 用 System.Drawing · 无外依
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 48, 128)
$here = Split-Path $MyInvocation.MyCommand.Path -Parent
$bgHex = '#0F2A2A'    # 深青 (老子之深渊)
$ringHex = '#45C8C4'  # 道之青
$textHex = '#6CE0E6'  # 道之光

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $sz, $sz
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # 背景圆
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml($bgHex)
    $brushBg = New-Object System.Drawing.SolidBrush $bgColor
    $g.FillEllipse($brushBg, 0, 0, $sz, $sz)
    $brushBg.Dispose()

    # 外环
    $ringColor = [System.Drawing.ColorTranslator]::FromHtml($ringHex)
    $penRing = New-Object System.Drawing.Pen($ringColor, [Math]::Max(1, [int]($sz / 16)))
    $pad = [int]($sz / 12)
    $g.DrawEllipse($penRing, $pad, $pad, $sz - 2 * $pad, $sz - 2 * $pad)
    $penRing.Dispose()

    # 中字 "道"
    $textColor = [System.Drawing.ColorTranslator]::FromHtml($textHex)
    $brushText = New-Object System.Drawing.SolidBrush $textColor
    $fontSize = [Math]::Max(8, [int]($sz * 0.55))
    $boldStyle = [System.Drawing.FontStyle]::Bold
    $pixelUnit = [System.Drawing.GraphicsUnit]::Pixel
    $font = New-Object System.Drawing.Font('Microsoft YaHei', [single]$fontSize, $boldStyle, $pixelUnit)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF 0, 0, $sz, $sz
    $g.DrawString('道', $font, $brushText, $rect, $fmt)
    $font.Dispose()
    $brushText.Dispose()
    $fmt.Dispose()

    $g.Dispose()

    $out = Join-Path $here "icon-$sz.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "[icon] $sz x $sz → $out"
}

Write-Host ""
Write-Host "图标三规已立 (16/48/128) · 道之朴 ★"
