/* ============================================================================
 * sprites.js — hand-authored pixel maps (string arrays + palettes).
 *
 * Every sprite below is an ORIGINAL pixel map drawn by hand for this fan
 * remake. They merely *evoke* the look of SMB (1985); no Nintendo ROM tile
 * data is used anywhere. All sprites are rendered procedurally onto
 * offscreen canvases at load time; the game never loads an image file.
 * ============================================================================ */

'use strict';

/* ---- sprite builder ---------------------------------------------------- */

// Turn one frame (array of equal-length strings) into an offscreen canvas.
function frameToCanvas(rows, palette) {
  const h = rows.length, w = rows[0].length;
  for (let r = 0; r < h; r++) {
    if (rows[r].length !== w) {
      throw new Error('sprite row width mismatch: row ' + r + ' is ' + rows[r].length + ', expected ' + w);
    }
  }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = palette[ch];
      if (!col) throw new Error('no palette entry for "' + ch + '"');
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

// def: { w, h, palette, frames: [ [rows], ... ] } -> { w, h, frames: [canvas] }
function makeSprite(def) {
  const frames = def.frames.map(f => frameToCanvas(f, def.palette));
  return { w: def.w, h: def.h, frames: frames };
}

function concatRows(a, b) { return a.concat(b); }

/* ---- palettes ---------------------------------------------------------- */

const PAL = {
  mario:    { R: '#D82800', S: '#FCA044', H: '#4A2400', O: '#7C4000' },
  fire:     { R: '#FCFCFC', S: '#FCA044', H: '#4A2400', O: '#D82800' },
  goomba:   { G: '#A55400', W: '#FCFCFC', K: '#180800', B: '#402000' },
  koopa:    { K: '#00A048', Y: '#F8C058', W: '#FCFCFC' },
  mushroom: { R: '#D82800', W: '#FCFCFC', S: '#FFE0B0' },
  oneup:    { R: '#00A048', W: '#FCFCFC', S: '#FFE0B0' },
  flowerA:  { P: '#D82800', W: '#FCFCFC', K: '#180800', G: '#00A048' },
  flowerB:  { P: '#F8B800', W: '#FCFCFC', K: '#180800', G: '#00A048' },
  fireball: { O: '#D82800', W: '#FCFCFC', Y: '#F8B800' },
  coin:     { Y: '#F8B800', W: '#FCFCFC' },
  star:     { Y: '#F8B800', W: '#FCFCFC' },
  debris:   { B: '#C84C0C', K: '#180800' }
};

// Palettes cycled while Starman invincibility is active (classic rainbow
// flicker, approximated with four color schemes of the same pixel maps).
const STAR_PALS = [
  { R: '#D82800', S: '#FCA044', H: '#4A2400', O: '#7C4000' },
  { R: '#FCFCFC', S: '#FCA044', H: '#4A2400', O: '#D82800' },
  { R: '#00A800', S: '#FCA044', H: '#4A2400', O: '#F8B800' },
  { R: '#F8B800', S: '#FCA044', H: '#4A2400', O: '#00A800' }
];

/* ---- small Mario (16x16) ----------------------------------------------- */

// Shared head+torso for the small frames; legs differ per pose.
const SM_BODY = [
  "................",
  "....RRRRRR......",
  "...RRRRRRRRR....",
  "...HHHSSHSS.....",
  "..HSHSSSHSSSS...",
  "..HSHHSSSSHHH...",
  "..HHSSSSSSSS....",
  "....SSSSSS......",
  "...RRRORRRR.....",
  "..RRRROORRRR....",
  "..RRRROOOORRR...",
  "..SSRROOOORSS...",
  "..SSOOOOOOOOSS..",
  "..SOOOOOOOOOOS.."
];
const SM_LEGS = {
  stand: ["..OOO....OOO....",
          ".HHHH....HHHH..."],
  run1:  ["..OO......OOO...",
          ".HHH......HHHH.."],
  run2:  ["...OOO..OOO.....",
          "...HHH..HHH....."],
  run3:  ["...OOO......OO..",
          "..HHHH......HHH."],
  jump:  ["..OOOO...OOO....",
          ".HHHHH...HHHH..."],
  skid:  ["....OOOO.OOO....",
          "....HHHH.HHHH..."]
};
const SM_DEATH = [
  "................",
  "....RRRRRR......",
  "...RRRRRRRRR....",
  "...HHSSSSHH.....",
  "..HSHSSSSSSH....",
  "..HSHHSSSSHH....",
  "..HHSSSSSSSS....",
  "....SSSSSS......",
  ".S.RRRORRRR.S...",
  ".SSRRRROORRRRSS.",
  ".SSRRROOOORRRSS.",
  "..SROOOOOOOORS..",
  "..SOOOOOOOOOOS..",
  "..OOOO..OOOO....",
  ".HHHHH..HHHHH...",
  "................"
];

/* ---- big Mario (16x32) -------------------------------------------------- */

// Shared head+torso (top half) for standing/running/skid/jump poses.
const BG_BODY = [
  "................",
  "....RRRRRR......",
  "...RRRRRRRRR....",
  "..RRRRRRRRRRR...",
  "...HHHSSHSS.....",
  "..HSHSSSHSSSS...",
  "..HSHHSSSSHHH...",
  "..HHSSSSSSSSS...",
  "...SSSSSSSSS....",
  "....HHHHHH......",
  ".....SSSS.......",
  "..RRRRRRRRRRR...",
  ".RRRRRROORRRRRR.",
  ".RRRRROOOORRRRR.",
  ".SSRROOOOOORRSS.",
  ".SSROOOOOOOORSS."
];
const BG_LEGS = {
  stand: [
    "..ROOOOOOOOOOR..",
    "..OOOOOOOOOOOO..",
    "..OOOOOOOOOOOO..",
    "..OOOOOOOOOOOO..",
    "..OOOOO..OOOOO..",
    "..OOOO....OOOO..",
    "..OOOO....OOOO..",
    "..OOO......OOO..",
    "..OOO......OOO..",
    "..OOO......OOO..",
    ".HHHH......HHHH.",
    ".HHHH......HHHH.",
    ".HHHHH....HHHHH.",
    ".HHHHH....HHHHH.",
    "HHHHHH....HHHHHH",
    "HHHHHH....HHHHHH"
  ],
  run1: [
    "..ROOOOOOOOOOR..",
    "..OOOOOOOOOOOO..",
    "...OOOOOOOOOO...",
    "...OOOOOOOOO....",
    "...OOOO..OOOO...",
    "...OOO....OOO...",
    "..OOO......OOO..",
    "..OOO.......OO..",
    "..OO........OO..",
    ".HHH.........HH.",
    ".HHH.........HHH",
    ".HHHH........HHH",
    "HHHHH.........HH",
    "HHHHH.........HH",
    "HHHH..........HH",
    "HHHH..........HH"
  ],
  run2: [
    "..ROOOOOOOOOOR..",
    "..OOOOOOOOOOOO..",
    "...OOOOOOOOOO...",
    "....OOOOOOOO....",
    "....OOOOOOO.....",
    "....OOO.OOO.....",
    "....OOO.OOO.....",
    "....OO..OO......",
    "....OO..OO......",
    "....HH..HHH.....",
    "....HH...HH.....",
    "...HHH...HHH....",
    "...HHH....HHH...",
    "...HH.....HH....",
    "..HHH.....HHH...",
    "..HH.......HH..."
  ],
  run3: [
    "..ROOOOOOOOOOR..",
    "..OOOOOOOOOOOO..",
    "...OOOOOOOOOO...",
    "....OOOOOOOOO...",
    "...OOOO..OOOO...",
    "...OOO....OOO...",
    "..OOO......OOO..",
    "..OO.......OOO..",
    "..OO........OO..",
    ".HH.........HHH.",
    "HHH.........HHH.",
    "HHH........HHHH.",
    "HH.........HHHHH",
    "HH.........HHHHH",
    "HH..........HHHH",
    "HH..........HHHH"
  ],
  jump: [
    "..ROOOOOOOOOOR..",
    "..OOOOOOOOOOOO..",
    "..OOOOOOOOOOOO..",
    "...OOOOOOOOO....",
    "...OOOO..OOOO...",
    "..OOOO....OOOO..",
    "..OOO......OOO..",
    "..OOO......OOO..",
    "..OOO......OOO..",
    "..HHH......HHH..",
    ".HHHH......HHHH.",
    ".HHHH......HHHH.",
    ".HHHH.......HHH.",
    "HHHHH.......HHHH",
    "HHHHH........HHH",
    "HHHH.........HHH"
  ],
  skid: [
    "..ROOOOOOOOOOR..",
    "..OOOOOOOOOOOO..",
    "...OOOOOOOOOOO..",
    "...OOOOO..OOOO..",
    "....OOOO...OOO..",
    "....OOO....OOO..",
    "....OOO.....OO..",
    "....OO......OO..",
    "...OOO.......OO.",
    "...HH........HH.",
    "..HHH........HHH",
    "..HHH........HHH",
    ".HHHH.........HH",
    ".HHHH.........HH",
    "HHHHH.........HH",
    "HHHH..........HH"
  ]
};
// Crouch pose: whole body compressed into the lower half.
const BG_CROUCH = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "....RRRRRR......",
  "...RRRRRRRRR....",
  "..RRRRRRRRRRR...",
  "...HHHSSHSS.....",
  "..HSHSSSHSSSS...",
  "..HSHHSSSSHHH...",
  "..HHSSSSSSSSS...",
  "...SSSSSSSSS....",
  "....HHHHHH......",
  "..RRRRRRRRRRR...",
  ".RRRRRROORRRRRR.",
  ".RRRRROOOORRRRR.",
  ".SSRROOOOOORRSS.",
  ".SSROOOOOOOORSS.",
  "..ROOOOOOOOOOR..",
  "..OOOOOOOOOOOO..",
  "...OOOOOOOOOO...",
  "...OOOO..OOOO...",
  "..OOOO....OOOO..",
  "..OOOOOOOOOOOO..",
  ".HHHHHHHHHHHHHH.",
  ".HHHHHHHHHHHHHH.",
  ".HHHHH....HHHHH.",
  "HHHHHH....HHHHHH",
  "HHHHHH....HHHHHH",
  "................"
];
// Fire-throw pose: standing with the throwing arm stretched forward.
const BG_THROW = BG_BODY.slice(0, 12).concat([
  ".RRRRRROORRRRRR.",
  ".RRRRROOOORRRRR.",
  "..SRROOOOOORRRRS",
  "..SROOOOOOOORRS."
]).concat(BG_LEGS.stand);

/* ---- enemies & items ---------------------------------------------------- */

const GOOMBA_BODY = [
  "................",
  "................",
  "................",
  "....GGGGGG......",
  "..GGGGGGGGGG....",
  ".GGGGGGGGGGGG...",
  ".GGWWGGGGWWGG...",
  ".GWWKWGWWKWWG...",
  ".GWWKWGWWKWWG...",
  ".GGGGGGGGGGGG...",
  ".GGKKKKKKKKGG...",
  ".GGGKKKKKKGGG...",
  "..GGGGGGGGGG....",
  "..GGGGGGGGGG...."
];
const GOOMBA_WALK1 = GOOMBA_BODY.concat([
  ".BBBB..GG..BBBB.",
  ".BBBB....BBBB..."
]);
const GOOMBA_WALK2 = GOOMBA_BODY.concat([
  "..BBBB.GG.BBBB..",
  "...BBBB..BBBB..."
]);
const GOOMBA_SQUASH = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "..GGGGGGGGGGGG..",
  ".GGGGGGGGGGGGGG.",
  ".GWKGWWGGWWKWG..",
  ".GGGGGGGGGGGGGG.",
  ".BBBBBBBBBBBBBB.",
  "................"
];

const KOOPA_TOP = [
  "................",
  ".....YYY........",
  "....YYYYYY......",
  "....YWYYYYY.....",
  "....YWYYYYY.....",
  "....YYYYYY......",
  ".....YYYY.......",
  "......YYY.......",
  "...KKKKKKK......",
  "..KKKKKKKKK.....",
  ".KKWKKKKKKWK....",
  ".KKKKKKKKKKK....",
  ".KKKKKKKKKKK....",
  "..KKKKKKKKK.....",
  "..WWWWWWWWW.....",
  "...YYYYYYY......"
];
const KOOPA_WALK1 = KOOPA_TOP.concat([
  "...YY...YY......",
  "..YY.....YY.....",
  "..YY......YY....",
  ".YYY......YYY...",
  ".YY........YY...",
  "YYYY......YYYY..",
  "YYYY......YYYY..",
  "................"
]);
const KOOPA_WALK2 = KOOPA_TOP.concat([
  "...YY...YY......",
  "....YY...YY.....",
  "....YY....YY....",
  "....YYY...YYY...",
  "....YY.....YY...",
  "....YYYY..YYYY..",
  "....YYYY..YYYY..",
  "................"
]);
const KOOPA_SHELL = [
  "................",
  "................",
  "................",
  "....KKKKKK......",
  "..KKKKKKKKKK....",
  "..KWKKKKKKWK....",
  ".KKKKKKKKKKKK...",
  ".KKKWKKKKWKKK...",
  ".KKKKKKKKKKKK...",
  ".KKKKKKKKKKKK...",
  "..KKKKKKKKKK....",
  "..WWWWWWWWWW....",
  "...YYYYYYYY.....",
  "................",
  "................",
  "................"
];
const KOOPA_WAKE = [
  "................",
  "................",
  "................",
  "....KKKKKK......",
  "..KKKKKKKKKK....",
  "..KKKKWWKKKK....",
  ".KKKKKKKKKKKK...",
  ".KKWKKKKKKWK....",
  ".KKKKKKKKKKKK...",
  ".KKKKKKKKKKKK...",
  "..KKKKKKKKKK....",
  "..WWWWWWWWWW....",
  "...YYYYYYYY.....",
  "................",
  "................",
  "................"
];

const MUSHROOM_MAP = [
  "................",
  "....RRRRRR......",
  "..RRRRRRRRRR....",
  ".RRWWRRRRWWRR...",
  ".RWWWWRRWWWWR...",
  "RRRWWRRRRWWRRRR.",
  "RRRRRRRRRRRRRRRR",
  "RWWRRRRRRRRWWRR.",
  ".RRRRRRRRRRRRRR.",
  "..SSSSSSSSSS....",
  "..SSWWSSSSWWSS..",
  "..SSWWSSSSWWSS..",
  "..SSSSSSSSSSSS..",
  "..SSSSSSSSSSSS..",
  "..SSSSSSSSSSSS..",
  "................"
];

const STAR_FRAME1 = [
  "................",
  ".......YY.......",
  ".......YY.......",
  "......YWWY......",
  "..YYYYYYYYYYYY..",
  "...YYYYWWYYYY...",
  "....YYYYYYYY....",
  "....YYYYYYYY....",
  "...YYYYYYYYYY...",
  "...YYYY..YYYY...",
  "..YYYY....YYYY..",
  "..YYY......YYY..",
  ".YYY........YYY.",
  "................",
  "................",
  "................"
];
// twinkle frame: highlights shift (2-frame animation)
const STAR_FRAME2 = [
  "................",
  ".......WW.......",
  ".......YY.......",
  "......YYYY......",
  "..YYYYYYYYYYYY..",
  "...YYYWWYYYYY...",
  "....YYYWYYYY....",
  "....YYYYYYYY....",
  "...YYYYYYYYYY...",
  "...YYYY..YYYY...",
  "..YYYY....YYYY..",
  "..YYY......YYY..",
  ".YYY........YYY.",
  "................",
  "................",
  "................"
];

const FLOWER_MAP = [
  "................",
  "...PPPPPP.......",
  "..PPPPPPPP......",
  "..PPWWWWPPP.....",
  "..PWKWWKWPP.....",
  "..PWWWWWWPP.....",
  "..PPWWWWPPP.....",
  "...PPPPPPP......",
  "....PPPPP.......",
  ".....G.G........",
  ".....G.G........",
  "..G..G.G..G.....",
  "..GG.G.G.GG.....",
  "...GGG.GGG......",
  ".....GGG........",
  "................"
];

const FIREBALL_FRAMES = [
  [ "..OOOO..",
    ".OWWWWO.",
    "OWYWWYWO",
    "OWWWWWWO",
    "OWYWWYWO",
    ".OWWWWO.",
    "..OOOO..",
    "........" ],
  [ "..OOOO..",
    ".OWWWWO.",
    "OWWWWWWO",
    "OYWWWWYO",
    "OWWWWWWO",
    ".OWWWWO.",
    "..OOOO..",
    "........" ],
  [ "..OOOO..",
    ".OWWWWO.",
    "OWWWWWWO",
    "OWWYYWWO",
    "OWWWWWWO",
    ".OWWWWO.",
    "..OOOO..",
    "........" ],
  [ "..OOOO..",
    ".OWWWWO.",
    "OWWWWWWO",
    "OYWWWWYO",
    "OWWWWWWO",
    ".OWWWWO.",
    "..OOOO..",
    "........" ]
];

const COIN_FRAMES = [
  [ "................",
    "................",
    "................",
    "...YYYYYYYYYY...",
    "..YYYYYYYYYYYY..",
    "..YYWWYYYYYYYY..",
    "..YYWYYYYYYYYY..",
    "..YYWYYYYYYYYY..",
    "..YYWYYYYYYYYY..",
    "..YYWYYYYYYYYY..",
    "..YYWWYYYYYYYY..",
    "..YYYYYYYYYYYY..",
    "...YYYYYYYYYY...",
    "................",
    "................",
    "................" ],
  [ "................",
    "................",
    "................",
    "....YYYYYYYY....",
    "....YYWWYYYY....",
    "....YYWYYYYY....",
    "....YYWYYYYY....",
    "....YYWYYYYY....",
    "....YYWYYYYY....",
    "....YYWYYYYY....",
    "....YYWWYYYY....",
    "....YYYYYYYY....",
    "....YYYYYYYY....",
    "................",
    "................",
    "................" ],
  [ "................",
    "................",
    "................",
    "......YYYY......",
    "......YWYY......",
    "......YYYY......",
    "......YYYY......",
    "......YYYY......",
    "......YYYY......",
    "......YYYY......",
    "......YWYY......",
    "......YYYY......",
    "......YYYY......",
    "................",
    "................",
    "................" ],
  [ "................",
    "................",
    "................",
    "....YYYYYYYY....",
    "....YYYYWWYY....",
    "....YYYYYWYY....",
    "....YYYYYWYY....",
    "....YYYYYWYY....",
    "....YYYYYWYY....",
    "....YYYYYWYY....",
    "....YYYYWWYY....",
    "....YYYYYYYY....",
    "....YYYYYYYY....",
    "................",
    "................",
    "................" ]
];

const DEBRIS_MAP = [
  "BBBBBBBB",
  "BKBBBBKB",
  "BBBBBBBB",
  "BBBKBBBB",
  "BBBBBBBB",
  "BKBBBBKB",
  "BBBBBBBB",
  "........"
];

/* ---- sprite registry ----------------------------------------------------- */

function buildSprites() {
  const S = {};
  const smallFrames = [
    concatRows(SM_BODY, SM_LEGS.stand),
    concatRows(SM_BODY, SM_LEGS.run1),
    concatRows(SM_BODY, SM_LEGS.run2),
    concatRows(SM_BODY, SM_LEGS.run3),
    concatRows(SM_BODY, SM_LEGS.skid),
    concatRows(SM_BODY, SM_LEGS.jump),
    SM_DEATH
  ];
  const bigFrames = [
    concatRows(BG_BODY, BG_LEGS.stand),
    concatRows(BG_BODY, BG_LEGS.run1),
    concatRows(BG_BODY, BG_LEGS.run2),
    concatRows(BG_BODY, BG_LEGS.run3),
    concatRows(BG_BODY, BG_LEGS.skid),
    concatRows(BG_BODY, BG_LEGS.jump),
    BG_CROUCH,
    BG_THROW
  ];
  S.marioSmall = makeSprite({ w: 16, h: 16, palette: PAL.mario, frames: smallFrames });
  S.marioBig  = makeSprite({ w: 16, h: 32, palette: PAL.mario, frames: bigFrames });
  S.marioFire = makeSprite({ w: 16, h: 32, palette: PAL.fire,  frames: bigFrames });
  // Starman flicker: the same Mario pixel maps in four cycling palettes
  S.marioSmallStar = STAR_PALS.map(p => makeSprite({ w: 16, h: 16, palette: p, frames: smallFrames }));
  S.marioBigStar   = STAR_PALS.map(p => makeSprite({ w: 16, h: 32, palette: p, frames: bigFrames }));
  S.goomba = makeSprite({ w: 16, h: 16, palette: PAL.goomba, frames: [GOOMBA_WALK1, GOOMBA_WALK2, GOOMBA_SQUASH] });
  S.koopa  = makeSprite({ w: 16, h: 24, palette: PAL.koopa,  frames: [KOOPA_WALK1, KOOPA_WALK2] });
  S.shell  = makeSprite({ w: 16, h: 16, palette: PAL.koopa,  frames: [KOOPA_SHELL, KOOPA_WAKE] });
  S.mushroom = makeSprite({ w: 16, h: 16, palette: PAL.mushroom, frames: [MUSHROOM_MAP] });
  S.oneup    = makeSprite({ w: 16, h: 16, palette: PAL.oneup,    frames: [MUSHROOM_MAP] });
  S.star     = makeSprite({ w: 16, h: 16, palette: PAL.star, frames: [STAR_FRAME1, STAR_FRAME2] });
  S.flower = makeSprite({ w: 16, h: 16, palette: PAL.flowerA, frames: [FLOWER_MAP] });
  S.flower.frames.push(frameToCanvas(FLOWER_MAP, PAL.flowerB));
  S.fireball = makeSprite({ w: 8, h: 8, palette: PAL.fireball, frames: FIREBALL_FRAMES });
  S.coin = makeSprite({ w: 16, h: 16, palette: PAL.coin, frames: COIN_FRAMES });
  S.debris = makeSprite({ w: 8, h: 8, palette: PAL.debris, frames: [DEBRIS_MAP] });
  return S;
}

const SPRITES = buildSprites();

/* ---- tile images (procedurally drawn, no bitmap data) -------------------- */

function tileCanvas(fn) {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 16;
  fn(cv.getContext('2d'));
  return cv;
}

function buildTiles() {
  const T = {};
  const ORANGE = '#C84C0C', DARK = '#2A0E00', MID = '#7C2A00', LIGHT = '#F0A44C';

  T['#'] = tileCanvas(g => {                       // ground block
    g.fillStyle = ORANGE; g.fillRect(0, 0, 16, 16);
    g.fillStyle = LIGHT;  g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
    g.fillStyle = MID;
    g.fillRect(4, 4, 2, 2); g.fillRect(11, 3, 2, 2); g.fillRect(7, 9, 2, 2);
    g.fillRect(2, 12, 2, 2); g.fillRect(12, 12, 2, 2); g.fillRect(8, 14, 2, 2);
  });

  T['X'] = tileCanvas(g => {                       // hard block (stairs, pole base)
    g.fillStyle = DARK;   g.fillRect(0, 0, 16, 16);
    g.fillStyle = ORANGE; g.fillRect(1, 1, 14, 14);
    g.fillStyle = LIGHT;  g.fillRect(2, 2, 12, 2);
    g.fillStyle = MID;    g.fillRect(2, 12, 12, 2);
  });

  function brick(g) {                              // brick block
    g.fillStyle = ORANGE; g.fillRect(0, 0, 16, 16);
    g.fillStyle = LIGHT;  g.fillRect(0, 0, 16, 1);
    g.fillStyle = DARK;
    g.fillRect(0, 3, 16, 1); g.fillRect(0, 7, 16, 1); g.fillRect(0, 11, 16, 1);
    g.fillRect(7, 0, 1, 3); g.fillRect(3, 4, 1, 3); g.fillRect(11, 4, 1, 3);
    g.fillRect(7, 8, 1, 3); g.fillRect(3, 12, 1, 4); g.fillRect(11, 12, 1, 4);
  }
  T['B'] = tileCanvas(brick);
  T['C'] = T['B'];                                 // multi-coin brick looks identical
  T['T'] = T['B'];                                 // Starman brick looks identical

  function question(base, qcol) {                  // ? block (3 shimmer frames)
    return tileCanvas(g => {
      g.fillStyle = base; g.fillRect(0, 0, 16, 16);
      g.fillStyle = DARK; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
      g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
      g.fillRect(2, 2, 2, 2); g.fillRect(12, 2, 2, 2);
      g.fillRect(2, 12, 2, 2); g.fillRect(12, 12, 2, 2);
      g.fillStyle = qcol;
      const q = ["01110", "10001", "00001", "00110", "00100", "00000", "00100"];
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 5; x++)
          if (q[y][x] === '1') g.fillRect(5 + x, 4 + y, 1, 1);
    });
  }
  T['?'] = { frames: [question('#FC9838', '#7C4000'),
                      question('#FFD85C', '#7C4000'),
                      question('#FC9838', '#7C4000')] };

  T['U'] = tileCanvas(g => {                       // used block
    g.fillStyle = '#9C4A00'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = DARK; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1);
    g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    g.fillRect(3, 3, 2, 2); g.fillRect(11, 3, 2, 2);
    g.fillRect(3, 11, 2, 2); g.fillRect(11, 11, 2, 2);
  });

  const PIPE = '#00A800', PIPE_D = '#005800', PIPE_L = '#80D010';
  T['['] = tileCanvas(g => {                       // pipe top left
    g.fillStyle = PIPE; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PIPE_D; g.fillRect(0, 0, 16, 2); g.fillRect(14, 2, 2, 14);
    g.fillStyle = PIPE_L; g.fillRect(0, 2, 16, 2); g.fillRect(2, 4, 3, 12);
  });
  T[']'] = tileCanvas(g => {                       // pipe top right
    g.fillStyle = PIPE; g.fillRect(0, 0, 16, 16);
    g.fillStyle = PIPE_D; g.fillRect(0, 0, 16, 2); g.fillRect(0, 2, 2, 14);
    g.fillStyle = PIPE_L; g.fillRect(0, 2, 16, 2); g.fillRect(4, 4, 3, 12);
  });
  T['('] = tileCanvas(g => {                       // pipe body left
    g.fillStyle = PIPE; g.fillRect(2, 0, 14, 16);
    g.fillStyle = PIPE_D; g.fillRect(14, 0, 2, 16);
    g.fillStyle = PIPE_L; g.fillRect(4, 0, 3, 16);
  });
  T[')'] = tileCanvas(g => {                       // pipe body right
    g.fillStyle = PIPE; g.fillRect(0, 0, 14, 16);
    g.fillStyle = PIPE_D; g.fillRect(0, 0, 2, 16);
    g.fillStyle = PIPE_L; g.fillRect(4, 0, 3, 16);
  });

  return T;
}

const TILE_IMGS = buildTiles();

/* ---- 5x7 bitmap font + text drawing --------------------------------------- */

// Glyphs as 7 rows of 5 bits ('1' = filled). Characters needed by the game.
const FONT = {
  'A': ["01110","10001","10001","11111","10001","10001","10001"],
  'B': ["11110","10001","10001","11110","10001","10001","11110"],
  'C': ["01110","10001","10000","10000","10000","10001","01110"],
  'D': ["11110","10001","10001","10001","10001","10001","11110"],
  'E': ["11111","10000","10000","11110","10000","10000","11111"],
  'F': ["11111","10000","10000","11110","10000","10000","10000"],
  'G': ["01110","10001","10000","10111","10001","10001","01111"],
  'H': ["10001","10001","10001","11111","10001","10001","10001"],
  'I': ["01110","00100","00100","00100","00100","00100","01110"],
  'J': ["00111","00010","00010","00010","00010","10010","01100"],
  'K': ["10001","10010","10100","11000","10100","10010","10001"],
  'L': ["10000","10000","10000","10000","10000","10000","11111"],
  'M': ["10001","11011","10101","10101","10001","10001","10001"],
  'N': ["10001","11001","10101","10011","10001","10001","10001"],
  'O': ["01110","10001","10001","10001","10001","10001","01110"],
  'P': ["11110","10001","10001","11110","10000","10000","10000"],
  'Q': ["01110","10001","10001","10001","10101","10010","01101"],
  'R': ["11110","10001","10001","11110","10100","10010","10001"],
  'S': ["01111","10000","10000","01110","00001","00001","11110"],
  'T': ["11111","00100","00100","00100","00100","00100","00100"],
  'U': ["10001","10001","10001","10001","10001","10001","01110"],
  'V': ["10001","10001","10001","10001","10001","01010","00100"],
  'W': ["10001","10001","10001","10101","10101","10101","01010"],
  'X': ["10001","10001","01010","00100","01010","10001","10001"],
  'Y': ["10001","10001","01010","00100","00100","00100","00100"],
  'Z': ["11111","00001","00010","00100","01000","10000","11111"],
  '0': ["01110","10001","10011","10101","11001","10001","01110"],
  '1': ["00100","01100","00100","00100","00100","00100","01110"],
  '2': ["01110","10001","00001","00110","01000","10000","11111"],
  '3': ["11111","00001","00001","01110","00001","10001","01110"],
  '4': ["00010","00110","01010","10010","11111","00010","00010"],
  '5': ["11111","10000","11110","00001","00001","10001","01110"],
  '6': ["01110","10000","10000","11110","10001","10001","01110"],
  '7': ["11111","00001","00010","00100","01000","01000","01000"],
  '8': ["01110","10001","10001","01110","10001","10001","01110"],
  '9': ["01110","10001","10001","01111","00001","00001","01110"],
  ' ': ["00000","00000","00000","00000","00000","00000","00000"],
  '-': ["00000","00000","00000","11111","00000","00000","00000"],
  '!': ["00100","00100","00100","00100","00100","00000","00100"],
  '.': ["00000","00000","00000","00000","00000","00110","00110"],
  '(': ["00010","00100","01000","01000","01000","00100","00010"],
  ')': ["01000","00100","00010","00010","00010","00100","01000"],
  '/': ["00001","00010","00010","00100","01000","01000","10000"],
  ':': ["00000","00110","00110","00000","00110","00110","00000"],
  '*': ["00000","10001","01010","00100","01010","10001","00000"], // used as "x" multiplier sign
  '?': ["01110","10001","00001","00110","00100","00000","00100"]
};

function drawText(ctx, str, x, y, color, scale) {
  scale = scale || 1;
  ctx.fillStyle = color;
  let cx = Math.floor(x);
  const cy = Math.floor(y);
  str = String(str).toUpperCase();
  for (let i = 0; i < str.length; i++) {
    const gl = FONT[str[i]];
    if (gl) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (gl[r][c] === '1') ctx.fillRect(cx + c * scale, cy + r * scale, scale, scale);
        }
      }
    }
    cx += 6 * scale;
  }
}

function textWidth(str, scale) {
  scale = scale || 1;
  return String(str).length * 6 * scale - scale;
}

/* ---- sprite drawing helper ------------------------------------------------- */

function drawSprite(ctx, spr, frame, x, y, flipH, flipV) {
  const img = spr.frames[frame % spr.frames.length];
  x = Math.floor(x); y = Math.floor(y);
  if (!flipH && !flipV) { ctx.drawImage(img, x, y); return; }
  ctx.save();
  ctx.translate(x + (flipH ? spr.w : 0), y + (flipV ? spr.h : 0));
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
