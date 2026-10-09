export type Direction = "TD" | "TB" | "BT" | "LR" | "RL";
export type Point = [number, number];
type Axis = 0 | 1;
type Edge = [null, string, string];
export interface Bounds {
  center: Point;
  min: Point;
  max: Point;
}
export interface NodeBounds extends Bounds {
  node: Element;
}
export interface LayoutSettings {
  compactLayout?: boolean;
  animationDuration?: number;
}
interface LayoutNode {
  node: Element;
  key: string;
  center: Point;
  incoming: number | undefined;
}
interface LayoutEdge { from: LayoutNode; to: LayoutNode; }

const edgeIndexes = new WeakMap<Document, Map<string, Edge | null>>();
function resolveEdge(doc: Document, path: Element): Edge | null {
  let index = edgeIndexes.get(doc);
  if (!index) {
    index = new Map();
    const keys = [...doc.querySelectorAll("g.node")].map(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1]).filter((key): key is string => key !== undefined);
    for (const from of keys) for (const to of keys) {
      const prefix = `L_${from}_${to}_`;
      index.set(prefix, index.has(prefix) ? null : [null, from, to]);
    }
    edgeIndexes.set(doc, index);
  }
  const id = path.getAttribute("data-id") || path.id;
  // Mermaid ends edge ids with an edge number; remove only that final suffix.
  return index.get(id.replace(/[^_]*$/, "")) || null;
}

export function orthogonalPath(points: Point[], direction: Direction | "", sourceLimit?: number, targetLimit?: number, branchLevel?: number): string | null {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const axis = vertical ? 1 : 0;
  const cross: Axis = axis === 0 ? 1 : 0;
  const first = points[0], last = points[points.length - 1];
  const sign = Math.sign(last[axis] - first[axis]);
  if (!sign) return null;
  const a = sourceLimit ?? first[axis], b = targetLimit ?? last[axis];
  if (sign * (b - a) <= 0) return null;
  const level = branchLevel ?? (a + b) / 2;
  const middle = sign * (level - a) > 0 && sign * (b - level) > 0 ? level : (a + b) / 2;
  const p: Point = [...first], q: Point = [...last];
  p[axis] = middle; q[axis] = middle;
  const route = Math.abs(first[cross] - last[cross]) < 0.01
    ? [first, last] : [first, p, q, last];
  return route.filter((p, i) => !i || p.some((v, j) => Math.abs(v - route[i - 1][j]) > 0.001))
    .map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join("");
}

function transformOffset(element: Node | null): Point | undefined {
  const offset: Point = [0, 0];
  for (let el = element; el; el = el.parentNode) {
    const transform = "getAttribute" in el && typeof el.getAttribute === "function"
      ? String(el.getAttribute("transform") || "") : "";
    if (!transform) continue;
    const t = transform.match(/^\s*translate\(\s*([-+\d.eE]+)(?:[,\s]+([-+\d.eE]+))?\s*\)\s*$/);
    if (!t) return undefined;
    offset[0] += Number(t[1]);
    offset[1] += Number(t[2] ?? 0);
  }
  return offset;
}

function polygonHasSideCenter(points: Point[], axis: Axis, side: "min" | "max", centerCross: number): boolean {
  const min = Math.min(...points.map(point => point[axis]));
  const max = Math.max(...points.map(point => point[axis]));
  const boundary = side === "min" ? min : max;
  const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const aa = a[axis], ba = b[axis], ac = a[1 - axis], bc = b[1 - axis];
    if (close(aa, boundary) && close(ba, boundary) &&
        centerCross >= Math.min(ac, bc) - 0.01 && centerCross <= Math.max(ac, bc) + 0.01) return true;
    if (close(aa, boundary) && close(ac, centerCross)) return true;
    if (close(ba, boundary) && close(bc, centerCross)) return true;
  }
  return false;
}

export function nodeBounds(doc: Document, key: string): NodeBounds | undefined {
  const node = [...doc.querySelectorAll("g.node")].find(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === key);
  if (!node) return undefined;
  const shape = node.querySelector("polygon, rect, circle, ellipse");
  if (!shape) return undefined;
  const offset = transformOffset(shape);
  if (!offset) return undefined;
  let x: number[], y: number[];
  if (shape.tagName === "polygon") {
    const source = (shape.getAttribute("points") || "").trim().split(/\s+/)
      .map(point => point.split(",").map(Number));
    if (source.length > 1 && source[0][0] === source.at(-1)![0] && source[0][1] === source.at(-1)![1]) source.pop();
    if (source.length < 3 || source.some(point => point.length !== 2 || !point.every(Number.isFinite))) return undefined;
    x = source.map(point => point[0]); y = source.map(point => point[1]);
    const center: Point = [(Math.min(...x) + Math.max(...x)) / 2, (Math.min(...y) + Math.max(...y)) / 2];
    for (const axis of [0, 1] as const) {
      if (!polygonHasSideCenter(source as Point[], axis, "min", center[1 - axis]) ||
          !polygonHasSideCenter(source as Point[], axis, "max", center[1 - axis])) return undefined;
    }
  } else if (shape.tagName === "circle") {
    const values = ["cx", "cy", "r"].map(name => shape.getAttribute(name));
    if (values.some(value => value === null)) return undefined;
    const [cx, cy, r] = values.map(Number);
    if (![cx, cy, r].every(Number.isFinite) || r < 0) return undefined;
    x = [cx - r, cx + r]; y = [cy - r, cy + r];
  } else if (shape.tagName === "ellipse") {
    const values = ["cx", "cy", "rx", "ry"].map(name => shape.getAttribute(name));
    if (values.some(value => value === null)) return undefined;
    const [cx, cy, rx, ry] = values.map(Number);
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) return undefined;
    x = [cx - rx, cx + rx]; y = [cy - ry, cy + ry];
  } else {
    const values = ["x", "y", "width", "height"].map(name => shape.getAttribute(name));
    if (values.some(value => value === null)) return undefined;
    const [left, top, w, h] = values.map(Number);
    if (![left, top, w, h].every(Number.isFinite) || w < 0 || h < 0) return undefined;
    x = [left, left + w]; y = [top, top + h];
  }
  const min: Point = [Math.min(...x) + offset[0], Math.min(...y) + offset[1]];
  const max: Point = [Math.max(...x) + offset[0], Math.max(...y) + offset[1]];
  return { node, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2], min, max };
}

export function nodeLimit(doc: Document, key: string, direction: Direction | "", outgoing: boolean): number | undefined {
  const bounds = nodeBounds(doc, key);
  if (!bounds) return undefined;
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const forward = !/^(BT|RL)$/.test(direction);
  return (outgoing === forward) ? bounds.max[axis] : bounds.min[axis];
}

export function centerAnchor(bounds: Bounds, direction: Direction | "", travelSign: number, outgoing: boolean): Point {
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const cross: Axis = axis === 0 ? 1 : 0;
  const sideSign = outgoing ? travelSign : -travelSign;
  const anchor: Point = [...bounds.center];
  anchor[axis] = sideSign > 0 ? bounds.max[axis] : bounds.min[axis];
  anchor[cross] = bounds.center[cross];
  return anchor;
}

export function returnLanePath(points: Point[], direction: Direction | "", from?: Bounds, to?: Bounds, offset: Point = [0, 0]): string | null {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const axis = vertical ? 1 : 0;
  const cross: Axis = axis === 0 ? 1 : 0;
  const first = points[0], last = points[points.length - 1];
  const values = points.map(point => point[cross]);
  const high = Math.max(...values), low = Math.min(...values);
  const lane = high > Math.max(first[cross], last[cross]) + 0.01 ? high
    : low < Math.min(first[cross], last[cross]) - 0.01 ? low : null;
  if (lane === null) return null;
  if (!from || !to) return null;
  const outer = lane + offset[cross] > (from.center[cross] + to.center[cross]) / 2 ? "max" : "min";
  const source: Point = [...from.center], target: Point = [...to.center];
  source[cross] = from[outer][cross];
  target[cross] = to[outer][cross];
  // Native ports can sit inside a wide block's cross-axis extent. Move the
  // return lane outside both blocks so the final segment approaches from outside.
  const laneRoot = outer === "max"
    ? Math.max(lane + offset[cross], from.max[cross] + 16, to.max[cross] + 16)
    : Math.min(lane + offset[cross], from.min[cross] - 16, to.min[cross] - 16);
  const bend1: Point = [...source], bend2: Point = [...target];
  bend1[cross] = laneRoot;
  bend2[cross] = laneRoot;
  for (const point of [source, target, bend1, bend2]) {
    point[0] -= offset[0]; point[1] -= offset[1];
  }
  return [source, bend1, bend2, target]
    .filter((point, i, all) => !i || point.some((v, j) => Math.abs(v - all[i - 1][j]) > 0.001))
    .map((point, i) => `${i ? "L" : "M"}${point.join(",")}`).join("");
}

export function roundPath(d: string, radius = 4): string {
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, "g");
  const matches = [...d.matchAll(segment)];
  if (matches.length < 3 || d.replace(segment, "").trim() ||
      matches[0][1] !== "M" || matches.slice(1).some(m => m[1] !== "L")) return d;
  const points = matches.map(m => [Number(m[2]), Number(m[3])])
    .filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
  let path = `M${points[0].join(",")}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    const orthogonal = (u[0] === 0 || u[1] === 0) &&
      (v[0] === 0 || v[1] === 0) && u[0] * v[0] + u[1] * v[1] === 0;
    if (!orthogonal || !lu || !lv) { path += `L${b.join(",")}`; continue; }
    const r = Math.min(radius, lu / 2, lv / 2);
    const before = b.map((n, j) => n + u[j] * r / lu);
    const after = b.map((n, j) => n + v[j] * r / lv);
    path += `L${before.join(",")}Q${b.join(",")} ${after.join(",")}`;
  }
  return path + `L${points[points.length - 1].join(",")}`;
}

// Mermaid may already round its orthogonal routes with quadratic corners.
// Retain their control points when choosing an outer lane, then recompute
// centered routes. Unsupported curve commands keep the original path.
export function routePoints(d: string): Point[] | null {
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const command = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})|Q\\s*(${number})[\\s,]+(${number})[\\s,]+(${number})[\\s,]+(${number})`, "g");
  const matches = [...d.matchAll(command)];
  if (!matches.length || matches[0][1] !== "M" || d.replace(command, "").trim()) return null;
  if (matches.slice(1).some(m => m[1] === "M")) return null;
  return matches.flatMap<Point>(m => m[1] ? [[Number(m[2]), Number(m[3])]]
    : [[Number(m[4]), Number(m[5])], [Number(m[6]), Number(m[7])]])
    .filter((point, i, all) => !i || point.some((v, axis) => Math.abs(v - all[i - 1][axis]) > 0.001));
}

export function styleSvg(svg: string, direction: Direction | "", settings: LayoutSettings = {}): string {
  const compactLayout = settings.compactLayout !== false;
  // HTML labels can contain this HTML-only entity; XML has no such entity.
  svg = svg.replace(/&nbsp;/g, "\u00a0").replace(/<br\s*>/gi, "<br/>");
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return svg;
  // Equal-rank nodes can have different heights. Align their incoming sides,
  // rather than their centers, so both arrows finish on the same level.
  const layoutAxis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const layoutSign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  const layoutNodes = [...doc.querySelectorAll("g.node")].map(node => {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    return { node, key, center: t ? [Number(t[1]), Number(t[2])] as Point : null, incoming: key ? nodeLimit(doc, key, direction, false) : NaN };
  }).filter((n): n is LayoutNode => !!n.key && !!n.center);
  const layoutByKey = new Map(layoutNodes.map(n => [n.key, n]));
  const layoutEdges = [...doc.querySelectorAll("path.flowchart-link, .edgePath path.path")].map(path => {
    const edge = resolveEdge(doc, path);
    if (edge) return { from: layoutByKey.get(edge[1]), to: layoutByKey.get(edge[2]) };
  }).filter((e): e is LayoutEdge => !!e?.from && !!e.to);
  const alignedTargets = new Set<string>();
  for (const node of doc.querySelectorAll("g.node")) {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    if (key) {
      node.setAttribute("data-mpe-key", key);
      node.setAttribute("tabindex", "0");
    }
    const polygon = node.querySelector("polygon");
    const points = (polygon?.getAttribute("points") || "").trim().split(/\s+/).map(p => p.split(",").map(Number))
      .filter((p, i, all) => !i || p[0] !== all[0][0] || p[1] !== all[0][1]);
    if (!compactLayout || points.length !== 4) continue;
    const cx = points.reduce((s, p) => s + p[0], 0) / 4;
    const cy = points.reduce((s, p) => s + p[1], 0) / 4;
    const hw = Math.max(...points.map(p => Math.abs(p[0] - cx)));
    const hh = Math.max(...points.map(p => Math.abs(p[1] - cy)));
    const label = node.querySelector("foreignObject");
    // Keep the complete text rectangle inside the diamond with a small margin.
    const widthRatio = label ? Number(label.getAttribute("width")) / (2 * hw) : 1;
    const needed = label && widthRatio < 0.99
      ? Number(label.getAttribute("height")) / (2 * hh) / (0.99 - widthRatio) : 1;
    const scale = Math.min(1, Math.max(0.76, needed));
    polygon!.setAttribute("points", points.map(p => `${p[0]},${cy + (p[1] - cy) * scale}`).join(" "));
  }
  for (const source of compactLayout ? layoutNodes : []) {
    const targets = [...new Set(layoutEdges.filter(e => e.from === source &&
      layoutSign * (e.to.center[layoutAxis] - source.center[layoutAxis]) > 0).map(e => e.to))];
    if (targets.length < 2) continue;
    const sameCenters = targets.every(n => Math.abs(n.center[layoutAxis] - targets[0].center[layoutAxis]) <= 2);
    const sameIncomingSides = targets.every(n => Math.abs((n.incoming ?? NaN) - (targets[0].incoming ?? NaN)) <= 2);
    if (!sameCenters && !sameIncomingSides) continue;
    const limits = targets.map(n => nodeLimit(doc, n.key, direction, false));
    if (!limits.every((limit): limit is number => limit !== undefined && Number.isFinite(limit))) continue;
    const level = layoutSign > 0 ? Math.min(...limits) : Math.max(...limits);
    targets.forEach((n, i) => {
      if (alignedTargets.has(n.key)) return;
      const delta: Point = [0, 0];
      delta[layoutAxis] = level - limits[i];
      n.center[layoutAxis] += delta[layoutAxis];
      n.node.setAttribute("transform", `translate(${n.center.join(",")})`);
      alignedTargets.add(n.key);
    });
  }
  // Remove zero-length step segments so marker orientation follows the last
  // actual segment (a duplicate terminal point can turn an arrow sideways).
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, "g");
  const labelPositions = new Map<string, Point>();
  const routeExtent: Point[] = [];

  // All forward branches from one condition share the same bend/label level.
  // Use the nearest target so neither branch crosses its destination block.
  const branchLevels = new Map<string, number>();
  const outgoing = new Map<string, number[]>();
  const sign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  for (const path of compactLayout ? doc.querySelectorAll("path.flowchart-link, .edgePath path.path") : []) {
    const edge = resolveEdge(doc, path);
    if (!edge || !direction) continue;
    const source = [...doc.querySelectorAll("g.node")].find(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === edge[1]);
    if (!source?.querySelector("polygon")) continue;
    const a = nodeLimit(doc, edge[1], direction, true);
    const b = nodeLimit(doc, edge[2], direction, false);
    if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b) || sign * (b - a) <= 0) continue;
    const levels = outgoing.get(edge[1]) || [];
    levels.push((a + b) / 2);
    outgoing.set(edge[1], levels);
  }
  for (const [source, levels] of outgoing) {
    if (levels.length > 1) branchLevels.set(source, sign > 0 ? Math.min(...levels) : Math.max(...levels));
  }
  for (const path of compactLayout ? doc.querySelectorAll("path.flowchart-link, .edgePath path.path") : []) {
    const d = path.getAttribute("d") || "";
    const points = routePoints(d);
    if (!points || points.length < 2) continue;
    const edge = resolveEdge(doc, path);
    let routed = null;
    if (direction && edge) {
      const from = nodeBounds(doc, edge[1]), to = nodeBounds(doc, edge[2]);
      const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
      if (!from || !to) continue;
      const delta = to.center[axis] - from.center[axis];
      if (Math.abs(delta) < 0.01) continue;
      const travelSign = Math.sign(delta);
      const pathOffset = transformOffset(path);
      if (!pathOffset) continue;
      points[0] = centerAnchor(from, direction, travelSign, true).map((v, i) => v - pathOffset[i]) as Point;
      points[points.length - 1] = centerAnchor(to, direction, travelSign, false).map((v, i) => v - pathOffset[i]) as Point;
      const forward = sign * delta > 0;
      if (forward) {
        const sourceLimit = nodeLimit(doc, edge[1], direction, true)! - pathOffset[axis];
        const targetLimit = nodeLimit(doc, edge[2], direction, false)! - pathOffset[axis];
        routed = orthogonalPath(points, direction,
          sourceLimit, targetLimit,
          branchLevels.has(edge[1]) ? branchLevels.get(edge[1])! - pathOffset[axis] : undefined);
      } else {
        // Keep Mermaid's outer return lane and remove the small stairs.
        routed = returnLanePath(points, direction, from, to, pathOffset);
      }
      if (!routed) continue;
    }
    if (routed) {
      const route = [...routed.matchAll(segment)].map(m => [Number(m[2]), Number(m[3])]);
      const a = route.length > 2 ? route[1] : route[0];
      const b = route.length > 2 ? route[2] : route[1];
      const offset = transformOffset(path) || [0, 0];
      labelPositions.set(path.getAttribute("data-id") || path.id,
        [(a[0] + b[0]) / 2 + offset[0], (a[1] + b[1]) / 2 + offset[1]]);
      routeExtent.push(...route.map(point => point.map((value, axis) => value + offset[axis]) as Point));
    }
    path.setAttribute("d", routed ? roundPath(routed) : roundPath(d));
  }
  // Mermaid places labels for its original route. Move them with our route.
  for (const label of doc.querySelectorAll(".edgeLabels > .edgeLabel")) {
    const key = label.getAttribute("data-id") || label.querySelector("[data-id]")?.getAttribute("data-id");
    const position = key ? labelPositions.get(key) : undefined;
    const offset = transformOffset(label.parentNode);
    if (position && offset) label.setAttribute("transform",
      `translate(${position.map((value, axis) => value - offset[axis]).join(",")})`);
  }
  for (const node of doc.querySelectorAll("g.node")) {
    const polygon = node.querySelector("polygon");
    const points = (polygon?.getAttribute("points") || "").trim().split(/\s+/).map(p => p.split(",").map(Number))
      .filter((p, i, all) => !i || p[0] !== all[0][0] || p[1] !== all[0][1]);
    if (points.length === 4) {
      node.classList.add("mpe-decision");
      node.setAttribute("tabindex", "0");
    }
  }
  // A centered return port can need a slightly wider outer lane. Include that
  // lane in the SVG canvas instead of clipping its line or arrow at the edge.
  const root = doc.documentElement as unknown as SVGSVGElement;
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (routeExtent.length && viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    const [x, y, width, height] = viewBox;
    const left = Math.min(x, ...routeExtent.map(p => p[0] - 4));
    const top = Math.min(y, ...routeExtent.map(p => p[1] - 4));
    const right = Math.max(x + width, ...routeExtent.map(p => p[0] + 4));
    const bottom = Math.max(y + height, ...routeExtent.map(p => p[1] + 4));
    const sizes = [right - left, bottom - top];
    root.setAttribute("viewBox", `${left} ${top} ${sizes.join(" ")}`);
    for (const [name, size] of [["width", sizes[0]], ["height", sizes[1]]] as const) {
      if (/^[\d.]+$/.test(root.getAttribute(name) || "")) root.setAttribute(name, String(size));
    }
    if (Math.abs(parseFloat(root.style.maxWidth) - width) < 1) root.style.maxWidth = `${sizes[0]}px`;
  }
  const hierarchyNodes = [...doc.querySelectorAll("g.node[data-mpe-key]")];
  const axis = /^(TD|TB|BT)$/.test(direction) ? 2 : 1;
  const position = (node: Element) => Number((node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/)?.[axis]);
  const hierarchyByKey = new Map(hierarchyNodes.map(n => [n.getAttribute("data-mpe-key"), n]));
  for (const path of doc.querySelectorAll("path.flowchart-link, .edgePath path.path")) {
    const edge = resolveEdge(doc, path);
    if (!edge || !direction) continue;
    const from = hierarchyByKey.get(edge[1]), to = hierarchyByKey.get(edge[2]);
    if (!from || !to) continue;
    path.setAttribute("data-mpe-from", edge[1]);
    path.setAttribute("data-mpe-to", edge[2]);
    path.setAttribute("data-mpe-forward", String(sign * (position(to) - position(from)) > 0));
  }
  // Broad filled triangles, independent of connector stroke width.
  for (const marker of doc.querySelectorAll('marker[id$="pointEnd"], marker[id$="pointStart"]')) {
    marker.setAttribute("markerUnits", "userSpaceOnUse");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refY", "5");
    marker.setAttribute("orient", "auto");
    const start = marker.id.endsWith("pointStart");
    marker.setAttribute("refX", start ? "0" : "10");
    const path = marker.querySelector("path");
    if (path) {
      path.setAttribute("d", start ? "M10 0 L0 5 L10 10 Z" : "M0 0 L10 5 L0 10 Z");
      path.setAttribute("stroke-width", "0");
    }
  }
  doc.documentElement.classList.add("mfe-enhanced");
  root.style.setProperty("--mpe-duration", `${settings.animationDuration ?? 450}ms`);
  return new XMLSerializer().serializeToString(doc.documentElement);
}

export function widenSingleRectangles(source: string, svg: string, direction: Direction | ""): string {
  if (!/^(TD|TB|BT)$/.test(direction)) return source;
  const doc = new DOMParser().parseFromString(svg.replace(/<br\s*>/gi, "<br/>"), "image/svg+xml");
  const nodes = [...doc.querySelectorAll("g.node")].map(node => {
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    return { key, y: t ? Number(t[2]) : NaN, rect: !!node.querySelector("rect") };
  }).filter(n => n.key && Number.isFinite(n.y));
  const single = new Set(nodes.filter(n => n.rect &&
    !nodes.some(other => other !== n && Math.abs(other.y - n.y) < 2)).map(n => n.key));
  // Nonbreaking spaces let Mermaid measure and lay out the wider label itself.
  // Explicit line breaks and long labels retain their author's wrapping.
  return source.replace(/([\p{L}\p{N}_-]+)\["([^"\n]+)"\]/gu, (whole, key, label) => {
    if (!single.has(key) || label.length > 55 || /[<>&`]/.test(label)) return whole;
    return `${key}["${label.replace(/ /g, "\u00a0")}"]`;
  });
}

export function wrapDecisions(source: string): string {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.font = '16px "trebuchet ms", verdana, arial, sans-serif';
  return source.replace(/([\p{L}\p{N}_-]+)\{"([^"\n]+)"\}/gu, (whole, key, label) => {
    if (/[<>&`]/.test(label) || context.measureText(label).width <= 100) return whole;
    const words = label.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && context.measureText(next).width > 100) {
        lines.push(line); line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return `${key}{"${lines.join("<br/>")}"}`;
  });
}


