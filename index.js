import ForceGraph3D from "3d-force-graph";

const elem = document.getElementById("3d-graph");

const Graph = new ForceGraph3D(elem)
  .jsonUrl("data/test.json")
  .nodeLabel("id")
  .nodeAutoColorBy("group")
  .onNodeClick((node) => {
    // Aim at node from outside it
    const distance = 40;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

    const newPos =
      node.x || node.y || node.z
        ? {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: node.z * distRatio,
          }
        : { x: 0, y: 0, z: distance }; // special case if node is in (0,0,0)

    Graph.cameraPosition(
      newPos, // new position
      node, // lookAt ({ x, y, z })
      3000, // ms transition duration
    );
  })
  .nodeVal((node) => node.value)
  .linkWidth((link) => Math.sqrt(link.value))
  .linkOpacity(0.7);

resizeGraph();

if (window.ResizeObserver) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      resizeGraph();
    }
  });

  resizeObserver.observe(document.getElementById("3d-graph"));
}
