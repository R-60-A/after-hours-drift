// Map geometry and tunable driving/scoring settings.
(function(root) {
  'use strict';
  root.DriftConfig = Object.freeze({
    width: 1024,
    height: 1536,
    step: 1 / 60,
    carLength: 52,
    carWidth: 25,
    maxSpeed: 225,
    reverseSpeed: 65,
    acceleration: 150,
    braking: 260,
    grip: 7.2,
    driftGrip: 1.65,
    minDriftSpeed: 60,
    minSlip: .16,
    maxSlip: 1.15,
    comboGrace: 1,
    spawn: {
      x: 245,
      y: 1135,
      angle: -Math.PI / 2
    },
    circle: {
      x: 245,
      y: 1005,
      radius: 110
    },
    // World coordinates follow the original 1024 × 1536 image.
    zone: [
      [72, 700],
      [174, 643],
      [180, 738],
      [194, 759],
      [213, 770],
      [350, 770],
      [374, 752],
      [374, 630],
      [571, 630],
      [599, 648],
      [785, 672],
      [797, 744],
      [797, 782],
      [818, 800],
      [818, 1006],
      [875, 1055],
      [875, 1288],
      [839, 1330],
      [752, 1330],
      [694, 1280],
      [616, 1264],
      [557, 1260],
      [511, 1246],
      [472, 1257],
      [432, 1283],
      [407, 1330],
      [148, 1330],
      [97, 1294],
      [85, 1238],
      [62, 1180],
      [60, 1015],
      [54, 934],
      [48, 817]
    ],
    solids: [
      [
        [184, 575],
        [371, 575],
        [371, 745],
        [354, 763],
        [208, 763],
        [184, 741]
      ]
    ],
    gates: [
      [
        [374, 630],
        [571, 630]
      ],
      [
        [785, 672],
        [797, 782]
      ]
    ],
    secretFence: [
      [97, 1294],
      [148, 1330],
      [315, 1330]
    ],
    colors: ['#c8c8bb', '#e1e4dd', '#252f36', '#254a3d', '#aeaaa0', '#4d5961', '#a14235',
      '#c5b491'
    ]
  });
})(globalThis);
