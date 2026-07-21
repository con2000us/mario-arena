/* ============================================================================
 * levels.js — World 1-1 level data (ASCII tile map + entity spawns + scenery)
 *
 * Tile-layout facts (pipe heights/positions, block rows, pits, staircases,
 * enemy spots) are reconstructed from:
 *   - The Video Game Level Corpus (VGLC), "Super Mario Bros/Processed/mario-1-1.txt"
 *     https://github.com/TheVGLC/TheVGLC/blob/master/Super%20Mario%20Bros/Processed/mario-1-1.txt
 *   - Super Mario Wiki, "World 1-1 (Super Mario Bros.)" — used to resolve block
 *     CONTENTS (the VGLC only marks block types): the wiki documents exactly
 *     3 item blocks (Mushroom/Fire Flower), coin blocks, a ten-coin brick, a
 *     Starman brick, and the hidden 1-Up "between the fourth pipe and the
 *     first pit".  https://www.mariowiki.com/World_1-1_(Super_Mario_Bros.)
 *   - Hidden 1-Up presence rules: https://www.stephenlindholm.com/super_mario_1-up.html
 *     (on a fresh game the 1-1 hidden 1-Up is always present).
 *
 * LEGEND (one char = one 16x16 tile):
 *   '.' empty          '#' ground          'X' hard block (stairs, pole base)
 *   'B' brick          'C' multi-coin brick (10 coins, then becomes used)
 *   '?' coin block     'M' item block (Mushroom if small / Fire Flower if big)
 *   'T' Starman brick (looks like a brick; releases a Starman when bumped)
 *   'H' hidden 1-Up block (invisible + intangible until bumped from below)
 *   'U' used block (only created at runtime)
 *   '[',']' pipe top L/R   '(',')' pipe body L/R
 *
 * The map is 212 x 15 tiles. The VGLC source has a single ground row; a second
 * ground row was added underneath (rows 13-14) to fill the 240px NES height,
 * so every non-ground tile keeps its authentic row/column.
 *
 * KNOWN APPROXIMATIONS vs. the original:
 *   - Brick at (101,9) is the authentic Starman brick (per the mariowiki
 *     reference above) and is implemented as such.
 *   - The hidden 1-Up's exact column is not given by the references; it is
 *     placed at column 62, between pipe 4 (cols 57-58) and the first pit
 *     (cols 69-70), per the documented region.
 *   - Real 1-1 has 16 goombas + 1 koopa; the VGLC map marks 15 enemy spots
 *     (used verbatim below, with the koopa at col 106 per the wiki's prose).
 *   - The real brick at (94,9) is a ten-coin block; implemented as such.
 *   - Scenery (hills/clouds/bushes) is NOT in the reference data; placements
 *     below imitate SMB's periodic decoration pattern and are approximate.
 *   - The VGLC map ends at column 201; ground is extended to column 211 so
 *     the flagpole (col 198, base block from the reference) and the end
 *     castle have room, matching the original's proportions.
 * ============================================================================ */

const LEVEL_1_1 = {
  name: '1-1',
  width: 212,
  height: 15,
  time: 400,
  rows: [
  "....................................................................................................................................................................................................................",
  "....................................................................................................................................................................................................................",
  "....................................................................................................................................................................................................................",
  "....................................................................................................................................................................................................................",
  "....................................................................................................................................................................................................................",
  "......................?.........................................................BBBBBBBB...BBB?..............M...........BBB....B??B........................................................XX......................",
  "...........................................................................................................................................................................................XXX......................",
  "..........................................................................................................................................................................................XXXX......................",
  "................................................................B........................................................................................................................XXXXX......................",
  "................?...BMB?B.....................[].........[]...H..............BMB..............C.....BT....?..?..?.....B..........BB......X..X..........XX..X............BB?B............XXXXXX......................",
  "......................................[]......().........().............................................................................XX..XX........XXX..XX..........................XXXXXXX......................",
  "............................[]........()......().........()............................................................................XXX..XXX......XXXX..XXX.....[]..............[].XXXXXXXX......................",
  "............................()........()......().........()...........................................................................XXXX..XXXX....XXXXX..XXXX....()..............()XXXXXXXXX........X.............",
  "#####################################################################..###############...################################################################..#########################################################",
  "#####################################################################..###############...################################################################..#########################################################"
  ],

  /* Enemy spawns (tile x; y = pixels, omit to spawn on the ground).
   * Positions are the VGLC 'E' markers; vertical markers at cols 79/82 sit on
   * top of the brick rows (goombas that famously drop down from the blocks). */
  spawns: [
    { t: 'goomba', x: 21 },
    { t: 'goomba', x: 41 },
    { t: 'goomba', x: 53 },
    { t: 'goomba', x: 55 },
    { t: 'goomba', x: 79, y: 128 }, // on top of the 77-79 brick row
    { t: 'goomba', x: 82, y: 64 },  // on top of the high brick row (cols 80-87)
    { t: 'goomba', x: 95 },
    { t: 'goomba', x: 97 },
    { t: 'koopa',  x: 106 },
    { t: 'goomba', x: 124 },
    { t: 'goomba', x: 125 },
    { t: 'goomba', x: 127 },
    { t: 'goomba', x: 129 },
    { t: 'goomba', x: 174 },
    { t: 'goomba', x: 175 }
  ],

  /* Flagpole column (its base hard-block comes from the reference map) and
   * the left column of the end castle (5 tiles wide, door in the middle). */
  poleCol: 198,
  castleCol: 203,

  /* Approximate SMB-style scenery: repeating hills / bushes / clouds. */
  decor: (function () {
    const d = [];
    for (let i = 0; i < 5; i++) {
      const b = i * 48;
      d.push({ t: 'hill',  x: b + 0,  s: 1 });
      d.push({ t: 'hill',  x: b + 16, s: 0 });
      d.push({ t: 'bush',  x: b + 11, s: 1 });
      d.push({ t: 'bush',  x: b + 23, s: 0 });
      d.push({ t: 'bush',  x: b + 41, s: 0 });
      d.push({ t: 'cloud', x: b + 8,  y: 2, s: 0 });
      d.push({ t: 'cloud', x: b + 19, y: 3, s: 1 });
      d.push({ t: 'cloud', x: b + 27, y: 2, s: 1 });
      d.push({ t: 'cloud', x: b + 36, y: 3, s: 0 });
    }
    return d;
  })()
};
