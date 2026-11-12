(function () {
  var canvas = document.getElementById("stage");
  var scoreEl = document.getElementById("score");
  var ctx = canvas.getContext("2d");
  var W = canvas.width;
  var H = canvas.height;

  var GRAVITY = 0.38;
  var FLAP = -6.4;
  var GAP = 128;
  var PIPE_W = 56;
  var PIPE_SPEED = 2.6;

  var bird = { x: 96, y: H * 0.45, vy: 0, r: 16, tilt: 0 };
  var pipes = [];
  var score = 0;
  var running = true;
  var spawnX = W + 40;

  function resetGame() {
    bird.y = H * 0.45;
    bird.vy = 0;
    bird.tilt = 0;
    pipes.length = 0;
    score = 0;
    running = true;
    spawnX = W + 80;
    scoreEl.textContent = "0";
    canvas.focus();
    placePipe(spawnX);
    spawnX += 200;
  }

  function placePipe(x) {
    var margin = 64;
    var minTop = margin;
    var maxTop = H - margin - GAP;
    var topH = minTop + Math.random() * (maxTop - minTop);
    pipes.push({ x: x, top: topH, scored: false });
  }

  function flap() {
    if (!running) {
      resetGame();
      return;
    }
    bird.vy = FLAP;
  }

  function birdBounds() {
    return {
      left: bird.x - bird.r * 0.7,
      right: bird.x + bird.r * 0.85,
      top: bird.y - bird.r * 0.5,
      bottom: bird.y + bird.r * 0.55
    };
  }

  function hitPipe(p) {
    var b = birdBounds();
    var px = p.x;
    var pr = px + PIPE_W;
    if (b.right < px || b.left > pr) return false;
    if (b.top < p.top) return true;
    var bottomY = p.top + GAP;
    if (b.bottom > bottomY) return true;
    return false;
  }

  function update() {
    if (!running) return;

    bird.vy += GRAVITY;
    bird.y += bird.vy;
    bird.tilt = Math.max(-0.5, Math.min(0.9, bird.vy * 0.08));

    if (bird.y - bird.r < 0 || bird.y + bird.r > H) {
      running = false;
      return;
    }

    var lead = pipes[pipes.length - 1];
    if (!lead || lead.x < W - 180) {
      placePipe(spawnX);
      spawnX += 200 + Math.random() * 60;
    }

    for (var i = pipes.length - 1; i >= 0; i--) {
      var p = pipes[i];
      p.x -= PIPE_SPEED;
      if (!p.scored && p.x + PIPE_W < bird.x) {
        p.scored = true;
        score += 1;
        scoreEl.textContent = String(score);
      }
      if (hitPipe(p)) {
        running = false;
        return;
      }
      if (p.x + PIPE_W < -20) pipes.splice(i, 1);
    }
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#9ec9e8");
    g.addColorStop(1, "#d4ebe8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.ellipse(W * 0.75, 70, 48, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W * 0.68, 78, 36, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPipe(p) {
    ctx.fillStyle = "#4a7c59";
    ctx.strokeStyle = "#2d4f3a";
    ctx.lineWidth = 2;
    var cap = 14;
    ctx.fillRect(p.x, 0, PIPE_W, p.top - cap);
    ctx.strokeRect(p.x, 0, PIPE_W, p.top - cap);
    ctx.fillRect(p.x - 4, p.top - cap, PIPE_W + 8, cap);
    ctx.strokeRect(p.x - 4, p.top - cap, PIPE_W + 8, cap);
    var bottomY = p.top + GAP;
    ctx.fillRect(p.x, bottomY + cap, PIPE_W, H - bottomY - cap);
    ctx.strokeRect(p.x, bottomY + cap, PIPE_W, H - bottomY - cap);
    ctx.fillRect(p.x - 4, bottomY, PIPE_W + 8, cap);
    ctx.strokeRect(p.x - 4, bottomY, PIPE_W + 8, cap);
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.tilt);
    ctx.fillStyle = "#f2efe6";
    ctx.strokeStyle = "#8a8070";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-bird.r, 0);
    ctx.lineTo(bird.r * 0.6, -bird.r * 0.45);
    ctx.lineTo(bird.r * 0.9, 0);
    ctx.lineTo(bird.r * 0.6, bird.r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8a030";
    ctx.beginPath();
    ctx.moveTo(bird.r * 0.75, -2);
    ctx.lineTo(bird.r * 1.15, 2);
    ctx.lineTo(bird.r * 0.75, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#404850";
    ctx.beginPath();
    ctx.arc(bird.r * 0.15, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawOverlay() {
    ctx.fillStyle = "rgba(42, 58, 72, 0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Crashed", W / 2, H / 2 - 20);
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText("Score: " + score, W / 2, H / 2 + 8);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("Click or Space to try again", W / 2, H / 2 + 36);
    ctx.textAlign = "left";
  }

  function frame() {
    update();
    drawSky();
    for (var i = 0; i < pipes.length; i++) drawPipe(pipes[i]);
    drawBird();
    if (!running) drawOverlay();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", function (ev) {
    ev.preventDefault();
    flap();
  });

  window.addEventListener("keydown", function (ev) {
    if (ev.code === "Space") {
      ev.preventDefault();
      flap();
    }
  });

  resetGame();
  frame();
})();
