# Release checklist

Use this checklist for each release. Record evidence for completed checks and disclose verification gaps. Mobile verification and external user feedback remain open; removing the beta designation does not claim those checks have been completed.

## Before tagging

- [x] Run the CI checks in [testing.md](testing.md), including the Chromium integration suite and build.
- [ ] Test the built files in a disposable Obsidian vault. Check the flows in [demo-script.md](demo-script.md), light and dark themes, settings, the `%% mfe:off` directive, and reload/unload behavior.
- [x] Record the Obsidian version and desktop platform used for manual verification: Obsidian 1.14.2 on macOS, disposable demo vault. Settings, enable/disable, enhanced rendering, and both themes checked.
- [ ] Verify behavior on a mobile device. The manifest does not mark the plugin desktop-only, but mobile behavior is not yet verified.
- [ ] Obtain external user feedback and record issues or findings. External user testing is currently pending.
- [x] Record a short demo in actual Obsidian and review it for accidental exposure of private vault content: [capture report](assets/obsidian-capture-report.md), real light/dark screenshots, path GIF, and MP4. Only synthetic demo content is visible.
- [x] Confirm `manifest.json`, `versions.json`, and `CHANGELOG.md` agree on the version. Make the release tag exactly match the manifest version and omit a leading `v`.
- [x] Confirm the repository’s GitHub Actions identity can create releases and upload assets: [0.1.0 release workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37954104444) succeeded.

## Publish

Complete automated and isolated Obsidian checks, and disclose outstanding device and external verification. Push the version tag. The release workflow builds the plugin and attaches `main.js`, `manifest.json`, and `styles.css`. Inspect the generated GitHub release and download all three assets to verify that they are present and belong to the same build.

## Upgrade and rollback

The plugin stores its preferences through Obsidian's plugin data API. The current settings are `compactLayout` (default `true`), `pathHighlight` (`true`), `animationDuration` (`450` ms), and `hoverDelay` (`180` ms). Missing or invalid values are normalized to defaults or supported numeric bounds when the plugin loads. There is no note-content migration.

For an upgrade, disable the plugin before replacing its release files. Keep a copy of the existing plugin directory, including its plugin data file if present. Install the new `main.js`, `manifest.json`, and `styles.css` together, then re-enable the plugin and open the demo notes. If the new version causes a problem, disable it, restore the previous three files as a set, and re-enable the plugin. Removing the plugin's code leaves Mermaid blocks in notes intact; Obsidian falls back to its regular Mermaid renderer. Preserve or restore the plugin data file separately if you need to recover its prior preferences.

## 0.1.0 release verification

[Desktop beta release](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.0) published on 2026-10-09. All 17 unit and 11 browser tests passed in the release workflow. All three assets were downloaded and their SHA-256 hashes matched the local build. The downloaded files were installed together in the clean demo vault, the plugin reloaded enabled at version 0.1.0, enhanced SVG remained present with `filter:none`, and `dev:errors` reported no errors. The owner accepted the directory’s developer/support commitments on 2026-10-09. The [listing](https://community.obsidian.md/plugins/mermaid-flow-enhancer) is published with light/dark screenshots, Free payment type, and Visualization/Charts categories. The directory discovered 0.1.0 and completed its review without errors, including byte-for-byte build reproduction; mobile/external beta checks remain open.

Directory releases use normal GitHub releases with numeric `x.y.z` tags. Use the current plugin name and version in release titles; do not mark directory releases as GitHub pre-releases. Release 0.1.0’s pre-release flag was cleared during submission after the directory reported no matching release.

## 0.1.1 release verification

[Release 0.1.1](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.1) and its [workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37956215078) passed all 29 tests (17 unit, 12 Chromium) and produced GitHub artifact attestations. The three downloaded assets matched the local build byte-for-byte. `gh attestation verify` succeeded for `main.js`; the directory independently verified attestations for both JavaScript and CSS.

The downloaded release is installed and enabled in the disposable Downloads demo vault on Obsidian 1.14.2/macOS. Reload succeeds, enhanced SVG is present with `filter:none`, and the developer error log is empty. Demo preferences were preserved after the install test. The public listing now exposes an active Add to Obsidian link. The CLI catalogue install test reported “Plugin not found in community plugins”; direct catalogue installation remains unverified, so the release files were installed manually. No original user-vault plugin files were replaced.

The official 0.1.1 directory scan completed on 2026-10-09 and made 0.1.1 the current version. Build verification reproduced the release JavaScript byte-for-byte. The remaining finding is a CSS warning about scoped `!important`, in that release. The current source removes these declarations; publish a new release and verify its directory scan to close the finding.

## 0.1.2 release verification

[Release 0.1.2](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.2) refines the dark palette and centers connector attachments, including return paths, with 8px arrowheads. The [release workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37959501468) passed all 34 tests (20 unit, 14 Chromium), built the plugin, and attested release assets. The lead also ran the full local check successfully. The three downloaded files match the local build byte-for-byte.

New browser checks measure actual side-center positions and terminal tangents in TD/TB/BT/LR/RL, circles, and nested subgraphs, including Mermaid's native rounded quadratic paths. Actual Obsidian 1.14.2/macOS rendering in the disposable demo vault was refreshed with a versioned synthetic fixture: all 18 endpoints match shape side centers, the referenced pointEnd marker is 8×8, and the developer error log is empty. Cached diagrams may need a note refresh after a plugin update.

The official 0.1.2 directory review completed and made 0.1.2 the current release. The directory verified both artifact attestations and reproduced the release JavaScript byte-for-byte; the remaining finding is the previously documented scoped CSS `!important` warning.

## VirusTotal gate

- Configure the repository secret `VIRUSTOTAL_API_KEY`.
- Require completed analyses for all three exact release artifacts, with no malicious/suspicious detections and at least one engine verdict each.
- Review JSON statistics for failed/unsupported engines; preserve reports and SHA-256 hashes with the release.
- Missing key, API errors, empty results, and timeouts block publication. See [setup and status](virus-scanning.md).

VirusTotal baseline: release 0.1.2 completed the [real API scan](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37963960312) on 2026-10-09, with 0/60, 0/61, and 0/56 completed-engine detections. All three hashes matched independent release downloads; both reports are attached to the release. [Full statistics](security/virustotal-0.1.2.json) preserve engine failures/timeouts/unsupported results. All 48 tests and build passed locally and in GitHub CI.

## 1.0.0 release verification

[Release 1.0.0](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/1.0.0) was published on 2026-10-09 without the beta designation. Its [workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37971215293) passed all linters, strict TypeScript checking, 34 unit tests, 14 Chromium integration tests, the build, VirusTotal, and GitHub artifact attestations. All three downloaded plugin files match the tested local build byte-for-byte. Independent attestation verification succeeded for JavaScript and CSS.

Real Obsidian 1.14.4/Linux inside Docker passed with plugin 1.0.0, both light and dark palettes, eight fixture nodes, and 18 connector endpoints with zero side-center error. No host desktop application or personal vault was used. [VirusTotal statistics](security/virustotal-1.0.0.json) record 0/59, 0/60, and 0/61 detections for JavaScript, manifest, and CSS respectively.

The official directory review completed and promoted 1.0.0 to the current public version. It reproduced `main.js` byte-for-byte and verified both attestations. The `!important` CSS warning is resolved. The review has non-blocking source warnings about timer window compatibility, inferred DOM typing, unbound methods, Obsidian element helpers, and searchable settings, plus recommendations about the deprecated slider tooltip and attached antivirus reports. These findings are follow-up work, not claims of completed fixes. Mobile verification and external user feedback remain pending. The public listing description no longer labels the plugin beta.

## 1.0.1 release verification

[Release 1.0.1](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/1.0.1) and its [workflow](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37974552685) passed all linters, strict TypeScript checks, 38 unit tests, 14 browser tests, build, VirusTotal, and artifact attestations. The release contains exactly `main.js`, `manifest.json`, and `styles.css`. Scan reports are preserved in release notes, CI artifacts, and [the public archive](security/virustotal-1.0.1.json). All three downloaded files match the local build and scan hashes byte-for-byte; independent attestation verification passed for JavaScript and CSS.

Obsidian 1.14.4/Linux in Docker rendered both themes with 18 centered connector endpoints and no application errors. The separate native settings window displayed both toggles and both sliders, with the expected 450 ms and 180 ms defaults. No personal vault or host desktop app was used. New regression tests verify timer ownership across multiple windows and the searchable settings definitions.

Timers now use their SVG owner's window; source callbacks and DOM access have explicit types; event handlers retain their controller receiver; canvas creation uses Obsidian helpers; settings use the declarative API and no deprecated tooltip. Source safety rules prevent recurrence.

The official directory review completed on 2026-10-09 and promoted 1.0.1 to the current public release. All listed source warnings and recommendations are resolved, including unsupported release files. The review shows only passes, verifies both attestations, and reproduces release JavaScript byte-for-byte.
