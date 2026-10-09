function ancestorPath(edges, target) {
  const nodes = new Set([target]), selected = new Set(), pending = [target];
  const incoming = new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  while (pending.length) {
    const key = pending.pop();
    for (const edge of incoming.get(key) || []) {
      selected.add(edge.id);
      if (!nodes.has(edge.from)) { nodes.add(edge.from); pending.push(edge.from); }
    }
  }
  return { nodes, edges: selected };
}

function highlightAncestors(element) {
  const svg = element.closest("svg");
  if (!svg) return;
  const paths = [...svg.querySelectorAll("[data-mpe-from][data-mpe-to]")];
  const edges = paths.map(path => ({ from: path.getAttribute("data-mpe-from"),
    to: path.getAttribute("data-mpe-to"), id: path.getAttribute("data-id") || path.id,
    forward: path.getAttribute("data-mpe-forward") === "true" }));
  const key = element.getAttribute("data-mpe-key");
  const id = element.getAttribute("data-id") || element.querySelector("[data-id]")?.getAttribute("data-id") || element.id;
  const edge = key ? null : edges.find(edge => edge.id === id);
  if (!key && !edge) return;
  const selected = ancestorPath(edges.filter(edge => edge.forward), key || edge.from);
  if (edge) { selected.nodes.add(edge.to); selected.edges.add(edge.id); }
  svg.classList.add("mpe-tracing");
  for (const el of svg.querySelectorAll(".node, .flowchart-link, .edgePath, .edgeLabels > .edgeLabel")) {
    const key = el.getAttribute("data-mpe-key");
    const id = el.getAttribute("data-id") || el.querySelector("[data-id]")?.getAttribute("data-id") || el.id;
    el.classList.toggle("mpe-on-path", key ? selected.nodes.has(key) : selected.edges.has(id));
  }
}


function createPathController(document, getSettings, timers = { setTimeout: (fn, delay) => setTimeout(fn, delay), clearTimeout: id => clearTimeout(id) }) {
  const target = ".mermaid svg.mfe-enhanced .node, .mermaid svg.mfe-enhanced .flowchart-link, .mermaid svg.mfe-enhanced .edgePath path.path, .mermaid svg.mfe-enhanced .edgeLabels > .edgeLabel";
  const pending = new Map();
  let disposed = false;
  const cancel = svg => { timers.clearTimeout(pending.get(svg)); pending.delete(svg); };
  const reset = svg => {
    svg.classList.remove("mpe-tracing");
    svg.querySelectorAll(".mpe-on-path").forEach(el => el.classList.remove("mpe-on-path"));
  };
  return {
    enter(event) {
      if (disposed || !getSettings().pathHighlight) return;
      const node = event.target.closest?.(target);
      if (!node) return;
      cancel(node.closest("svg"));
      highlightAncestors(node);
    },
    leave(event) {
      if (disposed) return;
      const node = event.target.closest?.(target);
      if (!node || node.contains(event.relatedTarget)) return;
      const svg = node.closest("svg");
      if (!svg) return;
      cancel(svg);
      pending.set(svg, timers.setTimeout(() => {
        pending.delete(svg);
        reset(svg);
      }, getSettings().hoverDelay));
    },
    dispose() {
      disposed = true;
      pending.forEach(timer => timers.clearTimeout(timer));
      pending.clear();
      document.querySelectorAll("svg.mfe-enhanced").forEach(reset);
    }
  };
}
module.exports = { ancestorPath, highlightAncestors, createPathController };
