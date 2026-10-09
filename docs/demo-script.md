# Beta demo script

Use a disposable vault. Enable the plugin and open the Markdown files in `demo-vault/`.

1. Open `Examples/decision-branches.md`. In both light and dark themes, compare the two outgoing branches from each decision. Check label legibility and arrow direction.
2. Open `Examples/cycle-and-ids.md`. Hover `retry_step`, then follow the connector toward `verify_again`. The ancestor search should terminate on the cycle and keep the IDs with underscores distinct.
3. Open `Examples/opt-out.md`. Confirm the diagram marked `%% mfe:off` keeps its ordinary Mermaid rendering; the neighboring diagram remains enhanced.
4. Open `Generated/big100.md`, then `Generated/big300.md`. Move between several nodes and edges and observe whether the diagram remains usable. These files are stress fixtures, not promises about speed or supported graph size.
5. Focus nodes with the keyboard and check that the same ancestor path appears. Move focus away and confirm the highlight clears.

Record the Obsidian version, operating system, theme, which file was used, and any rendering or interaction issue. The external beta feedback round and directory submission remain pending.
