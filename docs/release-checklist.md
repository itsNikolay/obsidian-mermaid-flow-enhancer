# Beta release checklist

Use this checklist for each candidate release. The project is still in beta. External user testing and mobile verification remain requirements for a stable release; they do not claim to be covered by the initial desktop beta. Record evidence for each completed check.

## Before tagging

- [x] Run the CI checks in [testing.md](testing.md), including the Chromium integration suite and build.
- [ ] Test the built files in a disposable Obsidian vault. Check the flows in [demo-script.md](demo-script.md), light and dark themes, settings, the `%% mfe:off` directive, and reload/unload behavior.
- [x] Record the Obsidian version and desktop platform used for manual verification: Obsidian 1.14.2 on macOS, disposable demo vault. Settings, enable/disable, enhanced rendering, and both themes checked.
- [ ] Verify behavior on a mobile device. The manifest does not mark the plugin desktop-only, but mobile behavior is not yet verified.
- [ ] Obtain external beta feedback and record issues or findings. External user testing is currently pending.
- [x] Record a short demo in actual Obsidian and review it for accidental exposure of private vault content: [capture report](assets/obsidian-capture-report.md), real light/dark screenshots, path GIF, and MP4. Only synthetic demo content is visible.
- [x] Confirm `manifest.json`, `versions.json`, and `CHANGELOG.md` agree on the version. Make the release tag exactly match the manifest version and omit a leading `v`.
- [x] Confirm the repository’s GitHub Actions identity can create releases and upload assets: [0.1.0 release workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37954104444) succeeded.

## Publish

For an initial beta, complete automated and desktop checks and disclose the remaining device/external checks. Complete the full checklist before a stable release. Push the version tag. The release workflow builds the plugin and attaches `main.js`, `manifest.json`, and `styles.css`. Inspect the generated GitHub release and download all three assets to verify that they are present and belong to the same build.

## Upgrade and rollback

The plugin stores its preferences through Obsidian's plugin data API. The current settings are `compactLayout` (default `true`), `pathHighlight` (`true`), `animationDuration` (`450` ms), and `hoverDelay` (`180` ms). Missing or invalid values are normalized to defaults or supported numeric bounds when the plugin loads. There is no note-content migration.

For an upgrade, disable the plugin before replacing its release files. Keep a copy of the existing plugin directory, including its plugin data file if present. Install the new `main.js`, `manifest.json`, and `styles.css` together, then re-enable the plugin and open the demo notes. If the new version causes a problem, disable it, restore the previous three files as a set, and re-enable the plugin. Removing the plugin's code leaves Mermaid blocks in notes intact; Obsidian falls back to its regular Mermaid renderer. Preserve or restore the plugin data file separately if you need to recover its prior preferences.

## 0.1.0 release verification

[Desktop beta release](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.0) published on 2026-10-09. All 17 unit and 11 browser tests passed in the release workflow. All three assets were downloaded and their SHA-256 hashes matched the local build. The downloaded files were installed together in the clean demo vault, the plugin reloaded enabled at version 0.1.0, enhanced SVG remained present with `filter:none`, and `dev:errors` reported no errors. The owner accepted the directory’s developer/support commitments on 2026-10-09. The [listing](https://community.obsidian.md/plugins/mermaid-flow-enhancer) is published with light/dark screenshots, Free payment type, and Visualization/Charts categories. The directory discovered 0.1.0 and completed its review without errors, including byte-for-byte build reproduction; mobile/external beta checks remain open.

Directory releases use normal GitHub releases with numeric `x.y.z` tags. Keep beta status explicit in titles and documentation; do not mark directory releases as GitHub pre-releases. Release 0.1.0’s pre-release flag was cleared during submission after the directory reported no matching release.

## 0.1.1 release verification

[Release 0.1.1](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.1) and its [workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37956215078) passed all 29 tests (17 unit, 12 Chromium) and produced GitHub artifact attestations. The three downloaded assets matched the local build byte-for-byte. `gh attestation verify` succeeded for `main.js`; the directory independently verified attestations for both JavaScript and CSS.

The downloaded release is installed and enabled in the disposable Downloads demo vault on Obsidian 1.14.2/macOS. Reload succeeds, enhanced SVG is present with `filter:none`, and the developer error log is empty. Demo preferences were preserved after the install test. The public listing now exposes an active Add to Obsidian link. The CLI catalogue install test reported “Plugin not found in community plugins”; direct catalogue installation remains unverified, so the release files were installed manually. No original user-vault plugin files were replaced.

The official 0.1.1 directory scan completed on 2026-10-09 and made 0.1.1 the current version. Build verification reproduced the release JavaScript byte-for-byte. The remaining finding is a CSS warning about scoped `!important`, whose necessity and isolation are documented and browser-tested.

## 0.1.2 release verification

[Release 0.1.2](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.2) refines the dark palette and centers connector attachments, including return paths, with 8px arrowheads. The [release workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37959501468) passed all 34 tests (20 unit, 14 Chromium), built the plugin, and attested release assets. The lead also ran the full local check successfully. The three downloaded files match the local build byte-for-byte.

New browser checks measure actual side-center positions and terminal tangents in TD/TB/BT/LR/RL, circles, and nested subgraphs, including Mermaid's native rounded quadratic paths. Actual Obsidian 1.14.2/macOS rendering in the disposable demo vault was refreshed with a versioned synthetic fixture: all 18 endpoints match shape side centers, the referenced pointEnd marker is 8×8, and the developer error log is empty. Cached diagrams may need a note refresh after a plugin update.

The official 0.1.2 directory review completed and made 0.1.2 the current release. The directory verified both artifact attestations and reproduced the release JavaScript byte-for-byte; the remaining finding is the previously documented scoped CSS `!important` warning.

## VirusTotal gate

- Configure the repository secret `VIRUSTOTAL_API_KEY`.
- Require completed analyses for all three exact release artifacts, with no malicious/suspicious detections and at least one engine verdict each.
- Review JSON statistics for failed/unsupported engines; preserve reports and SHA-256 hashes with the release.
- Missing key, API errors, empty results, and timeouts block publication. See [setup and status](virus-scanning.md).
