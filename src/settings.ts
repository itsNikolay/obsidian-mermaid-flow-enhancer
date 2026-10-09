import { PluginSettingTab, type App, type Plugin, type SettingDefinitionItem } from 'obsidian';

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
  getSettingDefinitions(): SettingDefinitionItem<keyof EnhancerSettings>[] {
    return [
      {
        name: 'Compact layout',
        desc: 'Align branches, shorten connectors and adapt label wrapping. Reopen the note to apply.',
        control: { type: 'toggle', key: 'compactLayout', defaultValue: DEFAULT_SETTINGS.compactLayout },
      },
      {
        name: 'Highlight ancestor paths',
        desc: 'Highlight incoming forward paths on hover or keyboard focus.',
        control: { type: 'toggle', key: 'pathHighlight', defaultValue: DEFAULT_SETTINGS.pathHighlight },
      },
      {
        name: 'Animation duration (ms)',
        control: { type: 'slider', key: 'animationDuration', defaultValue: DEFAULT_SETTINGS.animationDuration,
          min: 0, max: 2000, step: 10 },
      },
      {
        name: 'Hover reset delay (ms)',
        control: { type: 'slider', key: 'hoverDelay', defaultValue: DEFAULT_SETTINGS.hoverDelay,
          min: 0, max: 1000, step: 10 },
      },
    ];
  }
  getControlValue(key: string): unknown {
    if (key === 'compactLayout' || key === 'pathHighlight' || key === 'animationDuration' || key === 'hoverDelay') {
      return this.plugin.settings[key];
    }
    return undefined;
  }
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'compactLayout' || key === 'pathHighlight' || key === 'animationDuration' || key === 'hoverDelay') {
      this.plugin.settings = normalizeSettings({ ...this.plugin.settings, [key]: value });
      await this.plugin.saveSettings();
    }
  }
}
