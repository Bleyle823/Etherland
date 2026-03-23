$apiKey = "sk-synth-8141ba6bce8e80ee090fd13190ad1364bfa4aefe693837d1"
$targetAddress = "0x231CdF6d31BF1D106DFA88b702B00E4b900628AD"
$headers = @{
    Authorization = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

# 6a. Initiate transfer
Write-Host "Initiating transfer to $targetAddress..."
$bodyInit = @{ targetOwnerAddress = $targetAddress } | ConvertTo-Json
$respInit = Invoke-RestMethod -Uri 'https://synthesis.devfolio.co/participants/me/transfer/init' -Method POST -Headers $headers -Body $bodyInit
Write-Host "Init Response:" ($respInit | ConvertTo-Json)

$transferToken = $respInit.transferToken

# 6b. Confirm transfer
Write-Host "Confirming transfer..."
$bodyConfirm = @{ transferToken = $transferToken; targetOwnerAddress = $targetAddress } | ConvertTo-Json
$respConfirm = Invoke-RestMethod -Uri 'https://synthesis.devfolio.co/participants/me/transfer/confirm' -Method POST -Headers $headers -Body $bodyConfirm
Write-Host "Confirm Response:" ($respConfirm | ConvertTo-Json)

# 7. Publish project
$projectUUID = "0bcb079a268e457bbb2c1d6da7d19223"
Write-Host "Publishing project $projectUUID..."
$respPublish = Invoke-RestMethod -Uri "https://synthesis.devfolio.co/projects/$projectUUID/publish" -Method POST -Headers $headers
Write-Host "Publish Response:" ($respPublish | ConvertTo-Json)

$respPublish | ConvertTo-Json -Depth 10 | Out-File 'final-publish-result.txt' -Encoding UTF8
Write-Host "Done! Final project status saved to final-publish-result.txt"
