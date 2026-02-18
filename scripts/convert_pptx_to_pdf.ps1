param()
$ppt = New-Object -ComObject PowerPoint.Application
$pptxPath = "D:\Sustainability-Signals\SustainabilitySignals_10slides.pptx"
$pdfPath = "D:\Sustainability-Signals\SustainabilitySignals_10slides.pdf"
$pres = $ppt.Presentations.Open($pptxPath, [int]-1, [int]0, [int]0)
$pres.SaveAs($pdfPath, [int]32)
$pres.Close()
$ppt.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
Write-Host "PDF saved: $pdfPath"
