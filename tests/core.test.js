'use strict';
const C = DriftCore,
  output = document.getElementById('output');
let passed = 0,
  failed = 0,
  lines = [];

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    passed++;
    lines.push('PASS ' + name);
  } catch (e) {
    failed++;
    lines.push('FAIL ' + name + ': ' + e.message);
  }
}
test('1,000 seeded layouts are safe, connected, varied, and nonrepeating', () => {
  const counts = new Set(),
    arrangements = new Set();
  let previous = '';
  for (let seed = 1; seed <= 1000; seed++) {
    const cars = C.generateLayout(seed, previous),
      signature = C.signature(cars);
    assert(C.validateLayout(cars), 'Invalid seed ' + seed);
    assert(signature !== previous, 'Repeated arrangement at ' + seed);
    assert(!C.collision(C.createCar(), cars), 'Spawn collision at ' + seed);
    assert(cars.filter(c => c.x < 300).length >= 2, 'Missing left-side cars at ' + seed);
    counts.add(cars.length);
    arrangements.add(signature);
    previous = signature;
  }
  assert(counts.size === 7, 'Expected counts 8 through 14; got ' + [...counts]);
  assert(arrangements.size > 950, 'Insufficient layout variety');
});
test('Seeded generation is deterministic', () => assert(JSON.stringify(C.generateLayout(42)) ===
  JSON.stringify(C.generateLayout(42)), 'Unstable seed'));
test('Sparse fallback layouts retain left-side cars and clear routes', () => {
  const left = C.candidates.filter(c => c.x < 300);
  let valid = 0;
  for (const x of [425, 675]) {
    for (let i = 0; i < left.length; i++)
      for (let j = i + 1; j < left.length; j++) {
        const cars = [left[i], left[j], ...C.candidates.filter(c => c.x === x)];
        if (C.validateLayout(cars)) valid++;
      }
  }
  assert(valid >= 2, 'Need at least two validated fallbacks; got ' + valid);
});
test('Invalid density, overlap, blocked spawn, and blocked circle are rejected', () => {
  const cars = C.generateLayout(55);
  assert(!C.validateLayout([]), 'Empty layout accepted');
  assert(!C.validateLayout([...cars.slice(1), cars[1]]), 'Overlaps accepted');
  assert(!C.validateLayout([{
    ...cars[0],
    x: 245,
    y: 1135
  }, ...cars.slice(1)]), 'Blocked spawn accepted');
  assert(!C.validateLayout([{
    ...cars[0],
    x: 245,
    y: 1005
  }, ...cars.slice(1)]), 'Blocked circle accepted');
});
test('Oriented cars collide at edges and separate across a gap', () => {
  const a = {
      x: 400,
      y: 900,
      angle: Math.PI / 4
    },
    b = {
      x: 410,
      y: 905,
      angle: -Math.PI / 4
    };
  assert(C.overlap(C.rect(a), C.rect(b)), 'Missed rotated overlap');
  b.x = 500;
  assert(!C.overlap(C.rect(a), C.rect(b)), 'False positive');
  assert(C.overlap(C.rect({
    x: 0,
    y: 0,
    angle: 0
  }), C.rect({
    x: 52,
    y: 0,
    angle: 0
  })), 'Touch not detected');
});
test('Zone boundary and shed collisions are detected', () => {
  assert(!C.collision(C.createCar(), []), 'Spawn outside zone');
  assert(C.collision({
    x: 460,
    y: 640,
    angle: 0
  }, [])?.includes('zone'), 'Entrance crossing accepted');
  assert(C.collision({
    x: 275,
    y: 680,
    angle: 0
  }, [])?.includes('shed'), 'Shed collision missed');
  assert(C.collision({
    x: 430,
    y: 1300,
    angle: Math.PI / 4
  }, []), 'Concave boundary missed');
});
test('Substeps prevent tunneling through a parked car at full speed', () => {
  const car = {
    ...C.createCar(),
    x: 425,
    y: 950,
    angle: -Math.PI / 2,
    vx: 0,
    vy: -225,
    speed: 225
  };
  const obstacle = {
    x: 425,
    y: 880,
    angle: 0,
    length: 54,
    width: 26
  };
  assert(C.simulate(car, {}, C.createScore(), [obstacle], .4)?.includes('parked'),
    'Tunneled through obstacle');
});
test('Only contact with the bottom-left fence unlocks the secret', () => {
  const bottom = {
    ...C.createCar(),
    x: 290,
    y: 1305,
    angle: Math.PI / 2,
    vx: 0,
    vy: 90,
    speed: 90
  };
  const reason = C.collision(bottom, []);
  assert(C.isSecretFenceHit(bottom, reason), 'Bottom-left horizontal fence missed');
  const bend = {
    ...bottom,
    x: 121,
    y: 1304,
    angle: Math.PI / 4
  };
  assert(C.isSecretFenceHit(bend, C.collision(bend, [])), 'Bottom-left fence bend missed');
  for (const car of [{
      ...bottom,
      x: 360
    }, {
      ...bottom,
      x: 290,
      y: 1260
    }, {
      ...bottom,
      x: 70,
      y: 1100
    }, {
      ...bottom,
      x: 820,
      y: 950
    }]) {
    assert(!C.isSecretFenceHit(car, C.collision(car, [])),
      'Secret triggered away from its fence');
  }
  assert(!C.isSecretFenceHit(bottom, 'You hit a parked car.'),
    'Parked-car crash triggered the secret');
  assert(!C.isSecretFenceHit(bottom, 'You hit the shed.'), 'Shed crash triggered the secret');
});
test('A real driving impact reaches the secret fence without tunneling', () => {
  const car = {
      ...C.createCar(),
      x: 290,
      y: 1280,
      angle: Math.PI / 2,
      vx: 0,
      vy: 120,
      speed: 120
    },
    score = C.createScore();
  let reason = null;
  for (let i = 0; i < 120 && !reason; i++) reason = C.simulate(car, {
    up: true
  }, score, [], 1 / 60);
  assert(C.isSecretFenceHit(car, reason), 'Driving into secret fence did not trigger it');
});
test('Straight driving, stationary steering, reversing, and spinning earn zero', () => {
  for (const values of [{
      speed: 130,
      forward: 130,
      slip: 0,
      yaw: 0
    }, {
      speed: 0,
      forward: 0,
      slip: .5,
      yaw: 2
    }, {
      speed: 90,
      forward: -90,
      slip: .4,
      yaw: 2
    }, {
      speed: 130,
      forward: 100,
      slip: 1.5,
      yaw: 4
    }]) {
    const score = C.createScore();
    for (let i = 0; i < 600; i++) C.scoreStep(score, values, 1 / 60);
    assert(score.points === 0, 'Invalid points ' + JSON.stringify(values));
  }
});
test('Drifting builds ×5, gap grace works, and a circle awards a bonus', () => {
  const score = C.createScore(),
    car = {
      speed: 130,
      forward: 110,
      slip: .45,
      yaw: 1.4
    };
  let bonus = 0;
  for (let i = 0; i < 600; i++) bonus += C.scoreStep(score, car, 1 / 60);
  assert(score.multiplier === 5 && score.points > 0, 'No multiplier');
  assert(score.circles >= 2 && bonus > 0, 'Circle bonus missing');
  C.scoreStep(score, {
    ...car,
    slip: 0
  }, .5);
  assert(score.multiplier === 5, 'Grace lost');
  C.scoreStep(score, {
    ...car,
    slip: 0
  }, .6);
  assert(score.multiplier === 1 && score.turn === 0, 'Chain failed to reset');
});
test('Changing turning direction resets partial circle progress', () => {
  const score = C.createScore(),
    car = {
      speed: 130,
      forward: 110,
      slip: .5,
      yaw: 1.4
    };
  for (let i = 0; i < 180; i++) C.scoreStep(score, car, 1 / 60);
  const before = score.turn;
  C.scoreStep(score, {
    ...car,
    yaw: -1.4
  }, 1 / 60);
  assert(before > 4 && score.turn < .1 && score.circles === 0, 'Zigzags counted as a circle');
});
test('Score rate is independent of rendering frequency', () => {
  const car = {
    speed: 130,
    forward: 110,
    slip: .45,
    yaw: 0
  };

  function run(hz) {
    const score = C.createScore();
    for (let i = 0; i < hz * 5; i++) C.scoreStep(score, car, 1 / hz);
    return score.points;
  }
  assert(Math.abs(run(60) - run(120)) < 3, 'Rate-dependent scoring');
});
test('Arcade handling accelerates, brakes, reverses, and stays finite', () => {
  const car = C.createCar();
  for (let i = 0; i < 180; i++) C.drive(car, {
    up: true
  }, 1 / 60);
  assert(car.speed > 160 && car.speed <= 225.01, 'Acceleration incorrect ' + car.speed);
  const speed = car.speed;
  for (let i = 0; i < 60; i++) C.drive(car, {
    down: true
  }, 1 / 60);
  assert(car.speed < speed, 'No braking');
  for (let i = 0; i < 180; i++) C.drive(car, {
    down: true
  }, 1 / 60);
  assert(car.forward < 0 && Math.abs(car.forward) <= 65.01, 'Reverse incorrect');
  for (let i = 0; i < 10000; i++) C.drive(car, {
    up: true,
    right: true,
    handbrake: i % 2 === 0
  }, 1 / 60);
  assert([car.x, car.y, car.angle, car.speed, car.slip].every(Number.isFinite),
    'Nonfinite physics');
});
test('Keyboard turns can sustain a scoring drift and circle', () => {
  const car = C.createCar(),
    score = C.createScore();
  for (let i = 0; i < 100; i++) C.drive(car, {
    up: true
  }, 1 / 60);
  for (let i = 0; i < 900; i++) {
    C.drive(car, {
      up: true,
      right: true
    }, 1 / 60);
    C.scoreStep(score, car, 1 / 60);
  }
  assert(score.points > 500 && score.circles > 0, 'Handling cannot sustain a circle: ' + JSON
    .stringify({
      score,
      car
    }));
});
test('A sustained circle is playable inside sparse and dense real layouts', () => {
  const byCount = new Map();
  for (let seed = 1; seed < 100 && byCount.size < 2; seed++) {
    const cars = C.generateLayout(seed);
    if (cars.length === 8 || cars.length === 14) byCount.set(cars.length, cars);
  }
  assert(byCount.size === 2, 'Missing density fixtures');
  for (const [count, cars] of byCount) {
    const car = C.createCar(),
      score = C.createScore();
    let reason = null;
    for (let i = 0; i < 900; i++) {
      reason = C.simulate(car, {
        up: true,
        left: i >= 48
      }, score, cars, 1 / 60);
      if (reason) break;
    }
    assert(!reason, 'Circle crashed in ' + count + '-car layout: ' + reason + ' ' + JSON
      .stringify(car));
    assert(score.circles >= 2, 'No full circles in ' + count + '-car layout');
  }
});
output.textContent = lines.join('\n') + '\n\n' + passed + ' passed / ' + failed + ' failed';
output.className = failed ? 'fail' : 'pass';
document.title = failed ? 'FAIL — core checks' : 'PASS — core checks';
document.documentElement.dataset.result = failed ? 'fail' : 'pass';
