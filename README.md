# Overleaf Flowchart Visualizer

An early Chrome and Edge extension MVP for visually arranging TikZ flowcharts in Overleaf. It opens a side panel on an Overleaf project page, lets you drag nodes that use explicit coordinates, and writes the updated positions and dimensions back to LaTeX source.

## Local installation

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode**, then select **Load unpacked**.
3. Select this repository directory.
4. Refresh the Overleaf project page and click **Flowchart** in the bottom-right corner.

## Usage

Click **Load from editor**, or paste TikZ code into the **LaTeX source** field and click **Parse / Refresh**. Drag a node to change its position. Drag the yellow handle in its bottom-right corner to change its minimum width and height. Click **Copy LaTeX**, then paste the updated code back into Overleaf.

Click a node to open the node toolbar. The toolbar can change its shape, fill color, and border color. Supported shapes are rectangle, rounded rectangle, ellipse, and diamond.

The document preamble must include:

```tex
\usepackage{tikz}
\usetikzlibrary{shapes.geometric}
```

Without `\usepackage{tikz}`, LaTeX treats the flowchart commands as ordinary text and displays the source code in the PDF. The extension displays this requirement and provides a **Copy setup** button.

Use [sample.tex](sample.tex) to try the extension.

## Manual test

1. Create a blank Overleaf project and replace `main.tex` with the contents of [sample.tex](sample.tex).
2. Compile the project. The PDF should show four connected nodes: **Start**, **Process data**, **Successful?**, and **Done**.
3. Open the extension and click **Load from editor**. The status should report `Found 4 nodes and 3 edges.`
4. Drag **Process data** one grid step to the right.
5. Drag the yellow resize handle on **Done** to make the node wider.
6. Select **Process data**, change its shape to **Ellipse**, its fill to **Blue**, and its border to **Blue**.
7. Click **Copy LaTeX**, replace the original `tikzpicture` block in Overleaf, and compile again.

Expected result:

- The `process` node's `at (x,y)` coordinate changes.
- The `done` node's `minimum width` and possibly `minimum height` change.
- The `process` node becomes a blue ellipse with a dark blue border.
- All four nodes and three arrows remain present after recompilation.

## Currently supported syntax

The extension supports common statements in this form:

```tex
\node[draw, minimum width=2.8cm, minimum height=1.1cm] (start) at (0,0) {Start};
\draw[->] (start) -- (next);
```

The current version does not parse relative positioning such as `below=of ...`, labels with nested braces, curved or orthogonal paths, or expanded TikZ macros. To avoid damaging an Overleaf document, the MVP uses a copy-and-paste workflow instead of directly overwriting editor content.

## Verification

```bash
node test.js
```

## Next steps

- Support relative layouts from the TikZ `positioning` library, with an option to preserve constraints or convert them to absolute coordinates after a drag.
- Support edge anchors, orthogonal path control points, adding and deleting nodes, and undo/redo.
- Replace regular-expression parsing with a LaTeX AST to support nested styles and custom macros.
- Implement safe, real-time, two-way synchronization through an official Overleaf extension point, if one becomes available, or through a robust editor adapter.
