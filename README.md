# VI Controller Updates

Public, compiled update files for VI Control Center. Source code remains in the private development repository.

## Publish a Control Center update

1. Build `VI_ControlCenter.dll` and calculate its SHA-256.
2. Add the DLL under `control-center/` with its version in the filename.
3. Update `control-center.version`, `.url`, and `.sha256` in `latest.ini`.
4. Commit and push both files together.

## Publish firmware

1. Compile the correct UF2 for each product.
2. Add the UF2 under `firmware/`.
3. Update that product's `version`, `url`, and `sha256` lines in `latest.ini`.
4. Commit and push together. The Control Center checks the connected board model before it offers firmware.

The updater refuses files without a matching SHA-256 hash.

## Cloudflare download service

The `cloudflare/` directory contains the download Worker. It serves only
`latest.ini`, `control-center/`, `firmware/`, and `dashboards/` from the private
`vi-controller-updates` R2 bucket. Bucket listing is never exposed.

Production endpoint:

`https://vi-update-downloads.velocitasimperium.workers.dev`

Initial deployment:

1. Enable R2 for the Cloudflare account.
2. Run `npx wrangler r2 bucket create vi-controller-updates`.
3. Run `powershell -ExecutionPolicy Bypass -File cloudflare/upload-updates.ps1`.
4. Run `npx wrangler deploy --config cloudflare/wrangler.jsonc`.
5. Test `https://vi-update-downloads.velocitasimperium.workers.dev/latest.ini`.
6. Optionally attach a custom download domain later and change the manifest host
   in a normal versioned release.

Versioned packages use a one-year immutable cache. The mutable manifest uses a
60-second cache so new releases appear promptly. Cloudflare request analytics can
group traffic by country and requested path without placing an identifier in the
plugin.

For subsequent releases, update the packages and `latest.ini`, then run
`powershell -ExecutionPolicy Bypass -File cloudflare/upload-updates.ps1`. The
script reads each five-version history from the manifest and uploads packages
before publishing the new manifest.

## Current test update

`V0.2.12` Control Center and `V0.2.13` VI-RSR firmware are the first end-to-end updater test packages. The RSR UF2 is a genuine build, not a dummy file.
