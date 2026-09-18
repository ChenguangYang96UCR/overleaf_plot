(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const state = { source: "", nodes: [], edges: [], scale: 60, selected: null };

  const launcher = document.createElement("button");
  launcher.id = "ofv-launcher";
  launcher.type = "button";
  launcher.textContent = "Flowchart";
  launcher.title = "Open the TikZ flowchart visualizer";
  document.body.appendChild(launcher);

  const panel = document.createElement("aside");
  panel.id = "ofv-panel";
  panel.innerHTML = `
    <header><strong>TikZ Flowchart</strong><button data-action="close" aria-label="Close">×</button></header>
    <div class="ofv-toolbar">
      <button data-action="load">Load from editor</button>
      <button data-action="render">Parse / Refresh</button>
      <button data-action="copy" class="primary">Copy LaTeX</button>
    </div>
    <details><summary>LaTeX source</summary><textarea id="ofv-source" spellcheck="false" placeholder="Paste TikZ code containing \\node ... at (x,y) and \\draw ..."></textarea></details>
    <div id="ofv-message">Drag a node to move it. Drag its bottom-right handle to resize it.</div>
    <svg id="ofv-canvas" viewBox="0 0 900 620" role="img" aria-label="Draggable flowchart canvas"></svg>
    <footer><label>Grid <input id="ofv-grid" type="number" min="0.1" step="0.1" value="0.25"> cm</label><span id="ofv-status"></span></footer>`;
  document.body.appendChild(panel);

  const sourceBox = panel.querySelector("#ofv-source");
  const canvas = panel.querySelector("#ofv-canvas");
  const status = panel.querySelector("#ofv-status");
  const gridInput = panel.querySelector("#ofv-grid");

  launcher.addEventListener("click", () => panel.classList.toggle("open"));
  panel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "close") panel.classList.remove("open");
    if (action === "load") loadFromEditor();
    if (action === "render") parseAndRender();
    if (action === "copy") copyLatex();
  });

  function loadFromEditor() {
    const editor = document.querySelector(".cm-content") || document.querySelector(".ace_content") || document.querySelector("textarea");
    if (!editor) return message("The Overleaf editor was not found. Paste the TikZ code manually.", true);
    const fullText = editor.value || editor.innerText || editor.textContent || "";
    const match = fullText.match(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/);
    sourceBox.value = match ? match[0] : fullText;
    parseAndRender();
  }

  function parseAndRender() {
    state.source = sourceBox.value;
    const parsed = FlowchartCore.parseTikz(state.source);
    state.nodes = parsed.nodes;
    state.edges = parsed.edges;
    render();
    message(parsed.nodes.length ? `Found ${parsed.nodes.length} nodes and ${parsed.edges.length} edges.` : "No nodes were found. This MVP requires explicit at (x,y) coordinates.", !parsed.nodes.length);
  }

  function bounds() {
    if (!state.nodes.length) return { minX: -5, maxX: 5, minY: -4, maxY: 4 };
    return {
      minX: Math.min(...state.nodes.map((n) => n.x - n.width / 2)) - 1,
      maxX: Math.max(...state.nodes.map((n) => n.x + n.width / 2)) + 1,
      minY: Math.min(...state.nodes.map((n) => n.y - n.height / 2)) - 1,
      maxY: Math.max(...state.nodes.map((n) => n.y + n.height / 2)) + 1
    };
  }

  function point(node, b) {
    return { x: 40 + (node.x - b.minX) * state.scale, y: 40 + (b.maxY - node.y) * state.scale };
  }

  function render() {
    canvas.replaceChildren();
    const b = bounds();
    canvas.setAttribute("viewBox", `0 0 ${Math.max(500, 80 + (b.maxX - b.minX) * state.scale)} ${Math.max(400, 80 + (b.maxY - b.minY) * state.scale)}`);
    const defs = svg("defs");
    const marker = svg("marker", { id: "ofv-arrow", markerWidth: 10, markerHeight: 10, refX: 9, refY: 3, orient: "auto", markerUnits: "strokeWidth" });
    marker.appendChild(svg("path", { d: "M0,0 L0,6 L9,3 z", fill: "#64748b" }));
    defs.appendChild(marker);
    canvas.appendChild(defs);
    const map = new Map(state.nodes.map((node) => [node.id, node]));
    state.edges.forEach((edge) => {
      const from = map.get(edge.from), to = map.get(edge.to);
      if (!from || !to) return;
      const a = point(from, b), z = point(to, b);
      canvas.appendChild(svg("line", { x1: a.x, y1: a.y, x2: z.x, y2: z.y, class: "ofv-edge", "marker-end": "url(#ofv-arrow)" }));
    });
    state.nodes.forEach((node) => drawNode(node, b));
  }

  function drawNode(node, b) {
    const p = point(node, b), w = node.width * state.scale, h = node.height * state.scale;
    const group = svg("g", { class: "ofv-node", "data-id": node.id, transform: `translate(${p.x},${p.y})` });
    group.appendChild(svg("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: 8 }));
    const label = svg("text", { x: 0, y: 5, "text-anchor": "middle" });
    label.textContent = node.label.replace(/\\\\/g, " ");
    group.appendChild(label);
    group.appendChild(svg("circle", { cx: w / 2, cy: h / 2, r: 7, class: "ofv-resize", "data-resize": "1" }));
    group.addEventListener("pointerdown", (event) => beginDrag(event, node, Boolean(event.target.dataset.resize)));
    canvas.appendChild(group);
  }

  function beginDrag(event, node, resize) {
    event.preventDefault();
    const start = screenToSvg(event), original = { x: node.x, y: node.y, width: node.width, height: node.height };
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (nextEvent) => {
      const now = screenToSvg(nextEvent);
      const dx = (now.x - start.x) / state.scale, dy = (now.y - start.y) / state.scale;
      const grid = Math.max(0.01, Number(gridInput.value) || 0.25);
      const snap = (value) => Math.round(value / grid) * grid;
      if (resize) {
        node.width = Math.max(grid, snap(original.width + dx * 2));
        node.height = Math.max(grid, snap(original.height + dy * 2));
      } else {
        node.x = snap(original.x + dx);
        node.y = snap(original.y - dy);
      }
      syncSource();
      render();
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function screenToSvg(event) {
    const matrix = canvas.getScreenCTM();
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  }

  function syncSource() {
    sourceBox.value = FlowchartCore.updateTikz(state.source, state.nodes);
  }

  async function copyLatex() {
    syncSource();
    try {
      await navigator.clipboard.writeText(sourceBox.value);
      message("Copied. Return to Overleaf and replace the original TikZ code.", false);
    } catch (_) {
      sourceBox.focus(); sourceBox.select(); document.execCommand("copy");
      message("LaTeX copied.", false);
    }
  }

  function svg(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function message(text, error) {
    status.textContent = text;
    status.classList.toggle("error", Boolean(error));
  }
})();
