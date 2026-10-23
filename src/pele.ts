import type { Direction, Point } from "./layout";

// Obsidian 1.15 draws Mermaid code blocks with Pele (https://github.com/obsidianmd/pele) instead
// of Mermaid.js, and `loadMermaid()` returns a shim around it. Pele lays flowcharts out with the
// plugin's spacing and connectors, and the plugin traces paths in each drawing.
export type PeleFlowchartConfig = Record<string, unknown>;
export interface PeleConfig { flowchart?: PeleFlowchartConfig; [section: string]: unknown }
export interface PeleMountOptions { onRender?: (result: unknown) => void; config?: PeleConfig }
export interface PeleMounted {
  readonly source: string;
  update: (text: string, options?: PeleMountOptions) => void;
}
export interface PeleRuntime {
  mount: (element: HTMLElement, text: string, options?: PeleMountOptions) => PeleMounted;
}
export interface PeleHost { pele?: PeleRuntime }
export interface PeleHooks {
  // Before Pele draws a text: the flowchart layout to draw it with, if any.
  prepare: (element: HTMLElement, source: string) => PeleFlowchartConfig | undefined;
  // After each drawing.
  trace: (element: HTMLElement, source: string) => void;
}

export function flowDirection(source: string): Direction | undefined {
  if (/^\s*%%\s*mfe:off\s*$/m.test(source)) return undefined;
  return source.match(/^\s*(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/m)?.[1] as Direction | undefined;
}

// Pele draws a mounted diagram again whenever its width or fonts change. Its exports are getters,
// so the global object is replaced by one whose `mount` lays out and traces each drawing.
export function patchPele(host: PeleHost, hooks: PeleHooks): () => void {
  const original = host.pele;
  if (!original) return () => {};
  // Diagrams mounted meanwhile keep this hook; it stops working once the plugin unloads.
  let active = true;
  const mount: PeleRuntime["mount"] = (element, text, options = {}) => {
    // Pele draws for the first time before `mount` returns.
    let mounted: PeleMounted | undefined = undefined;
    const traced: PeleMountOptions = { ...options, onRender(result) {
      try {
        if (active) hooks.trace(element, mounted?.source ?? text);
      } catch (error) {
        console.warn("Mermaid Flow Enhancer: kept Pele diagram without path tracing", error);
      }
      options.onRender?.call(this, result);
    } };
    // Pele keeps a diagram's options for later text, so the layout is chosen again for each text.
    // A diagram's own configuration still wins: Pele merges it over these sections.
    const optionsFor = (source: string): PeleMountOptions => {
      const flowchart = active ? hooks.prepare(element, source) : undefined;
      return flowchart
        ? { ...traced, config: { ...traced.config, flowchart: { ...traced.config?.flowchart, ...flowchart } } }
        : traced;
    };
    const handle = original.mount(element, text, optionsFor(text));
    mounted = handle;
    const update = handle.update;
    handle.update = (next, nextOptions) => update.call(handle, next, nextOptions ?? optionsFor(next));
    return handle;
  };
  const patched: PeleRuntime = { ...original, mount };
  host.pele = patched;
  return () => {
    active = false;
    if (host.pele === patched) host.pele = original;
  };
}

// Marks the container before Pele draws, so the plugin's palette applies from the first frame
// instead of fading in. Returns the layout for flowcharts the plugin enhances.
export function preparePeleDiagram(element: Element, source: string, layout: PeleFlowchartConfig | undefined): PeleFlowchartConfig | undefined {
  const enhanced = flowDirection(source) !== undefined;
  element.classList.toggle("mfe-flow", enhanced);
  return enhanced ? layout : undefined;
}

// Pele keeps Mermaid's edge ids, L_<from>_<to>_<n>. Node ids may themselves contain underscores.
function edgeEnds(id: string, keys: Set<string>): [string, string] | undefined {
  const body = id.match(/^L_(.+)_\d+$/)?.[1];
  if (!body) return undefined;
  const ends = [...body.matchAll(/_/g)]
    .map(match => [body.slice(0, match.index), body.slice(match.index + 1)] as [string, string])
    .filter(([from, to]) => keys.has(from) && keys.has(to));
  return ends.length === 1 ? ends[0] : undefined;
}

export function tracePeleDiagram(element: Element, source: string, animationDuration: number): void {
  const svg = element.querySelector<SVGSVGElement>(":scope > svg.pele-flowchart");
  const direction = flowDirection(source);
  if (!svg || !direction) return;
  const centers = new Map<string, Point>();
  for (const node of svg.querySelectorAll(".pele-node[data-id]")) {
    const key = node.getAttribute("data-id")!;
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    if (!t) continue;
    centers.set(key, [Number(t[1]), Number(t[2])]);
    node.setAttribute("data-mpe-key", key);
    node.setAttribute("tabindex", "0");
  }
  const keys = new Set(centers.keys());
  const edges = [...svg.querySelectorAll(".pele-edge[data-id]")].flatMap(edge => {
    const ends = edgeEnds(edge.getAttribute("data-id")!, keys);
    if (!ends) return [];
    const from = centers.get(ends[0])!, to = centers.get(ends[1])!;
    return [{ edge, ends, delta: [to[0] - from[0], to[1] - from[1]] as Point }];
  });
  // Pele turns an LR/RL flowchart that does not fit a narrow note into TB.
  const sign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const across = edges.filter(e => sign * e.delta[0] > 0).length;
  const down = edges.filter(e => e.delta[1] > 0).length;
  const [axis, flow] = vertical ? [1, sign] : down > across ? [1, 1] : [0, sign];
  for (const { edge, ends, delta } of edges) {
    edge.setAttribute("data-mpe-from", ends[0]);
    edge.setAttribute("data-mpe-to", ends[1]);
    edge.setAttribute("data-mpe-forward", String(flow * delta[axis] > 0));
  }
  svg.classList.add("mfe-pele");
  svg.style.setProperty("--mpe-duration", `${animationDuration}ms`);
}
