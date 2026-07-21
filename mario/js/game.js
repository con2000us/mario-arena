/* ============================================================================
 * game.js — SMB World 1-1 fan remake: engine, physics, entities, rendering.
 *
 * Plain script (no modules) sharing globals with sprites.js / audio.js /
 * levels.js so the game runs from file:// by double-clicking index.html.
 *
 * Physics units are px/frame at a fixed 60fps timestep. Numbers follow the
 * classic SMB feel: walk 1.5 / run 2.55, accel 0.09 ground / 0.06 air,
 * release decel 0.10, skid 0.20, jump impulse -(4.1 + 0.45*|vx|) capped at
 * -5.2, gravity 0.13 (rising, button held) / 0.40 (rising, released) /
 * 0.34 (falling), terminal velocity 4.5.
 * ============================================================================ */

'use strict';

/* ---- constants ----------------------------------------------------------- */

const TILE = 16;
const VW = 256, VH = 240;          // NES internal resolution
const STEP = 1000 / 60;            // fixed timestep (ms)
const SKY = '#5C94FC';

const WALK_MAX = 1.5, RUN_MAX = 2.55;
const ACCEL_G = 0.09, ACCEL_A = 0.06, DECEL = 0.10, SKID_DECEL = 0.20;
const JUMP_A = 4.1, JUMP_B = 0.45, JUMP_CAP = 5.2;
const GRAV_HOLD = 0.13, GRAV_UP = 0.40, GRAV_DOWN = 0.34, MAX_FALL = 4.5;

const SMALL_W = 12, SMALL_H = 14, BIG_H = 26;

const CHAIN = [100, 200, 400, 800, 1000, 2000, 4000, 8000]; // then 1UP

const HISCORE_KEY = 'smb11remake.hiscore';

/* ---- game state ------------------------------------------------------------ */

let canvas = null, ctx = null;
let gameState = 'title';           // 'title' | 'play' | 'gameover'
let paused = false;
let globalFrame = 0;

let map = [];                      // 2D array of tile chars (mutable)
let LW = 0, LH = 0, levelWpx = 0;
let camX = 0;

let mario = null;
let ents = [];                     // enemies, items, fireballs, debris, coin pops
let bumps = [];                    // block bounce animations {tx,ty,t}
let popups = [];                   // floating score text {x,y,text,t}
let particles = [];                // firework / poof particles
let multiCoins = {};               // remaining coins per multi-coin brick "tx,ty"

let score = 0, coins = 0, lives = 3, hiscore = 0;
let time = 400, timeFrames = 0, timeFastT = 0;   // timeFastT: delay between warning jingle and BGM speed-up

let spawnIdx = 0;
let freezeT = 0;                   // global freeze for grow/shrink transformations

// flagpole / end-of-level
let poleX = 0, poleTopY = 24, poleBaseY = 192, flagY = 32;
let castleX = 0, doorX = 0;
let castleFlagY = -1;              // small flag raised atop the castle at the end
let clearTime = 0, fireworksLeft = 0, fwTimer = 0, fwDoneT = -1;

/* ---- input ------------------------------------------------------------------- */

const input = { left: false, right: false, down: false, jump: false, run: false,
                jumpPressed: false, runPressed: false };

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
  KeyZ: 'jump', Space: 'jump',
  KeyX: 'run', ShiftLeft: 'run', ShiftRight: 'run'
};
const HANDLED = { ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1,
                  Space: 1, Enter: 1, KeyZ: 1, KeyX: 1, ShiftLeft: 1, ShiftRight: 1, KeyM: 1 };

function keyDown(code) {
  Sfx.unlock();
  const k = KEYMAP[code];
  if (k) {
    if (k === 'jump' && !input.jump) input.jumpPressed = true;
    if (k === 'run' && !input.run) input.runPressed = true;
    input[k] = true;
  }
  if (code === 'Enter') handleEnter();
  if (code === 'KeyM') Sfx.toggleMute();
}

function keyUp(code) {
  const k = KEYMAP[code];
  if (k) input[k] = false;
}

function handleEnter() {
  if (gameState === 'title') {
    newGame();
  } else if (gameState === 'gameover') {
    gameState = 'title';
  } else if (gameState === 'play') {
    if (mario.state === 'clear') {
      saveHiscore();
      gameState = 'title';
    } else if (mario.state !== 'die') {
      paused = !paused;
      Sfx.pause();
      if (paused) Music.suspend(); else Music.resume();
    }
  }
}

/* ---- level setup ---------------------------------------------------------------- */

function loadHiscore() {
  try {
    const v = (typeof localStorage !== 'undefined') ? localStorage.getItem(HISCORE_KEY) : null;
    hiscore = v ? (parseInt(v, 10) || 0) : 0;
  } catch (e) { hiscore = 0; }
}

function saveHiscore() {
  if (score > hiscore) hiscore = score;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HISCORE_KEY, String(hiscore));
  } catch (e) { /* ignore */ }
}

function newGame() {
  score = 0; coins = 0; lives = 3;
  resetLevel();
  gameState = 'play';
  paused = false;
  Music.setFast(false);
  Music.play('main');
}

function resetLevel() {
  map = LEVEL_1_1.rows.map(r => r.split(''));
  LW = LEVEL_1_1.width; LH = LEVEL_1_1.height; levelWpx = LW * TILE;
  ents = []; bumps = []; popups = []; particles = []; multiCoins = {};
  camX = 0; spawnIdx = 0; freezeT = 0;
  time = LEVEL_1_1.time; timeFrames = 0; timeFastT = 0;
  poleX = LEVEL_1_1.poleCol * TILE + 8;
  poleBaseY = 12 * TILE;
  flagY = poleTopY + 8;
  castleX = LEVEL_1_1.castleCol * TILE;
  doorX = castleX + 40;
  castleFlagY = -1;
  mario = {
    isMario: true,
    x: 40, y: 13 * TILE - SMALL_H, w: SMALL_W, h: SMALL_H,
    vx: 0, vy: 0, facing: 1,
    big: false, fire: false,
    onGround: true, jumpHeld: false,
    state: 'play', stateT: 0, invulnT: 0,
    starT: 0, starChain: 0,
    chain: 0, animT: 0, throwT: 0,
    skidding: false, crouching: false, visible: true,
    shrinkStayBig: false,
    hitWall: 0, landed: false, hitHead: false, headTx: 0, headTy: 0
  };
}

/* ---- tiles ------------------------------------------------------------------------ */

function tileAt(tx, ty) {
  if (tx < 0 || tx >= LW) return 'X';   // level side walls
  if (ty < 0 || ty >= LH) return '.';
  return map[ty][tx];
}

function solidChar(c) {
  return c === '#' || c === 'X' || c === 'B' || c === 'C' || c === 'T' ||
         c === '?' || c === 'M' || c === 'U' ||
         c === '[' || c === ']' || c === '(' || c === ')';
}
// Note: 'H' (hidden block) is intangible except when bumped from below.

function solidAt(tx, ty) { return solidChar(tileAt(tx, ty)); }

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function bodyCollides(e) {
  const tx0 = Math.floor(e.x / TILE), tx1 = Math.floor((e.x + e.w - 0.001) / TILE);
  const ty0 = Math.floor(e.y / TILE), ty1 = Math.floor((e.y + e.h - 0.001) / TILE);
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      if (solidAt(tx, ty)) return true;
  return false;
}

// Horizontal move + resolve. Sets e.hitWall (-1/0/1).
function moveEntityX(e) {
  e.x += e.vx;
  e.hitWall = 0;
  const ty0 = Math.floor(e.y / TILE), ty1 = Math.floor((e.y + e.h - 0.001) / TILE);
  let tx, ty;
  if (e.vx > 0) {
    tx = Math.floor((e.x + e.w - 0.001) / TILE);
    for (ty = ty0; ty <= ty1; ty++) {
      if (solidAt(tx, ty)) {
        // SMB corner correction: while airborne, tiny lips are stepped over.
        if (e.isMario && !e.onGround) {
          const step = e.y + e.h - ty * TILE;
          if (step > 0 && step <= 4) {
            const oldY = e.y;
            e.y -= step;
            if (!bodyCollides(e)) return;
            e.y = oldY;
          }
        }
        e.x = tx * TILE - e.w; e.hitWall = 1; return;
      }
    }
  } else if (e.vx < 0) {
    tx = Math.floor(e.x / TILE);
    for (ty = ty0; ty <= ty1; ty++) {
      if (solidAt(tx, ty)) {
        if (e.isMario && !e.onGround) {
          const step = e.y + e.h - ty * TILE;
          if (step > 0 && step <= 4) {
            const oldY = e.y;
            e.y -= step;
            if (!bodyCollides(e)) return;
            e.y = oldY;
          }
        }
        e.x = (tx + 1) * TILE; e.hitWall = -1; return;
      }
    }
  }
}

// Vertical move + resolve. Sets e.landed (falling) or e.hitHead (rising).
function moveEntityY(e) {
  e.y += e.vy;
  e.landed = false; e.hitHead = false;
  const tx0 = Math.floor(e.x / TILE), tx1 = Math.floor((e.x + e.w - 0.001) / TILE);
  let tx, ty;
  if (e.vy > 0) {
    ty = Math.floor((e.y + e.h - 0.001) / TILE);
    for (tx = tx0; tx <= tx1; tx++) {
      if (solidAt(tx, ty)) {
        e.y = ty * TILE - e.h; e.vy = 0; e.landed = true; return;
      }
    }
  } else if (e.vy < 0) {
    ty = Math.floor(e.y / TILE);
    let bestTx = -1, bestOv = -1;
    for (tx = tx0; tx <= tx1; tx++) {
      const c = tileAt(tx, ty);
      if (solidChar(c) || c === 'H') {
        const ov = Math.min(e.x + e.w, tx * TILE + TILE) - Math.max(e.x, tx * TILE);
        if (ov > bestOv) { bestOv = ov; bestTx = tx; }
      }
    }
    if (bestTx >= 0) {
      e.y = (ty + 1) * TILE; e.vy = 0; e.hitHead = true;
      e.headTx = bestTx; e.headTy = ty;
    }
  }
}

/* ---- scoring ---------------------------------------------------------------------- */

function addPopup(x, y, text) { popups.push({ x: x, y: y, text: text, t: 0 }); }

function addScore(n, x, y) {
  score += n;
  if (x !== undefined) addPopup(x, y, String(n));
}

function award1UP(x, y) {
  lives++;
  Sfx.oneup();
  if (x !== undefined) addPopup(x, y, '1UP');
}

function awardCoin(x, y) {
  coins++;
  addScore(200, x, y);
  if (coins >= 100) {
    coins -= 100;
    award1UP(mario.x, mario.y - 10);
  }
}

// Consecutive stomps / shell kills chain: 100,200,...,8000 then 1UP.
function chainAward(chainIdx, x, y) {
  if (chainIdx >= CHAIN.length) award1UP(x, y);
  else addScore(CHAIN[chainIdx], x, y);
}

/* ---- block interaction -------------------------------------------------------------- */

function addBump(tx, ty) {
  bumps.push({ tx: tx, ty: ty, t: 0 });
  // Enemies standing on a bumped block are flipped off (classic SMB rule).
  const top = ty * TILE;
  for (const e of ents) {
    if (e.kind !== 'goomba' && e.kind !== 'koopa') continue;
    if (e.state !== 'walk' && e.state !== 'shell') continue;
    const feet = e.y + e.h;
    if (feet > top - 3 && feet < top + 3 &&
        e.x + e.w > tx * TILE && e.x < tx * TILE + TILE) {
      flipKill(e, 100);
    }
  }
}

function hitBlock(tx, ty) {
  const c = tileAt(tx, ty);
  if (c === '?') {
    map[ty][tx] = 'U';
    addBump(tx, ty);
    spawnCoinPop(tx, ty);
    awardCoin(tx * TILE, ty * TILE - 8);
    Sfx.coin();
  } else if (c === 'C') {
    const k = tx + ',' + ty;
    if (multiCoins[k] === undefined) multiCoins[k] = 10;
    addBump(tx, ty);
    spawnCoinPop(tx, ty);
    awardCoin(tx * TILE, ty * TILE - 8);
    Sfx.coin();
    if (--multiCoins[k] <= 0) map[ty][tx] = 'U';
  } else if (c === 'M') {
    map[ty][tx] = 'U';
    addBump(tx, ty);
    spawnItem(tx, ty, mario.big ? 'flower' : 'mushroom');
    Sfx.sprout();
  } else if (c === 'H') {
    map[ty][tx] = 'U';
    addBump(tx, ty);
    spawnItem(tx, ty, 'oneup');
    Sfx.sprout();
  } else if (c === 'T') {
    // Starman brick (101,9 in authentic 1-1): releases a Starman, then is used.
    map[ty][tx] = 'U';
    addBump(tx, ty);
    spawnItem(tx, ty, 'star');
    Sfx.sprout();
  } else if (c === 'B') {
    if (mario.big) {
      map[ty][tx] = '.';
      spawnDebris(tx, ty);
      addScore(50, tx * TILE + 4, ty * TILE);
      Sfx.brick();
    } else {
      addBump(tx, ty);
      Sfx.bump();
    }
  } else {
    Sfx.bump();
  }
}

/* ---- entity factories ------------------------------------------------------------------ */

function spawnCoinPop(tx, ty) {
  ents.push({ kind: 'coinpop', x: tx * TILE, y: ty * TILE - TILE, w: 16, h: 16,
              vx: 0, vy: -3.4, t: 0 });
}

function spawnDebris(tx, ty) {
  const defs = [
    { vx: -1.1, vy: -4.0 }, { vx: 1.1, vy: -4.0 },
    { vx: -0.7, vy: -2.2 }, { vx: 0.7, vy: -2.2 }
  ];
  for (const d of defs) {
    ents.push({ kind: 'debris', x: tx * TILE + 4, y: ty * TILE, w: 8, h: 8,
                vx: d.vx, vy: d.vy, t: 0 });
  }
}

function spawnItem(tx, ty, kind) {
  ents.push({ kind: kind, x: tx * TILE + 1, y: ty * TILE, w: 14, h: 14,
              vx: 0, vy: 0, dir: 1, state: 'rise',
              riseDur: kind === 'flower' ? 50 : 60, t: 0 });
}

function spawnEnemy(kind, tileX, yPx) {
  if (kind === 'goomba') {
    ents.push({ kind: 'goomba', x: tileX * TILE + 1, y: yPx, w: 14, h: 14,
                vx: -0.55, vy: 0, dir: -1, state: 'walk', t: 0 });
  } else if (kind === 'koopa') {
    ents.push({ kind: 'koopa', x: tileX * TILE + 2, y: yPx, w: 12, h: 22,
                vx: -0.5, vy: 0, dir: -1, state: 'walk', t: 0, shellT: 0, kills: 0 });
  }
}

function spawnEnemiesAhead() {
  const spawns = LEVEL_1_1.spawns;
  while (spawnIdx < spawns.length && spawns[spawnIdx].x * TILE < camX + VW + 64) {
    const s = spawns[spawnIdx];
    const groundY = 13 * TILE;
    const y = (s.y !== undefined) ? s.y : groundY - (s.t === 'koopa' ? 22 : 14);
    spawnEnemy(s.t, s.x, y);
    spawnIdx++;
  }
}

function flipKill(e, scoreVal) {
  e.state = 'flip';
  e.vy = -3.4;
  e.vx = 0.3 * (e.dir || 1);
  if (scoreVal) addScore(scoreVal, e.x, e.y - 6);
}

function spawnFireworkBurst(x, y) {
  const colors = ['#FCFCFC', '#F8B800', '#D82800'];
  for (let i = 0; i < 26; i++) {
    const a = (Math.PI * 2 * i) / 26;
    const sp = 0.6 + (i % 4) * 0.45;
    particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                     life: 55, t: 0, color: colors[i % 3] });
  }
  Sfx.firework();
}

/* ---- Mario transformations, damage, death ------------------------------------------ */

function startGrow(toFire) {
  if (!mario.big) {
    mario.big = true;
    mario.h = BIG_H;
    mario.y -= (BIG_H - SMALL_H);
  }
  if (toFire) mario.fire = true;
  mario.state = 'grow';
  mario.stateT = 0;
  freezeT = 42;                     // brief pause + flicker, like the original
}

function startShrink(stayBig) {
  mario.state = 'shrink';
  mario.stateT = 0;
  mario.shrinkStayBig = stayBig;    // fire -> big keeps the big body
  freezeT = 42;
  Sfx.shrink();
}

function finishTransformation() {
  if (mario.state === 'shrink') {
    if (!mario.shrinkStayBig) {
      mario.big = false;
      if (mario.h !== SMALL_H) { mario.h = SMALL_H; mario.y += (BIG_H - SMALL_H); }
    }
    mario.invulnT = 120;            // ~2s of invincibility flicker
  }
  mario.state = 'play';
  mario.stateT = 0;
}

function powerupMario(kind) {
  if (kind === 'mushroom') {
    addScore(1000, mario.x, mario.y - 8);
    if (!mario.big) startGrow(false);
    Sfx.powerup();
  } else if (kind === 'flower') {
    addScore(1000, mario.x, mario.y - 8);
    if (!mario.big) startGrow(false);       // small + flower = big only (SMB rule)
    else if (!mario.fire) startGrow(true);  // big + flower = fire form
    Sfx.powerup();
  } else if (kind === 'oneup') {
    award1UP(mario.x, mario.y - 10);
  } else if (kind === 'star') {
    addScore(1000, mario.x, mario.y - 8);
    mario.starT = 600;                // ~10s of invincibility
    mario.starChain = 0;              // contact-kill chain starts fresh
    Sfx.star();
    Music.play('star');             // invincibility loop takes over from the overworld BGM
  }
}

function hurtMario() {
  if (mario.state !== 'play' || mario.invulnT > 0) return;
  if (mario.fire) { mario.fire = false; startShrink(true); }
  else if (mario.big) startShrink(false);
  else killMario(false);
}

function killMario(pit) {
  if (mario.state !== 'play') return;
  mario.state = 'die';
  mario.stateT = pit ? 10 : 0;      // pit deaths skip the "pop up" hang
  mario.vy = pit ? 1.5 : -4.5;
  mario.vx = 0;
  Music.stop();                    // silence the BGM for the death jingle
  Sfx.die();
}

function endLife() {
  lives--;
  saveHiscore();
  if (lives <= 0) gameState = 'gameover';
  else { resetLevel(); Music.setFast(false); Music.play('main'); }   // restart the stage loop
}

/* ---- Mario per-frame update ----------------------------------------------------------- */

function updateMario() {
  if (mario.invulnT > 0) mario.invulnT--;
  if (mario.throwT > 0) mario.throwT--;
  if (mario.starT > 0) {
    mario.starT--;
    if (mario.starT === 0) {
      mario.starChain = 0;            // chain dies with the star
      Music.play('main');             // star loop ends -> back to the overworld loop
    }
  }

  switch (mario.state) {
    case 'play': updateMarioPlay(); break;
    case 'die': updateMarioDie(); break;
    case 'pole': updateMarioPole(); break;
    case 'poleHop': updateMarioPoleHop(); break;
    case 'walkCastle': updateMarioWalkCastle(); break;
    case 'flagRaise': updateMarioFlagRaise(); break;
    case 'timeCount': updateMarioTimeCount(); break;
    case 'fireworks': updateMarioFireworks(); break;
    case 'clear': break;            // waits for Enter
    // 'grow' / 'shrink' are driven by the freeze timer in update()
  }
}

function updateMarioPlay() {
  // crouch (big Mario only)
  const wantCrouch = mario.big && input.down && mario.onGround;
  if (wantCrouch && mario.h !== SMALL_H) { mario.h = SMALL_H; mario.y += (BIG_H - SMALL_H); }
  if (!wantCrouch && mario.big && mario.h === SMALL_H) {
    const test = { x: mario.x, y: mario.y - (BIG_H - SMALL_H), w: mario.w, h: BIG_H };
    if (!bodyCollides(test)) { mario.h = BIG_H; mario.y -= (BIG_H - SMALL_H); }
  }
  mario.crouching = wantCrouch;

  // horizontal movement
  const max = input.run ? RUN_MAX : WALK_MAX;
  const acc = mario.onGround ? ACCEL_G : ACCEL_A;
  mario.skidding = false;
  if (!mario.crouching) {
    if (input.left && !input.right) {
      mario.facing = -1;
      if (mario.vx > 0) {
        mario.vx -= mario.onGround ? SKID_DECEL : ACCEL_A;
        if (mario.onGround && mario.vx > 0.6) mario.skidding = true;
      } else {
        mario.vx -= acc;
        if (mario.vx < -max) mario.vx = -max;
      }
    } else if (input.right && !input.left) {
      mario.facing = 1;
      if (mario.vx < 0) {
        mario.vx += mario.onGround ? SKID_DECEL : ACCEL_A;
        if (mario.onGround && mario.vx < -0.6) mario.skidding = true;
      } else {
        mario.vx += acc;
        if (mario.vx > max) mario.vx = max;
      }
    } else if (mario.onGround) {
      if (mario.vx > 0) mario.vx = Math.max(0, mario.vx - DECEL);
      else if (mario.vx < 0) mario.vx = Math.min(0, mario.vx + DECEL);
    }
  }

  // jump (variable height: releasing the button raises gravity while rising)
  if (input.jumpPressed && mario.onGround && !mario.crouching) {
    mario.vy = -(JUMP_A + JUMP_B * Math.abs(mario.vx));
    if (mario.vy < -JUMP_CAP) mario.vy = -JUMP_CAP;
    mario.onGround = false;
    mario.jumpHeld = true;
    Sfx.jump(mario.big);
  }
  if (!input.jump) mario.jumpHeld = false;
  if (mario.vy < 0) mario.vy += (mario.jumpHeld && input.jump) ? GRAV_HOLD : GRAV_UP;
  else mario.vy += GRAV_DOWN;
  if (mario.vy > MAX_FALL) mario.vy = MAX_FALL;

  // fire!
  if (input.runPressed && mario.fire && !mario.crouching && mario.throwT <= 0) {
    let n = 0;
    for (const e of ents) if (e.kind === 'fireball') n++;
    if (n < 2) {
      ents.push({ kind: 'fireball',
                  x: mario.facing > 0 ? mario.x + mario.w : mario.x - 8,
                  y: mario.y + 4, w: 8, h: 8,
                  vx: 3.4 * mario.facing, vy: 0.6, t: 0 });
      mario.throwT = 12;
      Sfx.fireball();
    }
  }

  // integrate + collide
  moveEntityX(mario);
  moveEntityY(mario);
  if (mario.hitHead) hitBlock(mario.headTx, mario.headTy);
  mario.onGround = mario.landed;
  if (mario.onGround) mario.chain = 0;
  // edge-triggered inputs are consumed each frame: a held button must NOT
  // re-fire the action (a latched jumpPressed caused endless auto-jumping)
  input.jumpPressed = false;
  input.runPressed = false;

  // classic SMB camera rule: Mario can never move past the screen's left edge
  if (mario.x < camX) { mario.x = camX; if (mario.vx < 0) mario.vx = 0; }
  if (mario.x < 0) mario.x = 0;
  if (mario.x > levelWpx - mario.w) mario.x = levelWpx - mario.w;

  // run animation clock
  mario.animT += Math.abs(mario.vx);
  if (mario.onGround && Math.abs(mario.vx) < 0.05) mario.animT = 0;

  // fell into a pit?
  if (mario.y > VH + 4) { killMario(true); return; }

  // reached the flagpole?
  if (mario.x + mario.w >= poleX && mario.x < poleX) startPoleSequence();
}

function updateMarioDie() {
  mario.stateT++;
  if (mario.stateT > 14) mario.vy += 0.25;   // hang, then fall through the world
  mario.y += mario.vy;
  if (mario.y > VH + 48) endLife();
}

/* ---- flagpole end sequence ------------------------------------------------------------- */

function startPoleSequence() {
  const grabY = mario.y;
  const tier = grabY < 64 ? 4000 : grabY < 96 ? 2000 : grabY < 128 ? 800 :
               grabY < 160 ? 400 : 100;
  addScore(tier, poleX - 20, grabY);
  clearTime = time;
  mario.state = 'pole';
  mario.stateT = 0;
  mario.vx = 0; mario.vy = 0;
  mario.x = poleX - mario.w - 1;
  mario.facing = 1;
  Music.stop();                    // BGM cuts out when the pole is grabbed
  Sfx.flagpole();
}

function updateMarioPole() {
  mario.stateT++;
  mario.y += 2.2;                            // slide down the pole
  if (flagY < poleBaseY - 16) flagY += 2.2;  // the flag descends alongside
  if (mario.y + mario.h >= poleBaseY) {
    mario.y = poleBaseY - mario.h;
    mario.state = 'poleHop';
    mario.vy = -2.4;                          // hop off to the right side
    mario.vx = 1.3;
  }
}

function updateMarioPoleHop() {
  mario.vy += 0.25;
  mario.x += mario.vx;
  moveEntityY(mario);
  if (mario.landed) {
    mario.state = 'walkCastle';
    mario.vx = 1.0;
  }
}

function updateMarioWalkCastle() {
  mario.x += mario.vx;                       // auto-walk into the castle door
  mario.animT += 1;
  if (mario.x + mario.w / 2 >= doorX) {
    mario.visible = false;
    mario.state = 'flagRaise';
    mario.stateT = 0;
    castleFlagY = 13 * TILE - 50;            // flag starts at the castle roofline
  }
}

// SMB1 authenticity note: after Mario enters the castle, a small flag is
// raised on the castle's roof pole. (Confirmed SMB1 behavior; the flag pole's
// exact roof position is approximated, and the raise runs before the time
// countdown to match this remake's existing end-sequence order.)
function updateMarioFlagRaise() {
  mario.stateT++;
  castleFlagY -= 0.4;                        // ~22px rise over 60 frames
  if (castleFlagY < 13 * TILE - 72) castleFlagY = 13 * TILE - 72;
  if (mario.stateT >= 60) {
    mario.state = 'timeCount';
    mario.stateT = 0;
  }
}

function updateMarioTimeCount() {
  mario.stateT++;
  if (mario.stateT % 2 === 0) {
    if (time > 0) {
      time--;
      score += 50;                           // 50 pts per remaining time unit
      Sfx.tick();
    } else {
      const d = clearTime % 10;
      fireworksLeft = (d === 1 || d === 3 || d === 6) ? d : 0;
      fwTimer = 0; fwDoneT = -1;
      mario.state = fireworksLeft > 0 ? 'fireworks' : 'clear';
      mario.stateT = 0;
    }
  }
}

function updateMarioFireworks() {
  mario.stateT++;
  if (fireworksLeft > 0 && mario.stateT - fwTimer >= 36) {
    const spots = [ { x: castleX + 12, y: 92 }, { x: castleX + 64, y: 68 },
                    { x: castleX + 30, y: 120 }, { x: castleX - 12, y: 80 },
                    { x: castleX + 48, y: 100 }, { x: castleX + 20, y: 60 } ];
    const s = spots[(fireworksLeft - 1) % spots.length];
    spawnFireworkBurst(s.x, s.y);
    score += 500;                            // 500 per firework
    fireworksLeft--;
    fwTimer = mario.stateT;
    if (fireworksLeft === 0) fwDoneT = mario.stateT;
  }
  if (fireworksLeft === 0 && fwDoneT >= 0 && mario.stateT - fwDoneT > 60) {
    mario.state = 'clear';
    mario.stateT = 0;
    saveHiscore();
  }
}

/* ---- entity updates ---------------------------------------------------------------------- */

function enemyGravity(e) {
  e.vy += 0.3;
  if (e.vy > 4) e.vy = 4;
}

function updateGoomba(e) {
  e.t++;
  if (e.state === 'walk') {
    enemyGravity(e);
    e.vx = e.dir * 0.55;
    moveEntityX(e);
    if (e.hitWall) e.dir = -e.dir;
    moveEntityY(e);
  } else if (e.state === 'squash') {
    if (e.t >= 30) e.remove = true;          // squashed frame lingers 30f
  } else if (e.state === 'flip') {
    e.vy += 0.25;
    e.x += e.vx; e.y += e.vy;
  }
  if (e.y > VH + 48) e.remove = true;
}

function updateKoopa(e) {
  e.t++;
  if (e.state === 'walk') {
    enemyGravity(e);
    e.vx = e.dir * 0.5;
    moveEntityX(e);
    if (e.hitWall) e.dir = -e.dir;
    moveEntityY(e);
  } else if (e.state === 'shell') {
    enemyGravity(e);
    moveEntityX(e);
    moveEntityY(e);
    e.shellT--;
    if (e.shellT <= 0) {                     // wakes up and resumes walking
      e.state = 'walk';
      e.h = 22;
      e.y -= 8;
      e.dir = -1;
    }
  } else if (e.state === 'slide') {
    enemyGravity(e);
    e.vx = e.dir * 5.8;
    moveEntityX(e);
    if (e.hitWall) { e.dir = -e.dir; Sfx.bump(); }   // ricochet
    moveEntityY(e);
    // a sliding shell flips every enemy in its path (chained score)
    for (const o of ents) {
      if (o === e || o.remove) continue;
      if (o.kind !== 'goomba' && o.kind !== 'koopa') continue;
      if (o.state !== 'walk' && o.state !== 'shell') continue;
      if (overlap(e, o)) {
        chainAward(e.kills, o.x, o.y - 6);
        flipKill(o, 0);
        e.kills++;
      }
    }
  } else if (e.state === 'flip') {
    e.vy += 0.25;
    e.x += e.vx; e.y += e.vy;
  }
  if (e.y > VH + 48) e.remove = true;
}

function updateItem(e) {
  e.t++;
  if (e.state === 'rise') {                  // rises out of its block; cannot be
    e.y -= TILE / e.riseDur;                 // collected yet (invulnerable)
    if (e.t >= e.riseDur) {
      e.y = Math.round(e.y);
      e.state = (e.kind === 'flower') ? 'idle' : (e.kind === 'star') ? 'bounce' : 'walk';
    }
    return;
  }
  if (e.state === 'bounce') {                // Starman: fast, high bounces
    enemyGravity(e);
    e.vx = e.dir * 1.1;
    moveEntityX(e);
    if (e.hitWall) e.dir = -e.dir;
    moveEntityY(e);
    if (e.landed) e.vy = -4.2;               // big bounce off the ground
    if (e.y > VH + 32) e.remove = true;      // lost in a pit
    return;
  }
  if (e.state === 'walk') {
    enemyGravity(e);
    e.vx = e.dir * 0.95;
    moveEntityX(e);
    if (e.hitWall) e.dir = -e.dir;
    moveEntityY(e);
    if (e.y > VH + 32) e.remove = true;
  }
}

function updateFireball(e) {
  e.t++;
  e.vy += 0.3;
  if (e.vy > 3.5) e.vy = 3.5;
  moveEntityX(e);
  if (e.hitWall) { e.remove = true; Sfx.bump(); return; }  // explodes on walls
  moveEntityY(e);
  if (e.landed) e.vy = -1.8;                 // bounces along the ground
  // kills enemies on contact (flip-off, 100 pts)
  for (const o of ents) {
    if (o.remove) continue;
    if (o.kind !== 'goomba' && o.kind !== 'koopa') continue;
    if (o.state !== 'walk' && o.state !== 'shell') continue;
    if (overlap(e, o)) {
      flipKill(o, 100);
      e.remove = true;
      return;
    }
  }
  if (e.y > VH + 16 || e.x < camX - 16) e.remove = true;
}

function updateCoinPop(e) {
  e.t++;
  e.y += e.vy;
  e.vy += 0.22;
  if (e.t >= 26) e.remove = true;
}

function updateDebris(e) {
  e.t++;
  e.vy += 0.3;
  e.x += e.vx; e.y += e.vy;
  if (e.y > VH + 16) e.remove = true;
}

function updateEnts() {
  for (const e of ents) {
    if (e.remove) continue;
    if (e.kind === 'goomba') updateGoomba(e);
    else if (e.kind === 'koopa') updateKoopa(e);
    else if (e.kind === 'mushroom' || e.kind === 'flower' || e.kind === 'oneup' || e.kind === 'star') updateItem(e);
    else if (e.kind === 'fireball') updateFireball(e);
    else if (e.kind === 'coinpop') updateCoinPop(e);
    else if (e.kind === 'debris') updateDebris(e);
  }

  // walking enemies bump into each other and turn around
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i];
    if (a.remove || a.state !== 'walk') continue;
    if (a.kind !== 'goomba' && a.kind !== 'koopa') continue;
    for (let j = i + 1; j < ents.length; j++) {
      const b = ents[j];
      if (b.remove || b.state !== 'walk') continue;
      if (b.kind !== 'goomba' && b.kind !== 'koopa') continue;
      if (overlap(a, b)) { a.dir = -a.dir; b.dir = -b.dir; }
    }
  }

  // Mario <-> entities
  if (mario.state === 'play') {
    for (const e of ents) {
      if (e.remove) continue;
      if (e.kind === 'goomba' || e.kind === 'koopa') marioVsEnemy(e);
      else if ((e.kind === 'mushroom' || e.kind === 'flower' || e.kind === 'oneup' || e.kind === 'star') &&
               e.state !== 'rise' && overlap(mario, e)) {
        e.remove = true;
        powerupMario(e.kind);
      }
    }
  }

  ents = ents.filter(e => !e.remove);
}

function bounceMario() {
  mario.vy = input.jump ? -4.2 : -2.8;
  mario.jumpHeld = !!input.jump;
  mario.onGround = false;
}

function marioVsEnemy(e) {
  if (!overlap(mario, e)) return;
  // Starman invincibility: every enemy Mario touches is destroyed on contact
  // (walking, shelled or sliding) with chained scoring 100..8000 then 1UP.
  if (mario.starT > 0) {
    if (e.state === 'walk' || e.state === 'shell' || e.state === 'slide') {
      chainAward(mario.starChain, e.x, e.y - 6);
      flipKill(e, 0);
      mario.starChain++;
      Sfx.stomp();
    }
    return;
  }
  const stomping = mario.vy > 0 && (mario.y + mario.h - e.y) < 10;
  if (e.state === 'walk') {
    if (stomping) {
      if (e.kind === 'goomba') {
        e.state = 'squash'; e.t = 0;
      } else {
        e.state = 'shell';                   // koopa retreats into its shell
        e.shellT = 480;                      // ~8s before it wakes up
        e.kills = 0;
        e.h = 14; e.y += 8; e.vx = 0;
      }
      chainAward(mario.chain, e.x, e.y - 6);
      mario.chain++;
      Sfx.stomp();
      bounceMario();
    } else {
      hurtMario();
    }
  } else if (e.state === 'shell') {
    // stomping or touching a resting shell kicks it in Mario's direction
    e.state = 'slide';
    e.dir = (mario.x + mario.w / 2) < (e.x + e.w / 2) ? 1 : -1;
    e.kills = 0;
    addScore(400, e.x, e.y - 6);
    Sfx.kick();
    if (stomping) bounceMario();
  } else if (e.state === 'slide') {
    if (stomping) {                          // stomp a sliding shell to stop it
      e.state = 'shell';
      e.shellT = 480;
      e.vx = 0;
      addScore(100, e.x, e.y - 6);
      Sfx.stomp();
      bounceMario();
    } else {
      hurtMario();                           // rebounding shells hurt
    }
  }
}

/* ---- misc updates -------------------------------------------------------------------------- */

function updateBumps() {
  for (const b of bumps) b.t++;
  bumps = bumps.filter(b => b.t < 16);
}

function updatePopups() {
  for (const p of popups) { p.t++; p.y -= 0.5; }
  popups = popups.filter(p => p.t < 48);
}

function updateParticles() {
  for (const p of particles) {
    p.t++;
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.02;
  }
  particles = particles.filter(p => p.t < p.life);
}

function updateCamera() {
  // forward-only camera: camX never decreases
  const target = mario.x + mario.w / 2 - 128;
  if (target > camX) camX = Math.min(target, levelWpx - VW);
}

function updateTimer() {
  if (mario.state !== 'play') return;
  timeFrames++;
  if (timeFrames >= 24) {                    // one time unit every 24 frames
    timeFrames = 0;
    if (time > 0) time--;
    if (time === 100) { Sfx.warning(); timeFastT = 150; }   // jingle first, BGM speeds up after
    if (time === 0) killMario(false);
  }
  if (timeFastT > 0 && --timeFastT === 0) Music.setFast(true);
}

/* ---- master update --------------------------------------------------------------------------- */

function update() {
  globalFrame++;
  if (gameState !== 'play' || paused) return;

  if (freezeT > 0) {                         // grow/shrink transformation pause
    freezeT--;
    mario.stateT++;
    if (mario.stateT >= 42) finishTransformation();
    updatePopups();
    return;
  }

  updateBumps();
  spawnEnemiesAhead();
  updateMario();
  updateEnts();
  updatePopups();
  updateParticles();
  updateCamera();
  updateTimer();
}

/* ---- rendering -------------------------------------------------------------------------- */

function pad(n, len) {
  let s = String(Math.max(0, Math.floor(n)));
  while (s.length < len) s = '0' + s;
  return s;
}

function drawDecor(cam) {
  const groundY = 13 * TILE;
  for (const d of LEVEL_1_1.decor) {
    const x = d.x * TILE - cam;
    if (x < -96 || x > VW + 32) continue;
    if (d.t === 'hill') {
      const w = d.s ? 80 : 48, h = d.s ? 48 : 32;
      ctx.fillStyle = '#00A800';
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x + w / 2, groundY - h);
      ctx.lineTo(x + w, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#005800';
      ctx.fillRect(x + w / 2 - 1, groundY - h + 10, 2, 2);
      ctx.fillRect(x + w / 2 - 8, groundY - 14, 2, 2);
      ctx.fillRect(x + w / 2 + 6, groundY - 20, 2, 2);
    } else if (d.t === 'bush') {
      const w = d.s ? 48 : 32;
      ctx.fillStyle = '#00A800';
      ctx.fillRect(x, groundY - 8, w, 8);
      ctx.beginPath();
      ctx.arc(x + 8, groundY - 8, 8, Math.PI, 0);
      ctx.arc(x + w - 8, groundY - 8, 8, Math.PI, 0);
      if (d.s) ctx.arc(x + w / 2, groundY - 12, 10, Math.PI, 0);
      ctx.fill();
    } else if (d.t === 'cloud') {
      const y = d.y * TILE, w = d.s ? 48 : 32;
      ctx.fillStyle = '#FCFCFC';
      ctx.fillRect(x, y + 8, w, 8);
      ctx.beginPath();
      ctx.arc(x + 8, y + 8, 8, Math.PI, 0);
      ctx.arc(x + w - 8, y + 8, 8, Math.PI, 0);
      if (d.s) ctx.arc(x + w / 2, y + 4, 10, Math.PI, 0);
      ctx.fill();
    }
  }
}

function drawCastle(cam) {
  const x = castleX - cam;
  if (x > VW + 96 || x < -96) return;
  const baseY = 13 * TILE;                     // 208
  const BR = '#C84C0C', DK = '#2A0E00';
  ctx.fillStyle = BR;
  ctx.fillRect(x, baseY - 48, 80, 48);         // main body
  ctx.fillRect(x + 28, baseY - 72, 24, 24);    // tower
  // battlements
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + i * 20, baseY - 56, 8, 8);
  ctx.fillRect(x + 28, baseY - 80, 8, 8);
  ctx.fillRect(x + 44, baseY - 80, 8, 8);
  // brick speckles
  ctx.fillStyle = DK;
  ctx.fillRect(x + 8, baseY - 40, 3, 2); ctx.fillRect(x + 56, baseY - 36, 3, 2);
  ctx.fillRect(x + 24, baseY - 20, 3, 2); ctx.fillRect(x + 64, baseY - 16, 3, 2);
  ctx.fillRect(x + 36, baseY - 64, 3, 2);
  // door + windows
  ctx.fillRect(x + 32, baseY - 24, 16, 24);    // door
  ctx.fillRect(x + 12, baseY - 36, 6, 8);      // windows
  ctx.fillRect(x + 62, baseY - 36, 6, 8);
  ctx.fillRect(x + 37, baseY - 68, 6, 8);      // tower window
  // small roof flagpole (the end-of-level flag is raised here, as in SMB1)
  ctx.fillStyle = DK;
  ctx.fillRect(x + 13, baseY - 72, 2, 24);
  if (castleFlagY >= 0) {
    ctx.fillStyle = '#FCFCFC';
    ctx.beginPath();
    ctx.moveTo(x + 15, castleFlagY);
    ctx.lineTo(x + 15, castleFlagY + 8);
    ctx.lineTo(x + 24, castleFlagY + 4);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPole(cam) {
  const x = poleX - cam;
  if (x > VW + 32 || x < -32) return;
  ctx.fillStyle = '#00A800';
  ctx.fillRect(x - 1, poleTopY, 2, poleBaseY - poleTopY);
  ctx.fillStyle = '#005800';
  ctx.fillRect(x + 1, poleTopY, 1, poleBaseY - poleTopY);
  // ball on top
  ctx.fillStyle = '#00A800';
  ctx.fillRect(x - 3, poleTopY - 6, 6, 6);
  ctx.fillStyle = '#80D010';
  ctx.fillRect(x - 2, poleTopY - 5, 2, 2);
  // triangular flag (slides down with Mario)
  ctx.fillStyle = '#00A048';
  ctx.beginPath();
  ctx.moveTo(x - 1, flagY);
  ctx.lineTo(x - 1, flagY + 10);
  ctx.lineTo(x - 13, flagY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FCFCFC';
  ctx.fillRect(x - 7, flagY + 3, 3, 3);
}

function drawTiles(cam) {
  const tx0 = Math.max(0, Math.floor(cam / TILE));
  const tx1 = Math.min(LW - 1, Math.floor((cam + VW) / TILE) + 1);
  const qFrame = Math.floor(globalFrame / 16) % 3;
  for (let ty = 0; ty < LH; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = map[ty][tx];
      if (c === '.' || c === 'H') continue;    // hidden blocks stay invisible
      let img = null;
      if (c === '?' || c === 'M') img = TILE_IMGS['?'].frames[qFrame]; // item blocks look like ? blocks
      else img = TILE_IMGS[c];
      if (!img) continue;
      let off = 0;
      for (const b of bumps) {
        if (b.tx === tx && b.ty === ty) {
          off = -Math.round(4 * Math.sin(Math.PI * b.t / 16));
          break;
        }
      }
      ctx.drawImage(img, tx * TILE - cam, ty * TILE + off);
    }
  }
}

function drawEnt(e, cam) {
  const x = e.x - cam, y = e.y;
  if (x < -32 || x > VW + 32) return;
  switch (e.kind) {
    case 'goomba':
      if (e.state === 'squash') drawSprite(ctx, SPRITES.goomba, 2, x - 1, y - 2);
      else if (e.state === 'flip') drawSprite(ctx, SPRITES.goomba, 0, x - 1, y - 2, false, true);
      else drawSprite(ctx, SPRITES.goomba, Math.floor(e.t / 8) % 2, x - 1, y - 2);
      break;
    case 'koopa':
      if (e.state === 'walk') {
        drawSprite(ctx, SPRITES.koopa, Math.floor(e.t / 8) % 2, x - 2, y - 2, e.dir > 0);
      } else if (e.state === 'flip') {
        drawSprite(ctx, SPRITES.shell, 0, x - 1, y + 6, false, true);
      } else if (e.state === 'slide') {
        drawSprite(ctx, SPRITES.shell, Math.floor(e.t / 4) % 2, x - 1, y - 2,
                   false, Math.floor(e.t / 4) % 2 === 0);
      } else { // shell (with wake-up wiggle in the last ~2s)
        const wake = e.shellT < 120 && Math.floor(e.t / 8) % 2 === 1;
        drawSprite(ctx, SPRITES.shell, wake ? 1 : 0, x - 1, y - 2);
      }
      break;
    case 'mushroom':
      drawSprite(ctx, SPRITES.mushroom, 0, x - 1, y - 2);
      break;
    case 'oneup':
      drawSprite(ctx, SPRITES.oneup, 0, x - 1, y - 2);
      break;
    case 'star':
      drawSprite(ctx, SPRITES.star, Math.floor(globalFrame / 8) % 2, x - 1, y - 2);
      break;
    case 'flower':
      drawSprite(ctx, SPRITES.flower, Math.floor(globalFrame / 8) % 2, x - 1, y - 2);
      break;
    case 'fireball':
      drawSprite(ctx, SPRITES.fireball, Math.floor(e.t / 2) % 4, x, y);
      break;
    case 'coinpop':
      drawSprite(ctx, SPRITES.coin, Math.floor(e.t / 3) % 4, x, y);
      break;
    case 'debris':
      drawSprite(ctx, SPRITES.debris, 0, x, y);
      break;
  }
}

function marioSprite() {
  if (mario.state === 'die') return { spr: SPRITES.marioSmall, frame: 6 };
  if (mario.state === 'grow' || mario.state === 'shrink') {
    // transformation flicker: alternate small / big bodies
    const phase = Math.floor(mario.stateT / 4) % 2;
    const showBig = (mario.state === 'grow') ? phase === 1 : phase === 0;
    if (showBig) return { spr: mario.fire ? SPRITES.marioFire : SPRITES.marioBig, frame: 0 };
    return { spr: SPRITES.marioSmall, frame: 0 };
  }
  const set = mario.big ? (mario.fire ? SPRITES.marioFire : SPRITES.marioBig) : SPRITES.marioSmall;
  let f = 0;
  if (mario.state === 'pole') f = 0;
  else if (mario.state === 'poleHop') f = 5;
  else if (mario.state === 'walkCastle') f = 1 + Math.floor(mario.animT / 8) % 3;
  else {
    if (mario.crouching && mario.big) f = 6;
    else if (!mario.onGround) f = 5;
    else if (mario.skidding) f = 4;
    else if (Math.abs(mario.vx) > 0.05) f = 1 + Math.floor(mario.animT / 8) % 3;
    if (mario.throwT > 0 && mario.big) f = 7;
  }
  if (mario.starT > 0) {
    // Starman rainbow flicker. It slows down for the last ~2s as a warning
    // affordance (approximation: the original signals expiry with the star
    // music ending, which this remake deliberately does not have).
    const rate = mario.starT > 120 ? 4 : 10;
    const sets = mario.big ? SPRITES.marioBigStar : SPRITES.marioSmallStar;
    return { spr: sets[Math.floor(globalFrame / rate) % sets.length], frame: f };
  }
  return { spr: set, frame: f };
}

function drawMario(cam) {
  if (!mario.visible) return;
  if (mario.invulnT > 0 && mario.state === 'play' &&
      Math.floor(globalFrame / 3) % 2 === 0) return;   // invincibility flicker
  const s = marioSprite();
  const dx = mario.x - cam - 2;
  const dy = mario.y - (s.spr.h === 32 ? 6 : 2);
  drawSprite(ctx, s.spr, s.frame, dx, dy, mario.facing < 0);
}

function drawParticles(cam) {
  for (const p of particles) {
    if (p.t > p.life - 15 && p.t % 2 === 0) continue;  // fade out by blinking
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x - cam) - 1, Math.floor(p.y) - 1, 3, 3);
  }
}

function drawPopups(cam) {
  for (const p of popups) {
    if (p.t > 36 && p.t % 2 === 0) continue;           // blink before vanishing
    drawText(ctx, p.text, p.x - cam, p.y, '#FCFCFC');
  }
}

function drawHUD() {
  drawText(ctx, 'MARIO', 24, 8, '#FCFCFC');
  drawText(ctx, pad(score, 6), 24, 16, '#FCFCFC');
  // spinning coin icon + x count
  const cf = Math.floor(globalFrame / 10) % 4;
  ctx.drawImage(SPRITES.coin.frames[cf], 0, 0, 16, 16, 88, 15, 9, 9);
  drawText(ctx, '*' + pad(coins, 2), 100, 16, '#FCFCFC');
  drawText(ctx, 'WORLD', 148, 8, '#FCFCFC');
  drawText(ctx, '1-1', 154, 16, '#FCFCFC');
  drawText(ctx, 'TIME', 206, 8, '#FCFCFC');
  drawText(ctx, pad(time, 3), 210, 16, '#FCFCFC');
}

function centerX(str, scale) { return Math.floor((VW - textWidth(str, scale)) / 2); }

function renderTitle() {
  // ground strip + scenery
  for (let tx = 0; tx < 16; tx++) {
    ctx.drawImage(TILE_IMGS['#'], tx * TILE, 13 * TILE);
    ctx.drawImage(TILE_IMGS['#'], tx * TILE, 14 * TILE);
  }
  drawSprite(ctx, SPRITES.marioSmall, 0, 36, 13 * TILE - 16);
  drawSprite(ctx, SPRITES.goomba, Math.floor(globalFrame / 8) % 2, 210, 13 * TILE - 16, true);

  drawText(ctx, 'SUPER MARIO BROS.', centerX('SUPER MARIO BROS.', 2) + 2, 38, '#7C4000', 2);
  drawText(ctx, 'SUPER MARIO BROS.', centerX('SUPER MARIO BROS.', 2), 36, '#FCFCFC', 2);
  drawText(ctx, 'FAN REMAKE', centerX('FAN REMAKE', 1), 64, '#F8B800', 1);

  drawText(ctx, 'TOP- ' + pad(hiscore, 6), centerX('TOP- ' + pad(hiscore, 6), 1), 92, '#FCFCFC', 1);
  drawText(ctx, '1 PLAYER GAME', centerX('1 PLAYER GAME', 1), 116, '#FCFCFC', 1);
  drawText(ctx, 'ARROWS MOVE  Z/SPACE JUMP', centerX('ARROWS MOVE  Z/SPACE JUMP', 1), 140, '#FCFCFC', 1);
  drawText(ctx, 'X/SHIFT RUN+FIRE', centerX('X/SHIFT RUN+FIRE', 1), 152, '#FCFCFC', 1);
  if (Math.floor(globalFrame / 30) % 2 === 0) {
    drawText(ctx, 'PRESS ENTER', centerX('PRESS ENTER', 1), 172, '#F8B800', 1);
  }
  drawText(ctx, '(C) 2026 FAN REMAKE', centerX('(C) 2026 FAN REMAKE', 1), 196, '#FCFCFC', 1);
  drawText(ctx, 'NOT AFFILIATED WITH NINTENDO', centerX('NOT AFFILIATED WITH NINTENDO', 1), 208, '#FCFCFC', 1);
}

function renderGameOver() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VW, VH);
  drawText(ctx, 'GAME OVER', centerX('GAME OVER', 2), 100, '#FCFCFC', 2);
  if (Math.floor(globalFrame / 30) % 2 === 0) {
    drawText(ctx, 'PRESS ENTER', centerX('PRESS ENTER', 1), 144, '#FCFCFC', 1);
  }
}

function renderClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 48, VW, 96);
  drawText(ctx, 'COURSE CLEAR!', centerX('COURSE CLEAR!', 2), 64, '#FCFCFC', 2);
  drawText(ctx, 'SCORE ' + pad(score, 6), centerX('SCORE ' + pad(score, 6), 1), 96, '#FCFCFC', 1);
  if (Math.floor(globalFrame / 30) % 2 === 0) {
    drawText(ctx, 'PRESS ENTER', centerX('PRESS ENTER', 1), 120, '#F8B800', 1);
  }
}

function render() {
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, VW, VH);

  if (gameState === 'title') { renderTitle(); return; }
  if (gameState === 'gameover') { renderGameOver(); return; }

  const cam = Math.floor(camX);
  drawDecor(cam);
  drawCastle(cam);
  drawPole(cam);
  drawTiles(cam);
  for (const e of ents) drawEnt(e, cam);
  drawMario(cam);
  drawParticles(cam);
  drawPopups(cam);
  drawHUD();

  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 96, VW, 32);
    drawText(ctx, 'PAUSED', centerX('PAUSED', 1), 108, '#FCFCFC', 1);
  }
  if (mario.state === 'clear') renderClear();
}

/* ---- boot + main loop (fixed 60fps timestep) -------------------------------------------- */

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  loadHiscore();
  resetLevel();   // level sits ready behind the title screen

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', function (e) {
      if (HANDLED[e.code] && e.preventDefault) e.preventDefault();
      keyDown(e.code);
    });
    window.addEventListener('keyup', function (e) {
      if (HANDLED[e.code] && e.preventDefault) e.preventDefault();
      keyUp(e.code);
    });
  }

  let last = 0, acc = 0;
  const raf = (typeof requestAnimationFrame !== 'undefined')
    ? requestAnimationFrame
    : function (cb) { return setTimeout(function () { cb(0); }, 16); };
  function frame(ts) {
    raf(frame);
    if (!last) last = ts;
    let dt = ts - last;
    last = ts;
    if (dt > 250) dt = 250;
    acc += dt;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
  }
  raf(frame);
}

/* Public API (also used by the headless smoke test). */
const Game = {
  update: update,
  render: render,
  keyDown: keyDown,
  keyUp: keyUp,
  newGame: newGame,
  getInfo: function () {
    return { gameState: gameState, mario: mario, score: score, coins: coins,
             lives: lives, hiscore: hiscore, time: time, camX: camX, ents: ents.length };
  },
  debug: {
    powerup: function (kind) { powerupMario(kind || 'mushroom'); },
    damage: function () { mario.invulnT = 0; hurtMario(); },
    death: function () { killMario(false); },
    hitBlockAt: function (tx, ty) { hitBlock(tx, ty); },
    star: function () { powerupMario('star'); },
    spawnEnemy: function (kind, tileX, yPx) { spawnEnemy(kind, tileX, yPx); }
  }
};
if (typeof window !== 'undefined') window.Game = Game;

init();
