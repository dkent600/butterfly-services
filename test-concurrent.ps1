# Test concurrent requests to check nonce generation
Write-Host "Testing concurrent balance requests..."

$jobs = @()
$assets = @("BTC", "ETH", "SOL", "ADA", "DOGE")

# Fire off multiple concurrent requests
foreach ($asset in $assets) {
  $jobs += Start-Job -ScriptBlock {
    param($asset)
    curl -s "http://localhost:3000/api/v1/kraken/balance/$asset"
  } -ArgumentList $asset
}

# Wait for all jobs to complete and collect results
Write-Host "Waiting for all requests to complete..."
$results = $jobs | Wait-Job | Receive-Job

# Clean up jobs
$jobs | Remove-Job

# Display results
Write-Host "`nResults:"
foreach ($result in $results) {
  Write-Host $result
}

Write-Host "`nTest completed."
