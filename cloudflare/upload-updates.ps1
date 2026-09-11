$ErrorActionPreference = 'Stop'

$cloudflareFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryFolder = Split-Path -Parent $cloudflareFolder
$wranglerConfig = Join-Path $cloudflareFolder 'wrangler.jsonc'
$bucketName = 'vi-controller-updates'
$manifestPath = Join-Path $repositoryFolder 'latest.ini'
$manifest = @{}

foreach ($line in Get-Content -LiteralPath $manifestPath) {
    $separator = $line.IndexOf('=')
    if ($separator -gt 0 -and -not $line.TrimStart().StartsWith('#')) {
        $manifest[$line.Substring(0, $separator).Trim()] = $line.Substring($separator + 1).Trim()
    }
}

$uploadPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

foreach ($historyEntry in $manifest.GetEnumerator() | Where-Object Key -Like '*.history') {
    $prefix = $historyEntry.Key.Substring(0, $historyEntry.Key.Length - '.history'.Length)
    foreach ($version in $historyEntry.Value.Split(',') | Select-Object -First 5) {
        $urlKey = "$prefix.$($version.Trim()).url"
        if (-not $manifest.ContainsKey($urlKey)) { continue }
        $urlPath = [Uri]::UnescapeDataString(([Uri]$manifest[$urlKey]).AbsolutePath.TrimStart('/'))
        $relativePath = $null
        foreach ($knownFolder in @('control-center/', 'firmware/', 'dashboards/')) {
            $folderIndex = $urlPath.IndexOf($knownFolder, [System.StringComparison]::OrdinalIgnoreCase)
            if ($folderIndex -ge 0) {
                $relativePath = $urlPath.Substring($folderIndex).Replace('/', '\')
                break
            }
        }
        if (-not $relativePath) { continue }
        $filePath = Join-Path $repositoryFolder $relativePath
        if (Test-Path -LiteralPath $filePath -PathType Leaf) { [void]$uploadPaths.Add($filePath) }
    }
}

foreach ($dashboard in Get-ChildItem -LiteralPath (Join-Path $repositoryFolder 'dashboards') -File) {
    [void]$uploadPaths.Add($dashboard.FullName)
}

foreach ($filePath in @($uploadPaths | Sort-Object) + @($manifestPath)) {
    $file = Get-Item -LiteralPath $filePath
    $relativePath = $file.FullName.Substring($repositoryFolder.Length).TrimStart('\').Replace('\', '/')
    $contentType = switch ($file.Extension.ToLowerInvariant()) {
        '.ini' { 'text/plain; charset=utf-8' }
        '.dll' { 'application/octet-stream' }
        '.uf2' { 'application/octet-stream' }
        '.simhubdash' { 'application/zip' }
        default { 'application/octet-stream' }
    }

    Write-Host "Uploading $relativePath"
    & npx --yes wrangler r2 object put "$bucketName/$relativePath" --file $file.FullName --content-type $contentType --remote --config $wranglerConfig
    if ($LASTEXITCODE -ne 0) { throw "Upload failed for $relativePath" }
}

Write-Host 'Cloudflare R2 upload complete. Packages were published before the manifest.'
