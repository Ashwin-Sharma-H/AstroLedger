Add-Type -AssemblyName System.Drawing

$src = "C:\Users\ashwi\Desktop\Projects\AstroLedger\desktop\assets\logo.png"
if (-not (Test-Path $src)) {
    $src = "C:\Users\ashwi\.gemini\antigravity-ide\brain\dbb68a7d-9e2a-46fd-b507-f36d65156d09\.user_uploaded\media_1789367493688.png"
}

if (-not (Test-Path $src)) {
    Write-Error "Source logo file not found!"
    exit 1
}

Write-Host "Using source logo from: $src"
$logoImg = [System.Drawing.Bitmap]::FromFile($src)

$resDir = "C:\Users\ashwi\Desktop\Projects\AstroLedger\mobile\android\app\src\main\res"

# Function to draw image centered inside target dimensions with scaling
function Create-ScaledImage {
    param(
        [int]$canvasW,
        [int]$canvasH,
        [System.Drawing.Bitmap]$source,
        [double]$scaleRatio = 0.8,
        [System.Drawing.Color]$bgColor = [System.Drawing.Color]::White,
        [bool]$isTransparent = $false
    )

    $targetBmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($targetBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($isTransparent) {
        $g.Clear([System.Drawing.Color]::Transparent)
    } else {
        $g.Clear($bgColor)
    }

    # Calculate proportional fit
    $maxW = [int]($canvasW * $scaleRatio)
    $maxH = [int]($canvasH * $scaleRatio)

    $srcW = $source.Width
    $srcH = $source.Height

    $ratioW = $maxW / $srcW
    $ratioH = $maxH / $srcH
    $ratio = [Math]::Min($ratioW, $ratioH)

    $drawW = [int]($srcW * $ratio)
    $drawH = [int]($srcH * $ratio)

    $posX = [int](($canvasW - $drawW) / 2)
    $posY = [int](($canvasH - $drawH) / 2)

    $g.DrawImage($source, $posX, $posY, $drawW, $drawH)
    $g.Dispose()

    return $targetBmp
}

# 1. Android Mipmap densities
$densities = @(
    @{ name = "mdpi";    size = 48;  fgSize = 108 },
    @{ name = "hdpi";    size = 72;  fgSize = 162 },
    @{ name = "xhdpi";   size = 96;  fgSize = 216 },
    @{ name = "xxhdpi";  size = 144; fgSize = 324 },
    @{ name = "xxxhdpi"; size = 192; fgSize = 432 }
)

foreach ($d in $densities) {
    $dir = "$resDir\mipmap-$($d.name)"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    # A. Standard ic_launcher (white bg, 82% scaled)
    $icLauncher = Create-ScaledImage -canvasW $d.size -canvasH $d.size -source $logoImg -scaleRatio 0.82
    $icLauncher.Save("$dir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icLauncher.Dispose()

    # B. Round ic_launcher_round (white bg, 82% scaled)
    $icRound = Create-ScaledImage -canvasW $d.size -canvasH $d.size -source $logoImg -scaleRatio 0.82
    $icRound.Save("$dir\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icRound.Dispose()

    # C. Adaptive foreground ic_launcher_foreground (transparent bg, 62% scaled for safe zone)
    $icFg = Create-ScaledImage -canvasW $d.fgSize -canvasH $d.fgSize -source $logoImg -scaleRatio 0.62 -isTransparent $true
    $icFg.Save("$dir\ic_launcher_foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $icFg.Dispose()

    Write-Host "Generated mipmap icons for $($d.name) ($($d.size)x$($d.size) and fg $($d.fgSize)x$($d.fgSize))"
}

# 2. Splash Screens
$splashes = @(
    @{ path = "$resDir\drawable\splash.png"; w = 480; h = 800 },
    @{ path = "$resDir\drawable-port-mdpi\splash.png"; w = 320; h = 480 },
    @{ path = "$resDir\drawable-port-hdpi\splash.png"; w = 480; h = 800 },
    @{ path = "$resDir\drawable-port-xhdpi\splash.png"; w = 720; h = 1280 },
    @{ path = "$resDir\drawable-port-xxhdpi\splash.png"; w = 960; h = 1600 },
    @{ path = "$resDir\drawable-port-xxxhdpi\splash.png"; w = 1280; h = 1920 },
    @{ path = "$resDir\drawable-land-mdpi\splash.png"; w = 480; h = 320 },
    @{ path = "$resDir\drawable-land-hdpi\splash.png"; w = 800; h = 480 },
    @{ path = "$resDir\drawable-land-xhdpi\splash.png"; w = 1280; h = 720 },
    @{ path = "$resDir\drawable-land-xxhdpi\splash.png"; w = 1600; h = 960 },
    @{ path = "$resDir\drawable-land-xxxhdpi\splash.png"; w = 1920; h = 1280 }
)

foreach ($s in $splashes) {
    $parent = Split-Path $s.path
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

    $splashBmp = Create-ScaledImage -canvasW $s.w -canvasH $s.h -source $logoImg -scaleRatio 0.38
    $splashBmp.Save($s.path, [System.Drawing.Imaging.ImageFormat]::Png)
    $splashBmp.Dispose()
    Write-Host "Generated splash screen for $($s.path) ($($s.w)x$($s.h))"
}

$logoImg.Dispose()

Write-Host "SUCCESS: All Android APK launcher icons and splash screens updated with AstroLedger logo!"
