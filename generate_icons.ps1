Add-Type -AssemblyName System.Drawing

$src = "C:\Users\ashwi\.gemini\antigravity-ide\brain\dbb68a7d-9e2a-46fd-b507-f36d65156d09\.user_uploaded\media_1789367493688.png"

$destPng = "c:\Users\ashwi\Desktop\Projects\AstroLedger\desktop\assets\icon.png"
$destIco = "c:\Users\ashwi\Desktop\Projects\AstroLedger\desktop\assets\icon.ico"
$desktopLogo = "c:\Users\ashwi\Desktop\Projects\AstroLedger\desktop\assets\logo.png"

$frontendAssets = "c:\Users\ashwi\Desktop\Projects\AstroLedger\frontend\src\assets"
$frontendLogo = "$frontendAssets\logo.png"

$frontendPublic = "c:\Users\ashwi\Desktop\Projects\AstroLedger\frontend\public"
$frontendIco = "$frontendPublic\favicon.ico"
$publicLogo = "$frontendPublic\logo.png"

$mobileAssets = "c:\Users\ashwi\Desktop\Projects\AstroLedger\mobile\assets"

if (-not (Test-Path $src)) {
    Write-Error "Source image not found at $src"
    exit 1
}

# Ensure destination folders exist
if (-not (Test-Path $frontendAssets)) { New-Item -ItemType Directory -Path $frontendAssets -Force | Out-Null }
if (-not (Test-Path $frontendPublic)) { New-Item -ItemType Directory -Path $frontendPublic -Force | Out-Null }
if (-not (Test-Path $mobileAssets)) { New-Item -ItemType Directory -Path $mobileAssets -Force | Out-Null }
if (-not (Test-Path "c:\Users\ashwi\Desktop\Projects\AstroLedger\desktop\assets")) { New-Item -ItemType Directory -Path "c:\Users\ashwi\Desktop\Projects\AstroLedger\desktop\assets" -Force | Out-Null }

# 1. Copy raw logo
Copy-Item $src $desktopLogo -Force
Copy-Item $src $frontendLogo -Force
Copy-Item $src $publicLogo -Force
Write-Host "Copied raw logo to desktop and frontend"

# 2. Generate 256x256 PNG & Windows ICO
$img = [System.Drawing.Bitmap]::FromFile($src)
$canvas256 = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($canvas256)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()

# Save 256x256 PNG
$canvas256.Save($destPng, [System.Drawing.Imaging.ImageFormat]::Png)
$canvas256.Save("$mobileAssets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created $destPng and $mobileAssets\icon.png"

# Save Windows ICO file (ICONDIR + ICONDIRENTRY + PNG stream)
$ms = New-Object System.IO.MemoryStream
$canvas256.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()

$fs = New-Object System.IO.FileStream($destIco, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR (6 bytes)
$bw.Write([UInt16]0) # Reserved
$bw.Write([UInt16]1) # Type (1=ICO)
$bw.Write([UInt16]1) # Count (1 image)

# ICONDIRENTRY (16 bytes)
$bw.Write([Byte]0)   # Width (0 = 256)
$bw.Write([Byte]0)   # Height (0 = 256)
$bw.Write([Byte]0)   # ColorCount
$bw.Write([Byte]0)   # Reserved
$bw.Write([UInt16]1) # ColorPlanes
$bw.Write([UInt16]32)# BitCount
$bw.Write([UInt32]$pngBytes.Length) # Image bytes
$bw.Write([UInt32]22) # Offset (6 + 16 = 22)

# Raw PNG payload
$bw.Write($pngBytes)

$bw.Close()
$fs.Close()
Write-Host "Created $destIco"

# Copy favicon
Copy-Item $destIco $frontendIco -Force
Write-Host "Updated $frontendIco"

$canvas256.Dispose()
$img.Dispose()
Write-Host "All AstroLedger logo icons generated and linked successfully!"
