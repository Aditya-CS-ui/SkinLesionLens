(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, pts = [];
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.s = Math.random() * 1.4 + 0.2;
    this.baseVx = (Math.random() - 0.5) * 0.3;
    this.baseVy = (Math.random() - 0.5) * 0.3;
    this.vx = this.baseVx;
    this.vy = this.baseVy;
    this.a = Math.random() * 0.35 + 0.05;
    this.c = Math.random() > 0.6 ? "rgba(59,158,255," : "rgba(86,207,250,";
  }

  function init() {
    resize();
    pts = [];
    for (let i = 0; i < 80; i++) pts.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const grd = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 280);
    grd.addColorStop(0, "rgba(59,158,255,0.045)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    pts.forEach(p => {
      const dx = mouseX - p.x, dy = mouseY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = Math.max(0, (200 - dist) / 200);
      p.vx = p.baseVx + (dist > 0 ? force * (dx / dist) * 0.7 : 0);
      p.vy = p.baseVy + (dist > 0 ? force * (dy / dist) * 0.7 : 0);
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.baseVx *= -1;
      if (p.y < 0 || p.y > H) p.baseVy *= -1;
    });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(59,158,255,${(1 - d / 120) * 0.08})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.stroke();
        }
      }
    }
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fillStyle = p.c + p.a + ")";
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("mousemove", e => { mouseX = e.clientX; mouseY = e.clientY; });

  init();
  draw();
})();