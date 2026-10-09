export default {
  extends: ['stylelint-config-standard'],
  rules: { 'declaration-no-important': true },
  overrides: [
    {
      files: ['styles.css'],
      rules: {
        // Mermaid owns these case-sensitive SVG class names (nodeLabel, edgePath, etc.).
        'selector-class-pattern': '^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*|labelBox|nodeLabel|edgeLabel|messageText|noteText|loopText|labelText|edgePath|messageLine[01]|labelBkg|loopLine|edgeLabels)$',
      },
    },
  ],
};
