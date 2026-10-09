import type { App } from 'obsidian';
interface DemoApp extends App {
  plugins: { enablePluginAndSave(id: string): Promise<void> };
  commands: { executeCommandById(id: string): void };
}
declare global {
  var app: DemoApp;
  interface Window {
    measureFlow(count: number): Promise<{ nodes: number; edges: number; renderAndEnhanceMs: number; svgBytes: number }>;
  }
}
export {};
