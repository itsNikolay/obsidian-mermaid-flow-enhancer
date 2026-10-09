# Agent collaboration

Work directly in the main repository; do not use git worktrees. Give parallel agents separate files and agree on module interfaces before editing. Do not edit the user vault or record private notes. The lead reviews changes and runs the full checks.

## Obsidian verification and recording

Run future Obsidian checks and demonstration recordings in the project's Docker environment, using the Linux Obsidian application on its isolated virtual display. Do not launch or control Obsidian on the user's desktop for these tasks. Use only the synthetic demo vault created inside the container; never mount a personal vault, host Obsidian configuration, or credentials. Export screenshots, videos, and check results to `artifacts/docker/`. See [the Docker workflow](docs/docker-testing.md). Browser-only tests remain useful, but do not describe them as checks in Obsidian.
