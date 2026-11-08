Add-Type -AssemblyName System.Drawing

function Create-PwaIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [bool]$IsMaskable = $false
    )

    $bmp = [System.Drawing.Bitmap]::new($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # Fundo elegante minimalista: Slate 900 escuro (#0F172A)
    $bgBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    $bgBrush.Dispose()

    # Dimensões do card da logo
    $cardW = [int]($Size * 0.82)
    $cardH = [int]($Size * 0.52)
    $cardX = [int](($Size - $cardW) / 2)
    $cardY = [int]($Size * 0.16)

    # Card branco com cantos arredondados (squircle moderno)
    $cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $radius = [int][Math]::Max(4.0, ($Size * 0.08))
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($cardX, $cardY, $radius, $radius, 180, 90)
    $path.AddArc($cardX + $cardW - $radius, $cardY, $radius, $radius, 270, 90)
    $path.AddArc($cardX + $cardW - $radius, $cardY + $cardH - $radius, $radius, $radius, 0, 90)
    $path.AddArc($cardX, $cardY + $cardH - $radius, $radius, $radius, 90, 90)
    $path.CloseFigure()

    $g.FillPath($cardBrush, $path)
    $cardBrush.Dispose()
    $path.Dispose()

    # Desenhar a Logo da Sesé centralizada com respiro límpido
    $logoPath = Resolve-Path "public\logo_0.jpeg"
    if (Test-Path $logoPath) {
        $logo = [System.Drawing.Image]::FromFile($logoPath)
        
        $padX = [int]($cardW * 0.10)
        $padY = [int]($cardH * 0.12)
        $availW = $cardW - ($padX * 2)
        $availH = $cardH - ($padY * 2)
        
        $scale = [Math]::Min($availW / $logo.Width, $availH / $logo.Height)
        $drawW = [int]($logo.Width * $scale)
        $drawH = [int]($logo.Height * $scale)
        $drawX = $cardX + [int](($cardW - $drawW) / 2)
        $drawY = $cardY + [int](($cardH - $drawH) / 2)

        $g.DrawImage($logo, $drawX, $drawY, $drawW, $drawH)
        $logo.Dispose()
    }

    # Tipografia minimalista: DISPLAY STOCK
    $fontSize = [float][Math]::Max(10.0, ($Size * 0.092))
    $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)

    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textRect = [System.Drawing.RectangleF]::new(0.0, [float]($Size * 0.74), [float]$Size, [float]($Size * 0.15))
    $g.DrawString("DISPLAY STOCK", $font, $textBrush, $textRect, $format)

    # Linha minimalista sutil em azul Sesé (#00B0F0)
    $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 0, 176, 240), [float][Math]::Max(2.0, ($Size * 0.012)))
    $lineW = [int]($Size * 0.35)
    $lineX1 = [int](($Size - $lineW) / 2)
    $lineX2 = $lineX1 + $lineW
    $lineY = [int]($Size * 0.89)
    $g.DrawLine($linePen, $lineX1, $lineY, $lineX2, $lineY)
    $linePen.Dispose()

    # Salvar arquivo
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $font.Dispose()
    $textBrush.Dispose()
    $format.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Gerado com sucesso: $OutputPath ($Size x $Size)"
}

Create-PwaIcon -Size 192 -OutputPath "public\icon-192.png"
Create-PwaIcon -Size 512 -OutputPath "public\icon-512.png"
Create-PwaIcon -Size 512 -OutputPath "public\icon-maskable-512.png" -IsMaskable $true
Create-PwaIcon -Size 180 -OutputPath "public\apple-touch-icon.png"
