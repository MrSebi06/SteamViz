import ForceGraph3D from "3d-force-graph";

const N = 300;
const gData = {
  nodes: [...Array(N).keys()].map((i) => ({ id: i })),
  links: [...Array(N).keys()]
    .filter((id) => id)
    .map((id) => ({
      source: id,
      target: Math.round(Math.random() * (id - 1)),
    })),
};

const Graph = new ForceGraph3D(document.getElementById("3d-graph")).graphData(
  gData,
);

function resizeGraph() {
  const container = document.getElementById("3d-graph");
  const width = container.clientWidth;
  const height = container.clientHeight;

  Graph.width(width).height(height);
}

resizeGraph();

if (window.ResizeObserver) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      resizeGraph();
    }
  });

  resizeObserver.observe(document.getElementById("3d-graph"));
}
