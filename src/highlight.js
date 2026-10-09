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


module.exports = { ancestorPath, highlightAncestors };
