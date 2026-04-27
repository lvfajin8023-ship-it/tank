const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  stage: document.getElementById('stage'),
  gems: document.getElementById('gems'),
  life: document.getElementById('life'),
  overlay: document.getElementById('overlay'),
  startBtn: document.getElementById('startBtn')
};

const keys = new Set();
const stars = Array.from({ length: 120 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.8 + 0.3,
  v: Math.random() * 1.6 + 0.2
}));

const state = {
  running: false,
  score: 0,
  gems: 0,
  stage: 1,
  frame: 0,
  nextWaveFrame: 0,
  bombs: 2,
  player: null,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  particles: [],
  stageClearTextTimer: 0
};

function resetGame() {
  state.score = 0;
  state.gems = 0;
  state.stage = 1;
  state.frame = 0;
  state.nextWaveFrame = 0;
  state.bombs = 2;
  state.bullets = [];
  state.enemyBullets = [];
  state.enemies = [];
  state.particles = [];
  state.stageClearTextTimer = 120;

  state.player = {
    x: canvas.width / 2,
    y: canvas.height - 96,
    w: 26,
    h: 34,
    life: 3,
    speed: 4.6,
    fireCooldown: 0,
    fireLevel: 1,
    invincibleFrames: 0
  };

  syncHud();
}

function syncHud() {
  ui.score.textContent = state.score.toLocaleString();
  ui.stage.textContent = `${state.stage} / 30`;
  ui.gems.textContent = state.gems;
  ui.life.textContent = state.player.life;
}

function spawnWave() {
  const count = 4 + Math.min(8, Math.floor(state.stage / 2));
  const elite = state.stage % 5 === 0;

  for (let i = 0; i < count; i++) {
    state.enemies.push({
      x: 42 + i * ((canvas.width - 84) / count),
      y: -Math.random() * 220 - 35,
      w: elite ? 32 : 22,
      h: elite ? 36 : 24,
      hp: elite ? 8 + state.stage : 2 + Math.floor(state.stage / 3),
      speed: elite ? 1.2 : 1.5 + Math.random() * 0.9,
      fireRate: elite ? 70 : 140,
      fireCooldown: 40 + Math.random() * 80,
      elite
    });
  }

  state.nextWaveFrame = state.frame + 450;
}

function shootPlayer() {
  const p = state.player;
  if (p.fireCooldown > 0) return;

  p.fireCooldown = Math.max(6, 16 - p.fireLevel * 2);

  const spread = Math.min(4, p.fireLevel);
  for (let i = 0; i < spread; i++) {
    const offset = (i - (spread - 1) / 2) * 10;
    state.bullets.push({
      x: p.x + offset,
      y: p.y - 18,
      vx: offset * 0.03,
      vy: -8.5,
      r: 3.3,
      damage: 1
    });
  }
}

function launchBomb() {
  if (state.bombs <= 0) return;
  state.bombs -= 1;
  state.enemyBullets = [];

  for (const enemy of state.enemies) {
    enemy.hp -= 999;
  }

  for (let i = 0; i < 100; i++) {
    state.particles.push({
      x: state.player.x,
      y: state.player.y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 24 + Math.random() * 24,
      color: '#87d8ff'
    });
  }
}

function update() {
  if (!state.running) return;

  state.frame += 1;
  const p = state.player;

  if (p.fireCooldown > 0) p.fireCooldown -= 1;
  if (p.invincibleFrames > 0) p.invincibleFrames -= 1;

  let dx = 0;
  let dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;

  p.x = Math.max(30, Math.min(canvas.width - 30, p.x + dx * p.speed));
  p.y = Math.max(48, Math.min(canvas.height - 42, p.y + dy * p.speed));

  if (keys.has(' ') || keys.has('j')) shootPlayer();

  if (state.frame >= state.nextWaveFrame && state.enemies.length === 0) {
    if (state.stage < 30) {
      state.stage += 1;
      state.stageClearTextTimer = 100;
      spawnWave();
      syncHud();
    } else {
      gameOver(true);
      return;
    }
  }

  if (state.frame === 1) spawnWave();

  for (const s of stars) {
    s.y += s.v;
    if (s.y > canvas.height + 2) {
      s.y = -2;
      s.x = Math.random() * canvas.width;
    }
  }

  state.bullets = state.bullets.filter((b) => {
    b.x += b.vx;
    b.y += b.vy;
    return b.y > -10;
  });

  state.enemyBullets = state.enemyBullets.filter((b) => {
    b.x += b.vx;
    b.y += b.vy;
    return b.y < canvas.height + 16;
  });

  for (const enemy of state.enemies) {
    enemy.y += enemy.speed;
    enemy.fireCooldown -= 1;

    if (enemy.fireCooldown <= 0) {
      enemy.fireCooldown = enemy.fireRate;
      const tx = p.x - enemy.x;
      const ty = p.y - enemy.y;
      const len = Math.hypot(tx, ty) || 1;
      state.enemyBullets.push({
        x: enemy.x,
        y: enemy.y + enemy.h / 2,
        vx: (tx / len) * 2.2,
        vy: (ty / len) * 2.2,
        r: enemy.elite ? 5 : 4,
        damage: enemy.elite ? 2 : 1
      });
    }
  }

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (hitCircleRect(bullet.x, bullet.y, bullet.r, enemy)) {
        bullet.y = -99;
        enemy.hp -= bullet.damage;
        if (enemy.hp <= 0) {
          state.score += enemy.elite ? 850 : 120;
          if (enemy.elite) {
            state.gems += 8;
            p.fireLevel = Math.min(5, p.fireLevel + 1);
          }
          explode(enemy.x, enemy.y, enemy.elite ? 36 : 18, enemy.elite ? '#ffc66b' : '#ff8f62');
        }
      }
    }
  }

  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0 && enemy.y < canvas.height + 60);

  if (p.invincibleFrames === 0) {
    for (const eb of state.enemyBullets) {
      if (Math.hypot(eb.x - p.x, eb.y - p.y) < eb.r + p.w * 0.35) {
        hurtPlayer();
        break;
      }
    }

    for (const enemy of state.enemies) {
      if (
        Math.abs(enemy.x - p.x) < (enemy.w + p.w) * 0.45 &&
        Math.abs(enemy.y - p.y) < (enemy.h + p.h) * 0.45
      ) {
        enemy.hp = -1;
        hurtPlayer();
      }
    }
  }

  state.particles = state.particles.filter((item) => {
    item.x += item.vx;
    item.y += item.vy;
    item.vx *= 0.98;
    item.vy *= 0.98;
    item.life -= 1;
    return item.life > 0;
  });

  if (state.stageClearTextTimer > 0) state.stageClearTextTimer -= 1;

  syncHud();
}

function hurtPlayer() {
  const p = state.player;
  p.life -= 1;
  p.invincibleFrames = 120;
  explode(p.x, p.y, 28, '#59c9ff');
  if (p.life <= 0) gameOver(false);
}

function explode(x, y, power, color) {
  for (let i = 0; i < power; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * (Math.random() * 6),
      vy: (Math.random() - 0.5) * (Math.random() * 6),
      life: 20 + Math.random() * 20,
      color
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#071735');
  g.addColorStop(0.45, '#0b2650');
  g.addColorStop(1, '#050a1b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const s of stars) {
    ctx.fillStyle = `rgba(160,220,255,${0.2 + s.r / 2.4})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShip(state.player.x, state.player.y, '#8ed9ff', state.player.invincibleFrames > 0);

  for (const enemy of state.enemies) {
    drawShip(enemy.x, enemy.y, enemy.elite ? '#d08dff' : '#ff865f', false, enemy.elite ? 1.2 : 0.95);
  }

  for (const b of state.bullets) {
    ctx.fillStyle = '#7fd5ff';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of state.enemyBullets) {
    ctx.fillStyle = '#ff9e62';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r, b.r * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const item of state.particles) {
    ctx.fillStyle = item.color;
    ctx.globalAlpha = Math.max(0, item.life / 40);
    ctx.fillRect(item.x, item.y, 3, 3);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#9fcdff';
  ctx.font = 'bold 16px Segoe UI';
  ctx.fillText(`炸弹 ${state.bombs}`, 16, canvas.height - 16);

  if (state.stageClearTextTimer > 0) {
    ctx.fillStyle = 'rgba(215,238,255,0.9)';
    ctx.font = 'bold 30px Segoe UI';
    ctx.fillText(`第 ${state.stage} 关`, canvas.width / 2 - 58, canvas.height / 2 - 8);
  }
}

function drawShip(x, y, color, blink, scale = 1) {
  if (blink && Math.floor(state.frame / 5) % 2 === 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-15, 14);
  ctx.lineTo(-5, 8);
  ctx.lineTo(0, 18);
  ctx.lineTo(5, 8);
  ctx.lineTo(15, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#113354';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(-6, 8);
  ctx.lineTo(0, 5);
  ctx.lineTo(6, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function hitCircleRect(cx, cy, r, rect) {
  const rx = rect.x - rect.w / 2;
  const ry = rect.y - rect.h / 2;
  const nearestX = Math.max(rx, Math.min(cx, rx + rect.w));
  const nearestY = Math.max(ry, Math.min(cy, ry + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < r * r;
}

function gameOver(win) {
  state.running = false;
  ui.overlay.classList.remove('hidden');
  ui.overlay.querySelector('h1').textContent = win ? '任务完成' : '战机坠毁';
  ui.overlay.querySelector('p').textContent = win
    ? `你通关了 30 关，总分 ${state.score.toLocaleString()}。点击再次出击。`
    : `最终得分 ${state.score.toLocaleString()}，再来一次提升火力。`;
  ui.startBtn.textContent = '重新开始';
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

ui.startBtn.addEventListener('click', () => {
  resetGame();
  state.running = true;
  ui.overlay.classList.add('hidden');
  ui.startBtn.textContent = '开始作战';
});

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'j', 'k', 'a', 's', 'd', 'w'].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key);
  if ((e.key === 'k' || e.key === 'K') && state.running) {
    launchBomb();
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.key));

resetGame();
draw();
requestAnimationFrame(gameLoop);
