// Sprite-aligned head/tail lamps and the night darkness mask. No pixel reads.
(function(root) {
  'use strict';
  root.createNightLighting = function(ctx, cfg) {
    const C = DriftCore;
    const headLamps = document.createElement('canvas'),
      tailLamps = document.createElement('canvas');
    for (const image of [headLamps, tailLamps]) {
      image.width = 140;
      image.height = 280;
    }
    const lighting = document.createElement('canvas'),
      light = lighting.getContext('2d');
    const lamps = [
      [87, 797],
      [94, 1192],
      [353, 754],
      [805, 795],
      [862, 1080],
      [835, 1293],
      [305, 1323]
    ];

    function path(poly) {
      ctx.beginPath();
      poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath();
    }

    function pool(target, x, y, radius, strength, color = '0,0,0') {
      const g = target.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(${color},${strength})`);
      g.addColorStop(.3, `rgba(${color},${strength*.75})`);
      g.addColorStop(1, `rgba(${color},0)`);
      target.fillStyle = g;
      target.beginPath();
      target.arc(x, y, radius, 0, C.TAU);
      target.fill();
    }

    function prepareLampSprites(rio) {
      // Trace the glass in original PNG coordinates, then apply the very same
      // crop and scale used for the car. Keep the actual lens texture underneath.
      const front = new Path2D(
        'M363 111 C332 111 291 134 272 166 C254 195 249 235 251 268 C264 259 285 224 302 200 C325 171 346 146 363 111 Z'
        );
      const rear = new Path2D(
        'M236 1264 C241 1301 251 1323 269 1345 C290 1369 333 1391 369 1406 L373 1415 C323 1407 278 1397 252 1373 C236 1351 229 1314 236 1264 Z'
        );
      for (const [image, shape, tint] of [
          [headLamps, front, 'rgba(225,244,255,.48)'],
          [tailLamps, rear, 'rgba(255,40,30,.55)']
        ]) {
        const pen = image.getContext('2d');
        pen.setTransform(140 / 715, 0, 0, 280 / 1420, -155 * 140 / 715, -65 * 280 / 1420);
        for (const mirrored of [false, true]) {
          pen.save();
          if (mirrored) {
            pen.translate(1024, 0);
            pen.scale(-1, 1);
          }
          pen.clip(shape);
          pen.drawImage(rio, 0, 0);
          pen.globalCompositeOperation = 'screen';
          pen.fillStyle = tint;
          pen.fill(shape);
          pen.restore();
        }
      }
    }

    function nightLights(car) {
      // A separate darkness mask lets lights reveal the original pavement and
      // cars. It uses no pixel reads and works with ordinary local-file security.
      light.setTransform(1, 0, 0, 1, 0, 0);
      light.globalCompositeOperation = 'source-over';
      light.clearRect(0, 0, lighting.width, lighting.height);
      light.fillStyle = 'rgba(4,10,28,.79)';
      light.fillRect(0, 0, lighting.width, lighting.height);
      light.setTransform(ctx.getTransform());
      light.globalCompositeOperation = 'destination-out';
      for (const [x, y] of lamps) pool(light, x, y, 125, .68);
      pool(light, car.x, car.y, 80, .38);
      light.save();
      light.translate(car.x, car.y);
      light.rotate(car.angle);
      for (const y of [-8.3, 8.3]) {
        const beam = light.createRadialGradient(22.6, y, 0, 22.6, y, 205);
        beam.addColorStop(0, 'rgba(0,0,0,.95)');
        beam.addColorStop(.42, 'rgba(0,0,0,.8)');
        beam.addColorStop(1, 'rgba(0,0,0,0)');
        light.fillStyle = beam;
        light.beginPath();
        light.moveTo(22.6, y);
        light.arc(22.6, y, 205, -.36, .36);
        light.closePath();
        light.fill();
      }
      light.restore();
      light.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(lighting, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const [x, y] of lamps) {
        pool(ctx, x, y, 115, .12, '255,182,78');
        ctx.fillStyle = '#ffe4a6';
        ctx.shadowColor = '#ffca68';
        ctx.shadowBlur = 13;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, C.TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle + Math.PI / 2);
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#d9efff';
      ctx.drawImage(headLamps, -14, -27, 28, 54);
      ctx.shadowColor = '#ff3838';
      ctx.drawImage(tailLamps, -14, -27, 28, 54);
      ctx.restore();
      // Keep the playable outline readable outside the headlight beams.
      path(cfg.zone);
      ctx.strokeStyle = '#e1c381aa';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([6, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [a, b] of cfg.gates) {
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.lineTo(...b);
        ctx.strokeStyle = '#ffd78a';
        ctx.lineWidth = 4;
        ctx.setLineDash([9, 7]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    return {
      prepare: prepareLampSprites,
      resize(width, height) {
        lighting.width = width;
        lighting.height = height;
      },
      draw: nightLights
    };
  };
})(globalThis);
