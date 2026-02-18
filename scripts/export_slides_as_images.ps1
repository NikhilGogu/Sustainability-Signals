param()

$pptxPath = "D:\Sustainability-Signals\SustainabilitySignals_10slides.pptx"
$outDir   = "D:\Sustainability-Signals\scripts\_slide_images"

if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null

$ppt = New-Object -ComObject PowerPoint.Application
$pres = $ppt.Presentations.Open($pptxPath, [int]-1, [int]0, [int]0)

# Export each slide as PNG at 1920x1080
$width = 1920
$height = 1080

for ($i = 1; $i -le $pres.Slides.Count; $i++) {
    $slide = $pres.Slides.Item($i)
    $outFile = Join-Path $outDir ("slide_{0:D2}.png" -f $i)
    $slide.Export($outFile, "PNG", $width, $height)
    Write-Host "Exported slide $i -> $outFile"
}

$pres.Close()
$ppt.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
Write-Host "All slides exported to $outDir"
