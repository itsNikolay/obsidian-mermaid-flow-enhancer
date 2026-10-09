const { Plugin, loadMermaid } = require("obsidian");

// Set font metrics and layout BEFORE rendering; CSS alone cannot resize nodes.
const defaults = {
  theme: "dark",
  fontFamily: '"trebuchet ms", verdana, arial, sans-serif',
  themeVariables: { fontSize: "16px", darkMode: true, primaryColor: "#1f2020", primaryTextColor: "#cccccc", primaryBorderColor: "#aaaaaa", lineColor: "#cccccc" },
  flowchart: {
    curve: "step", nodeSpacing: 28, rankSpacing: 26,
    padding: 10, diagramPadding: 4, wrappingWidth: 140, useMaxWidth: false,
  },
};

const { styleSvg, widenSingleRectangles, wrapDecisions } = require("./layout");
const { highlightAncestors } = require("./highlight");
const { normalizeSettings, EnhancerSettingsTab } = require("./settings");

module.exports = class MermaidPreviewEnhanced extends Plugin {
  async onload() {
    this.stopped = false;
    this.settings = normalizeSettings(await this.loadData());
    this.addSettingTab(new EnhancerSettingsTab(this.app, this));
    const hoverTarget = ".mermaid .node, .mermaid .flowchart-link, .mermaid .edgePath path.path, .mermaid .edgeLabels > .edgeLabel";
    const pendingClears = new Map();
    const cancelClear = svg => {
      clearTimeout(pendingClears.get(svg));
      pendingClears.delete(svg);
    };
    const enter = event => {
      const node = event.target.closest?.(hoverTarget);
      if (!node || !this.settings.pathHighlight) return;
      cancelClear(node.closest("svg"));
      highlightAncestors(node);
    };
    const leave = event => {
      const node = event.target.closest?.(hoverTarget);
      if (!node || node.contains(event.relatedTarget)) return;
      const svg = node.closest("svg");
      if (!svg) return;
      cancelClear(svg);
      // Keep the current path while the pointer crosses a gap between nodes.
      // Entering the next node cancels this reset and transitions directly.
      pendingClears.set(svg, setTimeout(() => {
        pendingClears.delete(svg);
        svg.classList.remove("mpe-tracing");
        svg.querySelectorAll(".mpe-on-path").forEach(el => el.classList.remove("mpe-on-path"));
      }, this.settings.hoverDelay));
    };
    this.registerDomEvent(document, "pointerover", enter);
    this.registerDomEvent(document, "pointerout", leave);
    this.registerDomEvent(document, "focusin", enter);
    this.registerDomEvent(document, "focusout", leave);
    this.register(() => {
      pendingClears.forEach(timer => clearTimeout(timer));
      pendingClears.clear();
    });
    this.register(() => document.querySelectorAll(".mpe-tracing, .mpe-on-path").forEach(el => el.classList.remove("mpe-tracing", "mpe-on-path")));
    const mermaid = await loadMermaid();
    if (this.stopped) return;
    const original = mermaid.render;
    const plugin = this;
    const wrapped = async function (id, source, ...args) {
      if (typeof source !== "string") return original.call(this, id, source, ...args);
      if (/^\s*%%\s*mfe:off\s*$/m.test(source)) return original.call(this, id, source, ...args);
      const direction = source.match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/m)?.[1];
      if (!direction) return original.call(this, id, source, ...args);
      if (plugin.settings.compactLayout) source = wrapDecisions(source);
      // YAML must remain first. Per-diagram configuration keeps its priority.
      const header = source.match(/^\s*---\s*\n[\s\S]*?\n---\s*\n/);
      const prefix = header ? header[0] : "";
      const dark = document.body.classList.contains("theme-dark");
      const configuredDefaults = {
        ...defaults,
        theme: dark ? "dark" : "base",
        themeVariables: {
          ...defaults.themeVariables,
          darkMode: dark,
          primaryColor: dark ? "#1f2020" : "#f5f5f5",
          primaryTextColor: dark ? "#cccccc" : "#333333",
          primaryBorderColor: dark ? "#aaaaaa" : "#888888",
          lineColor: dark ? "#cccccc" : "#555555",
        },
      };
      const configured = prefix + `%%{init: ${JSON.stringify(configuredDefaults)}}%%\n` + source.slice(prefix.length);
      let result = await original.call(this, id, configured, ...args);
      const widerSource = plugin.settings.compactLayout ? widenSingleRectangles(source, typeof result === "string" ? result : result.svg, direction) : source;
      if (widerSource !== source) {
        const widerConfigured = prefix + `%%{init: ${JSON.stringify(configuredDefaults)}}%%\n` + widerSource.slice(prefix.length);
        result = await original.call(this, id, widerConfigured, ...args);
      }
      try {
        const svg = styleSvg(typeof result === "string" ? result : result.svg, direction, plugin.settings);
        return typeof result === "string" ? svg : { ...result, svg };
      } catch (error) {
        console.warn("Mermaid Flow Enhancer: kept original SVG after transformation failed", error);
        return result;
      }
    };
    mermaid.render = wrapped;
    this.register(() => {
      if (mermaid.render === wrapped) mermaid.render = original;
    });
  }
  async saveSettings() {
    this.settings = normalizeSettings(this.settings);
    await this.saveData(this.settings);
    document.querySelectorAll("svg.mfe-enhanced").forEach(svg => svg.style.setProperty("--mpe-duration", `${this.settings.animationDuration}ms`));
    if (!this.settings.pathHighlight) document.querySelectorAll(".mpe-tracing, .mpe-on-path").forEach(el => el.classList.remove("mpe-tracing", "mpe-on-path"));
  }
  onunload() { this.stopped = true; }
};
