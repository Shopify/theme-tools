import './style.css';
import * as d3 from 'd3';
import graph from './graph.json';
import { SerializableGraph, SerializableNode } from '@shopify/theme-graph';

interface Node extends d3.SimulationNodeDatum {
  type: string;
  kind: string;
  uri: string;
  path: string;
  parents: Node[];
  dependencies: Node[];
}

interface Link extends d3.SimulationLinkDatum<Node> {
  value: number;
}

const filters = {
  js: false,
  css: false,
  layout: false,
};

// Specify the color scale.
const color = d3.scaleOrdinal(d3.schemeCategory10);
let rootUri = graph.rootUri;

function chart(app: any, graph: SerializableGraph) {
  // Specify the dimensions of the chart.
  let { width, height } = app.getBoundingClientRect();
  rootUri = graph.rootUri;

  window.addEventListener('resize', () => {
    ({ width, height } = app.getBoundingClientRect());
    svg
      ?.attr('width', width)
      .attr('height', height)
      .attr('viewBox', () => [-width / 2, -height / 2, width, height])
      .attr('style', 'max-width: 100%; height: auto;');
  });

  const nodes: Node[] = graph.nodes
    .filter((node) => applyFilters(node))
    .map((node) => ({
      ...node,
      path: relative(node.uri),
      parents: [],
      dependencies: [],
    }));

  const links: Link[] = graph.edges
    .map((edge) => ({
      ...edge,
      value: 2,
      source: nodes.find((node) => node.uri === edge.source.uri)!,
      target: nodes.find((node) => node.uri === edge.target.uri)!,
    }))
    .filter((link) => link.source && link.target);

  bind(nodes, links);

  function linkAccessor(d: Node): string {
    return d.path;
  }

  const linkForces = d3.forceLink<Node, Link>(links).id(linkAccessor).distance(30);

  // Create a simulation with several forces.
  const simulation = d3
    .forceSimulation(nodes)
    .force('link', linkForces)
    .force('charge', d3.forceManyBody().strength(-200))
    .force('x', d3.forceX())
    .force('y', d3.forceY());

  // Create the SVG container.
  const svg = d3
    .create('svg')
    .attr('width', () => width)
    .attr('height', () => height)
    .attr('viewBox', () => [-width / 2, -height / 2, width, height])
    .attr('style', 'max-width: 100%; height: auto;');

  const g = svg.append('g');

  // Add a line for each link, and a circle for each node.
  const link = g
    .append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', (d) => Math.sqrt(d.value));

  const node = g
    .append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 7)
    .attr('fill', (d) => color(d.type + d.kind));

  // Add a drag behavior.
  node.call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended) as any);

  // Set the position attributes of links and nodes each time the simulation ticks.
  simulation.on('tick', () => {
    link
      .attr('x1', (d) => (d as any).source.x)
      .attr('y1', (d) => (d as any).source.y)
      .attr('x2', (d) => (d as any).target.x)
      .attr('y2', (d) => (d as any).target.y);

    node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
  });

  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  // Update the subject (dragged node) position during drag.
  function dragged(event: any) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  // Restore the target alpha so the simulation cools after dragging ends.
  // Unfix the subject position now that it’s no longer being dragged.
  function dragended(event: any) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  const tooltip = d3.select('#tooltip');
  const sidebar = d3.select('#sidebar-content');

  node
    .on('mouseover', function (event, d) {
      // switch class so that the node in the graph are opaque and the ones that
      // aren't are at 0.5 opacity
      const subset = subgraph(d);
      node
        .transition()
        .duration(100)
        .style('opacity', (d) => (subset.has(d) ? 1 : 0.1))
        .attr('r', (d) => (subset.has(d) ? 10 : 7));

      link
        .transition()
        .duration(100)
        .style('opacity', (d) =>
          subset.has(d.target as Node) && subset.has(d.source as Node) ? 0.6 : 0.1,
        );

      tooltip.transition().duration(100).style('opacity', 0.9);
      tooltip
        .html(d.path)
        .style('left', event.pageX + 'px')
        .style('top', event.pageY - 28 + 'px');

      sidebar.selectAll('*').remove();
      renderSidebar(d, sidebar.append('ul') as any);
      // console.log(renderToMarkdown(d));
    })
    .on('mouseout', function (d) {
      node.transition().duration(100).style('opacity', 1).attr('r', 7);
      link.transition().duration(100).style('opacity', 0.6);

      tooltip.transition().duration(500).style('opacity', 0);
    });

  let transform;

  const zoom = d3.zoom().on('zoom', (e) => {
    g.attr('transform', (transform = e.transform));
  });

  svg.call(zoom as any).call(zoom.transform as any, d3.zoomIdentity);

  return svg.node();
}

function bind(nodes: Node[], links: Link[]) {
  // Create a map of nodes by URI for quick access.
  const nodeMap = new Map<string, Node>();
  nodes.forEach((node) => nodeMap.set(node.uri, node));

  links.forEach((link) => {
    const sourceNode = nodeMap.get((link.source as Node).uri)!;
    const targetNode = nodeMap.get((link.target as Node).uri)!;

    sourceNode.dependencies.push(targetNode);
    targetNode.parents.push(sourceNode);
  });
}

function subgraph(node: Node): Set<Node> {
  const subgraph = new Set<Node>();
  const stack = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    subgraph.add(current);
    for (const dep of current.dependencies) {
      if (!subgraph.has(dep)) {
        stack.push(dep);
      }
    }
  }
  return subgraph;
}

const relative = (uri: string) => {
  return uri.replace(rootUri, '').replace(/^\//, '');
};

function renderSidebar(
  node: Node,
  el: d3.Selection<HTMLUListElement, unknown, any, unknown>,
  rendered = new Set<Node>(),
) {
  el.append('li').text(relative(node.uri));
  rendered.add(node);
  for (const dep of node.dependencies) {
    if (dep.uri === node.uri || rendered.has(dep)) continue; // Avoid self-references
    el.append('ul').call((ul) => renderSidebar(dep, ul as any, rendered));
  }
}

function renderToMarkdown(node: Node, indent = 0): string {
  return `${' '.repeat(indent)}- ${node.uri}\n${node.dependencies
    .map((dep) => renderToMarkdown(dep, indent + 2))
    .join('')}`;
}

function applyFilters(node: SerializableNode) {
  let filteredOut = false;
  if (!filters.js && node.type === 'JavaScript') {
    filteredOut = true;
  }

  if (!filters.css && node.type === 'CSS') {
    filteredOut = true;
  }

  if (!filters.layout && node.kind === 'layout') {
    filteredOut = true;
  }

  return !filteredOut;
}

const graphInput = d3.select<d3.BaseType, HTMLInputElement>('#graph');
const includeJsInput = d3.select<d3.BaseType, HTMLInputElement>('#show-js');
const includeCssInput = d3.select<d3.BaseType, HTMLInputElement>('#show-css');
const includeLayoutInput = d3.select<d3.BaseType, HTMLInputElement>('#show-layout');

graphInput.on('change', function (e) {
  const files = e.target.files;
  const file = files[0];
  if (file) {
    var reader = new FileReader();

    reader.onload = function (event) {
      try {
        inputGraph = JSON.parse(event?.target?.result as any); // Parse the JSON content
        reset();
      } catch (e) {
        console.error('Error parsing JSON!', e);
      }
    };

    reader.onerror = function (event) {
      console.error('File could not be read! Code ' + (event as any).target.error.code);
    };

    reader.readAsText(file); // Read the file as text
  } else {
    alert('No file selected!');
  }
});

let inputGraph: any = null;

function reset() {
  app.selectAll('*').remove();
  app.append(() => chart(app.node(), inputGraph ?? (graph as SerializableGraph)));
}

includeJsInput.on('change', function (e) {
  filters.js = e.target.checked;
  reset();
});

includeCssInput.on('change', function (e) {
  filters.css = e.target.checked;
  reset();
});

includeLayoutInput.on('change', function (e) {
  filters.layout = e.target.checked;
  reset();
});

const app = d3.select<d3.BaseType, HTMLDivElement>('#app');
app.append(() => chart(app.node(), inputGraph ?? (graph as SerializableGraph)));
