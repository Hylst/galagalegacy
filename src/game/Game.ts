export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover' | 'bonus-summary';

interface Vec2 {
  x: number;
  y: number;
}

interface Ship {
  x: number;
  y: number;
  offsetX: number;
  targetX?: number;
}

interface Player {
  ships: Ship[];
  speed: number;
  shootCooldown: number;
  currentCooldown: number;
  invulnerable: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isEnemy: boolean;
}

interface Enemy {
  id: number;
  type: 0 | 1 | 2 | 3;
  col: number;
  row: number;
  x: number;
  y: number;
  state: 'formation' | 'diving' | 'capturing' | 'returning' | 'bonus-entry' | 'bonus-leave';
  pathT: number;
  pathType: number;
  startPos: Vec2;
  controlPos: Vec2;
  endPos: Vec2;
  capturedShip: boolean;
  health: number;
  maxHealth: number;
  shootTimer: number;
  isAttacker: boolean;
  angle: number;
  wingPhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  brightness: number;
  color: string;
}

interface TractorBeam {
  x: number;
  y: number;
  width: number;
  height: number;
  life: number;
  maxLife: number;
  enemyId: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

interface PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'rapid' | 'shield' | 'dual';
  life: number;
  maxLife: number;
}

export interface GamePublicState {
  status: GameStatus;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  isBonusStage: boolean;
  enemiesRemaining: number;
  message: string;
  messageTimer: number;
  isFullscreen: boolean;
}

const WIDTH = 600;
const HEIGHT = 800;

const COLORS = {
  player: '#00f0ff',
  playerGlow: '#00f0ff',
  bulletPlayer: '#fff7a3',
  bulletEnemy: '#ff4d6d',
  enemy0: '#ffd93d',
  enemy1: '#6eff89',
  enemy2: '#ff2a6d',
  enemy3: '#bc13fe',
  star: '#ffffff',
  neonPink: '#ff00ff',
  neonCyan: '#00ffff',
};

const ENEMY_POINTS = {
  0: 50,
  1: 80,
  2: 150,
  3: 250,
};

// Procedural chiptune music patterns
const MUSIC_NOTES: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5,
};

const BASSLINE = ['C3', 'C3', 'G3', 'G3', 'A3', 'A3', 'F3', 'F3'];
const MELODY = ['E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4', 'G4', 'A4', 'C5', 'A4', 'G4', 'E4', 'D4', 'C4', 'E4'];
const ARP = ['C5', 'E5', 'G5', 'C6', 'G5', 'E5', 'C5', 'G4'];

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private status: GameStatus = 'menu';
  private score = 0;
  private highScore = 0;
  private lives = 3;
  private level = 1;
  private isBonusStage = false;
  private bonusSummaryTimer = 0;

  private player: Player;
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];
  private beams: TractorBeam[] = [];
  private floatingTexts: FloatingText[] = [];
  private powerUps: PowerUp[] = [];

  private keys: Set<string> = new Set();
  private animationId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private readonly dt = 1000 / 60;

  private formationOffset = 0;
  private formationDirection = 1;
  private formationSpeed = 0.4;
  private formationDrop = 0;
  private attackTimer = 0;
  private attackInterval = 150;
  private bonusTimer = 0;
  private bonusSpawnTimer = 0;
  private message = '';
  private messageTimer = 0;
  private screenShake = 0;
  private rapidFireTimer = 0;
  private shieldTimer = 0;
  private musicTimer = 0;
  private musicBeat = 0;
  private comboCount = 0;
  private comboTimer = 0;

  private onStateChange: (state: GamePublicState) => void;
  private audioCtx: AudioContext | null = null;
  private soundsEnabled = true;
  private musicEnabled = true;
  private masterGain: GainNode | null = null;

  constructor(canvas: HTMLCanvasElement, onStateChange: (state: GamePublicState) => void) {
    this.canvas = canvas;
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
    this.onStateChange = onStateChange;

    this.player = {
      ships: [],
      speed: 7,
      shootCooldown: 10,
      currentCooldown: 0,
      invulnerable: 0,
    };

    this.bindInput();
    this.initStars();
    this.updatePublicState();
  }

  private updatePublicState() {
    this.onStateChange({
      status: this.status,
      score: this.score,
      highScore: Math.max(this.score, this.highScore),
      lives: this.lives,
      level: this.level,
      isBonusStage: this.isBonusStage,
      enemiesRemaining: this.enemies.filter((e) => e.state === 'formation').length,
      message: this.message,
      messageTimer: this.messageTimer,
      isFullscreen: !!document.fullscreenElement,
    });
  }

  private bindInput() {
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);

    this.canvas.addEventListener('touchstart', this.handleTouch, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouch, { passive: false });
    this.canvas.addEventListener('touchend', this.touchEndHandler);

    document.addEventListener('fullscreenchange', () => this.updatePublicState());
  }

  private keyDownHandler = (e: KeyboardEvent) => {
    this.keys.add(e.key);
    if (e.key === 'Enter' && (this.status === 'menu' || this.status === 'gameover')) {
      this.start();
    }
    if (e.key === 'p' || e.key === 'P') {
      if (this.status === 'playing') this.status = 'paused';
      else if (this.status === 'paused') this.status = 'playing';
      this.updatePublicState();
    }
    if (e.key === 'm' || e.key === 'M') {
      this.toggleMusic();
    }
  };

  private keyUpHandler = (e: KeyboardEvent) => {
    this.keys.delete(e.key);
  };

  private touchEndHandler = () => {
    this.keys.delete(' ');
    this.player.ships.forEach((ship) => (ship.targetX = undefined));
  };

  private handleTouch = (e: TouchEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;
    const scaleX = WIDTH / rect.width;
    const centerX = (touch.clientX - rect.left) * scaleX;
    this.player.ships.forEach((s) => (s.targetX = centerX));
    this.keys.add(' ');
  };

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.canvas.parentElement?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.audioCtx?.currentTime || 0, 0.1);
    } else if (this.musicEnabled && this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(0.25, this.audioCtx.currentTime, 0.1);
    }
  }

  private initAudio() {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.25;
      this.masterGain.connect(this.audioCtx.destination);
    } catch {
      this.soundsEnabled = false;
    }
  }

  private initStars() {
    this.stars = [];
    const colors = ['#ffffff', '#00ffff', '#ff00ff', '#ffff00', '#88ccff'];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        z: Math.random() * 2 + 0.5,
        speed: 0.3 + Math.random() * 2.5,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  start() {
    this.initAudio();
    this.audioCtx?.resume?.();

    // Reset permanent run state when restarting from menu/gameover
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.highScore = Math.max(this.highScore, this.score);
    this.comboCount = 0;
    this.comboTimer = 0;
    this.startLevel(1);
  }

  private startLevel(level: number) {
    this.level = level;
    this.isBonusStage = level % 3 === 0;
    this.bullets = [];
    this.beams = [];
    this.particles = [];
    this.floatingTexts = [];
    this.powerUps = [];
    this.attackTimer = 0;
    this.bonusTimer = 0;
    this.bonusSpawnTimer = 0;
    this.rapidFireTimer = 0;
    this.shieldTimer = 0;
    this.screenShake = 0;

    const savedShips = this.player?.ships?.length || 1;

    this.player = {
      ships: [{ x: WIDTH / 2, y: HEIGHT - 70, offsetX: 0 }],
      speed: 7 + Math.min(level * 0.3, 3),
      shootCooldown: this.isBonusStage ? 5 : Math.max(5, 11 - level * 0.5),
      currentCooldown: 0,
      invulnerable: 180,
    };

    if (savedShips >= 2) {
      this.player.ships[0].offsetX = -24;
      this.player.ships.push({ x: WIDTH / 2, y: HEIGHT - 70, offsetX: 24 });
    }

    if (this.isBonusStage) {
      this.enemies = [];
      this.status = 'playing';
      this.message = `BONUS ${level}`;
      this.messageTimer = 180;
      this.playJingle('bonus');
    } else {
      this.spawnFormation();
      this.status = 'playing';
      this.message = `NIVEAU ${level}`;
      this.messageTimer = 180;
      this.playJingle('start');
    }

    this.updatePublicState();
  }

  private spawnFormation() {
    this.enemies = [];
    const cols = 8;
    const rows = Math.min(5 + Math.floor(this.level / 3), 8);
    const startX = (WIDTH - (cols - 1) * 52) / 2;
    const startY = 70;
    let id = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let type: 0 | 1 | 2 | 3 = 0;
        if (row === 0 && this.level > 2) type = 3;
        else if (row === 0 || row === 1) type = 2;
        else if (row === 2 || row === 3) type = 1;

        const health = type === 3 ? 3 : type === 2 ? 2 : 1;

        this.enemies.push({
          id: id++,
          type,
          col,
          row,
          x: startX + col * 52,
          y: startY + row * 44,
          state: 'formation',
          pathT: 0,
          pathType: 0,
          startPos: { x: 0, y: 0 },
          controlPos: { x: 0, y: 0 },
          endPos: { x: 0, y: 0 },
          capturedShip: false,
          health,
          maxHealth: health,
          shootTimer: Math.random() * 200,
          isAttacker: false,
          angle: 0,
          wingPhase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private spawnBonusEnemy() {
    const side = Math.random() > 0.5 ? -40 : WIDTH + 40;
    const y = 80 + Math.random() * 250;
    const type: 0 | 1 | 2 | 3 = this.level > 4 && Math.random() > 0.8 ? 3 : Math.random() > 0.7 ? 2 : Math.random() > 0.5 ? 1 : 0;

    const enemy: Enemy = {
      id: Date.now() + Math.random(),
      type,
      col: -1,
      row: -1,
      x: side,
      y,
      state: 'bonus-entry',
      pathT: 0,
      pathType: 0,
      startPos: { x: side, y },
      controlPos: { x: WIDTH / 2 + (Math.random() - 0.5) * 100, y: 250 + Math.random() * 200 },
      endPos: { x: side > WIDTH / 2 ? WIDTH + 60 : -60, y: y + 100 },
      capturedShip: false,
      health: 1 + Math.floor(this.level / 5),
      maxHealth: 1,
      shootTimer: 9999,
      isAttacker: false,
      angle: 0,
      wingPhase: 0,
    };
    this.enemies.push(enemy);
  }

  private nextLevel() {
    this.level++;
    this.startLevel(this.level);
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    this.canvas.removeEventListener('touchstart', this.handleTouch);
    this.canvas.removeEventListener('touchmove', this.handleTouch);
    this.canvas.removeEventListener('touchend', this.touchEndHandler);
    document.removeEventListener('fullscreenchange', () => this.updatePublicState());
  }

  run() {
    this.lastTime = performance.now();
    const loop = (time: number) => {
      const frameTime = time - this.lastTime;
      this.lastTime = time;
      this.accumulator += Math.min(frameTime, 50);

      while (this.accumulator >= this.dt) {
        this.update();
        this.accumulator -= this.dt;
      }

      this.draw();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private update() {
    if (this.status === 'paused') {
      this.updateStars(0.3);
      this.updateMusic();
      return;
    }

    if (this.status === 'menu' || this.status === 'gameover') {
      this.updateStars(0.5);
      this.updateMusic();
      return;
    }

    if (this.status === 'bonus-summary') {
      this.bonusSummaryTimer--;
      this.updateStars();
      this.updateMusic();
      if (this.bonusSummaryTimer <= 0) {
        this.nextLevel();
      }
      return;
    }

    this.updateStars();
    this.updatePlayer();
    this.updateBullets();
    this.updateEnemies();
    this.checkEnemyPlayerCollisions();
    this.updateBeams();
    this.updatePowerUps();
    this.updateParticles();
    this.updateFloatingTexts();

    if (this.messageTimer > 0) this.messageTimer--;
    if (this.screenShake > 0) this.screenShake *= 0.9;
    if (this.screenShake < 0.5) this.screenShake = 0;
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
    if (this.rapidFireTimer > 0) {
      this.rapidFireTimer--;
      if (this.rapidFireTimer <= 0) this.player.shootCooldown = Math.max(6, 12 - this.level * 0.5);
    }
    if (this.shieldTimer > 0) this.shieldTimer--;

    if (this.isBonusStage) {
      this.updateBonusStage();
    } else {
      this.updateFormation();
      this.updateAttacks();
      this.checkLevelComplete();
    }

    this.updateMusic();

    if (this.lives < 0) {
      this.status = 'gameover';
      this.message = 'GAME OVER';
      this.messageTimer = 300;
      this.highScore = Math.max(this.highScore, this.score);
      this.playTone(110, 'sawtooth', 0.3, 0.6);
      this.updatePublicState();
    }
  }

  private updateStars(speedMultiplier = 1) {
    for (const star of this.stars) {
      const warp = this.isBonusStage ? 4 : 1;
      star.y += star.speed * warp * speedMultiplier;
      if (star.y > HEIGHT) {
        star.y = 0;
        star.x = Math.random() * WIDTH;
      }
      star.brightness = 0.4 + Math.sin(performance.now() * 0.004 + star.x) * 0.4;

      // Twinkle
      if (Math.random() > 0.995) {
        star.brightness = Math.random();
      }
    }
  }

  private updatePlayer() {
    if (this.player.invulnerable > 0) this.player.invulnerable--;
    if (this.player.currentCooldown > 0) this.player.currentCooldown--;

    const left = this.keys.has('ArrowLeft') || this.keys.has('a') || this.keys.has('A') || this.keys.has('q') || this.keys.has('Q');
    const right = this.keys.has('ArrowRight') || this.keys.has('d') || this.keys.has('D');
    const shoot = this.keys.has(' ') || this.keys.has('ArrowUp') || this.keys.has('w') || this.keys.has('W') || this.keys.has('z') || this.keys.has('Z');

    let move = 0;
    if (left) move -= 1;
    if (right) move += 1;

    if (move !== 0) {
      this.player.ships.forEach((ship) => (ship.targetX = undefined));
    }

    this.player.ships.forEach((ship) => {
      if (ship.targetX !== undefined) {
        const targetCenter = ship.targetX;
        const currentCenter = ship.x - ship.offsetX;
        const dx = targetCenter - currentCenter;
        ship.x += Math.sign(dx) * Math.min(Math.abs(dx), this.player.speed);
      } else {
        ship.x += move * this.player.speed;
      }

      const center = Math.max(20, Math.min(WIDTH - 20, ship.x - ship.offsetX));
      ship.x = center + ship.offsetX;
    });

    if (shoot && this.player.currentCooldown <= 0) {
      this.shoot();
      this.player.currentCooldown = this.rapidFireTimer > 0 ? Math.max(3, this.player.shootCooldown - 4) : this.player.shootCooldown;
    }
  }

  private shoot() {
    const spread = this.player.ships.length === 2 ? 1 : 0;
    this.player.ships.forEach((ship, index) => {
      const angle = spread === 0 ? 0 : (index === 0 ? -0.08 : 0.08);
      const speed = 12;
      this.bullets.push({
        x: ship.x + ship.offsetX,
        y: ship.y - 15,
        vx: Math.sin(angle) * speed,
        vy: -Math.cos(angle) * speed,
        radius: 3,
        color: COLORS.bulletPlayer,
        isEnemy: false,
      });
    });
    this.playTone(880 + Math.random() * 100, 'square', 0.03, 0.08);
  }

  private updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;

      if (b.y < -20 || b.y > HEIGHT + 20 || b.x < -20 || b.x > WIDTH + 20) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (!b.isEnemy) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (this.collides(b, e)) {
            this.hitEnemy(e, j);
            this.bullets.splice(i, 1);
            break;
          }
        }
      } else {
        for (let j = this.player.ships.length - 1; j >= 0; j--) {
          const ship = this.player.ships[j];
          if (this.player.invulnerable <= 0 && this.shieldTimer <= 0 && this.collidesWithShip(b, ship)) {
            this.hitPlayer(j);
            this.bullets.splice(i, 1);
            break;
          } else if (this.shieldTimer > 0 && this.collidesWithShip(b, ship)) {
            this.spawnParticles(b.x, b.y, '#00f0ff', 5);
            this.bullets.splice(i, 1);
            this.playTone(600, 'sine', 0.03, 0.08);
            break;
          }
        }
      }
    }
  }

  private collides(b: Bullet, e: Enemy): boolean {
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 18 + b.radius;
  }

  private collidesWithShip(b: Bullet, s: Ship): boolean {
    const dx = b.x - s.x;
    const dy = b.y - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < 16 + b.radius;
  }

  private hitEnemy(enemy: Enemy, index: number) {
    enemy.health--;
    if (enemy.health > 0) {
      this.spawnParticles(enemy.x, enemy.y, this.getEnemyColor(enemy.type), 8);
      this.playTone(250 + enemy.type * 80, 'square', 0.03, 0.05);
      return;
    }

    // Combo system
    this.comboCount++;
    this.comboTimer = 90;
    const comboMultiplier = Math.min(4, 1 + Math.floor(this.comboCount / 4) * 0.5);
    const basePoints = this.isBonusStage ? ENEMY_POINTS[enemy.type] * 2 : ENEMY_POINTS[enemy.type];
    const points = Math.floor(basePoints * comboMultiplier);
    this.score += points;
    this.highScore = Math.max(this.highScore, this.score);
    this.spawnParticles(enemy.x, enemy.y, this.getEnemyColor(enemy.type), 22);
    this.spawnShockwave(enemy.x, enemy.y, this.getEnemyColor(enemy.type));
    if (comboMultiplier > 1) {
      this.addFloatingText(enemy.x, enemy.y - 16, `x${comboMultiplier.toFixed(1)}`, '#ffee00');
    }
    this.addFloatingText(enemy.x, enemy.y, points.toString(), '#fff');
    this.screenShake = 6;
    this.playTone(120 + enemy.type * 80, 'sawtooth', 0.08, 0.2);
    this.playExplosion(enemy.type);

    if (enemy.capturedShip) {
      this.restoreDualShip();
    }

    if (Math.random() < 0.08) {
      this.spawnPowerUp(enemy.x, enemy.y);
    }

    this.enemies.splice(index, 1);
    this.updatePublicState();
  }

  private restoreDualShip() {
    if (this.player.ships.length >= 2) return;
    if (this.player.ships.length === 1) {
      this.player.ships[0].offsetX = -24;
    }
    this.player.ships.push({
      x: this.player.ships[0]?.x ?? WIDTH / 2,
      y: HEIGHT - 70,
      offsetX: 24,
    });
    this.addFloatingText(WIDTH / 2, HEIGHT - 100, 'VAISSEAU DOUBLE !', '#00f0ff');
    this.playJingle('powerup');
  }

  private spawnPowerUp(x: number, y: number) {
    const types: PowerUp['type'][] = ['rapid', 'shield', 'dual'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: 1.5,
      type,
      life: 600,
      maxLife: 600,
    });
  }

  private updatePowerUps() {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0 || p.y > HEIGHT + 30) {
        this.powerUps.splice(i, 1);
        continue;
      }

      for (const ship of this.player.ships) {
        const dx = p.x - ship.x;
        const dy = p.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 28) {
          this.applyPowerUp(p.type);
          this.powerUps.splice(i, 1);
          break;
        }
      }
    }
  }

  private applyPowerUp(type: PowerUp['type']) {
    if (type === 'rapid') {
      this.rapidFireTimer = 600;
      this.player.shootCooldown = Math.max(3, this.player.shootCooldown - 5);
      this.addFloatingText(WIDTH / 2, HEIGHT - 120, 'TIR RAPIDE !', '#ffd93d');
    } else if (type === 'shield') {
      this.shieldTimer = 600;
      this.addFloatingText(WIDTH / 2, HEIGHT - 120, 'BOUCLIER !', '#00f0ff');
    } else if (type === 'dual') {
      this.restoreDualShip();
    }
    this.playJingle('powerup');
  }

  private hitPlayer(shipIndex: number) {
    if (this.player.invulnerable > 0 || this.shieldTimer > 0) return;

    const ship = this.player.ships[shipIndex];
    this.spawnParticles(ship.x, ship.y, COLORS.player, 30);
    this.screenShake = 12;
    this.playTone(80, 'sawtooth', 0.3, 0.5);
    this.player.ships.splice(shipIndex, 1);

    if (this.player.ships.length === 1) {
      this.player.ships[0].offsetX = 0;
    }

    this.comboCount = 0;
    this.comboTimer = 0;

    if (this.player.ships.length === 0) {
      this.lives--;
      if (this.lives >= 0) {
        this.player.ships = [{ x: WIDTH / 2, y: HEIGHT - 70, offsetX: 0 }];
        this.player.invulnerable = 180;
        this.bullets = this.bullets.filter((b) => b.isEnemy);
        this.shieldTimer = 120;
      }
    }

    this.updatePublicState();
  }

  private updateEnemies() {
    for (const enemy of this.enemies) {
      enemy.wingPhase += 0.15 + (enemy.state !== 'formation' ? 0.2 : 0);
      enemy.angle = Math.sin(enemy.wingPhase) * 0.15;

      if (enemy.state === 'formation') {
        const homeX = this.getFormationX(enemy.col);
        const homeY = this.getFormationY(enemy.row);
        enemy.x += (homeX - enemy.x) * 0.08;
        enemy.y += (homeY - enemy.y) * 0.08;

        if (!this.isBonusStage && (enemy.type === 2 || enemy.type === 3) && !enemy.capturedShip) {
          enemy.shootTimer--;
          if (enemy.shootTimer <= 0) {
            enemy.shootTimer = 400 + Math.random() * 300 - this.level * 15;
            this.shootEnemyBullet(enemy);
          }
        }
      } else if (enemy.state === 'diving') {
        this.updateDivingEnemy(enemy);
      } else if (enemy.state === 'capturing') {
        this.updateCapturingEnemy(enemy);
      } else if (enemy.state === 'returning') {
        this.updateReturningEnemy(enemy);
      } else if (enemy.state === 'bonus-entry' || enemy.state === 'bonus-leave') {
        this.updateBonusEnemy(enemy);
      }
    }
  }

  private updateDivingEnemy(enemy: Enemy) {
    enemy.pathT += 0.009 + this.level * 0.0005;

    if (enemy.pathType === 0) {
      const t = Math.min(enemy.pathT, 1);
      enemy.x = enemy.startPos.x + (enemy.endPos.x - enemy.startPos.x) * t + Math.sin(t * Math.PI * 3) * 90;
      enemy.y = enemy.startPos.y + (enemy.endPos.y - enemy.startPos.y) * t + Math.sin(t * Math.PI * 2) * 120;
      if (t >= 1) {
        enemy.state = 'returning';
        enemy.pathT = 0;
      }
    } else if (enemy.pathType === 1) {
      const t = Math.min(enemy.pathT, 1);
      enemy.x = enemy.controlPos.x + Math.cos(t * Math.PI * 2) * 140;
      enemy.y = enemy.controlPos.y + Math.sin(t * Math.PI * 2) * 90 + t * 280;
      if (t >= 1) {
        enemy.state = 'returning';
        enemy.pathT = 0;
      }
    } else if (enemy.pathType === 2) {
      enemy.x += (enemy.endPos.x - enemy.x) * 0.04;
      enemy.y += (enemy.endPos.y - enemy.y) * 0.04;
      if (Math.abs(enemy.x - enemy.endPos.x) < 5 && Math.abs(enemy.y - enemy.endPos.y) < 5) {
        enemy.state = 'capturing';
        enemy.pathT = 0;
        this.beams.push({
          x: enemy.x,
          y: enemy.y + 15,
          width: 50,
          height: HEIGHT - enemy.y - 60,
          life: 240,
          maxLife: 240,
          enemyId: enemy.id,
        });
        this.playTone(180, 'sine', 0.2, 0.4);
      }
    }

    enemy.shootTimer--;
    if (enemy.shootTimer <= 0 && enemy.y < HEIGHT - 150) {
      enemy.shootTimer = Math.max(40, 100 + Math.random() * 80 - this.level * 2);
      this.shootEnemyBullet(enemy);
    }

    if (enemy.y > HEIGHT + 60) {
      enemy.state = 'returning';
      enemy.pathT = 0;
    }
  }

  private updateCapturingEnemy(enemy: Enemy) {
    enemy.pathT += 1;
    if (enemy.pathT > 240) {
      enemy.state = 'returning';
      enemy.pathT = 0;
    }
  }

  private updateReturningEnemy(enemy: Enemy) {
    const homeX = this.getFormationX(enemy.col);
    const homeY = this.getFormationY(enemy.row);
    enemy.x += (homeX - enemy.x) * 0.05;
    enemy.y += (homeY - enemy.y) * 0.05;

    if (Math.abs(enemy.x - homeX) < 3 && Math.abs(enemy.y - homeY) < 3) {
      enemy.state = 'formation';
      enemy.isAttacker = false;
    }
  }

  private updateBonusEnemy(enemy: Enemy) {
    enemy.pathT += 0.012 + this.level * 0.001;
    const t = Math.min(enemy.pathT, 1);
    enemy.x = (1 - t) * (1 - t) * enemy.startPos.x + 2 * (1 - t) * t * enemy.controlPos.x + t * t * enemy.endPos.x;
    enemy.y = (1 - t) * (1 - t) * enemy.startPos.y + 2 * (1 - t) * t * enemy.controlPos.y + t * t * enemy.endPos.y;

    if (t >= 1) {
      if (enemy.state === 'bonus-entry') {
        enemy.state = 'bonus-leave';
        enemy.pathT = 0;
        enemy.startPos = { x: enemy.x, y: enemy.y };
        enemy.endPos = { x: enemy.startPos.x < WIDTH / 2 ? -60 : WIDTH + 60, y: enemy.y + 120 };
        enemy.controlPos = { x: WIDTH / 2, y: enemy.y - 180 };
      } else {
        const idx = this.enemies.indexOf(enemy);
        if (idx >= 0) this.enemies.splice(idx, 1);
      }
    }
  }

  private checkEnemyPlayerCollisions() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.state === 'formation' || enemy.state === 'bonus-entry' || enemy.state === 'bonus-leave') continue;

      for (let j = this.player.ships.length - 1; j >= 0; j--) {
        const ship = this.player.ships[j];
        const dx = enemy.x - ship.x;
        const dy = enemy.y - ship.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 26) {
          this.spawnParticles(enemy.x, enemy.y, this.getEnemyColor(enemy.type), 16);
          this.screenShake = 10;
          this.hitPlayer(j);
          if (!enemy.capturedShip) {
            this.enemies.splice(i, 1);
            i--;
          }
          break;
        }
      }
    }
  }

  private updateFormation() {
    this.formationOffset += this.formationDirection * (this.formationSpeed + this.level * 0.04);
    const maxOffset = 70 + this.level * 6;

    if (Math.abs(this.formationOffset) > maxOffset) {
      this.formationDirection *= -1;
      this.formationDrop = Math.min(this.formationDrop + 12, 180);
    }
  }

  private updateAttacks() {
    this.attackTimer++;
    const maxAttackers = Math.min(3 + Math.floor(this.level / 2), 10);
    const currentAttackers = this.enemies.filter((e) => e.state !== 'formation').length;

    if (currentAttackers < maxAttackers && this.attackTimer > this.attackInterval && this.player.ships.length > 0) {
      this.attackTimer = 0;
      this.attackInterval = Math.max(30, 140 - this.level * 6);

      const available = this.enemies.filter((e) => e.state === 'formation');
      if (available.length > 0) {
        const enemy = available[Math.floor(Math.random() * available.length)];
        this.startDive(enemy);
      }
    }
  }

  private startDive(enemy: Enemy) {
    if (this.player.ships.length === 0) return;

    enemy.state = 'diving';
    enemy.pathT = 0;
    enemy.isAttacker = true;
    enemy.startPos = { x: enemy.x, y: enemy.y };

    const canCapture = enemy.type === 2 && this.player.ships.length === 1 && Math.random() > 0.4;

    if (canCapture) {
      enemy.pathType = 2;
      const targetShip = this.player.ships[0];
      enemy.endPos = { x: targetShip.x, y: HEIGHT - 200 };
    } else {
      enemy.pathType = Math.floor(Math.random() * 2);
      const playerX = this.player.ships[0]?.x ?? WIDTH / 2;
      if (enemy.pathType === 0) {
        enemy.endPos = { x: playerX + (Math.random() - 0.5) * 240, y: HEIGHT + 80 };
      } else {
        enemy.controlPos = { x: WIDTH / 2 + (Math.random() - 0.5) * 240, y: 250 + Math.random() * 150 };
      }
    }

    enemy.shootTimer = 50 + Math.floor(Math.random() * 50);
  }

  private updateBeams() {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      beam.life--;

      const enemy = this.enemies.find((e) => e.id === beam.enemyId);
      if (enemy) {
        beam.x = enemy.x;
        beam.y = enemy.y + 15;
      }

      if (beam.life <= 0 || !enemy) {
        this.beams.splice(i, 1);
        continue;
      }

      if (this.player.ships.length === 1 && this.player.invulnerable <= 0 && this.shieldTimer <= 0) {
        const ship = this.player.ships[0];
        if (ship.x > beam.x - beam.width / 2 && ship.x < beam.x + beam.width / 2) {
          if (Math.random() > 0.97) {
            this.capturePlayer(enemy);
            this.beams.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  private capturePlayer(enemy: Enemy) {
    const ship = this.player.ships[0];
    this.spawnParticles(ship.x, ship.y, '#ff00cc', 40);
    this.screenShake = 15;
    this.playTone(120, 'sine', 0.4, 0.9);
    this.player.ships = [];
    enemy.capturedShip = true;
    enemy.health += 1;
    enemy.maxHealth += 1;
    enemy.state = 'returning';
    enemy.pathT = 0;
    this.lives--;
    this.addFloatingText(WIDTH / 2, HEIGHT / 2, 'CAPTURÉ !', '#ff00cc');

    if (this.lives >= 0) {
      setTimeout(() => {
        if (this.status === 'playing' && this.player.ships.length === 0) {
          this.player.ships = [{ x: WIDTH / 2, y: HEIGHT - 70, offsetX: 0 }];
          this.player.invulnerable = 180;
        }
      }, 1500);
    }

    this.updatePublicState();
  }

  private updateBonusStage() {
    this.bonusTimer++;
    this.bonusSpawnTimer++;

    const spawnRate = Math.max(18, 50 - this.level * 2);
    if (this.bonusSpawnTimer > spawnRate) {
      this.bonusSpawnTimer = 0;
      this.spawnBonusEnemy();
    }

    if (this.bonusTimer > 900) {
      this.status = 'bonus-summary';
      this.bonusSummaryTimer = 180;
      this.message = 'BONUS TERMINÉ !';
      this.messageTimer = 180;
      this.playJingle('bonus-end');
      this.updatePublicState();
    }
  }

  private checkLevelComplete() {
    if (this.enemies.length === 0 && !this.isBonusStage && this.status === 'playing') {
      this.status = 'bonus-summary';
      this.bonusSummaryTimer = 120;
      this.message = 'NIVEAU TERMINÉ !';
      this.messageTimer = 120;
      this.playJingle('stage-clear');
      this.updatePublicState();
    }
  }

  private shootEnemyBullet(enemy: Enemy) {
    if (this.isBonusStage) return;
    const target = this.player.ships[0];
    if (!target) return;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 4 + this.level * 0.25;
    this.bullets.push({
      x: enemy.x,
      y: enemy.y + 15,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      radius: 3,
      color: COLORS.bulletEnemy,
      isEnemy: true,
    });
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private updateFloatingTexts() {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 0.6;
      ft.life--;
      ft.scale = 1 + (1 - ft.life / ft.maxLife) * 0.5;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 7;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 25,
        maxLife: 60,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  private spawnShockwave(x: number, y: number, color: string) {
    for (let r = 10; r <= 40; r += 10) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        this.particles.push({
          x: x + Math.cos(angle) * r,
          y: y + Math.sin(angle) * r,
          vx: Math.cos(angle) * 3,
          vy: Math.sin(angle) * 3,
          life: 25,
          maxLife: 40,
          color,
          size: 3,
        });
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({ x, y, text, life: 70, maxLife: 70, color, scale: 1 });
  }

  private getFormationX(col: number): number {
    const cols = 8;
    const startX = (WIDTH - (cols - 1) * 52) / 2;
    return startX + col * 52 + this.formationOffset;
  }

  private getFormationY(row: number): number {
    return 70 + row * 44 + this.formationDrop;
  }

  private getEnemyColor(type: number): string {
    if (type === 0) return COLORS.enemy0;
    if (type === 1) return COLORS.enemy1;
    if (type === 2) return COLORS.enemy2;
    return COLORS.enemy3;
  }

  private getPowerUpColor(type: PowerUp['type']): string {
    if (type === 'rapid') return '#ffd93d';
    if (type === 'shield') return '#00f0ff';
    return '#ff2a6d';
  }

  private getPowerUpLabel(type: PowerUp['type']): string {
    if (type === 'rapid') return 'TIR RAPIDE';
    if (type === 'shield') return 'BOUCLIER';
    return 'DOUBLE';
  }

  // Drawing
  private draw() {
    this.ctx.save();

    if (this.screenShake > 0) {
      const shake = this.screenShake;
      this.ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    this.drawBackground();

    if (this.status === 'menu') {
      this.drawMenu();
      this.ctx.restore();
      return;
    }

    if (this.status === 'gameover') {
      this.drawGameOver();
      this.ctx.restore();
      return;
    }

    if (this.status === 'paused') {
      this.drawGame();
      this.drawPausedOverlay();
      this.ctx.restore();
      return;
    }

    this.drawGame();
    this.ctx.restore();
  }

  private drawBackground() {
    const gradient = this.ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, HEIGHT);
    gradient.addColorStop(0, '#120a2a');
    gradient.addColorStop(0.5, '#070515');
    gradient.addColorStop(1, '#02020a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Subtle nebula clouds
    const time = performance.now() * 0.0001;
    const cloud = this.ctx.createRadialGradient(
      WIDTH * (0.3 + Math.sin(time) * 0.1),
      HEIGHT * (0.3 + Math.cos(time * 0.7) * 0.1),
      0,
      WIDTH * 0.5,
      HEIGHT * 0.5,
      WIDTH * 0.8
    );
    cloud.addColorStop(0, 'rgba(80, 0, 120, 0.08)');
    cloud.addColorStop(0.5, 'rgba(0, 60, 120, 0.05)');
    cloud.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = cloud;
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Warp stars
    for (const star of this.stars) {
      const alpha = star.brightness * (0.4 + star.z * 0.3);
      this.ctx.fillStyle = star.color;
      this.ctx.globalAlpha = alpha;
      const length = this.isBonusStage ? star.size * 6 : star.size * star.z;
      this.ctx.beginPath();
      this.ctx.ellipse(star.x, star.y, star.size * 0.6, length, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    // Neon grid floor
    this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.08)';
    this.ctx.lineWidth = 1;
    const gridOffset = (performance.now() * 0.05) % 40;
    for (let y = HEIGHT - 200; y < HEIGHT; y += 40) {
      const yy = y + gridOffset;
      if (yy > HEIGHT) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(0, yy);
      this.ctx.lineTo(WIDTH, yy);
      this.ctx.stroke();
    }
    for (let x = 0; x <= WIDTH; x += 60) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, HEIGHT);
      this.ctx.lineTo(x + (x - WIDTH / 2) * 0.5, HEIGHT - 200);
      this.ctx.stroke();
    }
  }

  private drawGame() {
    // Beams
    for (const beam of this.beams) {
      this.drawBeam(beam);
    }

    // Power-ups
    for (const p of this.powerUps) {
      this.drawPowerUp(p);
    }

    // Enemies
    for (const enemy of this.enemies) {
      this.drawEnemy(enemy);
    }

    // Player
    for (const ship of this.player.ships) {
      this.drawPlayer(ship);
    }

    // Bullets
    for (const b of this.bullets) {
      this.drawBullet(b);
    }

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
    this.ctx.globalAlpha = 1;

    // Floating texts
    for (const ft of this.floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      this.ctx.save();
      this.ctx.translate(ft.x, ft.y);
      this.ctx.scale(ft.scale, ft.scale);
      this.ctx.fillStyle = ft.color;
      this.ctx.globalAlpha = alpha;
      this.ctx.font = 'bold 18px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = ft.color;
      this.ctx.fillText(ft.text, 0, 0);
      this.ctx.restore();
    }
    this.ctx.globalAlpha = 1;

    // Message
    if (this.messageTimer > 0) {
      const alpha = Math.min(1, this.messageTimer / 30);
      this.ctx.save();
      this.ctx.translate(WIDTH / 2, HEIGHT / 2);
      this.ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      this.ctx.font = 'bold 42px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.shadowBlur = 25;
      this.ctx.shadowColor = '#ff00cc';
      this.ctx.fillText(this.message, 0, 0);
      this.ctx.restore();
    }

    // Scanlines
    this.drawScanlines();
  }

  private drawPlayer(ship: Ship) {
    if (this.player.invulnerable > 0 && Math.floor(performance.now() / 40) % 2 === 0) return;

    this.ctx.save();
    this.ctx.translate(ship.x, ship.y);

    // Shield glow
    if (this.shieldTimer > 0) {
      const shieldPulse = 1 + Math.sin(performance.now() * 0.01) * 0.1;
      this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.3 + Math.sin(performance.now() * 0.02) * 0.2})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 28 * shieldPulse, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = COLORS.player;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = COLORS.playerGlow;

    // Animated engine trail
    const flicker = 18 + Math.random() * 8;
    this.ctx.fillStyle = '#ff7b00';
    this.ctx.beginPath();
    this.ctx.moveTo(-7, 12);
    this.ctx.lineTo(0, 22 + flicker);
    this.ctx.lineTo(7, 12);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = COLORS.player;
    // Main body
    this.ctx.beginPath();
    this.ctx.moveTo(0, -22);
    this.ctx.lineTo(16, 12);
    this.ctx.lineTo(8, 18);
    this.ctx.lineTo(0, 12);
    this.ctx.lineTo(-8, 18);
    this.ctx.lineTo(-16, 12);
    this.ctx.closePath();
    this.ctx.fill();

    // Cockpit
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -8);
    this.ctx.lineTo(4, 2);
    this.ctx.lineTo(0, 6);
    this.ctx.lineTo(-4, 2);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private drawEnemy(enemy: Enemy) {
    const color = enemy.capturedShip ? '#ff66dd' : this.getEnemyColor(enemy.type);
    this.ctx.save();
    this.ctx.translate(enemy.x, enemy.y);
    this.ctx.rotate(enemy.angle);
    this.ctx.fillStyle = color;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = color;

    const wingW = Math.sin(enemy.wingPhase) * 6;

    if (enemy.type === 0) {
      // Bee - animated wings
      this.ctx.beginPath();
      this.ctx.moveTo(0, -14);
      this.ctx.lineTo(14, -2);
      this.ctx.lineTo(10, 14);
      this.ctx.lineTo(-10, 14);
      this.ctx.lineTo(-14, -2);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
      this.ctx.beginPath();
      this.ctx.ellipse(20 + wingW, 0, 8, 4, 0.3, 0, Math.PI * 2);
      this.ctx.ellipse(-20 - wingW, 0, 8, 4, -0.3, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (enemy.type === 1) {
      // Butterfly
      this.ctx.beginPath();
      this.ctx.moveTo(0, -16);
      this.ctx.lineTo(16, -4);
      this.ctx.lineTo(10, 16);
      this.ctx.lineTo(-10, 16);
      this.ctx.lineTo(-16, -4);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -16);
      this.ctx.lineTo(0, 16);
      this.ctx.stroke();
    } else if (enemy.type === 2) {
      // Boss Galaga
      this.ctx.beginPath();
      this.ctx.moveTo(0, -18);
      this.ctx.lineTo(18, -4);
      this.ctx.lineTo(14, 18);
      this.ctx.lineTo(-14, 18);
      this.ctx.lineTo(-18, -4);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.fillStyle = '#000';
      this.ctx.beginPath();
      this.ctx.arc(0, 2, 6, 0, Math.PI * 2);
      this.ctx.fill();

      if (enemy.capturedShip) {
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 24, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    } else {
      // Elite enemy
      this.ctx.beginPath();
      this.ctx.moveTo(0, -20);
      this.ctx.lineTo(18, -8);
      this.ctx.lineTo(12, 8);
      this.ctx.lineTo(0, 18);
      this.ctx.lineTo(-12, 8);
      this.ctx.lineTo(-18, -8);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(-18, -8);
      this.ctx.lineTo(0, 18);
      this.ctx.lineTo(18, -8);
      this.ctx.stroke();
    }

    // Health bar for tougher enemies
    if (enemy.maxHealth > 1) {
      const barW = 24;
      const pct = enemy.health / enemy.maxHealth;
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(-barW / 2, -28, barW, 4);
      this.ctx.fillStyle = pct > 0.5 ? '#0f0' : '#f00';
      this.ctx.fillRect(-barW / 2, -28, barW * pct, 4);
    }

    this.ctx.restore();
  }

  private drawBullet(b: Bullet) {
    this.ctx.save();
    this.ctx.translate(b.x, b.y);
    this.ctx.fillStyle = b.color;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = b.color;

    if (!b.isEnemy) {
      // Player bullet - elongated
      this.ctx.beginPath();
      this.ctx.moveTo(0, -8);
      this.ctx.lineTo(4, 4);
      this.ctx.lineTo(0, 8);
      this.ctx.lineTo(-4, 4);
      this.ctx.closePath();
      this.ctx.fill();
    } else {
      // Enemy bullet - glowing orb
      this.ctx.beginPath();
      this.ctx.arc(0, 0, b.radius + 1, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, b.radius * 0.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawBeam(beam: TractorBeam) {
    const alpha = 0.25 + Math.sin(performance.now() * 0.02) * 0.15;
    const gradient = this.ctx.createLinearGradient(beam.x, beam.y, beam.x, beam.y + beam.height);
    gradient.addColorStop(0, `rgba(255,0,255,${alpha})`);
    gradient.addColorStop(0.5, `rgba(200,0,255,${alpha * 0.6})`);
    gradient.addColorStop(1, 'rgba(255,0,255,0)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    const w1 = beam.width / 2;
    const w2 = beam.width / 4;
    this.ctx.moveTo(beam.x - w1, beam.y);
    this.ctx.lineTo(beam.x + w1, beam.y);
    this.ctx.lineTo(beam.x + w2, beam.y + beam.height);
    this.ctx.lineTo(beam.x - w2, beam.y + beam.height);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = `rgba(255,255,255,${alpha + 0.2})`;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(beam.x, beam.y);
    this.ctx.lineTo(beam.x, beam.y + beam.height);
    this.ctx.stroke();
  }

  private drawPowerUp(p: PowerUp) {
    const color = this.getPowerUpColor(p.type);
    this.ctx.save();
    this.ctx.translate(p.x, p.y);
    const pulse = 1 + Math.sin(performance.now() * 0.01) * 0.15;
    this.ctx.scale(pulse, pulse);
    this.ctx.fillStyle = color;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.getPowerUpLabel(p.type)[0], 0, 1);
    this.ctx.restore();
  }

  private drawMenu() {
    this.drawBackground();

    this.ctx.save();
    this.ctx.translate(WIDTH / 2, 160);

    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 64px monospace';
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = COLORS.neonPink;
    this.ctx.fillText('GALAGA', 0, 0);

    this.ctx.font = 'bold 32px monospace';
    this.ctx.shadowColor = COLORS.neonCyan;
    this.ctx.fillText('LEGACY', 0, 45);

    this.ctx.restore();

    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 20px monospace';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#ffee00';
    this.ctx.fillText('Appuyez sur ENTRÉE pour commencer', WIDTH / 2, 340);

    this.ctx.font = 'bold 18px monospace';
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
    this.ctx.fillText('Créateur: Hylst - Geoffroy', WIDTH / 2, 410);
    this.ctx.font = '14px monospace';
    this.ctx.fillStyle = 'rgba(255,255,255,0.5)';
    this.ctx.fillText('Avec l\'aide d\'une IA', WIDTH / 2, 435);

    this.ctx.font = '13px monospace';
    this.ctx.fillStyle = 'rgba(255,255,255,0.45)';
    this.ctx.fillText('Déplacements: ← → / Q D  |  Tir: ESPACE / Z  |  Pause: P  |  Musique: M', WIDTH / 2, 480);

    this.drawScanlines();
  }

  private drawGameOver() {
    this.drawGame();

    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.ctx.save();
    this.ctx.translate(WIDTH / 2, HEIGHT / 2 - 60);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 52px monospace';
    this.ctx.shadowBlur = 25;
    this.ctx.shadowColor = '#ff0000';
    this.ctx.fillText('GAME OVER', 0, 0);
    this.ctx.restore();

    this.ctx.font = '24px monospace';
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
    this.ctx.fillText(`Score: ${this.score}`, WIDTH / 2, HEIGHT / 2 + 20);
    this.ctx.fillText(`Meilleur: ${Math.max(this.score, this.highScore)}`, WIDTH / 2, HEIGHT / 2 + 55);

    this.ctx.fillStyle = '#ffee00';
    this.ctx.font = 'bold 22px monospace';
    this.ctx.fillText('Appuyez sur ENTRÉE pour recommencer', WIDTH / 2, HEIGHT / 2 + 130);

    this.drawScanlines();
  }

  private drawPausedOverlay() {
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 56px monospace';
    this.ctx.shadowBlur = 25;
    this.ctx.shadowColor = COLORS.neonCyan;
    this.ctx.fillText('PAUSE', WIDTH / 2, HEIGHT / 2);
    this.ctx.font = '16px monospace';
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
    this.ctx.fillText('Appuyez sur P pour reprendre', WIDTH / 2, HEIGHT / 2 + 40);
  }

  private drawScanlines() {
    this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let y = 0; y < HEIGHT; y += 3) {
      this.ctx.fillRect(0, y, WIDTH, 1);
    }
    this.ctx.fillStyle = 'rgba(255,255,255,0.02)';
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Audio & Music
  private updateMusic() {
    if (!this.musicEnabled || !this.audioCtx || !this.masterGain) return;
    if (this.status === 'gameover') return;

    this.musicTimer++;
    const beatDuration = 12; // frames per 16th note

    if (this.musicTimer >= beatDuration) {
      this.musicTimer = 0;
      this.musicBeat = (this.musicBeat + 1) % 64;

      // Bass on every quarter note
      if (this.musicBeat % 4 === 0) {
        const note = BASSLINE[Math.floor(this.musicBeat / 4) % BASSLINE.length];
        this.playMusicNote(note, 'square', 0.15, 0.12, 0.15);
      }

      // Melody
      if (this.musicBeat % 2 === 0) {
        const note = MELODY[Math.floor(this.musicBeat / 2) % MELODY.length];
        this.playMusicNote(note, 'square', 0.06, 0.06, 0.08);
      }

      // Arpeggio
      if (this.musicBeat % 2 === 1) {
        const note = ARP[this.musicBeat % ARP.length];
        this.playMusicNote(note, 'triangle', 0.04, 0.04, 0.06);
      }
    }
  }

  private playMusicNote(note: string, type: OscillatorType, gain: number, attack: number, decay: number) {
    if (!this.audioCtx || !this.masterGain || !this.musicEnabled) return;
    const freq = MUSIC_NOTES[note];
    if (!freq) return;

    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    g.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, this.audioCtx.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + attack + decay);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + attack + decay + 0.02);
  }

  private playTone(freq: number, type: OscillatorType, attack: number, decay: number) {
    if (!this.soundsEnabled || !this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.1, this.audioCtx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + attack + decay);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + attack + decay + 0.05);
  }

  private playExplosion(type: number) {
    if (!this.soundsEnabled || !this.audioCtx || !this.masterGain) return;
    const noise = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    noise.type = 'sawtooth';
    noise.frequency.setValueAtTime(100 + type * 50, this.audioCtx.currentTime);
    noise.frequency.exponentialRampToValueAtTime(20, this.audioCtx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.25);
    noise.connect(gain);
    gain.connect(this.masterGain);
    noise.start(this.audioCtx.currentTime);
    noise.stop(this.audioCtx.currentTime + 0.3);
  }

  private playJingle(type: 'start' | 'bonus' | 'bonus-end' | 'stage-clear' | 'powerup') {
    const patterns: Record<string, string[]> = {
      start: ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'],
      bonus: ['C5', 'D5', 'E5', 'G5', 'A5', 'C6'],
      'bonus-end': ['C6', 'G5', 'E5', 'C5', 'G4', 'C4'],
      'stage-clear': ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'],
      powerup: ['G4', 'C5', 'E5', 'G5', 'C6', 'E6'],
    };

    const notes = patterns[type];
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.playTone(MUSIC_NOTES[note], 'square', 0.05, 0.12);
      }, i * 90);
    });
  }
}
