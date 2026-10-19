/**
 * Sample boards for the dev gallery (/dev/canvas): one per visual, written exactly
 * the way the AI sends them (compact Board Protocol v2 commands).
 */

const intro = (caption, title) => [
  { type: 'caption', text: caption },
  { type: 'write', text: title, size: 'lg', id: 't' },
  { type: 'underline', id: 't', color: 'blue' },
];

export const SAMPLES = [
  {
    id: 'plot',
    title: 'Plot: y = x² − 4',
    actions: [
      ...intro("Let's draw y = x² − 4 and see where it meets the x-axis.", 'y = x^2 − 4'),
      {
        type: 'plot',
        fns: ['x^2-4'],
        x: [-4, 4],
        points: { A: [-2, 0], B: [2, 0] },
        labels: ['y=x^2-4'],
        shade: { fn: 0, from: -2, to: 2 },
      },
      { type: 'write', text: 'x^2 = 4' },
      { type: 'write', text: 'x = ±2', color: 'green', id: 'a' },
      { type: 'box', id: 'a', color: 'green' },
    ],
  },
  {
    id: 'asymptote',
    title: 'Plot: 1/x and tan x',
    actions: [
      ...intro('Some curves break where they are undefined.', 'y = 1/x'),
      { type: 'plot', fns: ['1/x'], x: [-4, 4], y: [-5, 5], labels: ['y=1/x'] },
      { type: 'plot', fns: ['tan(x)'], x: [-3, 3], y: [-4, 4], labels: ['tan x'] },
    ],
  },
  {
    id: 'numberline',
    title: 'Number line: −2 < x ≤ 3',
    actions: [
      ...intro('All x greater than −2 and up to 3.', '−2 < x ≤ 3'),
      { type: 'numberline', range: [-5, 5], interval: { from: -2, to: 3, open: [true, false] } },
    ],
  },
  {
    id: 'geo',
    title: 'Geometry: 3-4-5 triangle',
    actions: [
      ...intro('A right triangle with sides 3, 4 and 5.', 'Pythagoras'),
      {
        type: 'geo',
        pts: { A: [0, 0], B: [4, 0], C: [0, 3] },
        shapes: ['ABC'],
        right: ['BAC'],
        angles: ['ABC'],
        sides: { AB: '4 cm', AC: '3 cm', BC: '5 cm' },
      },
      { type: 'write', text: 'BC^2 = AB^2 + AC^2' },
      { type: 'write', text: '25 = 16 + 9', color: 'green' },
    ],
  },
  {
    id: 'circle',
    title: 'Geometry: circle and radius',
    actions: [
      ...intro('A circle is every point at the same distance from O.', 'Circle'),
      {
        type: 'geo',
        pts: { O: [0, 0], A: [2, 0], B: [0, 2] },
        shapes: ['OA', 'OB'],
        circles: [{ c: 'O', through: 'A' }],
        sides: { OA: 'r' },
        angles: ['AOB'],
      },
    ],
  },
  {
    id: 'table',
    title: 'Table of values: y = 2x + 1',
    actions: [
      ...intro('Make a table of values before drawing the line.', 'y = 2x + 1'),
      { type: 'table', fn: '2x+1', xs: [-2, -1, 0, 1, 2] },
      { type: 'plot', fns: ['2x+1'], x: [-2, 2] },
    ],
  },
  {
    id: 'rows',
    title: 'Table: metals and water',
    actions: [
      ...intro('How metals react with water.', 'Metals + water'),
      {
        type: 'table',
        head: ['Metal', 'With water', 'Gas'],
        rows: [
          ['Sodium', 'very fast', 'H_2'],
          ['Calcium', 'fast', 'H_2'],
          ['Magnesium', 'slow (hot)', 'H_2'],
          ['Iron', 'steam only', 'H_2'],
        ],
      },
    ],
  },
  {
    id: 'bar',
    title: 'Bar chart',
    actions: [
      ...intro('Marks in each test.', 'Test marks'),
      {
        type: 'chart',
        kind: 'bar',
        labels: ['T1', 'T2', 'T3', 'T4'],
        values: [62, 74, 70, 88],
        title: 'Maths',
        unit: '%',
      },
    ],
  },
  {
    id: 'pie',
    title: 'Pie chart',
    actions: [
      ...intro('What air is made of.', 'Air'),
      {
        type: 'chart',
        kind: 'pie',
        labels: ['Nitrogen', 'Oxygen', 'Other'],
        values: [78, 21, 1],
        title: 'Air',
      },
    ],
  },
  {
    id: 'line',
    title: 'Line chart: a journey',
    actions: [
      ...intro('A car speeds up, cruises, then stops.', 'Speed–time'),
      {
        type: 'chart',
        kind: 'line',
        labels: ['0', '2', '4', '6', '8', '10'],
        values: [0, 10, 20, 20, 20, 0],
        title: 'speed (m/s) vs time (s)',
      },
    ],
  },
  {
    id: 'flow',
    title: 'Flowchart: photosynthesis',
    actions: [
      ...intro('How a leaf makes food.', 'Photosynthesis'),
      {
        type: 'flow',
        nodes: ['Sunlight', 'Chlorophyll absorbs light', 'Water + CO_2', 'Glucose + O_2'],
        edges: [
          [0, 1],
          [1, 3],
          [2, 3],
        ],
      },
    ],
  },
  {
    id: 'mind',
    title: 'Mind map',
    actions: [
      ...intro('Everything a plant needs.', 'Plant needs'),
      {
        type: 'flow',
        kind: 'mind',
        nodes: ['Plant', 'Sunlight', 'Water', 'CO_2', 'Minerals', 'Chlorophyll'],
      },
    ],
  },
  {
    id: 'circuit',
    title: 'Circuit: series',
    actions: [
      ...intro('A battery lights a bulb through a resistor.', 'Series circuit'),
      {
        type: 'diagram',
        kind: 'circuit',
        parts: ['battery 6V', 'resistor 4Ω', 'bulb', 'switch', 'ammeter'],
      },
      { type: 'write', text: 'I = V/R = 6/4 = 1.5 A' },
    ],
  },
  {
    id: 'parallel',
    title: 'Circuit: parallel',
    actions: [
      ...intro('Two bulbs on separate branches.', 'Parallel circuit'),
      {
        type: 'diagram',
        kind: 'circuit',
        layout: 'parallel',
        parts: ['battery 9V', 'bulb L1', 'bulb L2', 'resistor R'],
      },
    ],
  },
  {
    id: 'lens',
    title: 'Convex lens: object beyond 2F',
    actions: [
      ...intro('Where does a convex lens form the image?', 'Convex lens'),
      { type: 'diagram', kind: 'lens', shape: 'convex', f: 10, u: 30, h: 2 },
      { type: 'write', text: '1/v − 1/u = 1/f' },
      { type: 'write', text: 'v = 15 cm, real, inverted', color: 'green' },
    ],
  },
  {
    id: 'magnifier',
    title: 'Convex lens: magnifying glass',
    actions: [
      ...intro('Object inside F: a virtual, bigger image.', 'Magnifier'),
      { type: 'diagram', kind: 'lens', shape: 'convex', f: 10, u: 5, h: 2 },
    ],
  },
  {
    id: 'mirror',
    title: 'Concave mirror',
    actions: [
      ...intro('A concave mirror with the object beyond C.', 'Concave mirror'),
      { type: 'diagram', kind: 'mirror', shape: 'concave', f: 10, u: 30, h: 2 },
    ],
  },
  {
    id: 'fbd',
    title: 'Free-body diagram',
    actions: [
      ...intro('Forces on a block pulled at an angle.', 'Forces'),
      {
        type: 'diagram',
        kind: 'fbd',
        forces: [
          { dir: 'down', label: 'mg' },
          { dir: 'up', label: 'N' },
          { dir: 30, label: 'F', size: 1.5 },
          { dir: 'left', label: 'f' },
        ],
      },
    ],
  },
  {
    id: 'atom',
    title: 'Bohr model: sodium',
    actions: [
      ...intro('Sodium has 11 electrons.', 'Sodium (Na)'),
      { type: 'diagram', kind: 'atom', z: 11, symbol: 'Na' },
      { type: 'write', text: 'Valency = 1', color: 'green' },
    ],
  },
  {
    id: 'cell',
    title: 'Plant cell',
    actions: [
      ...intro('The parts of a plant cell.', 'Plant cell'),
      {
        type: 'diagram',
        kind: 'cell',
        cell: 'plant',
        labels: ['cell wall', 'cell membrane', 'nucleus', 'chloroplast', 'vacuole', 'cytoplasm'],
      },
    ],
  },
  {
    id: 'animal',
    title: 'Animal cell',
    actions: [
      ...intro('The parts of an animal cell.', 'Animal cell'),
      { type: 'diagram', kind: 'cell', cell: 'animal' },
    ],
  },
  {
    id: 'apparatus',
    title: 'Lab apparatus',
    actions: [
      ...intro('Heating a liquid in the lab.', 'Apparatus'),
      {
        type: 'diagram',
        kind: 'apparatus',
        items: ['beaker', 'flask', 'test_tube', 'burner'],
        title: 'Heating set-up',
      },
    ],
  },
  {
    id: 'questions',
    title: 'Questions: ask, answers and marks',
    actions: [
      ...intro('A rectangle is 3 cm long and 4 cm wide. What is its area?', 'Area'),
      { type: 'write', text: 'Area = l × b' },
      { type: 'ask', id: 'q1', kind: 'number', unit: 'cm^2' },
      { type: 'answer', ask: 'q1', text: '7', correct: false },
      { type: 'answer', ask: 'q1', text: '12', correct: true },
      { type: 'caption', text: 'Correct! Length times breadth: 3 × 4 = 12.' },
      { type: 'write', text: '3 + 4 = 7', color: 'orange', id: 's1' },
      { type: 'mark', id: 's1', kind: 'cross', note: 'added, not multiplied' },
      { type: 'write', text: '3 × 4 = 12 cm^2', color: 'orange', id: 's2' },
      { type: 'mark', id: 's2', kind: 'tick' },
      { type: 'ask', id: 'q2', kind: 'choice', options: ['7 cm^2', '12 cm^2', '14 cm^2'] },
    ],
  },
  {
    id: 'lesson',
    title: 'Mixed lesson: motion',
    actions: [
      ...intro("Let's see how speed changes when a car speeds up.", 'Motion'),
      { type: 'write', text: 'v = u + at' },
      {
        type: 'plot',
        fns: ['2x'],
        x: [0, 5],
        xlabel: 't (s)',
        ylabel: 'v (m/s)',
        labels: ['v = 2t'],
      },
      { type: 'caption', text: 'Zoom in on the graph: the slope is the acceleration.' },
      { type: 'focus', at: [920, 100, 620, 360] },
      { type: 'pause', ms: 800 },
      { type: 'focus' },
      { type: 'scene', title: 'Forces on the car' },
      {
        type: 'diagram',
        kind: 'fbd',
        forces: [
          { dir: 'right', label: 'engine', size: 1.5 },
          { dir: 'left', label: 'friction' },
          { dir: 'down', label: 'mg' },
          { dir: 'up', label: 'N' },
        ],
      },
      { type: 'column', side: 'left' },
      { type: 'write', text: 'F_{net} = ma' },
      { type: 'write', text: 'engine > friction', color: 'green', id: 'a' },
      { type: 'box', id: 'a', color: 'green' },
    ],
  },
];
