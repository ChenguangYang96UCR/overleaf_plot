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

  function optionParts(options) {
    return (options || "").split(",").map((part) => part.trim()).filter(Boolean);
  }

  function optionValue(options, key, fallback) {
    const prefix = key + "=";
    const part = optionParts(options).find((item) => item.startsWith(prefix));
    return part ? part.slice(prefix.length).trim() : fallback;
  }

  function nodeShape(options) {
    const parts = optionParts(options);
    if (parts.some((part) => part === "diamond")) return "diamond";
    if (parts.some((part) => part === "ellipse" || part === "circle")) return "ellipse";
    if (parts.some((part) => part.startsWith("rounded corners"))) return "rounded";
    return "rectangle";
  }

  function fontFamily(options) {
    const font = optionValue(options, "font", "");
    if (font.includes("\\sffamily")) return "sans";
    if (font.includes("\\ttfamily")) return "monospace";
    return "serif";
  }

  function fontSize(options) {
    const font = optionValue(options, "font", "");
    const match = /\\fontsize\{([\d.]+)\}/.exec(font);
    return match ? Number(match[1]) : 10;
  }

  function pointSize(options, key, fallback) {
    const match = new RegExp("(?:^|,)\\s*" + key + "\\s*=\\s*(" + NUMBER + ")\\s*pt(?:\\s*,|$)").exec(options || "");
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
        shape: nodeShape(match[1]),
        fill: optionValue(match[1], "fill", "white"),
        stroke: optionValue(match[1], "draw", "black"),
        fontFamily: fontFamily(match[1]),
        fontSize: fontSize(match[1]),
        borderWidth: pointSize(match[1], "line width", 0.4),
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
    const parts = optionParts(options);
    const prefix = new RegExp("^" + key + "\\s*=");
    const next = key + "=" + Number(value).toFixed(2).replace(/\.?0+$/, "") + "cm";
    const index = parts.findIndex((part) => prefix.test(part));
    if (index >= 0) parts[index] = next;
    else parts.push(next);
    return parts.join(", ");
  }

  function applyNodeStyle(options, node) {
    const shapeOptions = new Set(["diamond", "ellipse", "circle"]);
    const parts = optionParts(options).filter((part) => {
      if (shapeOptions.has(part) || part.startsWith("rounded corners")) return false;
      if (part === "draw" || part.startsWith("draw=")) return false;
      if (part === "fill" || part.startsWith("fill=")) return false;
      if (part.startsWith("font=")) return false;
      if (part.startsWith("line width=")) return false;
      if (["thin", "semithin", "thick", "very thick", "ultra thick"].includes(part)) return false;
      return true;
    });
    parts.push("draw=" + (node.stroke || "black"));
    parts.push("fill=" + (node.fill || "white"));
    const family = node.fontFamily === "sans" ? "\\sffamily" : node.fontFamily === "monospace" ? "\\ttfamily" : "\\rmfamily";
    const size = Number(node.fontSize) || 10;
    parts.push("font=" + family + "\\fontsize{" + format(size) + "}{" + format(size * 1.2) + "}\\selectfont");
    parts.push("line width=" + format(Number(node.borderWidth) || 0.4) + "pt");
    if (node.shape === "rounded") parts.push("rounded corners");
    if (node.shape === "ellipse") parts.push("ellipse");
    if (node.shape === "diamond") parts.push("diamond");
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
      let options = applyNodeStyle(original.options, changed);
      options = setOption(options, "minimum width", changed.width);
      options = setOption(options, "minimum height", changed.height);
      const replacement = "\\node[" + options + "] (" + original.id + ") at (" + format(changed.x) + "," + format(changed.y) + ") {" + changed.label + "};";
      output = output.slice(0, original.start) + replacement + output.slice(original.end);
    }
    return output;
  }

  function format(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, "");
  }

  function boundaryOffset(shape, width, height, dx, dy) {
    if (!dx && !dy) return { x: 0, y: 0 };
    const halfWidth = Math.max(width / 2, 0.001);
    const halfHeight = Math.max(height / 2, 0.001);
    let scale;
    if (shape === "ellipse") {
      scale = 1 / Math.sqrt((dx * dx) / (halfWidth * halfWidth) + (dy * dy) / (halfHeight * halfHeight));
    } else if (shape === "diamond") {
      scale = 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight);
    } else {
      scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
    }
    return { x: dx * scale, y: dy * scale };
  }

  root.FlowchartCore = { parseTikz, updateTikz, setOption, applyNodeStyle, boundaryOffset };
  if (typeof module !== "undefined") module.exports = root.FlowchartCore;
})(typeof globalThis !== "undefined" ? globalThis : window);
