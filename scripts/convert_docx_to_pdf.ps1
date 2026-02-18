param()
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$docxPath = "D:\Sustainability-Signals\SustainabilitySignals_TechnicalDescription.docx"
$pdfPath = "D:\Sustainability-Signals\SustainabilitySignals_TechnicalDescription.pdf"
$doc = $word.Documents.Open($docxPath)
$doc.SaveAs([ref]$pdfPath, [ref]17)  # wdFormatPDF = 17
$doc.Close()
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
Write-Host "Technical Description PDF saved: $pdfPath"
