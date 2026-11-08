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

    # Fundo Oficial Azul Sesé (#1E3F90)
    $seseBlue = [System.Drawing.Color]::FromArgb(255, 30, 63, 144)
    $bgBrush = [System.Drawing.SolidBrush]::new($seseBlue)
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    $bgBrush.Dispose()

    $logoFile = if (Test-Path "public\logo.jpg") { "public\logo.jpg" } else { "LOGO.jpg" }
    $logo = [System.Drawing.Image]::FromFile((Resolve-Path $logoFile).Path)

    if ($IsMaskable) {
        # Área segura do Android (~78% do centro para evitar cortes em ícones redondos)
        $w = [int]($Size * 0.78)
        $h = [int]($Size * 0.78)
        $x = [int](($Size - $w) / 2)
        $y = [int](($Size - $h) / 2)
        $g.DrawImage($logo, $x, $y, $w, $h)
    } else {
        # Ícone direto de alta fidelidade preenchendo o quadrado com a logo oficial
        $g.DrawImage($logo, 0, 0, $Size, $Size)
    }

    $logo.Dispose()

    $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Ícone PWA gerado com sucesso: $OutputPath ($Size x $Size)"
}

# Gerar todos os ícones PWA diretamente com a LOGO.jpg
New-PwaIcon -Size 192 -OutputPath "public\icon-192.png"
New-PwaIcon -Size 512 -OutputPath "public\icon-512.png"
New-PwaIcon -Size 512 -OutputPath "public\icon-maskable-512.png" -IsMaskable $true
New-PwaIcon -Size 180 -OutputPath "public\apple-touch-icon.png"

# Gerar Favicons para navegador (32x32 e 16x16)
New-PwaIcon -Size 32 -OutputPath "public\favicon-32x32.png"
New-PwaIcon -Size 16 -OutputPath "public\favicon-16x16.png"
Copy-Item "public\favicon-32x32.png" "src\app\icon.png" -Force

# Gerar favicon.ico legítimo contendo a logo
$bmp32 = [System.Drawing.Bitmap]::new(32, 32)
$g32 = [System.Drawing.Graphics]::FromImage($bmp32)
$g32.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$logo = [System.Drawing.Image]::FromFile((Resolve-Path "public\logo.jpg").Path)
$g32.DrawImage($logo, 0, 0, 32, 32)
$hIcon = $bmp32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = Join-Path (Get-Location) "public\favicon.ico"
$fs = [System.IO.File]::Create($icoPath)
$icon.Save($fs)
$fs.Close()
Copy-Item $icoPath "src\app\favicon.ico" -Force
$g32.Dispose()
$bmp32.Dispose()
$logo.Dispose()

Write-Host "Todos os ícones PWA e favicons foram gerados diretamente a partir de LOGO.jpg!"
