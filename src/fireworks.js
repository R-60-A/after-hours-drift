// Screen-space celebration particles; static sparks for reduced-motion users.
(function(root) {
  'use strict';
  root.createFireworks = function(canvas, reducedMotion) {
    const C = DriftCore,
      fire = canvas.getContext('2d');
    let sparks = [],
      burstTimer = 0;

    function burst(x, y) {
      const color = ['#d7fa79', '#ffce70', '#82dfff', '#ff88b9', '#f7f6e6'][Math.floor(Math
        .random() * 5)];
      for (let i = 0; i < (reducedMotion ? 20 : 65); i++) {
        const angle = Math.random() * C.TAU,
          speed = 45 + Math.random() * 150;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.2 + Math.random() * .8,
          maxLife: 2,
          color
        });
        if (reducedMotion) {
          const p = sparks[sparks.length - 1];
          p.x += p.vx * .8;
          p.y += p.vy * .8;
        }
      }
      sparks = sparks.slice(-500);
    }

    function drawFireworks(dt, w, h, dpr) {
      fire.setTransform(dpr, 0, 0, dpr, 0, 0);
      fire.clearRect(0, 0, w, h);
      if (!reducedMotion) {
        burstTimer -= dt;
        if (burstTimer <= 0) {
          burst(w * (.12 + Math.random() * .76), h * (.12 + Math.random() * .6));
          burstTimer = .85;
        }
      }
      fire.save();
      fire.globalCompositeOperation = 'lighter';
      fire.lineWidth = 2;
      for (const p of sparks) {
        if (!reducedMotion) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 45 * dt;
        }
        fire.globalAlpha = Math.max(0, p.life / p.maxLife);
        fire.strokeStyle = p.color;
        fire.shadowColor = p.color;
        fire.shadowBlur = 5;
        fire.beginPath();
        fire.moveTo(p.x, p.y);
        fire.lineTo(p.x - p.vx * .035, p.y - p.vy * .035);
        fire.stroke();
      }
      fire.restore();
      sparks = sparks.filter(p => p.life > 0);
    }
    return {
      start(w, h) {
        sparks = [];
        burstTimer = 0;
        for (const x of [.2, .5, .8]) burst(x * w, h * .25);
      },
      reset() {
        sparks = [];
      },
      resize(width, height) {
        canvas.width = width;
        canvas.height = height;
      },
      draw: drawFireworks
    };
  };
})(globalThis);
