const mermaid = require("mermaid").default;
const { styleSvg } = require("../src/layout");
const { createPathController } = require("../src/highlight");
const pluginCss = require("../styles.css");

const source = `flowchart LR
  request["Feature request"] --> triage["Triage the request"]
  triage --> ready{"Ready to build?"}
  ready -->|No| clarify["Clarify scope"]
  clarify --> triage
  ready -->|Yes| implement["Implement change"]
  implement --> review["Review and test"]
  review --> passed{"Checks pass?"}
  passed -->|No| implement
  passed -->|Yes| release["Release"]
  release --> done(("Complete"))`;

const root = document.documentElement;
const diagram = document.getElementById("diagram");
let compactLayout = true;
let renderId = 0;
const pathController = createPathController(document, () => ({ pathHighlight: true, hoverDelay: 180 }));
document.addEventListener("pointerover", pathController.enter);
document.addEventListener("pointerout", pathController.leave);
document.addEventListener("focusin", pathController.enter);
document.addEventListener("focusout", pathController.leave);

async function render() {
  const thisRender = ++renderId;
  const dark = root.classList.contains("theme-dark");
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: dark ? "dark" : "base",
    themeVariables: { darkMode: dark, primaryColor: dark ? "#1f2020" : "#f5f5f5",
      primaryTextColor: dark ? "#cccccc" : "#333333", primaryBorderColor: dark ? "#aaaaaa" : "#888888",
      lineColor: dark ? "#cccccc" : "#555555", fontSize: "16px" },
    flowchart: { curve: "step", nodeSpacing: 28, rankSpacing: 26, padding: 10, diagramPadding: 4, wrappingWidth: 140, useMaxWidth: false } });
  const result = await mermaid.render(`demo-flow-${thisRender}`, source);
  if (thisRender !== renderId) return;
  const svg = result.svg;
  diagram.innerHTML = styleSvg(svg, "LR", { compactLayout, animationDuration: 450 });
}

window.measureFlow = async count => {
  const lines = ["flowchart LR", "n0[Start]"];
  for (let i = 1; i < count; i++) lines.push(`n${i - 1} --> n${i}[Step ${i}]`);
  const started = performance.now();
  const result = await mermaid.render(`perf-flow-${count}`, lines.join("\n"));
  const svg = result.svg;
  const enhanced = styleSvg(svg, "LR", { compactLayout: true, animationDuration: 450 });
  return { nodes: count, edges: count - 1, renderAndEnhanceMs: +(performance.now() - started).toFixed(1), svgBytes: enhanced.length };
};

document.head.insertAdjacentHTML("beforeend", `<style>${pluginCss}</style>`);
document.getElementById("theme").addEventListener("click", async event => {
  root.classList.toggle("theme-dark"); root.classList.toggle("theme-light");
  document.body.classList.toggle("theme-dark"); document.body.classList.toggle("theme-light");
  event.currentTarget.textContent = root.classList.contains("theme-dark") ? "Switch to light" : "Switch to dark";
  await render();
});
document.getElementById("compact").addEventListener("click", async event => {
  compactLayout = !compactLayout;
  event.currentTarget.textContent = `Compact nodes: ${compactLayout ? "on" : "off"}`;
  await render();
});
render();
