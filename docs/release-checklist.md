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
- [ ] Confirm the repository's GitHub Actions identity has permission to create releases and upload assets. GitHub release authentication and a completed release run are currently pending.

## Publish

For an initial beta, complete automated and desktop checks and disclose the remaining device/external checks. Complete the full checklist before a stable release. Push the version tag. The release workflow builds the plugin and attaches `main.js`, `manifest.json`, and `styles.css`. Inspect the generated GitHub release and download all three assets to verify that they are present and belong to the same build.

## Upgrade and rollback

The plugin stores its preferences through Obsidian's plugin data API. The current settings are `compactLayout` (default `true`), `pathHighlight` (`true`), `animationDuration` (`450` ms), and `hoverDelay` (`180` ms). Missing or invalid values are normalized to defaults or supported numeric bounds when the plugin loads. There is no note-content migration.

For an upgrade, disable the plugin before replacing its release files. Keep a copy of the existing plugin directory, including its plugin data file if present. Install the new `main.js`, `manifest.json`, and `styles.css` together, then re-enable the plugin and open the demo notes. If the new version causes a problem, disable it, restore the previous three files as a set, and re-enable the plugin. Removing the plugin's code leaves Mermaid blocks in notes intact; Obsidian falls back to its regular Mermaid renderer. Preserve or restore the plugin data file separately if you need to recover its prior preferences.
