const { PluginSettingTab, Setting } = require('obsidian');
const DEFAULT_SETTINGS = Object.freeze({ compactLayout: true, pathHighlight: true, animationDuration: 450, hoverDelay: 180 });
function normalizeSettings(value = {}) {
  const finite = (key, min, max) => typeof value[key] === 'number' && Number.isFinite(value[key])
    ? Math.min(max, Math.max(min, Math.round(value[key]))) : DEFAULT_SETTINGS[key];
  return { compactLayout: typeof value.compactLayout === 'boolean' ? value.compactLayout : true,
    pathHighlight: typeof value.pathHighlight === 'boolean' ? value.pathHighlight : true,
    animationDuration: finite('animationDuration', 0, 2000), hoverDelay: finite('hoverDelay', 0, 1000) };
}
class EnhancerSettingsTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this; containerEl.empty();
    for (const [key, name, desc] of [
      ['compactLayout', 'Compact layout', 'Align branches, shorten connectors and adapt label wrapping. Reopen the note to apply.'],
      ['pathHighlight', 'Highlight ancestor paths', 'Highlight incoming forward paths on hover or keyboard focus.']]) {
      new Setting(containerEl).setName(name).setDesc(desc).addToggle(toggle => toggle.setValue(this.plugin.settings[key]).onChange(async value => {
        this.plugin.settings[key] = value; await this.plugin.saveSettings();
      }));
    }
    for (const [key, name, max] of [['animationDuration', 'Animation duration (ms)', 2000], ['hoverDelay', 'Hover reset delay (ms)', 1000]]) {
      new Setting(containerEl).setName(name).addSlider(slider => slider.setLimits(0, max, 10).setValue(this.plugin.settings[key]).setDynamicTooltip().onChange(async value => {
        this.plugin.settings[key] = value; await this.plugin.saveSettings();
      }));
    }
  }
}
module.exports = { DEFAULT_SETTINGS, normalizeSettings, EnhancerSettingsTab };
