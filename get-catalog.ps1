$catalog = Invoke-RestMethod -Uri 'https://synthesis.devfolio.co/catalog?page=1&limit=50' -Method GET
$catalog | ConvertTo-Json -Depth 10 | Out-File 'catalog.txt' -Encoding UTF8
Write-Host "Done - saved to catalog.txt"
