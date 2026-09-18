(function (root) {
  "use strict";

  const NUMBER = "-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)";
  const NODE_RE = new RegExp(
    "\\\\node\\s*(?:\\[([^\\]]*)\\])?\\s*\\(([^)]+)\\)\\s*at\\s*\\(\\s*(" +
      NUMBER +
      ")\\s*,\\s*(" +
      NUMBER +
      ")\\s*\\)\\s*\\{([^{}]*)\\}\\s*;",
    "g"
  );
  const EDGE_RE = /\\draw\s*(?:\[([^\]]*)\])?\s*\(([^)]+)\)\s*(--|(?:-+>)|(?:-+\|))\s*\(([^)]+)\)\s*;/g;

  function optionNumber(options, key, fallback) {
    const match = new RegExp("(?:^|,)\\s*" + key + "\\s*=\\s*(" + NUMBER + ")\\s*cm(?:\\s*,|$)").exec(options || "");
    return match ? Number(match[1]) : fallback;
  }

  function parseTikz(source) {
    const nodes = [];
    const edges = [];
    let match;
    NODE_RE.lastIndex = 0;
    while ((match = NODE_RE.exec(source))) {
      nodes.push({
        id: match[2].trim(),
        label: match[5].trim(),
        x: Number(match[3]),
        y: Number(match[4]),
        width: optionNumber(match[1], "minimum width", 2.8),
        height: optionNumber(match[1], "minimum height", 1.1),
        options: match[1] || "",
        start: match.index,
        end: NODE_RE.lastIndex,
        raw: match[0]
      });
    }
    EDGE_RE.lastIndex = 0;
    while ((match = EDGE_RE.exec(source))) {
      edges.push({ from: match[2].trim(), to: match[4].trim(), options: match[1] || "", operator: match[3] });
    }
    return { nodes, edges };
  }

  function setOption(options, key, value) {
    const parts = (options || "").split(",").map((part) => part.trim()).filter(Boolean);
    const prefix = new RegExp("^" + key + "\\s*=");
    const next = key + "=" + Number(value).toFixed(2).replace(/\.?0+$/, "") + "cm";
    const index = parts.findIndex((part) => prefix.test(part));
    if (index >= 0) parts[index] = next;
    else parts.push(next);
    return parts.join(", ");
  }

  function updateTikz(source, nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const parsed = parseTikz(source).nodes;
    let output = source;
    for (let index = parsed.length - 1; index >= 0; index -= 1) {
      const original = parsed[index];
      const changed = byId.get(original.id);
      if (!changed) continue;
      let options = setOption(original.options, "minimum width", changed.width);
      options = setOption(options, "minimum height", changed.height);
      const replacement = "\\node[" + options + "] (" + original.id + ") at (" + format(changed.x) + "," + format(changed.y) + ") {" + original.label + "};";
      output = output.slice(0, original.start) + replacement + output.slice(original.end);
    }
    return output;
  }

  function format(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, "");
  }

  root.FlowchartCore = { parseTikz, updateTikz, setOption };
  if (typeof module !== "undefined") module.exports = root.FlowchartCore;
})(typeof globalThis !== "undefined" ? globalThis : window);
