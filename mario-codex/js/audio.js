/* ============================================================================
 * audio.js — WebAudio sound effects + background music.
 *
 * Every cue below is an ORIGINAL short composition (square/triangle/noise
 * synth lines written for this remake), and the background music in the
 * Music module at the bottom is likewise an ORIGINAL chiptune written for
 * this project: Koji Kondo's SMB melodies are copyrighted, so nothing here
 * quotes them. Even the "powerup" and "death" cues are fresh phrases that
 * only fill the same functional slot.
 * ============================================================================ */

'use strict';

const Sfx = (function () {
  let ctx = null;
  let master = null;
  let muted = false;

  // Lazily create the AudioContext (must happen after a user gesture).
  function ensure() {
    if (ctx) return true;
    try {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  // Called from input handlers so browsers with autoplay policies unlock audio.
  function unlock() {
    if (ensure() && ctx.state === 'suspended' && ctx.resume) ctx.resume();
  }

  // One oscillator blip/sweep. o: {type, f0, f1, dur, vol, t}
  function tone(o) {
    if (muted || !ensure()) return;
    try {
      const t0 = ctx.currentTime + (o.t || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(Math.max(1, o.f0), t0);
      if (o.f1 && o.f1 !== o.f0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
      }
      const v = o.vol || 0.2;
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + o.dur + 0.03);
    } catch (e) { /* audio must never crash the game */ }
  }

  // White-noise burst. o: {dur, vol, t, filter}
  function noise(o) {
    if (muted || !ensure()) return;
    try {
      const t0 = ctx.currentTime + (o.t || 0);
      const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(o.vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + o.dur);
      if (o.filter && ctx.createBiquadFilter) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.filter;
        src.connect(f); f.connect(g);
      } else {
        src.connect(g);
      }
      g.connect(master);
      src.start(t0); src.stop(t0 + o.dur + 0.03);
    } catch (e) { /* ignore */ }
  }

  return {
    unlock: unlock,

    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },

    // shared-bus accessors for the Music module (this file only)
    _ensure: ensure,
    _ctx() { return ctx; },
    _master() { return master; },

    jump(big) {
      // rising sweep; big Mario jumps a fifth lower
      tone({ f0: big ? 200 : 320, f1: big ? 760 : 940, dur: 0.18, vol: 0.22 });
    },
    coin() {
      // two-tone ping
      tone({ f0: 990, dur: 0.06, vol: 0.22 });
      tone({ f0: 1320, dur: 0.28, vol: 0.22, t: 0.06 });
    },
    stomp() {
      noise({ dur: 0.14, vol: 0.3, filter: 900 });
      tone({ f0: 240, f1: 90, dur: 0.1, vol: 0.18 });
    },
    bump() {
      tone({ f0: 130, f1: 70, dur: 0.09, vol: 0.3, type: 'triangle' });
      noise({ dur: 0.05, vol: 0.12, filter: 500 });
    },
    brick() {
      noise({ dur: 0.22, vol: 0.32, filter: 1600 });
    },
    sprout() {
      tone({ f0: 180, f1: 1200, dur: 0.5, vol: 0.18, type: 'triangle' });
    },
    powerup() {
      // original ascending arpeggio (A minor-ish, 6 notes)
      const seq = [440, 554, 659, 880, 1108, 1318];
      for (let i = 0; i < seq.length; i++) {
        tone({ f0: seq[i], dur: 0.09, vol: 0.2, t: i * 0.07 });
      }
    },
    shrink() {
      tone({ f0: 900, f1: 160, dur: 0.35, vol: 0.22 });
    },
    fireball() {
      tone({ f0: 880, f1: 220, dur: 0.12, vol: 0.22 });
    },
    kick() {
      tone({ f0: 620, f1: 340, dur: 0.05, vol: 0.25 });
      noise({ dur: 0.04, vol: 0.15, filter: 2400 });
    },
    oneup() {
      // longer original ascending arpeggio
      const seq = [523, 659, 784, 1046, 1318, 1568, 2093];
      for (let i = 0; i < seq.length; i++) {
        tone({ f0: seq[i], dur: 0.12, vol: 0.2, t: i * 0.09 });
      }
    },
    star() {
      // original "star get" cue: quick bright ascending figure (triangle wave
      // to set it apart from the square powerup arpeggio). The invincibility
      // loop that follows lives in Music (song 'star'), also original.
      const seq = [660, 880, 1108, 1318, 1760];
      for (let i = 0; i < seq.length; i++) {
        tone({ f0: seq[i], dur: 0.09, vol: 0.2, t: i * 0.055, type: 'triangle' });
      }
    },
    pipe() {
      // Short descending square-wave sweep for pipe travel.
      tone({ f0: 760, f1: 95, dur: 0.34, vol: 0.22, type: 'square' });
    },
    flagpole() {
      tone({ f0: 1400, f1: 300, dur: 0.9, vol: 0.2, type: 'triangle' });
    },
    warning() {
      for (let i = 0; i < 3; i++) tone({ f0: 880, dur: 0.12, vol: 0.25, t: i * 0.22 });
    },
    die() {
      // short original descending phrase (NOT the SMB melody)
      const seq = [660, 520, 392, 330, 262];
      for (let i = 0; i < seq.length; i++) {
        tone({ f0: seq[i], dur: 0.16, vol: 0.22, t: i * 0.13, type: i < 2 ? 'square' : 'triangle' });
      }
    },
    firework() {
      noise({ dur: 0.3, vol: 0.35, filter: 1000 });
      tone({ f0: 120, f1: 40, dur: 0.25, vol: 0.2, type: 'triangle' });
    },
    tick() {
      tone({ f0: 1500, dur: 0.03, vol: 0.12 });
    },
    pause() {
      tone({ f0: 700, dur: 0.05, vol: 0.2 });
      tone({ f0: 700, dur: 0.05, vol: 0.2, t: 0.09 });
    }
  };
})();

/* ============================================================================
 * Music — original chiptune BGM, composed for this remake.
 *
 * Both loops ('main' overworld loop and 'star' invincibility loop) were
 * written fresh for this project. They deliberately do NOT quote Koji
 * Kondo's SMB melodies, which are copyrighted: different melodic contour,
 * rhythm and phrase structure — just the same chiptune instrumentation
 * (square lead, triangle bass, noise hat) and a cheerful major-key mood.
 *
 * Playback is a lookahead scheduler on top of the Sfx audio bus: every
 * 50 ms all notes falling inside a 0.2 s horizon are scheduled at their
 * exact AudioContext timestamps, which keeps the loop steady even if the
 * game frame rate hiccups.
 * ============================================================================ */

const Music = (function () {
  /* ---- song data: rows of [beatInLoop, durBeats, midiNote] ------------------ */

  // 'main' — original 8-bar loop in C major, 32 beats. Bouncy lead over an
  // oom-pah bass (I–IV–I–V–I–IV–V–I).
  const MAIN_LEAD = [
    [0, .5, 72], [.5, .5, 76], [1, .5, 79], [1.5, .5, 76], [2, 1, 81], [3, .5, 79], [3.5, .5, 76],
    [4, .5, 77], [4.5, .5, 81], [5, .5, 84], [5.5, .5, 81], [6, 1, 79], [7, .5, 77], [7.5, .5, 74],
    [8, .5, 76], [8.5, .5, 79], [9, 1, 84], [10, .5, 79], [10.5, .5, 76], [11, .5, 74], [11.5, .5, 72],
    [12, .5, 74], [12.5, .5, 77], [13, .5, 83], [13.5, .5, 79], [14, 1.5, 74], [15.5, .5, 67],
    [16, .5, 72], [16.5, .5, 76], [17, .5, 79], [17.5, .5, 76], [18, 1.5, 81], [19.5, .5, 84],
    [20, .5, 84], [20.5, .5, 81], [21, .5, 77], [21.5, .5, 81], [22, 1, 79], [23, 1, 76],
    [24, .5, 74], [24.5, .5, 77], [25, .5, 79], [25.5, .5, 83], [26, .5, 81], [26.5, .5, 79], [27, .5, 77], [27.5, .5, 74],
    [28, 1, 72], [29, .5, 76], [29.5, .5, 79], [30, 1, 76], [31, 1, 72]
  ];
  function bassBar(beat0, root, fifth, third) {
    const seq = [root, fifth, third, fifth, root, fifth, third, fifth], out = [];
    for (let i = 0; i < 8; i++) out.push([beat0 + i * 0.5, 0.5, seq[i]]);
    return out;
  }
  const MAIN_BASS = [].concat(
    bassBar(0, 48, 43, 40), bassBar(4, 41, 48, 45),
    bassBar(8, 48, 43, 40), bassBar(12, 43, 50, 47),
    bassBar(16, 48, 43, 40), bassBar(20, 41, 48, 45),
    bassBar(24, 43, 50, 47), bassBar(28, 48, 43, 40)
  );

  // 'star' — original 2-bar frantic loop, 8 beats: rapid eighth-note
  // alternation high up, running bass underneath.
  const STAR_LEAD = [
    [0, .5, 84], [.5, .5, 79], [1, .5, 84], [1.5, .5, 79],
    [2, .5, 81], [2.5, .5, 76], [3, .5, 81], [3.5, .5, 76],
    [4, .5, 83], [4.5, .5, 79], [5, .5, 83], [5.5, .5, 79],
    [6, .5, 84], [6.5, .5, 84], [7, .5, 83], [7.5, .5, 81]
  ];
  const STAR_BASS = [
    [0, .5, 48], [.5, .5, 55], [1, .5, 52], [1.5, .5, 55],
    [2, .5, 48], [2.5, .5, 55], [3, .5, 52], [3.5, .5, 55],
    [4, .5, 50], [4.5, .5, 55], [5, .5, 53], [5.5, .5, 55],
    [6, .5, 50], [6.5, .5, 55], [7, .5, 53], [7.5, .5, 55]
  ];

  // 'bonus' — original 4-bar underground cue.  It changes palette and pulse
  // density like the source game's bonus room without quoting its melody.
  const BONUS_LEAD = [
    [0, .5, 60], [.5, .5, 63], [1, .5, 67], [1.5, .5, 72],
    [2.5, .5, 67], [3, .5, 63], [3.5, .5, 60],
    [4, .5, 58], [4.5, .5, 62], [5, .5, 65], [5.5, .5, 70],
    [6.5, .5, 65], [7, .5, 62], [7.5, .5, 58],
    [8, .5, 60], [8.5, .5, 64], [9, .5, 67], [9.5, .5, 72],
    [10, 1, 75], [11.5, .5, 72],
    [12, .5, 67], [12.5, .5, 64], [13, .5, 60], [13.5, .5, 55],
    [14, 1, 58], [15, 1, 60]
  ];
  const BONUS_BASS = [
    [0, 1, 36], [1, 1, 43], [2, 1, 39], [3, 1, 43],
    [4, 1, 34], [5, 1, 41], [6, 1, 38], [7, 1, 41],
    [8, 1, 36], [9, 1, 43], [10, 1, 39], [11, 1, 43],
    [12, 1, 36], [13, 1, 43], [14, 1, 38], [15, 1, 36]
  ];

  const SONGS = {
    main: { bpm: 172, beats: 32, hatEvery: 1,   lead: MAIN_LEAD, bass: MAIN_BASS, leadVol: 0.10, bassVol: 0.13, hatVol: 0.028 },
    star: { bpm: 184, beats: 8,  hatEvery: 0.5, lead: STAR_LEAD, bass: STAR_BASS, leadVol: 0.09, bassVol: 0.11, hatVol: 0.03 },
    bonus: { bpm: 148, beats: 16, hatEvery: 1, lead: BONUS_LEAD, bass: BONUS_BASS, leadVol: 0.09, bassVol: 0.13, hatVol: 0.022 }
  };

  /* ---- scheduler state ------------------------------------------------------- */

  const hasTimers = (typeof setInterval !== 'undefined') && (typeof clearInterval !== 'undefined');
  const FAST_MULT = 1.45;              // time-warning speed-up, like SMB's hurry mode

  let playing = null;                  // null | 'main' | 'star'
  let suspendedTrack = null;
  let fast = false;
  let timer = null;
  let anchored = false, anchorT = 0, anchorPos = 0;
  let leadVi, bassVi, hatBeat, hatBuf = null;

  function resetPtrs() {
    leadVi = { i: 0, loop: 0 };
    bassVi = { i: 0, loop: 0 };
    hatBeat = 0;
  }
  resetPtrs();

  function spb() {                     // seconds per beat at current tempo
    return 60 / (SONGS[playing].bpm * (fast ? FAST_MULT : 1));
  }
  function beatToTime(b) { return anchorT + (b - anchorPos) * spb(); }
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Audio bus via Sfx; null when no AudioContext exists yet (pre-gesture).
  function readyCtx() {
    try {
      if (!Sfx._ensure()) return null;
      const c = Sfx._ctx();
      return (c && c.currentTime != null) ? c : null;
    } catch (e) { return null; }
  }

  function emitNote(ctx, type, freq, t, dur, vol) {
    try {
      const now = ctx.currentTime;
      if (t < now) t = now;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.setValueAtTime(vol, t + Math.max(0.012, dur - 0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(Sfx._master());
      osc.start(t); osc.stop(t + dur + 0.05);
    } catch (e) { /* audio must never crash the game */ }
  }

  function emitHat(ctx, t, vol) {
    try {
      const now = ctx.currentTime;
      if (t < now) t = now;
      if (!hatBuf) {
        hatBuf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.03)), ctx.sampleRate);
        const d = hatBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = hatBuf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(g); g.connect(Sfx._master());
      src.start(t); src.stop(t + 0.06);
    } catch (e) { /* ignore */ }
  }

  // Schedule one melodic voice up to the horizon; pointers always advance,
  // even while muted, so unmuting never dumps a burst of catch-up notes.
  function scheduleVoice(seq, vi, type, vol, horizon, song, ctx, silent) {
    while (true) {
      const e = seq[vi.i];
      const t = beatToTime(vi.loop * song.beats + e[0]);
      if (t > horizon) break;
      if (!silent) emitNote(ctx, type, midiToFreq(e[2]), t, e[1] * spb() * 0.9, vol);
      vi.i++;
      if (vi.i >= seq.length) { vi.i = 0; vi.loop++; }
    }
  }

  function tick() {
    if (!playing) return;
    const ctx = readyCtx();
    if (!ctx) return;                  // pre-gesture: try again on the next tick
    if (!anchored) {
      anchorT = ctx.currentTime + 0.08;
      anchorPos = 0;
      resetPtrs();
      anchored = true;
    }
    const song = SONGS[playing];
    const horizon = ctx.currentTime + 0.2;
    const silent = Sfx.isMuted();
    scheduleVoice(song.lead, leadVi, 'square', song.leadVol, horizon, song, ctx, silent);
    scheduleVoice(song.bass, bassVi, 'triangle', song.bassVol, horizon, song, ctx, silent);
    while (true) {
      const t = beatToTime(hatBeat);
      if (t > horizon) break;
      if (!silent) emitHat(ctx, t, song.hatVol);
      hatBeat += song.hatEvery;
    }
  }

  return {
    // Start a loop from the top ('main' | 'star'). Safe to call any time.
    play(name) {
      if (!SONGS[name] || playing === name) return;
      playing = name;
      anchored = false;
      resetPtrs();
      if (hasTimers && timer === null) timer = setInterval(tick, 50);
    },
    stop() {
      playing = null;
      if (timer !== null) { clearInterval(timer); timer = null; }
    },
    // Pause menu: music halts and the loop restarts on resume (SMB stops its
    // music while paused too; restarting the short loop is close enough).
    suspend() {
      if (playing) { suspendedTrack = playing; this.stop(); }
    },
    resume() {
      if (suspendedTrack) { const s = suspendedTrack; suspendedTrack = null; this.play(s); }
    },
    // Hurry mode: re-anchor at the current position, then continue faster.
    setFast(f) {
      f = !!f;
      if (f === fast) return;
      const ctx = playing ? readyCtx() : null;
      if (ctx && anchored) {
        anchorPos = anchorPos + (ctx.currentTime - anchorT) / spb();  // old tempo
        anchorT = ctx.currentTime;
      }
      fast = f;
    },
    isFast() { return fast; },
    current() { return playing; }
  };
})();

// expose for the game + headless test (same pattern as window.Game)
if (typeof window !== 'undefined') window.Music = Music;
