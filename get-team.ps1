$apiKey = "sk-synth-8141ba6bce8e80ee090fd13190ad1364bfa4aefe693837d1"
$headers = @{ Authorization = "Bearer $apiKey" }

# Get my team info
$me = Invoke-RestMethod -Uri 'https://synthesis.devfolio.co/teams/me' -Method GET -Headers $headers
$me | ConvertTo-Json -Depth 10 | Out-File 'team-info.txt' -Encoding UTF8
Write-Host "Team:" ($me | ConvertTo-Json -Depth 10)
