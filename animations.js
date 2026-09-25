(function(){
  const PAL = { model: "#1A6B78", sample: "#C94B3A", ink: "#1A1712", muted: "#6B6256", rule: "#DCCFBB", surface: "#FAF6EE", paper: "#F0E8D8" };
  function readPalette(el) {
    const s = getComputedStyle(el);
    const v = (n, f) => (s.getPropertyValue(n).trim() || f);
    return {
      model: v("--model", PAL.model),
      sample: v("--sample", PAL.sample),
      ink: v("--ink", PAL.ink),
      muted: v("--muted", PAL.muted),
      rule: v("--border", PAL.rule),
      surface: v("--card", PAL.surface),
      paper: v("--bg", PAL.paper),
    };
  }
  function hexAlpha(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randn(rand) {
    const u = Math.max(1e-12, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true; }
    return { width: rect.width, height: rect.height, ctx };
  }
  function clear(ctx, p, w, h) { ctx.clearRect(0, 0, w, h); ctx.fillStyle = p.surface; ctx.fillRect(0, 0, w, h); }
  function mapX(x, w, x0, x1, pad) { pad = pad == null ? 16 : pad; return pad + ((x - x0) / (x1 - x0)) * (w - pad * 2); }
  function mapY(y, h, y0, y1, pad) { pad = pad == null ? 16 : pad; return pad + ((y1 - y) / (y1 - y0)) * (h - pad * 2); }
  function npdf(x, m, s) { const z = (x - m) / s; return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)); }
  function ncdf(x, m, s) {
    const z = (x - m) / s;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  function makeMh(kind) {
    return function () {
      const sx = 1, sy = 0.72, rho = 0.55;
      const prop = kind === "hero" ? 0.42 : 0.5;
      const maxPath = kind === "hero" ? 160 : 70;
      let rand = mulberry32(kind === "hero" ? 42 : 7);
      let x = -1.4, y = -1.1, path = [{ x: x, y: y }], accepted = 1, total = 1, acc = 0, reject = null, w = 460, h = 300;
      function eigen2() {
        const a = sx * sx, b = rho * sx * sy, c = sy * sy, tr = a + c, det = a * c - b * b;
        const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
        return { l1: tr / 2 + disc, l2: tr / 2 - disc, angle: Math.atan2(2 * b, a - c) / 2 };
      }
      function logBvn(px, py) {
        const dx = px / sx, dy = py / sy, z = dx * dx - 2 * rho * dx * dy + dy * dy;
        return -0.5 * z / (1 - rho * rho);
      }
      function stepOnce() {
        const nx = x + randn(rand) * prop, ny = y + randn(rand) * prop;
        total += 1;
        const logA = logBvn(nx, ny) - logBvn(x, y);
        if (Math.log(Math.max(1e-12, rand())) < logA) {
          x = nx; y = ny; accepted += 1; path.push({ x: x, y: y });
          if (path.length > maxPath) path = path.slice(path.length - maxPath);
          reject = null;
        } else if (kind === "hero") reject = { x: nx, y: ny, age: 0 };
      }
      return {
        reset: function (cw, ch) {
          w = cw; h = ch; rand = mulberry32(kind === "hero" ? 42 : 7);
          x = -1.4; y = -1.1; path = [{ x: x, y: y }]; accepted = 1; total = 1; acc = 0; reject = null;
          for (let i = 0; i < (kind === "hero" ? 36 : 24); i++) stepOnce();
        },
        tick: function (dt, intensity) {
          acc += dt * (kind === "hero" ? 7 : 5) * intensity;
          while (acc >= 1) { acc -= 1; stepOnce(); }
          if (reject) reject.age += dt;
        },
        draw: function (ctx, p, cw, ch) {
          w = cw; h = ch; clear(ctx, p, w, h);
          const e = eigen2();
          const cx = mapX(0, w, -3.4, 3.4), cy = mapY(0, h, -2.5, 2.5);
          const rxU = (w - 32) / 6.8, ryU = (h - 32) / 5.0;
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(-e.angle);
          ctx.beginPath(); ctx.ellipse(0, 0, 1.1 * Math.sqrt(e.l1) * rxU, 1.1 * Math.sqrt(e.l2) * ryU, 0, 0, Math.PI * 2);
          ctx.fillStyle = hexAlpha(p.model, 0.06); ctx.fill();
          ctx.strokeStyle = hexAlpha(p.model, 0.55); ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]);
          [0.9, 1.6, 2.3, 3.0].forEach(function (d) {
            ctx.beginPath(); ctx.ellipse(0, 0, d * Math.sqrt(e.l1) * rxU, d * Math.sqrt(e.l2) * ryU, 0, 0, Math.PI * 2); ctx.stroke();
          });
          ctx.restore();
          ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.setLineDash([]);
          path.forEach(function (pt, i) {
            if (i % 3 !== 0 && i !== path.length - 1) return;
            ctx.beginPath(); ctx.arc(mapX(pt.x, w, -3.4, 3.4), mapY(pt.y, h, -2.5, 2.5), kind === "hero" ? 2.2 : 1.8, 0, Math.PI * 2);
            ctx.fillStyle = hexAlpha(p.sample, 0.18 + (i / path.length) * 0.55); ctx.fill();
          });
          ctx.beginPath();
          path.forEach(function (pt, i) {
            const X = mapX(pt.x, w, -3.4, 3.4), Y = mapY(pt.y, h, -2.5, 2.5);
            if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
          });
          ctx.strokeStyle = p.sample; ctx.lineWidth = kind === "hero" ? 2.2 : 1.8; ctx.stroke();
          if (reject && reject.age < 0.45) {
            ctx.beginPath(); ctx.arc(mapX(reject.x, w, -3.4, 3.4), mapY(reject.y, h, -2.5, 2.5), 4, 0, Math.PI * 2);
            ctx.strokeStyle = hexAlpha(p.sample, 1 - reject.age / 0.45); ctx.lineWidth = 1.4; ctx.stroke();
          }
          const last = path[path.length - 1];
          if (last) {
            ctx.beginPath(); ctx.arc(mapX(last.x, w, -3.4, 3.4), mapY(last.y, h, -2.5, 2.5), kind === "hero" ? 5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = p.sample; ctx.fill();
            ctx.beginPath(); ctx.arc(mapX(last.x, w, -3.4, 3.4), mapY(last.y, h, -2.5, 2.5), kind === "hero" ? 5 : 4, 0, Math.PI * 2);
            ctx.strokeStyle = p.surface; ctx.lineWidth = 1.5; ctx.stroke();
          }
        },
        stats: function () { return { accepted: accepted, total: total }; },
      };
    };
  }

  function makeNN() {
    const nodes = [{ x: 0.18, y: 0.3 }, { x: 0.18, y: 0.7 }, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.7 }, { x: 0.82, y: 0.5 }];
    const edges = [[0, 2], [0, 3], [1, 2], [1, 3], [2, 4], [3, 4]];
    let t = 0;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.55 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const phase = t % 2, forward = phase < 1, u = forward ? phase : phase - 1;
        edges.forEach(function (e, i) {
          const na = nodes[e[0]], nb = nodes[e[1]];
          ctx.beginPath(); ctx.moveTo(na.x * w, na.y * h); ctx.lineTo(nb.x * w, nb.y * h);
          const active = forward ? u * 6 > i : u * 6 > 5 - i;
          ctx.strokeStyle = active ? (forward ? p.model : p.sample) : hexAlpha(p.model, 0.45);
          ctx.lineWidth = active ? 1.8 : 1.15; ctx.stroke();
        });
        nodes.forEach(function (n, i) {
          ctx.beginPath(); ctx.arc(n.x * w, n.y * h, 8, 0, Math.PI * 2);
          ctx.fillStyle = p.surface; ctx.fill(); ctx.lineWidth = 1.6;
          ctx.strokeStyle = i === 4 && !forward ? p.sample : p.ink; ctx.stroke();
        });
        if (!forward) {
          ctx.beginPath(); ctx.strokeStyle = p.sample; ctx.lineWidth = 1.4;
          ctx.moveTo(0.78 * w, 0.72 * h);
          ctx.bezierCurveTo(0.58 * w, 0.9 * h, 0.32 * w, 0.9 * h, 0.16 * w, 0.72 * h);
          ctx.stroke();
        }
      },
    };
  }

  function makeNlin() {
    const xs = [0.08, 0.14, 0.2, 0.27, 0.34, 0.42, 0.5, 0.57, 0.64, 0.72, 0.8, 0.88, 0.94];
    const ys = [0.78, 0.72, 0.58, 0.64, 0.55, 0.52, 0.58, 0.48, 0.44, 0.46, 0.42, 0.34, 0.36];
    let t = 0;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.35 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const knots = 3 + Math.floor((Math.sin(t) * 0.5 + 0.5) * 2.99);
        ctx.fillStyle = hexAlpha(p.sample, 0.7);
        xs.forEach(function (x, i) { ctx.beginPath(); ctx.arc(x * w, ys[i] * h, 2.4, 0, Math.PI * 2); ctx.fill(); });
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const u = i / 40, x = 0.06 + u * 0.9;
          const y = 0.78 - 0.42 * Math.pow(u, 1.15) - 0.08 * Math.sin(u * Math.PI * (0.6 + knots * 0.2));
          if (i === 0) ctx.moveTo(x * w, y * h); else ctx.lineTo(x * w, y * h);
        }
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.7; ctx.stroke();
        ctx.lineWidth = 1.2;
        for (let k = 1; k <= knots; k++) {
          const x = (0.2 + (k / (knots + 1)) * 0.6) * w;
          ctx.beginPath(); ctx.moveTo(x, h - 12); ctx.lineTo(x, h - 6); ctx.stroke();
        }
      },
    };
  }

  function makeCorr() {
    let t = 0, rand = mulberry32(11), pts = [];
    function regen(r) {
      rand = mulberry32(11);
      pts = Array.from({ length: 28 }, function () {
        const z1 = randn(rand), z2 = randn(rand);
        return { x: z1, y: r * z1 + Math.sqrt(Math.max(0, 1 - r * r)) * z2 };
      });
    }
    regen(0.7);
    return {
      reset: function () { t = 0; regen(0.7); },
      tick: function (dt, intensity) { t += dt * 0.4 * intensity; regen(0.2 + 0.7 * (0.5 + 0.5 * Math.sin(t))); },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const r = 0.2 + 0.7 * (0.5 + 0.5 * Math.sin(t));
        ctx.fillStyle = hexAlpha(p.sample, 0.75);
        pts.forEach(function (pt) {
          ctx.beginPath(); ctx.arc(mapX(pt.x, w, -2.8, 2.8, 18), mapY(pt.y, h, -2.8, 2.8, 18), 2.3, 0, Math.PI * 2); ctx.fill();
        });
        ctx.beginPath();
        ctx.moveTo(mapX(-2.4, w, -2.8, 2.8, 18), mapY(-2.4 * r, h, -2.8, 2.8, 18));
        ctx.lineTo(mapX(2.4, w, -2.8, 2.8, 18), mapY(2.4 * r, h, -2.8, 2.8, 18));
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = p.muted; ctx.font = "11px IBM Plex Mono, ui-monospace, monospace";
        ctx.fillText("r = " + r.toFixed(2), 14, h - 10);
      },
    };
  }

  function makeContBin() {
    let t = 0;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.3 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const gap = 14 + 6 * Math.sin(t);
        const y0 = function (x, off) { return h * 0.72 - x * h * 0.38 + off; };
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(w * 0.1, y0(0, 0)); ctx.lineTo(w * 0.9, y0(1, 0)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * 0.1, y0(0, gap)); ctx.lineTo(w * 0.9, y0(1, gap)); ctx.stroke();
        const xs = [0.18, 0.36, 0.55, 0.74];
        ctx.fillStyle = p.sample;
        xs.forEach(function (u) { ctx.beginPath(); ctx.arc(u * w, y0((u - 0.1) / 0.8, -6), 2.4, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = p.sample; ctx.lineWidth = 1.2;
        xs.forEach(function (u) { ctx.beginPath(); ctx.arc(u * w, y0((u - 0.1) / 0.8, gap + 6), 2.6, 0, Math.PI * 2); ctx.stroke(); });
      },
    };
  }

  function makeDummy() {
    let t = 0;
    const rows = ["A", "B", "C"], cells = [[0, 0], [1, 0], [0, 1]];
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.7 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const hi = Math.floor(t) % 3;
        ctx.font = "12px IBM Plex Mono, ui-monospace, monospace"; ctx.textBaseline = "middle";
        rows.forEach(function (label, i) {
          const y = 22 + i * 22;
          ctx.fillStyle = p.muted; ctx.textAlign = "left"; ctx.fillText(label, 16, y);
          cells[i].forEach(function (v, j) {
            const x = 48 + j * 32, on = i === hi;
            ctx.strokeStyle = on ? p.sample : p.rule; ctx.lineWidth = on ? 1.4 : 1;
            ctx.strokeRect(x, y - 9, 26, 18);
            ctx.fillStyle = on ? p.sample : p.muted; ctx.textAlign = "center"; ctx.fillText(String(v), x + 13, y + 1);
          });
        });
      },
    };
  }

  function makeRand() {
    const digits = [[4, 7, 1, 9, 3], [2, 8, 6, 0, 5], [9, 1, 3, 7, 4]];
    const imb = [0, -1, 0, 1, 0, -1, -2, -1, 0, 1, 0, -1];
    let t = 0;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 1.1 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        ctx.font = "11px IBM Plex Mono, ui-monospace, monospace";
        ctx.fillStyle = hexAlpha(p.muted, 0.85); ctx.textBaseline = "top";
        digits.forEach(function (row, i) { ctx.fillText(row.join("  "), 14, 10 + i * 16); });
        const hi = Math.floor(t) % 5;
        ctx.strokeStyle = p.sample; ctx.lineWidth = 1.3; ctx.strokeRect(12 + hi * 18, 24, 14, 14);
        ctx.beginPath(); ctx.moveTo(14, h - 12); ctx.lineTo(w - 14, h - 12);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1; ctx.stroke();
        const n = Math.min(imb.length, 4 + Math.floor(t) % imb.length);
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = 14 + (i / (imb.length - 1)) * (w - 28), y = h - 12 - imb[i] * 7;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.5; ctx.stroke();
      },
    };
  }

  function makePower() {
    let t = 0;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.35 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(18, 14); ctx.lineTo(18, h - 18); ctx.lineTo(w - 12, h - 18); ctx.stroke();
        const y80 = 18 + (h - 36) * 0.22;
        ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(18, y80); ctx.lineTo(w - 12, y80);
        ctx.strokeStyle = hexAlpha(p.ink, 0.35); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = p.muted; ctx.font = "10px IBM Plex Mono, ui-monospace, monospace"; ctx.fillText("80%", 22, y80 - 4);
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const u = i / 40, pow = 1 - Math.exp(-3.4 * u * u);
          const x = 18 + u * (w - 30), y = h - 18 - pow * (h - 40);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.7; ctx.stroke();
        const n = 0.45 + 0.2 * Math.sin(t), x = 18 + n * (w - 30);
        ctx.beginPath(); ctx.moveTo(x, y80); ctx.lineTo(x, h - 18);
        ctx.strokeStyle = p.sample; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y80 + 4, 3, 0, Math.PI * 2); ctx.fillStyle = p.sample; ctx.fill();
        ctx.fillText("n", x - 4, h - 8);
      },
    };
  }

  function makeClt() {
    const bins = 21, nDraw = 12, mu = 1, sigma = Math.sqrt(1 / nDraw);
    const x0 = mu - 3.6 * sigma, x1 = mu + 3.6 * sigma, binW = (x1 - x0) / bins;
    const counts = new Array(bins).fill(0);
    let rand = mulberry32(99), n = 0, acc = 0;
    function add() {
      let s = 0; for (let i = 0; i < nDraw; i++) s += -Math.log(Math.max(1e-9, rand()));
      const m = s / nDraw, i = Math.floor(((m - x0) / (x1 - x0)) * bins);
      if (i >= 0 && i < bins) counts[i] += 1; n += 1;
    }
    return {
      reset: function () { rand = mulberry32(99); counts.fill(0); n = 0; acc = 0; for (let i = 0; i < 140; i++) add(); },
      tick: function (dt, intensity) { acc += dt * 14 * intensity; while (acc >= 1) { acc -= 1; add(); } },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const padL = 14, padR = 14, padB = 14, padT = 10, plotW = w - padL - padR, plotH = h - padT - padB;
        let maxDen = npdf(mu, mu, sigma);
        counts.forEach(function (c) { const d = c / Math.max(1, n) / binW; if (d > maxDen) maxDen = d; });
        const yScale = plotH / maxDen;
        const toX = function (x) { return padL + ((x - x0) / (x1 - x0)) * plotW; };
        const toY = function (den) { return padT + plotH - den * yScale; };
        counts.forEach(function (c, i) {
          const den = c / Math.max(1, n) / binW;
          ctx.fillStyle = hexAlpha(p.sample, 0.55);
          ctx.fillRect(padL + (i / bins) * plotW + 0.8, toY(den), plotW / bins - 1.6, den * yScale);
        });
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) {
          const x = x0 + (i / 48) * (x1 - x0);
          if (i === 0) ctx.moveTo(toX(x), toY(npdf(x, mu, sigma))); else ctx.lineTo(toX(x), toY(npdf(x, mu, sigma)));
        }
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padL, h - padB); ctx.lineTo(w - padR, h - padB);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1; ctx.stroke();
      },
    };
  }

  function makeGalton() {
    const rows = 7, nBins = rows + 1, bins = new Array(nBins).fill(0);
    let balls = [], acc = 0, rand = mulberry32(3);
    return {
      reset: function () {
        rand = mulberry32(3); bins.fill(0); balls = []; acc = 0;
        for (let i = 0; i < 18; i++) { let c = 0; for (let r = 0; r < rows; r++) c += rand() < 0.5 ? 0 : 1; bins[c] += 1; }
      },
      tick: function (dt, intensity) {
        acc += dt * 2.2 * intensity;
        while (acc >= 1) { acc -= 1; balls.push({ row: 0, col: 0, y: 0, done: false }); }
        balls.forEach(function (b) {
          if (b.done) return;
          b.y += dt * 3.2 * intensity;
          if (b.y >= 1) {
            b.y = 0; b.col += rand() < 0.5 ? 0 : 1; b.row += 1;
            if (b.row >= rows) { b.done = true; bins[b.col] += 1; }
          }
        });
        if (balls.length > 24) balls = balls.filter(function (b) { return !b.done; }).slice(-12);
      },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const top = 10, pinH = h * 0.52;
        ctx.fillStyle = hexAlpha(p.model, 0.65);
        for (let r = 0; r < rows; r++) {
          const n = r + 1;
          for (let c = 0; c < n; c++) {
            ctx.beginPath(); ctx.arc(w / 2 + (c - (n - 1) / 2) * 14, top + (r / (rows - 1)) * pinH, 1.8, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.fillStyle = p.sample;
        balls.forEach(function (b) {
          if (b.done) return;
          const n = b.row + 1;
          const x0 = w / 2 + (b.col - (n - 1) / 2) * 14;
          const x1 = w / 2 + (b.col + 0.5 - n / 2) * 14;
          ctx.beginPath();
          ctx.arc(x0 + (x1 - x0) * b.y, top + (b.row / (rows - 1)) * pinH + b.y * (pinH / (rows - 1)), 2.4, 0, Math.PI * 2);
          ctx.fill();
        });
        const max = Math.max(1, Math.max.apply(null, bins)), base = h - 12, bw = 12, start = w / 2 - (nBins * bw) / 2;
        bins.forEach(function (c, i) {
          ctx.fillStyle = hexAlpha(p.sample, 0.55);
          ctx.fillRect(start + i * bw + 1, base - (c / max) * (h * 0.22), bw - 2, (c / max) * (h * 0.22));
        });
        ctx.beginPath(); ctx.moveTo(start, base); ctx.lineTo(start + nBins * bw, base);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1; ctx.stroke();
      },
    };
  }

  function makeMonty() {
    let t = 0;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.45 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const phase = t % 4, dw = 28, dh = 50, gap = 12, total = 3 * dw + 2 * gap;
        const x0 = (w - total) / 2, y0 = (h - dh) / 2 - 4;
        [0, 1, 2].forEach(function (d) {
          const x = x0 + d * (dw + gap);
          ctx.strokeStyle = p.model; ctx.lineWidth = 1.3; ctx.strokeRect(x, y0, dw, dh);
          ctx.beginPath(); ctx.arc(x + dw - 6, y0 + dh / 2, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = hexAlpha(p.model, 0.6); ctx.fill();
          if (phase > 1 && d === 2) {
            ctx.strokeStyle = p.sample; ctx.lineWidth = 1.5; ctx.beginPath();
            ctx.moveTo(x + 8, y0 + 18); ctx.lineTo(x + dw - 8, y0 + 32);
            ctx.moveTo(x + dw - 8, y0 + 18); ctx.lineTo(x + 8, y0 + 32); ctx.stroke();
          }
          if (phase < 1.2 && d === 0) { ctx.strokeStyle = p.sample; ctx.strokeRect(x - 2, y0 - 2, dw + 4, dh + 4); }
          if (phase > 2.1 && d === 1) { ctx.strokeStyle = p.sample; ctx.strokeRect(x - 2, y0 - 2, dw + 4, dh + 4); }
        });
        if (phase > 2.1) {
          ctx.strokeStyle = p.sample; ctx.lineWidth = 1.4; ctx.beginPath();
          ctx.moveTo(x0 + 18, y0 - 10);
          ctx.bezierCurveTo(x0 + 40, y0 - 28, x0 + 90, y0 - 28, x0 + dw + gap + 14, y0 - 8);
          ctx.stroke();
        }
      },
    };
  }

  function makeHt() {
    let t = 0; const crit = 1.645;
    return {
      reset: function () { t = 0.8; },
      tick: function (dt, intensity) { t += dt * 0.35 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const delta = 0.55 + 1.35 * (0.5 + 0.5 * Math.sin(t));
        const x0 = -3.2, x1 = 5.2, padL = 12, padR = 12, padB = 16, padT = 10;
        const plotW = w - padL - padR, plotH = h - padT - padB, peak = npdf(0, 0, 1);
        const toX = function (x) { return padL + ((x - x0) / (x1 - x0)) * plotW; };
        const toY = function (den) { return padT + plotH - (den / peak) * plotH * 0.92; };
        ctx.beginPath(); ctx.moveTo(toX(crit), toY(0));
        for (let i = 0; i <= 64; i++) { const x = crit + ((x1 - crit) * i) / 64; ctx.lineTo(toX(x), toY(npdf(x, delta, 1))); }
        ctx.lineTo(toX(x1), toY(0)); ctx.closePath(); ctx.fillStyle = hexAlpha(p.sample, 0.28); ctx.fill();
        ctx.beginPath(); ctx.moveTo(toX(crit), toY(0));
        for (let i = 0; i <= 28; i++) { const x = crit + ((x1 - crit) * i) / 28; ctx.lineTo(toX(x), toY(npdf(x, 0, 1))); }
        ctx.lineTo(toX(x1), toY(0)); ctx.closePath(); ctx.fillStyle = hexAlpha(p.model, 0.16); ctx.fill();
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const x = x0 + ((x1 - x0) * i) / 64;
          if (i === 0) ctx.moveTo(toX(x), toY(npdf(x, 0, 1))); else ctx.lineTo(toX(x), toY(npdf(x, 0, 1)));
        }
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.7; ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const x = x0 + ((x1 - x0) * i) / 64;
          if (i === 0) ctx.moveTo(toX(x), toY(npdf(x, delta, 1))); else ctx.lineTo(toX(x), toY(npdf(x, delta, 1)));
        }
        ctx.strokeStyle = p.sample; ctx.lineWidth = 1.7; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(crit), padT + 4); ctx.lineTo(toX(crit), h - padB);
        ctx.strokeStyle = p.ink; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.moveTo(padL, h - padB); ctx.lineTo(w - padR, h - padB);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1; ctx.stroke();
      },
    };
  }

  function makeRoc() {
    let t = 0; const muH = 0, muD = 1.55, s = 1;
    return {
      reset: function () { t = 0; },
      tick: function (dt, intensity) { t += dt * 0.28 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const cutoff = -1.4 + 3.8 * (0.5 + 0.5 * Math.sin(t));
        const split = w * 0.58, pad = 10, x0 = -2.8, x1 = 4.2;
        const peak = Math.max(npdf(muH, muH, s), npdf(muD, muD, s));
        const denW = split - pad * 2, denH = h - pad * 2 - 8;
        const toX = function (x) { return pad + ((x - x0) / (x1 - x0)) * denW; };
        const toY = function (den) { return pad + denH - (den / peak) * denH * 0.9; };
        function dens(mu, fill, stroke) {
          ctx.beginPath(); ctx.moveTo(toX(x0), toY(0));
          for (let i = 0; i <= 40; i++) { const x = x0 + ((x1 - x0) * i) / 40; ctx.lineTo(toX(x), toY(npdf(x, mu, s))); }
          ctx.lineTo(toX(x1), toY(0)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
          ctx.strokeStyle = stroke; ctx.lineWidth = 1.4; ctx.stroke();
        }
        dens(muH, hexAlpha(p.model, 0.18), p.model);
        dens(muD, hexAlpha(p.sample, 0.18), p.sample);
        ctx.beginPath(); ctx.moveTo(toX(cutoff), pad); ctx.lineTo(toX(cutoff), pad + denH);
        ctx.strokeStyle = p.ink; ctx.lineWidth = 1.3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pad, pad + denH); ctx.lineTo(pad + denW, pad + denH);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1; ctx.stroke();
        const rocL = split + 6, rocS = Math.min(w - rocL - 10, h - 24), rocT = (h - rocS) / 2;
        ctx.strokeStyle = p.rule; ctx.strokeRect(rocL, rocT, rocS, rocS);
        ctx.beginPath(); ctx.moveTo(rocL, rocT + rocS); ctx.lineTo(rocL + rocS, rocT);
        ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) {
          const c = 4.5 - (i / 36) * 7.4, fpr = 1 - ncdf(c, muH, s), tpr = 1 - ncdf(c, muD, s);
          const X = rocL + fpr * rocS, Y = rocT + rocS - tpr * rocS;
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.strokeStyle = p.model; ctx.lineWidth = 1.7; ctx.stroke();
        const fpr = 1 - ncdf(cutoff, muH, s), tpr = 1 - ncdf(cutoff, muD, s);
        ctx.beginPath(); ctx.arc(rocL + fpr * rocS, rocT + rocS - tpr * rocS, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = p.sample; ctx.fill();
      },
    };
  }

  function makeKm() {
    const observations = [6, 6, 6, 7, 10, 13, 16, 22, 23,
      6, 9, 10, 11, 17, 19, 20, 25, 32, 32, 34, 35];
    const times = [...new Set(observations)].sort((a, b) => a - b);
    let survival = 1, t = 0;
    const steps = times.map((time) => {
      const risk = observations.filter((v) => v >= time).length;
      const events = observations.slice(0, 9).filter((v) => v === time).length;
      survival *= 1 - events / risk;
      return { time, survival, censored: observations.slice(9).includes(time) };
    });
    return {
      reset: function () { t = times.length; },
      tick: function (dt, intensity) { t += dt * 1.2 * intensity; },
      draw: function (ctx, p, w, h) {
        clear(ctx, p, w, h);
        const x = (v) => 24 + v / 35 * (w - 38);
        const y = (v) => 16 + (1 - v) * (h - 40);
        ctx.strokeStyle = p.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x(0), y(1)); ctx.lineTo(x(0), y(0)); ctx.lineTo(x(35), y(0)); ctx.stroke();
        const count = Math.min(steps.length, Math.floor(t % (steps.length + 5)) + 1);
        ctx.strokeStyle = p.model; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x(0), y(1));
        let previous = 1;
        steps.slice(0, count).forEach((step) => {
          ctx.lineTo(x(step.time), y(previous));
          ctx.lineTo(x(step.time), y(step.survival));
          previous = step.survival;
        });
        ctx.stroke();
        ctx.strokeStyle = p.sample; ctx.lineWidth = 1.5;
        steps.slice(0, count).filter((step) => step.censored).forEach((step) => {
          ctx.beginPath(); ctx.moveTo(x(step.time), y(step.survival) - 4);
          ctx.lineTo(x(step.time), y(step.survival) + 4); ctx.stroke();
        });
        ctx.fillStyle = p.muted; ctx.font = "11px IBM Plex Mono, ui-monospace, monospace";
        ctx.fillText("1", 10, y(1) + 4); ctx.fillText("0", 10, y(0) + 4);
        ctx.fillText("0", x(0) - 3, h - 8); ctx.fillText("35 weeks", Math.max(40, w - 72), h - 8);
      },
    };
  }

  const factories = {
    nn: makeNN, mcmc: makeMh("card"), nlin: makeNlin, corr: makeCorr, contbin: makeContBin,
    dummy: makeDummy, rand: makeRand, power: makePower, clt: makeClt, galton: makeGalton,
    monty: makeMonty, ht: makeHt, roc: makeRoc, km: makeKm,
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroStats = document.getElementById("hero-stats");

  function mount(canvas) {
    const id = canvas.getAttribute("data-sim");
    const kind = canvas.getAttribute("data-kind");
    const factory = id === "mcmc" ? makeMh(kind === "hero" ? "hero" : "card") : factories[id];
    if (!factory) return;
    const sim = factory();
    let raf = 0, last = performance.now(), visible = true, inited = false, statsTick = 0, hot = 1;
    const card = canvas.closest(".card");
    if (card) {
      card.addEventListener("mouseenter", function () { hot = 2.1; });
      card.addEventListener("mouseleave", function () { hot = 1; });
    }
    function paint(now) {
      const fit = fitCanvas(canvas);
      if (!fit.ctx || fit.width < 2 || fit.height < 2) { if (visible) raf = requestAnimationFrame(paint); else raf = 0; return; }
      if (!inited) { sim.reset(fit.width, fit.height); inited = true; }
      const pal = readPalette(canvas);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (visible && !window.previewsPaused && !document.hidden) sim.tick(dt, hot);
      sim.draw(fit.ctx, pal, fit.width, fit.height);
      statsTick += 1;
      if (heroStats && sim.stats && kind === "hero" && statsTick % 8 === 0) {
        heroStats.textContent = sim.stats().accepted + " accepted";
      }
      if (visible) raf = requestAnimationFrame(paint); else raf = 0;
    }
    function start() { if (raf) return; last = performance.now(); raf = requestAnimationFrame(paint); }
    const io = new IntersectionObserver(function (entries) {
      visible = entries.some(function (e) { return e.isIntersecting; });
      if (visible) start();
    }, { threshold: 0.08 });
    io.observe(canvas);
    start();
  }

  document.querySelectorAll("canvas[data-sim]").forEach(mount);
})();