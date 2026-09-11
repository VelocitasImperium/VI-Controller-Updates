$ErrorActionPreference = 'Stop'

$cloudflareFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryFolder = Split-Path -Parent $cloudflareFolder
$wranglerConfig = Join-Path $cloudflareFolder 'wrangler.jsonc'
$bucketName = 'vi-controller-updates'
$uploadRoots = @('latest.ini', 'control-center', 'firmware', 'dashboards')

foreach ($entry in $uploadRoots) {
    $entryPath = Join-Path $repositoryFolder $entry
    $files = if (Test-Path -LiteralPath $entryPath -PathType Leaf) {
        @(Get-Item -LiteralPath $entryPath)
    } else {
        @(Get-ChildItem -LiteralPath $entryPath -File -Recurse)
    }

    foreach ($file in $files) {
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
}

Write-Host 'Cloudflare R2 upload complete.'
