# Safari macOS Build And Package Notes

This document is the maintainer-facing workflow for building and packaging the current Safari alpha on macOS.

It reflects the repo as it exists now, not the original spike plan.

## Current State

- Safari has a dedicated build target
- The Safari manifest lives at `safari/manifest.json`
- The wrapper project is committed under `safari-app/`
- The wrapper references `dist/safari/` assets directly

That last point matters: Xcode does not build the RES JavaScript bundle for you.

## Prerequisites

Before attempting a Safari build, make sure the local machine has:

- `git`
- Node.js 22.x
- `yarn`
- Xcode with Apple's Safari Web Extension packager available through `xcrun`
- Safari on macOS with the Develop menu available for extension testing

In practice, this repo currently installs and builds cleanly with Node 22. The dependency tree rejected Node 24 during setup because `ava@6.1.3` caps its supported engine range below that version.

## Local Build Flow

### 1. Install dependencies

```sh
yarn install
```

### 2. Build the Safari development bundle

```sh
node build.js --mode development --browsers safari
```

Expected output:

- `dist/safari/`

### 3. Optionally build a production-style zip

```sh
node build.js --mode production --zip --browsers safari
```

Expected output:

- `dist/zip/safari.zip`

### 4. Build the wrapper app

Open the committed Xcode project in `safari-app/`, or build it from the command line:

```sh
xcodebuild -project "safari-app/Reddit Enhancement Suite Safari/Reddit Enhancement Suite Safari.xcodeproj" \
  -scheme "Reddit Enhancement Suite Safari" \
  -destination generic/platform=macOS \
  build
```

## Signing And Staying Enabled

Both wrapper targets sign automatically with team `77NZY979RW` and an Apple Development certificate. No provisioning profile is needed for the current entitlements.

Ad-hoc builds depend on Safari's "Allow unsigned extensions" setting, which resets whenever Safari quits. That is what turned the extension off between sessions.

To install a build for daily use, build and copy it to `/Applications`:

```sh
yarn build:safari
xcodebuild -project "safari-app/Reddit Enhancement Suite Safari/Reddit Enhancement Suite Safari.xcodeproj" \
  -scheme "Reddit Enhancement Suite Safari" \
  -configuration Release \
  -derivedDataPath /tmp/res-safari-build \
  build
ditto "/tmp/res-safari-build/Build/Products/Release/Reddit Enhancement Suite Safari.app" \
  "/Applications/Reddit Enhancement Suite Safari.app"
rm -rf /tmp/res-safari-build
open "/Applications/Reddit Enhancement Suite Safari.app"
```

Notes:

- Other copies with the same bundle identifier, such as old `DerivedData` builds, can compete with the installed app. Remove them.
- Rebuild before the signing certificate expires (currently April 2027).
- Regenerating the wrapper removes `DEVELOPMENT_TEAM` and `CODE_SIGN_IDENTITY`, so set them again afterwards.
- Developer ID signing and notarization are not a substitute. Apple limits Safari web extension distribution to the App Store, and notarized builds have been reported to still need "Allow unsigned extensions".

## Wrapper Regeneration

If the wrapper project needs to be regenerated from `dist/safari/`, use Apple's packager:

```sh
xcrun safari-web-extension-packager dist/safari \
  --project-location safari-app \
  --app-name "Reddit Enhancement Suite Safari" \
  --bundle-identifier com.honestbleeps.redditenhancementsuite.safari \
  --swift \
  --macos-only \
  --no-open \
  --no-prompt
```

Notes:

- Regenerating the wrapper can overwrite local Xcode project changes.
- If the bundle identifier changes, update the generated project and any related docs together.
- Ignore user-specific Xcode files such as `xcuserdata/` and Finder metadata such as `.DS_Store`.

## Important Caveats

### Xcode does not rebuild `dist/safari/`

The committed wrapper project references files under `dist/safari/` directly. Rebuild the Safari bundle before running from Xcode whenever JavaScript, CSS, or manifest files have changed.

If this becomes annoying, add an Xcode build phase later. For now, the requirement should stay documented and explicit.

### Safari currently warns about unsupported manifest permissions

On April 23, 2026, Apple's packager warned that the current Safari version does not support these manifest keys as currently declared:

- `history`
- `downloads`

Those warnings do not block wrapper generation, but they do mean the runtime code needs explicit Safari degradation instead of assuming the APIs work.

The current branch degrades the `history` and `downloads` paths more safely in Safari, but those behaviors still need manual validation before they should be treated as polished.

In particular, Safari currently uses an anchor-based fallback for downloads. For third-party media URLs, that may open the asset in a new tab or a browser-native save/view path instead of honoring the requested filename. That is expected alpha behavior, not necessarily a regression.

Safari does not declare the unsupported `geolocation` permission. Location-based automatic night mode is not offered in Safari, and stale saved values are normalized back to `none` at runtime. User-defined and system-color-scheme night mode remain available.

### The wrapper deployment target is normalized in the committed project

The committed project now resolves both the app and extension targets to `MACOSX_DEPLOYMENT_TARGET = 10.14`.

If the wrapper is regenerated, verify that Apple’s tools or newer Xcode defaults did not restore the bad inherited deployment target we previously saw at the project level.

## Current Observed Outputs

These have already been confirmed locally:

- `dist/safari/` builds successfully
- `dist/zip/safari.zip` builds successfully
- The committed wrapper project builds successfully
- The committed wrapper project now builds with the deployment target normalized to macOS 10.14
- Apple's Safari packager no longer warns about `geolocation`
- The settings page loads in Safari
- The toolbar CSS toggle works
- `showImages` works
- Infinite scroll works

## Still Needing Validation

- Clean-machine signing and enablement workflow
- Private browsing correctness after the new isolation path
- Downloads behavior with the Safari fallback path
- History-backed feature degradation in real usage
- Backup/restore and auth-provider behavior after Safari idle/wake cycles
- Night mode user-defined and system-color-scheme behavior

## Alpha Polish Still Open

- Confirm the current Safari foreground timeout is generous enough for cold wakes but still catches pathological hangs
- Consider an Xcode Run Script phase if the manual `dist/safari/` prebuild requirement becomes too easy to miss

If any of those assumptions change, update this file alongside the build script, Safari manifest, or wrapper project.
