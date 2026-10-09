# Demo script

Use a disposable vault. Enable the plugin and open the Markdown files in `demo-vault/`.

1. Open `Examples/decision-branches.md`. In both light and dark themes, compare the two outgoing branches from each decision. Check label legibility and arrow direction.
2. Open `Examples/cycle-and-ids.md`. Hover `retry_step`, then follow the connector toward `verify_again`. The ancestor search should terminate on the cycle and keep the IDs with underscores distinct.
3. Open `Examples/opt-out.md`. Confirm the diagram marked `%% mfe:off` keeps its ordinary Mermaid rendering; the neighboring diagram remains enhanced.
4. Open `Generated/big100.md`, then `Generated/big300.md`. Move between several nodes and edges and observe whether the diagram remains usable. These files are stress fixtures, not promises about speed or supported graph size.
5. Focus nodes with the keyboard and check that the same ancestor path appears. Move focus away and confirm the highlight clears.

Record the Obsidian version, operating system, theme, which file was used, and any rendering or interaction issue. External user feedback and mobile verification remain pending. The community directory listing is published.

## Everyday-process recording

`npm run docker:record` uses [grocery delivery](../demo-vault/Examples/grocery-delivery.md): a single-screen, 17-node flowchart with six node shapes, parallel address/time entry, yes/no branches, replacement and payment loops, basket/order storage, a receipt, and dotted notifications. The recording visits successful and alternative routes and a connector in both themes without scrolling. Node highlighting and the final ancestor path are checked automatically. Captions are in English for the public README. The recording checks that the diagram lies inside the 1440 × 1000 virtual screen. `docker:check` retains the smaller fixture and its strict centered-endpoint assertions.
