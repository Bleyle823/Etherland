$apiKey = "sk-synth-8141ba6bce8e80ee090fd13190ad1364bfa4aefe693837d1"
$headers = @{
    Authorization = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$body = Get-Content 'project-payload.json' -Raw | ConvertFrom-Json | ConvertTo-Json -Depth 10
$response = Invoke-RestMethod -Uri 'https://synthesis.devfolio.co/projects' -Method POST -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10 | Out-File 'project-submission-result.txt' -Encoding UTF8
Write-Host "Project submitted! Result saved to project-submission-result.txt"
