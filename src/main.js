const { Plugin, loadMermaid } = require("obsidian");

// Set font metrics and layout BEFORE rendering; CSS alone cannot resize nodes.
const defaults = {
  theme: "dark",
  fontFamily: '"trebuchet ms", verdana, arial, sans-serif',
  themeVariables: { fontSize: "16px", darkMode: true, primaryColor: "#273449", primaryTextColor: "#edf2fa", primaryBorderColor: "#7186a2", lineColor: "#a6b8cf" },
  flowchart: {
    curve: "step", nodeSpacing: 28, rankSpacing: 26,
    padding: 10, diagramPadding: 4, wrappingWidth: 140, useMaxWidth: false,
  },
};

const { styleSvg, widenSingleRectangles, wrapDecisions } = require("./layout");
const { createPathController } = require("./highlight");
const { normalizeSettings, EnhancerSettingsTab } = require("./settings");

module.exports = class MermaidFlowEnhancer extends Plugin {
  async onload() {
    this.stopped = false;
    this.settings = normalizeSettings(await this.loadData());
    if (this.stopped) return;
    this.addSettingTab(new EnhancerSettingsTab(this.app, this));
    const controller = createPathController(document, () => this.settings);
    this.registerDomEvent(document, "pointerover", controller.enter);
    this.registerDomEvent(document, "pointerout", controller.leave);
    this.registerDomEvent(document, "focusin", controller.enter);
    this.registerDomEvent(document, "focusout", controller.leave);
    this.register(controller.dispose);
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
          primaryColor: dark ? "#273449" : "#f5f5f5",
          primaryTextColor: dark ? "#edf2fa" : "#333333",
          primaryBorderColor: dark ? "#7186a2" : "#888888",
          lineColor: dark ? "#a6b8cf" : "#555555",
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
