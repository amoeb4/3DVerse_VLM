/**
 * A MIG welding arc, drawn over the streamed picture: the arc's glare, the spatter, the molten
 * pool's afterglow and the fume rising from it.
 *
 * Everything that moves is simulated in world space (metres, Y up) and projected with the camera
 * each frame, so sparks fall and smoke rises the right way, and shrink with distance, whatever the
 * view. Drawn on two canvases: the light (glare, sparks, pool) adds up and is blended with `screen`,
 * like real bloom; the smoke is drawn normally, so it veils the scene instead of only brightening it.
 *
 * No React here — `WeldArc` owns the canvases and the frame loop.
 */

type Vec3 = [number, number, number];

/** The camera, as the frame is drawn. */
export type ArcProjection = {
  /** `clip_from_world`, column-major. */
  clipFromWorld: ArrayLike<number>;
  /** `clip_from_view[5]`, i.e. `1 / tan(fovY / 2)`. */
  focalY: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
};

type Spark = { p: Vec3; v: Vec3; age: number; life: number };
type Puff = {
  p: Vec3;
  v: Vec3;
  age: number;
  life: number;
  size0: number;
  size1: number;
  rotation: number;
  spin: number;
  sprite: number;
  phase: number;
};

//------------------------------------------------------------------------------
// Tuning. Sizes in metres, rates per second.
//------------------------------------------------------------------------------
const GRAVITY = 9.81;
const SPARK_RATE = 45;
const MAX_SPARKS = 180;
const SMOKE_RATE = 9;
const MAX_PUFFS = 70;
/** A faint, steady draught, so the fume leans rather than rising in a perfect column. */
const WIND: Vec3 = [0.025, 0, 0.01];

/** Flicker stays within this band, short-circuit dips aside: an arc shimmers, it does not strobe. */
const FLICKER_MIN = 0.8;
const FLICKER_MAX = 1.12;

const SMOKE_SPRITES = 4;
const SPRITE_SIZE = 128;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

//------------------------------------------------------------------------------
export class WeldArcEffect {
  #welding = false;
  /** 0 → 1 as the arc strikes, back to 0 when it stops. */
  #arc = 0;
  /** The bright flash of the arc striking, decaying fast. */
  #strike = 0;
  /** The molten pool's heat: builds while welding, cools over a couple of seconds after. */
  #pool = 0;
  #flicker = 1;
  #flickerTarget = 1;
  #nextFlickerAt = 0;
  #sparkBudget = 0;
  #smokeBudget = 0;
  #sparks: Spark[] = [];
  #puffs: Puff[] = [];
  /** Where the arc last was, so the afterglow and the last smoke stay put once it stops. */
  #lastTip: Vec3 | null = null;

  readonly #reducedMotion: boolean;
  readonly #sprites: { neutral: HTMLCanvasElement; lit: HTMLCanvasElement }[];

  constructor({ reducedMotion }: { reducedMotion: boolean }) {
    this.#reducedMotion = reducedMotion;
    this.#sprites = Array.from({ length: SMOKE_SPRITES }, () => {
      // One shape, two tints: the fume is lit blue by the arc near it, grey further up.
      const seed = Math.random() * 1000;
      return {
        neutral: makeSmokeSprite(seed, [168, 170, 176]),
        lit: makeSmokeSprite(seed, [176, 204, 255]),
      };
    });
  }

  set welding(value: boolean) {
    if (value && !this.#welding) {
      this.#strike = 1;
    }
    this.#welding = value;
  }

  /** Whether there is still something to draw: the arc, the pool cooling, or particles in flight. */
  get isActive() {
    return (
      this.#welding ||
      this.#arc > 0.002 ||
      this.#pool > 0.01 ||
      this.#sparks.length > 0 ||
      this.#puffs.length > 0
    );
  }

  /** The arc's current brightness, 0 when off — also what drives the engine light. */
  get intensity() {
    return this.#arc * (this.#flicker + this.#strike * 0.9);
  }

  //----------------------------------------------------------------------------
  update(dt: number, now: number, tip: Vec3 | null) {
    dt = Math.min(dt, 0.05);
    if (tip) {
      this.#lastTip = [tip[0], tip[1], tip[2]];
    }
    const burning = this.#welding && tip !== null;

    // Arc on/off and strike flash.
    const arcTarget = burning ? 1 : 0;
    this.#arc +=
      (arcTarget - this.#arc) * (1 - Math.exp(-dt * (burning ? 30 : 20)));
    this.#strike *= Math.exp(-dt * 10);
    this.#pool = burning
      ? this.#pool + (1 - this.#pool) * (1 - Math.exp(-dt * 2.5))
      : this.#pool * Math.exp(-dt * 1.1);

    // Flicker: a new random level every 20–55 ms, eased towards, with the odd short-circuit dip
    // and pop of a short-arc transfer.
    if (this.#reducedMotion) {
      this.#flicker = 1;
    } else {
      if (now >= this.#nextFlickerAt) {
        const roll = Math.random();
        this.#flickerTarget =
          roll < 0.04
            ? 0.5
            : roll < 0.06
              ? 1.3
              : rand(FLICKER_MIN, FLICKER_MAX);
        this.#nextFlickerAt = now + rand(20, 55);
      }
      this.#flicker +=
        (this.#flickerTarget - this.#flicker) * (1 - Math.exp(-dt * 40));
    }

    if (burning && tip) {
      this.#spawnSparks(dt, tip);
      this.#spawnSmoke(dt, tip);
    }

    // Spatter: ballistic, with a little air drag.
    const drag = Math.exp(-dt * 1.6);
    for (const s of this.#sparks) {
      s.v[1] -= GRAVITY * dt;
      s.v[0] *= drag;
      s.v[1] *= drag;
      s.v[2] *= drag;
      s.p[0] += s.v[0] * dt;
      s.p[1] += s.v[1] * dt;
      s.p[2] += s.v[2] * dt;
      s.age += dt;
    }
    this.#sparks = this.#sparks.filter((s) => s.age < s.life);

    // Fume: buoyant at first, slowing, swaying, carried by the draught.
    for (const f of this.#puffs) {
      const sway = Math.sin(f.age * 1.4 + f.phase) * 0.018;
      f.v[1] *= Math.exp(-dt * 0.25);
      f.p[0] += (f.v[0] + WIND[0] + sway) * dt;
      f.p[1] += f.v[1] * dt;
      f.p[2] += (f.v[2] + WIND[2] + sway * 0.5) * dt;
      f.rotation += f.spin * dt;
      f.age += dt;
    }
    this.#puffs = this.#puffs.filter((f) => f.age < f.life);
  }

  #spawnSparks(dt: number, tip: Vec3) {
    if (this.#reducedMotion) {
      return;
    }
    this.#sparkBudget += SPARK_RATE * dt * this.#flicker;
    // Spatter comes in bursts.
    if (Math.random() < 0.03) {
      this.#sparkBudget += rand(5, 12);
    }
    while (this.#sparkBudget >= 1 && this.#sparks.length < MAX_SPARKS) {
      this.#sparkBudget -= 1;
      // Mostly up and outwards, off the plate.
      const theta = Math.random() * Math.PI * 2;
      const up = rand(0.15, 1);
      const out = Math.sqrt(1 - up * up);
      const speed = rand(0.5, 2.4);
      this.#sparks.push({
        p: [tip[0], tip[1], tip[2]],
        v: [
          Math.cos(theta) * out * speed,
          up * speed,
          Math.sin(theta) * out * speed,
        ],
        age: 0,
        life: rand(0.2, 0.85),
      });
    }
    this.#sparkBudget = Math.min(this.#sparkBudget, 1);
  }

  #spawnSmoke(dt: number, tip: Vec3) {
    this.#smokeBudget += SMOKE_RATE * dt * (this.#reducedMotion ? 0.5 : 1);
    while (this.#smokeBudget >= 1 && this.#puffs.length < MAX_PUFFS) {
      this.#smokeBudget -= 1;
      this.#puffs.push({
        p: [
          tip[0] + rand(-0.006, 0.006),
          tip[1] + 0.012,
          tip[2] + rand(-0.006, 0.006),
        ],
        v: [rand(-0.012, 0.012), rand(0.07, 0.14), rand(-0.012, 0.012)],
        age: 0,
        life: rand(2.6, 4.6),
        size0: rand(0.015, 0.03),
        size1: rand(0.18, 0.34),
        rotation: Math.random() * Math.PI * 2,
        spin: rand(-0.35, 0.35),
        sprite: Math.floor(Math.random() * SMOKE_SPRITES),
        phase: Math.random() * Math.PI * 2,
      });
    }
    this.#smokeBudget = Math.min(this.#smokeBudget, 1);
  }

  //----------------------------------------------------------------------------
  draw(
    light: CanvasRenderingContext2D,
    smoke: CanvasRenderingContext2D,
    projection: ArcProjection,
  ) {
    const { width, height } = projection;
    light.clearRect(0, 0, width, height);
    smoke.clearRect(0, 0, width, height);

    const intensity = this.intensity;
    this.#drawSmoke(smoke, projection, intensity);

    light.save();
    light.globalCompositeOperation = "lighter";
    this.#drawSparks(light, projection);
    const tip = this.#lastTip && project(projection, this.#lastTip);
    if (tip) {
      const perMetre = (projection.focalY * height * 0.5) / tip.w;
      this.#drawPool(light, tip, perMetre);
      if (intensity > 0.002) {
        drawArc(light, tip, perMetre, intensity, Math.max(width, height));
      }
    }
    light.restore();
  }

  #drawSmoke(
    ctx: CanvasRenderingContext2D,
    projection: ArcProjection,
    intensity: number,
  ) {
    // Farthest first, so nearer puffs are drawn over them.
    const visible = this.#puffs
      .map((puff) => ({ puff, at: project(projection, puff.p) }))
      .filter((entry): entry is { puff: Puff; at: Projected } => !!entry.at)
      .sort((a, b) => b.at.w - a.at.w);

    for (const { puff, at } of visible) {
      const t = puff.age / puff.life;
      const perMetre = (projection.focalY * projection.height * 0.5) / at.w;
      const size = Math.max(
        2,
        (puff.size0 + (puff.size1 - puff.size0) * (1 - (1 - t) ** 2)) *
          perMetre,
      );
      // Subtle: thin as it is born, densest just above the arc, gone by the end.
      const alpha = 0.14 * smoothstep(0, 0.12, t) * (1 - t) ** 1.5;
      // Lit blue by the arc near it, while the arc burns.
      const lit = clamp01((1 - t) ** 3 * Math.min(1, intensity));
      const sprites = this.#sprites[puff.sprite];

      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(puff.rotation);
      ctx.globalAlpha = alpha * (1 - lit);
      ctx.drawImage(sprites.neutral, -size / 2, -size / 2, size, size);
      if (lit > 0.01) {
        ctx.globalAlpha = alpha * lit;
        ctx.drawImage(sprites.lit, -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }
  }

  #drawSparks(ctx: CanvasRenderingContext2D, projection: ArcProjection) {
    ctx.lineCap = "round";
    for (const s of this.#sparks) {
      const head = project(projection, s.p);
      // A short streak behind the spark, like a camera's motion blur.
      const tail = project(projection, [
        s.p[0] - s.v[0] * 0.022,
        s.p[1] - s.v[1] * 0.022,
        s.p[2] - s.v[2] * 0.022,
      ]);
      if (!head || !tail) {
        continue;
      }
      const t = s.age / s.life;
      // White-hot, then yellow, orange, dull red as it cools.
      const g = Math.round(245 - 170 * t);
      const b = Math.round(210 * (1 - t) ** 3);
      ctx.strokeStyle = `rgba(255, ${g}, ${b}, ${(1 - t) ** 0.6})`;
      ctx.lineWidth = Math.max(0.8, 1.6 * (1 - t));
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
  }

  #drawPool(ctx: CanvasRenderingContext2D, tip: Projected, perMetre: number) {
    if (this.#pool < 0.01) {
      return;
    }
    const heat = this.#pool;
    const r = Math.max(5, 0.016 * perMetre);
    const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, r);
    g.addColorStop(0, `rgba(255, 190, 110, ${0.7 * heat})`);
    g.addColorStop(0.35, `rgba(255, 110, 40, ${0.45 * heat})`);
    g.addColorStop(1, "rgba(255, 60, 10, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(tip.x - r, tip.y - r, r * 2, r * 2);
  }
}

//------------------------------------------------------------------------------
/** The arc's glare: a wide blue halo, a tighter glow, a white-hot core and a faint lens streak. */
function drawArc(
  ctx: CanvasRenderingContext2D,
  tip: Projected,
  perMetre: number,
  intensity: number,
  maxDimension: number,
) {
  const { x, y } = tip;
  const a = (alpha: number) => Math.min(1, alpha * intensity).toFixed(3);

  const radial = (radius: number, stops: [number, string][]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    for (const [offset, color] of stops) {
      g.addColorStop(offset, color);
    }
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };

  // Halo: the light the arc throws on the air around it.
  const halo = Math.min(Math.max(0.45 * perMetre, 50), maxDimension * 0.6);
  radial(halo, [
    [0, `rgba(95, 150, 255, ${a(0.3)})`],
    [0.25, `rgba(60, 110, 255, ${a(0.12)})`],
    [1, "rgba(40, 80, 255, 0)"],
  ]);

  // Glow: the blue-violet plasma.
  const glow = Math.max(14, 0.07 * perMetre);
  radial(glow, [
    [0, `rgba(205, 232, 255, ${a(0.95)})`],
    [0.3, `rgba(120, 175, 255, ${a(0.55)})`],
    [1, "rgba(70, 120, 255, 0)"],
  ]);

  // Core: saturated to white, as a camera sees an arc.
  const core =
    Math.max(3, 0.013 * perMetre) * (0.85 + 0.25 * Math.min(1.3, intensity));
  radial(core, [
    [0, `rgba(255, 255, 255, ${a(1.2)})`],
    [0.5, `rgba(230, 242, 255, ${a(0.9)})`],
    [1, "rgba(200, 225, 255, 0)"],
  ]);

  // Anamorphic streak, faint.
  const streak = Math.min(Math.max(0.55 * perMetre, 50), maxDimension * 0.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.05);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, streak);
  g.addColorStop(0, `rgba(150, 195, 255, ${a(0.32)})`);
  g.addColorStop(1, "rgba(150, 195, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(-streak, -streak, streak * 2, streak * 2);
  ctx.restore();
}

//------------------------------------------------------------------------------
type Projected = { x: number; y: number; w: number };

/** World → canvas CSS pixels; `null` behind or too close to the camera. */
function project(
  { clipFromWorld: m, width, height }: ArcProjection,
  p: readonly number[],
): Projected | null {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if (w < 0.02) {
    return null;
  }
  return {
    x: (x / w + 1) * 0.5 * width,
    y: (1 - y / w) * 0.5 * height,
    w,
  };
}

/**
 * A soft, irregular puff: a few overlapping blobs inside a radial falloff, so the fume reads as
 * smoke rather than as round discs.
 */
function makeSmokeSprite(seed: number, [r, g, b]: [number, number, number]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  const c = SPRITE_SIZE / 2;
  let s = seed;
  const random = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < 9; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * c * 0.35;
    const bx = c + Math.cos(angle) * distance;
    const by = c + Math.sin(angle) * distance;
    const br = c * (0.35 + random() * 0.4);
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.42)`);
    grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.16)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
  // Fade the square's edges out entirely.
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(c, c, c * 0.45, c, c, c);
  mask.addColorStop(0, "rgba(0, 0, 0, 1)");
  mask.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}
