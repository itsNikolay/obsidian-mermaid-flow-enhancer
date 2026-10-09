# VirusTotal release scanning

The release workflow submits only the three public plugin artifacts (`main.js`, `manifest.json`, `styles.css`) to the VirusTotal v3 API before publishing. It waits for completed analyses and requires at least one engine verdict per file. Malicious or suspicious detections, invalid/empty results, missing credentials, API failures, or incomplete analyses block publication. Timeouts, failed engines, and unsupported file types remain visible in JSON statistics; they are not counted as no-detection verdicts.

The uploaded files are included in VirusTotal's community dataset. The allowlist and manifest validation prevent this workflow from uploading notes or arbitrary directories. Nothing runs inside the installed Obsidian plugin; it has no API key or new network behavior.

## Configure

Create a VirusTotal Community API key and save it in this GitHub repository under **Settings → Secrets and variables → Actions → New repository secret**, named `VIRUSTOTAL_API_KEY`. Never commit it, paste it into an issue/chat, or place it in plugin settings. The workflow fails rather than silently skipping scanning if the key is missing.

The public API permits 4 requests per minute and 500 per day. Requests are spaced at least 16 seconds apart; rate-limit/server retries are bounded. Release and manual scan workflows share a concurrency group to avoid simultaneous runs using the same key. The public API has usage restrictions, including commercial use: choose the appropriate account/API plan for your use.

## Scan a published release

Open **Actions → VirusTotal release scan → Run workflow**, enter a tag such as `0.1.2`, and run. This downloads the exact published bytes, not a new local build. The run summary and its `virustotal-report` artifact contain a Markdown report, JSON engine counts, SHA-256 hashes, analysis IDs, and links to VirusTotal. The manual job does not replace release files.

## Local scan

With `VIRUSTOTAL_API_KEY` set securely in your environment:

```sh
npm run build
npm run scan:virustotal
# Or scan three already-downloaded published files:
npx tsx scripts/scan-virustotal.mts /path/to/release-files
```

Only regular allowlisted files up to 32 MiB are accepted; symlinks are rejected. The release manifest must identify Mermaid Flow Enhancer. JSON/Markdown reports are written to `artifacts/virustotal/`. The scanner verifies that local files still match the uploaded hashes at completion.

A “no-detections” result is a scan result, not proof that software is safe. Security review, dependency updates, and build attestations remain necessary. Tests use mocked HTTP responses and a fake clock, without submitting test fixtures or malware samples to the public API.

## Current status

The repository secret is configured. The [manual scan of release 0.1.2](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/actions/runs/37963960312) completed successfully on 2026-10-09. Exact published hashes were independently compared with the downloaded report. Completed engine verdicts: `main.js` 0/60 detections, `manifest.json` 0/61, `styles.css` 0/56. One JavaScript engine failed, five CSS engines timed out, and 14 engines per file did not support the format; those are excluded from the completed-verdict counts and preserved in the [JSON report](security/virustotal-0.1.2.json).

Read the [Markdown report](security/virustotal-0.1.2.md); both report formats are also attached to the [0.1.2 release](https://github.com/itsNikolay/obsidian-mermaid-flow-enhancer/releases/tag/0.1.2). The full CI passed 34 unit tests and 14 browser integration tests (48 total), including 14 new mocked security tests. Earlier releases have not been claimed as scanned.

## API references

- [Authentication and getting started](https://docs.virustotal.com/reference/getting-started)
- [Public API quota and usage restrictions](https://docs.virustotal.com/reference/public-vs-premium-api)
- [File upload and community dataset inclusion](https://docs.virustotal.com/reference/files-scan)
- [Analysis status and engine statistics](https://docs.virustotal.com/reference/analyses-object)
