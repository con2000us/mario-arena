/* ============================================================================
 * levels.js — clean-room World 1-1 data.
 *
 * Geometry is generated from The Video Game Level Corpus processed map:
 * https://github.com/TheVGLC/TheVGLC/blob/master/Super%20Mario%20Bros/Processed/mario-1-1.txt
 *
 * Enemy commands are the decoded E_GroundArea6 bytes documented by the public
 * doppelganger SMB disassembly.  Keeping the command stream matters: six of the
 * entries are group commands, so the stage contains the original 16 Goombas and
 * one green Koopa rather than the 15 markers visible in VGLC.
 *
 * Underground room geometry and its 19 coins were cross-checked against the
 * NESMaps World 1-1 composite map. No ROM, CHR sheet, audio recording, or
 * Nintendo bitmap asset is included in this project.
 * ============================================================================ */

'use strict';

const VGLC_1_1 = [
  '----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------',
  '----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------',
  '----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------',
  '----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------',
  '----------------------------------------------------------------------------------E-----------------------------------------------------------------------------------------------------------------------',
  '----------------------Q---------------------------------------------------------SSSSSSSS---SSSQ--------------?-----------SSS----SQQS--------------------------------------------------------XX------------',
  '-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------XXX------------',
  '-------------------------------------------------------------------------------E----------------------------------------------------------------------------------------------------------XXXX------------',
  '----------------------------------------------------------------S------------------------------------------------------------------------------------------------------------------------XXXXX------------',
  '----------------Q---S?SQS---------------------<>---------<>------------------S?S--------------S-----SS----Q--Q--Q-----S----------SS------X--X----------XX--X------------SSQS------------XXXXXX------------',
  '--------------------------------------<>------[]---------[]-----------------------------------------------------------------------------XX--XX--------XXX--XX--------------------------XXXXXXX------------',
  '----------------------------<>--------[]------[]---------[]----------------------------------------------------------------------------XXX--XXX------XXXX--XXX-----<>--------------<>-XXXXXXXX------------',
  '---------------------E------[]--------[]-E----[]-----E-E-[]------------------------------------E-E--------E-----------------EE-E-E----XXXX--XXXX----XXXXX--XXXX----[]---------EE---[]XXXXXXXXX--------X---',
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX--XXXXXXXXXXXXXXX---XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX--XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
];

function buildOverworldRows() {
  const width = 224;
  const rows = Array.from({ length: 15 }, () => Array(width).fill('.'));
  const convert = function (ch, y) {
    if (ch === 'X') return y === 13 ? '#' : 'X';
    if (ch === 'S') return 'B';
    if (ch === 'Q') return '?';       // coin question block
    if (ch === '?') return 'M';       // power-up question block
    if (ch === '<') return '[';       // vertical pipe top, left
    if (ch === '>') return ']';       // vertical pipe top, right
    if (ch === '[') return '(';       // vertical pipe body, left
    if (ch === ']') return ')';       // vertical pipe body, right
    return '.';                       // empty / enemy marker
  };

  for (let y = 0; y < VGLC_1_1.length; y++) {
    if (VGLC_1_1[y].length !== 202) throw new Error('VGLC row ' + y + ' is not 202 columns');
    for (let x = 0; x < 202; x++) rows[y][x] = convert(VGLC_1_1[y][x], y);
  }

  // The map composite continues through the castle. Fill that tail with ground.
  for (let x = 202; x < width; x++) rows[13][x] = '#';
  // NES playfield has a second ground row. Preserve all three authentic pits.
  for (let x = 0; x < width; x++) rows[14][x] = rows[13][x] === '#' ? '#' : '.';

  // Contents not encoded by VGLC, verified against the disassembly / NES map.
  rows[8][64] = 'H';                  // hidden 1-Up, exact map position
  rows[9][94] = 'C';                 // ten-coin brick
  rows[9][101] = 'T';                // Starman brick

  return rows.map(function (r) { return r.join(''); });
}

/* E_GroundArea6 from the public SMB disassembly. */
const ENEMY_DATA_1_1 = [
  0x1e, 0xc2, 0x00, 0x6b, 0x06, 0x8b, 0x86, 0x63, 0xb7, 0x0f,
  0x05, 0x03, 0x06, 0x23, 0x06, 0x4b, 0xb7, 0xbb, 0x00, 0x5b,
  0xb7, 0xfb, 0x37, 0x3b, 0xb7, 0x0f, 0x0b, 0x1b, 0x37, 0xff
];

function decodeEnemyData(bytes) {
  const out = [];
  let page = 0;
  let i = 0;
  while (i < bytes.length && bytes[i] !== 0xff) {
    const first = bytes[i];
    const second = bytes[i + 1];
    let selected = false;
    if ((second & 0x80) !== 0) {
      page++;
      selected = true;
    }
    const row = first & 0x0f;
    if (row === 0x0e) {               // three-byte area / entrance pointer
      i += 3;
      continue;
    }
    if (row === 0x0f && !selected) {  // explicit page-select command
      page = second & 0x3f;
      i += 2;
      continue;
    }

    const id = second & 0x3f;
    const x = page * 256 + (first & 0xf0);
    if (id >= 0x37 && id < 0x3f) {
      const g = id - 0x37;
      out.push({
        kind: g < 4 ? 'goomba' : 'koopa',
        group: (g & 1) ? 3 : 2,
        triggerX: x,
        y: (g & 2) ? 0x70 : 0xb0
      });
    } else if (id === 0x06 || id === 0x00) {
      out.push({
        kind: id === 0x06 ? 'goomba' : 'koopa',
        group: 1,
        triggerX: x,
        x: x,
        y: row * 16 + 8
      });
    }
    i += 2;
  }
  return out;
}

function buildDecor() {
  const d = [];
  for (let i = 0; i < 5; i++) {
    const b = i * 48;
    // The original scenery tables repeat every three 256-pixel pages (48 tiles).
    d.push({ t: 'hill', x: b,      tiles: 5 });
    d.push({ t: 'hill', x: b + 16, tiles: 3 });
    d.push({ t: 'bush', x: b + 11, tiles: 4 });
    d.push({ t: 'bush', x: b + 23, tiles: 2 });
    d.push({ t: 'bush', x: b + 41, tiles: 3 });
    d.push({ t: 'cloud', x: b + 8,  y: 3, tiles: 2 });
    d.push({ t: 'cloud', x: b + 19, y: 2, tiles: 2 });
    d.push({ t: 'cloud', x: b + 27, y: 3, tiles: 4 });
    d.push({ t: 'cloud', x: b + 36, y: 2, tiles: 3 });
  }
  return d;
}

const LEVEL_1_1 = {
  name: '1-1',
  width: 224,
  height: 15,
  time: 400,
  rows: buildOverworldRows(),
  enemyData: ENEMY_DATA_1_1,
  enemyEvents: decodeEnemyData(ENEMY_DATA_1_1),
  poleCol: 198,
  castleCol: 202,
  entryPipe: { left: 57, right: 58, topRow: 9 },
  returnPipe: { left: 163, right: 164, topRow: 11 },
  decor: buildDecor()
};

function buildBonusRows() {
  const w = 17;
  const r = Array.from({ length: 15 }, () => Array(w).fill('.'));
  for (let y = 2; y <= 12; y++) r[y][0] = 'X';
  for (let x = 4; x <= 10; x++) r[2][x] = 'X';
  for (let x = 5; x <= 9; x++) r[5][x] = 'O';
  for (let x = 4; x <= 10; x++) r[7][x] = 'O';
  for (let x = 4; x <= 10; x++) r[9][x] = 'O';
  for (let y = 10; y <= 12; y++) for (let x = 4; x <= 10; x++) r[y][x] = 'X';
  for (let x = 0; x < w; x++) { r[13][x] = 'X'; r[14][x] = 'X'; }
  // 'P' tiles are solid; the connected horizontal/vertical pipe is drawn as one overlay.
  for (let y = 2; y <= 12; y++) { r[y][15] = 'P'; r[y][16] = 'P'; }
  for (let y = 11; y <= 12; y++) { r[y][13] = 'P'; r[y][14] = 'P'; }
  return r.map(function (row) { return row.join(''); });
}

const BONUS_1_1 = {
  name: 'BONUS',
  width: 17,
  height: 15,
  rows: buildBonusRows(),
  exitPipeCol: 13,
  coinCount: 19
};
