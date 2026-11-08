Add-Type -AssemblyName System.Drawing

function New-PwaIcon {
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

    # Fundo Oficial Azul Sesé (#1E3F90)
    $seseBlue = [System.Drawing.Color]::FromArgb(255, 30, 63, 144)
    $bgBrush = [System.Drawing.SolidBrush]::new($seseBlue)
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    $bgBrush.Dispose()

    # Logo do Projeto: LOGO.jpg (Leão Sesé + tipografia oficial)
    $logoFile = if (Test-Path "public\logo.jpg") { "public\logo.jpg" } else { "LOGO.jpg" }
    $logoPath = Resolve-Path $logoFile

    if (Test-Path $logoPath) {
        $logo = [System.Drawing.Image]::FromFile($logoPath)

        if ($IsMaskable) {
            # Ícone Maskable PWA: área segura central de ~65% para garantir que não haja cortes em círculos/squarcles do Android
            $logoW = [int]($Size * 0.58)
            $logoH = [int]($Size * 0.58)
            $logoX = [int](($Size - $logoW) / 2)
            $logoY = [int]($Size * 0.12)
            $g.DrawImage($logo, $logoX, $logoY, $logoW, $logoH)

            # Tipografia: DISPLAY STOCK
            $fontSize = [float][Math]::Max(8.0, ($Size * 0.075))
            $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
            $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
            $format = [System.Drawing.StringFormat]::new()
            $format.Alignment = [System.Drawing.StringAlignment]::Center
            $format.LineAlignment = [System.Drawing.StringAlignment]::Center
            $textRect = [System.Drawing.RectangleF]::new(0.0, [float]($Size * 0.72), [float]$Size, [float]($Size * 0.12))
            $g.DrawString("DISPLAY STOCK", $font, $textBrush, $textRect, $format)

            $font.Dispose()
            $textBrush.Dispose()
            $format.Dispose()
        } else {
            # Ícone PWA Padrão: Logo elegante com texto integrado
            $logoW = [int]($Size * 0.65)
            $logoH = [int]($Size * 0.65)
            $logoX = [int](($Size - $logoW) / 2)
            $logoY = [int]($Size * 0.10)
            $g.DrawImage($logo, $logoX, $logoY, $logoW, $logoH)

            # Tipografia: DISPLAY STOCK
            $fontSize = [float][Math]::Max(9.0, ($Size * 0.082))
            $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
            $textBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
            $format = [System.Drawing.StringFormat]::new()
            $format.Alignment = [System.Drawing.StringAlignment]::Center
            $format.LineAlignment = [System.Drawing.StringAlignment]::Center
            $textRect = [System.Drawing.RectangleF]::new(0.0, [float]($Size * 0.76), [float]$Size, [float]($Size * 0.14))
            $g.DrawString("DISPLAY STOCK", $font, $textBrush, $textRect, $format)

            $font.Dispose()
            $textBrush.Dispose()
            $format.Dispose()
        }

        $logo.Dispose()
    }

    # Salvar arquivo em formato PNG de alta fidelidade
    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Ícone PWA gerado com a logo oficial: $OutputPath ($Size x $Size)"
}

# Gerar ícones PWA e Touch Icon
New-PwaIcon -Size 192 -OutputPath "public\icon-192.png"
New-PwaIcon -Size 512 -OutputPath "public\icon-512.png"
New-PwaIcon -Size 512 -OutputPath "public\icon-maskable-512.png" -IsMaskable $true
New-PwaIcon -Size 180 -OutputPath "public\apple-touch-icon.png"
