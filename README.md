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

## Current test update

`V0.2.12` Control Center and `V0.2.13` VI-RSR firmware are the first end-to-end updater test packages. The RSR UF2 is a genuine build, not a dummy file.
