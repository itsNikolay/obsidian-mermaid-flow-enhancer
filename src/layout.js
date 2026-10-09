const edgeIndexes = new WeakMap();
function resolveEdge(doc, path) {
  let index = edgeIndexes.get(doc);
  if (!index) {
    index = new Map();
    const keys = [...doc.querySelectorAll("g.node")].map(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1]).filter(Boolean);
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

function orthogonalPath(points, direction, sourceLimit, targetLimit, branchLevel) {
  const vertical = /^(TD|TB|BT)$/.test(direction);
  const axis = vertical ? 1 : 0;
  const cross = 1 - axis;
  const sign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  const first = points[0], last = points[points.length - 1];
  if (sign * (last[axis] - first[axis]) <= 0) return null;
  const a = sourceLimit ?? first[axis], b = targetLimit ?? last[axis];
  if (sign * (b - a) < 0) return null;
  const middle = branchLevel ?? (a + b) / 2;
  const p = [...first], q = [...last];
  p[axis] = middle; q[axis] = middle;
  const route = Math.abs(first[cross] - last[cross]) < 0.01
    ? [first, last] : [first, p, q, last];
  return route.filter((p, i) => !i || p.some((v, j) => Math.abs(v - route[i - 1][j]) > 0.001))
    .map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join("");
}

function nodeLimit(doc, key, direction, outgoing) {
  const node = [...doc.querySelectorAll("g.node")].find(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === key);
  if (!node) return undefined;
  const axis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const shape = node.querySelector("polygon, rect");
  if (!shape) return undefined;
  let offset = 0;
  for (let el = shape; el && el !== node.parentNode; el = el.parentNode) {
    const t = (el.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    if (t) offset += Number(t[axis + 1]);
  }
  const values = shape.tagName === "polygon"
    ? (shape.getAttribute("points") || "").trim().split(/\s+/).map(p => Number(p.split(",")[axis]))
    : [Number(shape.getAttribute(axis ? "y" : "x")),
       Number(shape.getAttribute(axis ? "y" : "x")) + Number(shape.getAttribute(axis ? "height" : "width"))];
  const forward = !/^(BT|RL)$/.test(direction);
  return offset + ((outgoing === forward) ? Math.max(...values) : Math.min(...values));
}

function roundPath(d, radius = 4) {
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

function styleSvg(svg, direction, settings = {}) {
  const compactLayout = settings.compactLayout !== false;
  // HTML labels can contain this HTML-only entity; XML has no such entity.
  svg = svg.replace(/&nbsp;/g, "\u00a0").replace(/<br\s*>/gi, "<br/>");
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return svg;
  // Equal-rank nodes can have different heights. Align their incoming sides,
  // rather than their centers, so both arrows finish on the same level.
  const alignedNodes = new Map();
  const layoutAxis = /^(TD|TB|BT)$/.test(direction) ? 1 : 0;
  const layoutSign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  const layoutNodes = [...doc.querySelectorAll("g.node")].map(node => {
    const key = node.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1];
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    return { node, key, center: t ? [Number(t[1]), Number(t[2])] : null, incoming: key ? nodeLimit(doc, key, direction, false) : NaN };
  }).filter(n => n.key && n.center);
  const layoutByKey = new Map(layoutNodes.map(n => [n.key, n]));
  const layoutEdges = [...doc.querySelectorAll("path.flowchart-link, .edgePath path.path")].map(path => {
    const edge = resolveEdge(doc, path);
    if (edge) return { from: layoutByKey.get(edge[1]), to: layoutByKey.get(edge[2]) };
  }).filter(e => e?.from && e?.to);
  const compactNodes = new Map();
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
    polygon.setAttribute("points", points.map(p => `${p[0]},${cy + (p[1] - cy) * scale}`).join(" "));
    const t = (node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
    if (t && key) compactNodes.set(key, { center: [Number(t[1]), Number(t[2])], scale: [1, scale] });
  }
  for (const source of compactLayout ? layoutNodes : []) {
    const targets = [...new Set(layoutEdges.filter(e => e.from === source &&
      layoutSign * (e.to.center[layoutAxis] - source.center[layoutAxis]) > 0).map(e => e.to))];
    if (targets.length < 2) continue;
    const sameCenters = targets.every(n => Math.abs(n.center[layoutAxis] - targets[0].center[layoutAxis]) <= 2);
    const sameIncomingSides = targets.every(n => Math.abs(n.incoming - targets[0].incoming) <= 2);
    if (!sameCenters && !sameIncomingSides) continue;
    const limits = targets.map(n => nodeLimit(doc, n.key, direction, false));
    if (!limits.every(Number.isFinite)) continue;
    const level = layoutSign > 0 ? Math.min(...limits) : Math.max(...limits);
    targets.forEach((n, i) => {
      if (alignedNodes.has(n.key)) return;
      const delta = [0, 0];
      delta[layoutAxis] = level - limits[i];
      n.center[layoutAxis] += delta[layoutAxis];
      n.node.setAttribute("transform", `translate(${n.center.join(",")})`);
      alignedNodes.set(n.key, delta);
      if (compactNodes.has(n.key)) compactNodes.get(n.key).center = [...n.center];
    });
  }
  // Remove zero-length step segments so marker orientation follows the last
  // actual segment (a duplicate terminal point can turn an arrow sideways).
  const number = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?";
  const segment = new RegExp(`([ML])\\s*(${number})[\\s,]+(${number})`, "g");
  const labelPositions = new Map();
  // All forward branches from one condition share the same bend/label level.
  // Use the nearest target so neither branch crosses its destination block.
  const branchLevels = new Map();
  const outgoing = new Map();
  const sign = /^(BT|RL)$/.test(direction) ? -1 : 1;
  for (const path of compactLayout ? doc.querySelectorAll("path.flowchart-link, .edgePath path.path") : []) {
    const edge = resolveEdge(doc, path);
    if (!edge || !direction) continue;
    const source = [...doc.querySelectorAll("g.node")].find(n => n.id.match(/(?:^|-)flowchart-(.+)-\d+$/)?.[1] === edge[1]);
    if (!source?.querySelector("polygon")) continue;
    const a = nodeLimit(doc, edge[1], direction, true);
    const b = nodeLimit(doc, edge[2], direction, false);
    if (!Number.isFinite(a) || !Number.isFinite(b) || sign * (b - a) <= 0) continue;
    const levels = outgoing.get(edge[1]) || [];
    levels.push((a + b) / 2);
    outgoing.set(edge[1], levels);
  }
  for (const [source, levels] of outgoing) {
    if (levels.length > 1) branchLevels.set(source, sign > 0 ? Math.min(...levels) : Math.max(...levels));
  }
  for (const path of compactLayout ? doc.querySelectorAll("path.flowchart-link, .edgePath path.path") : []) {
    const d = path.getAttribute("d") || "";
    const matches = [...d.matchAll(segment)];
    if (!matches.length || d.replace(segment, "").trim()) continue;
    const points = matches.map(m => [Number(m[2]), Number(m[3])])
      .filter((p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
    const edge = resolveEdge(doc, path);
    if (edge) {
      for (const [key, index] of [[edge[1], 0], [edge[2], points.length - 1]]) {
        const delta = alignedNodes.get(key);
        if (delta) points[index] = points[index].map((v, i) => v + delta[i]);
        const compact = compactNodes.get(key);
        if (compact) points[index] = points[index].map((v, i) => compact.center[i] + (v - compact.center[i]) * compact.scale[i]);
      }
    }
    let routed = direction && edge ? orthogonalPath(points, direction,
      nodeLimit(doc, edge[1], direction, true), nodeLimit(doc, edge[2], direction, false),
      branchLevels.get(edge[1])) : null;
    if (!routed && /^(TD|TB|BT)$/.test(direction) && sign * (points.at(-1)[1] - points[0][1]) < 0) {
      const first = points[0], last = points.at(-1);
      // Preserve the outer lane chosen by Mermaid, removing its small stairs.
      const xs = points.map(p => p[0]);
      const right = Math.max(...xs), left = Math.min(...xs);
      const lane = right > Math.max(first[0], last[0]) + 0.01 ? right
        : left < Math.min(first[0], last[0]) - 0.01 ? left : null;
      if (lane !== null) routed = `M${first}L${lane},${first[1]}L${lane},${last[1]}L${last}`;
    }
    if (routed) {
      const route = [...routed.matchAll(segment)].map(m => [Number(m[2]), Number(m[3])]);
      const a = route.length > 2 ? route[1] : route[0];
      const b = route.length > 2 ? route[2] : route[1];
      labelPositions.set(path.getAttribute("data-id") || path.id, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    }
    path.setAttribute("d", roundPath(routed || points.map((p, i) => `${i ? "L" : "M"}${p.join(",")}`).join("")));
  }
  // Mermaid places labels for its original route. Move them with our route.
  for (const label of doc.querySelectorAll(".edgeLabels > .edgeLabel")) {
    const key = label.getAttribute("data-id") || label.querySelector("[data-id]")?.getAttribute("data-id");
    const position = labelPositions.get(key);
    if (position) label.setAttribute("transform", `translate(${position.join(",")})`);
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
  const hierarchyNodes = [...doc.querySelectorAll("g.node[data-mpe-key]")];
  const axis = /^(TD|TB|BT)$/.test(direction) ? 2 : 1;
  const position = node => Number((node.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/)?.[axis]);
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
    marker.setAttribute("markerWidth", "12");
    marker.setAttribute("markerHeight", "12");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refY", "5");
    marker.setAttribute("orient", "auto");
    const start = marker.id.endsWith("pointStart");
    marker.setAttribute("refX", start ? "1" : "9");
    const path = marker.querySelector("path");
    if (path) {
      path.setAttribute("d", start ? "M10 0 L0 5 L10 10 Z" : "M0 0 L10 5 L0 10 Z");
      path.setAttribute("stroke-width", "0");
    }
  }
  doc.documentElement.classList.add("mfe-enhanced");
  doc.documentElement.style.setProperty("--mpe-duration", `${settings.animationDuration ?? 450}ms`);
  return new XMLSerializer().serializeToString(doc.documentElement);
}

function widenSingleRectangles(source, svg, direction) {
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

function wrapDecisions(source) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.font = '16px "trebuchet ms", verdana, arial, sans-serif';
  return source.replace(/([\p{L}\p{N}_-]+)\{"([^"\n]+)"\}/gu, (whole, key, label) => {
    if (/[<>&`]/.test(label) || context.measureText(label).width <= 100) return whole;
    const words = label.split(/\s+/);
    const lines = [];
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


module.exports = { orthogonalPath, roundPath, nodeLimit, styleSvg, widenSingleRectangles, wrapDecisions };
