(function () {
  const cursor = document.getElementById("cursor");
  const ring   = document.getElementById("cursor-ring");
  if (!cursor || !ring) return;

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  document.addEventListener("mousemove", e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + "px";
    cursor.style.top  = my + "px";
  });

  (function tick() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + "px";
    ring.style.top  = ry + "px";
    requestAnimationFrame(tick);
  })();

  const selectors = "button, input, a, [onclick], .class-chip, .qp, .abcde-row, .nav-pill";
  document.querySelectorAll(selectors).forEach(el => {
    el.addEventListener("mouseenter", () => {
      ring.style.transform   = "translate(-50%,-50%) scale(1.8)";
      ring.style.borderColor = "rgba(0,210,255,0.6)";
    });
    el.addEventListener("mouseleave", () => {
      ring.style.transform   = "translate(-50%,-50%) scale(1)";
      ring.style.borderColor = "rgba(0,210,255,0.4)";
    });
  });
})();