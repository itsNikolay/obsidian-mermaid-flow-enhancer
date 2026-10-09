import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';

export interface EnhancerSettings {
  compactLayout: boolean;
  pathHighlight: boolean;
  animationDuration: number;
  hoverDelay: number;
}

export interface SettingsOwner extends Plugin {
  settings: EnhancerSettings;
  saveSettings(): Promise<void>;
}
export const DEFAULT_SETTINGS: Readonly<EnhancerSettings> = Object.freeze({ compactLayout: true, pathHighlight: true, animationDuration: 450, hoverDelay: 180 });
export function normalizeSettings(value: unknown = {}): EnhancerSettings {
  const input: Record<string, unknown> = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const finite = (key: 'animationDuration' | 'hoverDelay', min: number, max: number): number => {
    const candidate = input[key];
    return typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.min(max, Math.max(min, Math.round(candidate))) : DEFAULT_SETTINGS[key];
  };
  return { compactLayout: typeof input.compactLayout === 'boolean' ? input.compactLayout : true,
    pathHighlight: typeof input.pathHighlight === 'boolean' ? input.pathHighlight : true,
    animationDuration: finite('animationDuration', 0, 2000), hoverDelay: finite('hoverDelay', 0, 1000) };
}
export class EnhancerSettingsTab extends PluginSettingTab {
  private readonly plugin: SettingsOwner;
  constructor(app: App, plugin: SettingsOwner) { super(app, plugin); this.plugin = plugin; }
  display(): void {
    const { containerEl } = this; containerEl.empty();
    for (const [key, name, desc] of [
      ['compactLayout', 'Compact layout', 'Align branches, shorten connectors and adapt label wrapping. Reopen the note to apply.'],
      ['pathHighlight', 'Highlight ancestor paths', 'Highlight incoming forward paths on hover or keyboard focus.']] as const) {
      new Setting(containerEl).setName(name).setDesc(desc).addToggle(toggle => toggle.setValue(this.plugin.settings[key]).onChange(async value => {
        this.plugin.settings[key] = value; await this.plugin.saveSettings();
      }));
    }
    for (const [key, name, max] of [['animationDuration', 'Animation duration (ms)', 2000], ['hoverDelay', 'Hover reset delay (ms)', 1000]] as const) {
      new Setting(containerEl).setName(name).addSlider(slider => slider.setLimits(0, max, 10).setValue(this.plugin.settings[key]).setDynamicTooltip().onChange(async value => {
        this.plugin.settings[key] = value; await this.plugin.saveSettings();
      }));
    }
  }
}
