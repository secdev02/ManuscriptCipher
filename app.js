/* ==================================================================
   The Manuscript Cipher
   text -> cipher events -> measured systems -> SVG pages -> sound
   ================================================================== */

"use strict";

/* ---------------- 1. The cipher table ----------------
   Thirteen diatonic pitches, C4 (middle C) up to A5.
   Pitch index 0 = C4 sits on its own ledger line below the staff.
   Pitch index 12 = A5 sits on the first ledger line above it.

   letter a..m  -> quarter note at pitch (letter - a)
   letter n..z  -> eighth  note at pitch (letter - n)
   CAPITAL      -> same note, with an accent stroke above
   digit 0..9   -> half note at pitch (digit)
   space        -> quarter rest
   , ; :        -> eighth rest
   . ? !        -> half rest ( ! also writes "sf" in the old hand)
   newline      -> the current system is closed early
   anything else is passed over in silence
------------------------------------------------------- */

var BEATS = { e: 0.5, q: 1, h: 2 };
var PITCH_NAMES = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5"];
var FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88,
             523.25, 587.33, 659.25, 698.46, 783.99, 880.0];

function encode(text) {
  var events = [];
  var i, ch, code;
  for (i = 0; i < text.length; i++) {
    ch = text[i];
    code = ch.charCodeAt(0);

    if (ch === "\n") {
      events.push({ type: "break" });
      continue;
    }
    if (ch === " ") {
      events.push({ type: "rest", dur: "q", ch: ch });
      continue;
    }
    if (ch === "," || ch === ";" || ch === ":") {
      events.push({ type: "rest", dur: "e", ch: ch });
      continue;
    }
    if (ch === "." || ch === "?" || ch === "!") {
      events.push({ type: "rest", dur: "h", ch: ch, sf: ch === "!" });
      continue;
    }
    if (code >= 48 && code <= 57) {                      /* digits */
      events.push({ type: "note", pitch: code - 48, dur: "h", ch: ch });
      continue;
    }
    if (code >= 97 && code <= 122) {                     /* a..z */
      var li = code - 97;
      events.push({
        type: "note",
        pitch: li % 13,
        dur: li < 13 ? "q" : "e",
        ch: ch
      });
      continue;
    }
    if (code >= 65 && code <= 90) {                      /* A..Z */
      var ui = code - 65;
      events.push({
        type: "note",
        pitch: ui % 13,
        dur: ui < 13 ? "q" : "e",
        accent: true,
        ch: ch
      });
      continue;
    }
    /* every other character is left unwritten */
  }
  return events;
}

/* ---------------- 2. Layout ----------------
   Coordinates live in a 940 x 1240 viewBox per page.
   A staff is five lines, 12 units apart, 48 units tall.
   Note y = staffTop + (10 - pitch) * 6.
-------------------------------------------- */

var PAGE_W = 940, PAGE_H = 1240;
var STAFF_LEFT = 52, STAFF_RIGHT = 892;
var SYS_GAP = 118;
var FIRST_PAGE_TOP = 188, PAGE_TOP = 84, PAGE_BOTTOM = 1160;
var ADV = { e: 25, q: 34, h: 48 };     /* horizontal advance per duration */
var BAR_ADV = 15;

function layout(events) {
  var pages = [];
  var systems = [];
  var sys = null;
  var beat = 0;             /* beats consumed in the open measure */
  var firstSystem = true;

  function openSystem() {
    var startX = STAFF_LEFT + (firstSystem ? 96 : 62);
    sys = { items: [], x: startX, first: firstSystem };
    firstSystem = false;
  }
  function closeSystem() {
    if (sys && sys.items.length) systems.push(sys);
    sys = null;
    beat = 0;
  }
  function ensureRoom(width) {
    if (!sys) openSystem();
    if (sys.x + width > STAFF_RIGHT - 8) {
      closeSystem();
      openSystem();
    }
  }

  var i, ev, dur;
  for (i = 0; i < events.length; i++) {
    ev = events[i];

    if (ev.type === "break") { closeSystem(); continue; }

    dur = BEATS[ev.dur];
    if (beat + dur > 4.0001 || beat >= 3.9999) {
      ensureRoom(BAR_ADV + ADV[ev.dur]);
      sys.items.push({ type: "bar", x: sys.x });
      sys.x += BAR_ADV;
      beat = 0;
    } else {
      ensureRoom(ADV[ev.dur]);
    }

    ev.x = sys.x;
    sys.items.push(ev);
    sys.x += ADV[ev.dur];
    beat += dur;
  }
  closeSystem();

  /* pour systems onto pages */
  var pageSystems = [];
  var y = FIRST_PAGE_TOP;
  for (i = 0; i < systems.length; i++) {
    if (y + 60 > PAGE_BOTTOM) {
      pages.push(pageSystems);
      pageSystems = [];
      y = PAGE_TOP;
    }
    systems[i].y = y;
    pageSystems.push(systems[i]);
    y += SYS_GAP;
  }
  if (pageSystems.length) pages.push(pageSystems);
  return pages;
}

/* ---------------- 3. Engraving ----------------
   Everything is drawn with quill-style stroked paths so the
   score reads as a working manuscript, not laser print.
----------------------------------------------- */

var CLEF_PATH =
  "M 6 60 C 0 60 -2 54 2 50 C 5 47 10 49 10 54 C 10 58 8 61 5 61 " +
  "M 8 57 C 8 40 12 30 12 14 C 12 4 10 -6 6 -4 C 2 -1 3 10 8 18 " +
  "C 15 29 20 34 19 42 C 18 51 6 54 2 47 C -1 41 4 35 9 37";

var QREST_PATH = "M 2 8 L 9 17 C 4 22 4 25 9 31 C 2 29 0 34 5 40";
var EREST_STEM = "M 5 21 C 9 24 12 23 14 19 L 8 38";

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function opusOf(text) {
  var sum = 0;
  for (var i = 0; i < text.length; i++) sum = (sum + text.charCodeAt(i) * (i + 7)) % 9973;
  return (sum % 137) + 1;
}

function titleBlock(title, opus) {
  var s = "";
  s += "<text x='470' y='58' text-anchor='middle' font-family='IM Fell English SC, serif' font-size='30' letter-spacing='2'>" + esc(title) + "</text>";
  s += "<text x='470' y='88' text-anchor='middle' font-family='IM Fell English, serif' font-style='italic' font-size='16' opacity='0.75'>gesetzt in Noten, nach Art des alten Meisters</text>";
  s += "<text x='" + STAFF_LEFT + "' y='140' font-family='IM Fell English, serif' font-style='italic' font-size='19'>Allegro con brio.</text>";
  s += "<text x='" + STAFF_RIGHT + "' y='140' text-anchor='end' font-family='IM Fell English, serif' font-size='17'>Op. " + opus + "</text>";
  return s;
}

function drawSystem(sys, isVeryFirst) {
  var top = sys.y;
  var s = "<g>";
  var i, ln;

  /* five staff lines */
  for (i = 0; i < 5; i++) {
    ln = top + i * 12;
    s += "<line class='ink' x1='" + STAFF_LEFT + "' y1='" + ln + "' x2='" + STAFF_RIGHT + "' y2='" + ln + "' stroke-width='1.1' opacity='0.85'/>";
  }
  /* left edge and closing bar */
  s += "<line class='ink' x1='" + STAFF_LEFT + "' y1='" + top + "' x2='" + STAFF_LEFT + "' y2='" + (top + 48) + "' stroke-width='1.6'/>";
  s += "<line class='ink' x1='" + STAFF_RIGHT + "' y1='" + top + "' x2='" + STAFF_RIGHT + "' y2='" + (top + 48) + "' stroke-width='1.6'/>";

  /* clef, drawn as a quill stroke */
  s += "<g transform='translate(" + (STAFF_LEFT + 14) + "," + top + ")'>" +
       "<path class='ink' d='" + CLEF_PATH + "' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></g>";

  /* common time on the very first system only */
  if (isVeryFirst && sys.first) {
    var cx = STAFF_LEFT + 74;
    s += "<text x='" + cx + "' y='" + (top + 21) + "' text-anchor='middle' font-family='IM Fell English, serif' font-weight='bold' font-size='24'>4</text>";
    s += "<text x='" + cx + "' y='" + (top + 45) + "' text-anchor='middle' font-family='IM Fell English, serif' font-weight='bold' font-size='24'>4</text>";
  }

  for (i = 0; i < sys.items.length; i++) s += drawItem(sys.items[i], top);

  s += "</g>";
  return s;
}

function drawItem(it, top) {
  if (it.type === "bar") {
    return "<line class='ink' x1='" + it.x + "' y1='" + top + "' x2='" + it.x + "' y2='" + (top + 48) + "' stroke-width='1.2'/>";
  }
  if (it.type === "rest") return drawRest(it, top);
  return drawNote(it, top);
}

function drawRest(it, top) {
  var x = it.x + 6;
  var s = "<g class='rest-group' data-ch='" + esc(it.ch) + "'>";
  if (it.dur === "q") {
    s += "<g transform='translate(" + x + "," + top + ")'><path class='ink' d='" + QREST_PATH + "' stroke-width='3.2' stroke-linecap='round'/></g>";
  } else if (it.dur === "e") {
    s += "<g transform='translate(" + x + "," + top + ")'>" +
         "<circle class='fill' cx='4' cy='22' r='2.6'/>" +
         "<path class='ink' d='" + EREST_STEM + "' stroke-width='1.8' stroke-linecap='round'/></g>";
  } else {
    /* half rest sits upon the middle line */
    s += "<rect class='fill' x='" + (x - 1) + "' y='" + (top + 19) + "' width='12' height='5'/>";
    if (it.sf) {
      s += "<text x='" + (x + 5) + "' y='" + (top + 66) + "' text-anchor='middle' font-family='IM Fell English, serif' font-style='italic' font-size='15'>sf</text>";
    }
  }
  s += cipherLetter(it, top);
  s += "</g>";
  return s;
}

function drawNote(it, top) {
  var x = it.x + 7;
  var y = top + (10 - it.pitch) * 6;
  var stemUp = it.pitch < 6;
  var s = "<g class='note-group' data-ch='" + esc(it.ch) + "'>";

  /* ledger lines: middle C below, A5 above */
  if (it.pitch === 0) {
    s += "<line class='ink' x1='" + (x - 9) + "' y1='" + y + "' x2='" + (x + 9) + "' y2='" + y + "' stroke-width='1.2'/>";
  }
  if (it.pitch === 12) {
    s += "<line class='ink' x1='" + (x - 9) + "' y1='" + y + "' x2='" + (x + 9) + "' y2='" + y + "' stroke-width='1.2'/>";
  }

  /* head */
  if (it.dur === "h") {
    s += "<ellipse class='ink' cx='" + x + "' cy='" + y + "' rx='5.6' ry='4' stroke-width='1.9' transform='rotate(-18 " + x + " " + y + ")'/>";
  } else {
    s += "<ellipse class='fill' cx='" + x + "' cy='" + y + "' rx='5.4' ry='4.1' transform='rotate(-18 " + x + " " + y + ")'/>";
  }

  /* stem */
  var sx = stemUp ? x + 5 : x - 5;
  var sy1 = stemUp ? y - 2 : y + 2;
  var sy2 = stemUp ? y - 33 : y + 33;
  s += "<line class='ink' x1='" + sx + "' y1='" + sy1 + "' x2='" + sx + "' y2='" + sy2 + "' stroke-width='1.5'/>";

  /* eighth flag */
  if (it.dur === "e") {
    var f;
    if (stemUp) {
      f = "M " + sx + " " + sy2 + " C " + (sx + 8) + " " + (sy2 + 5) + " " + (sx + 9) + " " + (sy2 + 13) + " " + (sx + 4) + " " + (sy2 + 20);
    } else {
      f = "M " + sx + " " + sy2 + " C " + (sx + 8) + " " + (sy2 - 5) + " " + (sx + 9) + " " + (sy2 - 13) + " " + (sx + 4) + " " + (sy2 - 20);
    }
    s += "<path class='ink' d='" + f + "' stroke-width='2.4' stroke-linecap='round'/>";
  }

  /* accent for a capital letter */
  if (it.accent) {
    var ay = stemUp ? sy2 - 8 : y - 12;
    s += "<path class='ink' d='M " + (x - 5) + " " + (ay - 4) + " L " + (x + 5) + " " + ay + " L " + (x - 5) + " " + (ay + 4) + "' stroke-width='1.6' stroke-linejoin='round'/>";
  }

  s += cipherLetter(it, top);
  s += "</g>";
  return s;
}

function cipherLetter(it, top) {
  return "<text class='cipher-letter' x='" + (it.x + 7) + "' y='" + (top + 78) + "' text-anchor='middle'>" + esc(it.ch === " " ? "\u2423" : it.ch) + "</text>";
}

function renderPages(pages, title, opus) {
  var html = "";
  var p, i;
  for (p = 0; p < pages.length; p++) {
    var svg = "<svg viewBox='0 0 " + PAGE_W + " " + PAGE_H + "' xmlns='http://www.w3.org/2000/svg' role='img' aria-label='Manuscript page " + (p + 1) + "'>";
    if (p === 0) svg += titleBlock(title, opus);
    for (i = 0; i < pages[p].length; i++) {
      svg += drawSystem(pages[p][i], p === 0 && i === 0);
    }
    svg += "<text class='folio-number' x='470' y='1216' text-anchor='middle' font-size='16' opacity='0.7'>" + (p + 1) + "</text>";
    svg += "</svg>";
    html += "<div class='page'>" + svg + "</div>";
  }
  return html;
}

/* ---------------- 4. Playback ---------------- */

var audioCtx = null;
var playing = false;
var playTimer = null;

function stopPlayback() {
  playing = false;
  if (playTimer) { clearTimeout(playTimer); playTimer = null; }
  document.getElementById("play").textContent = "Play";
  var lit = document.querySelectorAll(".note-group.sounding");
  for (var i = 0; i < lit.length; i++) lit[i].classList.remove("sounding");
}

function playScore(events) {
  if (playing) { stopPlayback(); return; }
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();

  playing = true;
  document.getElementById("play").textContent = "Stop";

  var groups = document.querySelectorAll(".note-group");
  var soundable = [];
  for (var i = 0; i < events.length; i++) {
    if (events[i].type === "note" || events[i].type === "rest") soundable.push(events[i]);
  }

  var QUARTER = 0.22;                 /* brisk, con brio */
  var idx = 0, noteIdx = 0;

  function step() {
    if (!playing || idx >= soundable.length) { stopPlayback(); return; }
    var ev = soundable[idx++];
    var secs = BEATS[ev.dur] * QUARTER;

    if (ev.type === "note") {
      var g = groups[noteIdx++];
      if (g) {
        g.classList.add("sounding");
        setTimeout(function () { g.classList.remove("sounding"); }, secs * 1000);
      }
      var t = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = FREQS[ev.pitch];
      var peak = ev.accent ? 0.30 : 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + secs * 0.92);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + secs);
    }
    playTimer = setTimeout(step, secs * 1000);
  }
  step();
}

/* ---------------- 5. The document itself ---------------- */

var DECLARATION_TITLE = "The Declaration of Independence";

var DECLARATION_TEXT =
"In Congress, July 4, 1776.\n" +
"The unanimous Declaration of the thirteen united States of America.\n" +
"\n" +
"When in the Course of human events, it becomes necessary for one people " +
"to dissolve the political bands which have connected them with another, " +
"and to assume among the powers of the earth, the separate and equal " +
"station to which the Laws of Nature and of Nature's God entitle them, a " +
"decent respect to the opinions of mankind requires that they should " +
"declare the causes which impel them to the separation.\n" +
"\n" +
"We hold these truths to be self-evident, that all men are created equal, " +
"that they are endowed by their Creator with certain unalienable Rights, " +
"that among these are Life, Liberty and the pursuit of Happiness. That to " +
"secure these rights, Governments are instituted among Men, deriving " +
"their just powers from the consent of the governed, That whenever any " +
"Form of Government becomes destructive of these ends, it is the Right of " +
"the People to alter or to abolish it, and to institute new Government, " +
"laying its foundation on such principles and organizing its powers in " +
"such form, as to them shall seem most likely to effect their Safety and " +
"Happiness. Prudence, indeed, will dictate that Governments long " +
"established should not be changed for light and transient causes; and " +
"accordingly all experience hath shewn, that mankind are more disposed to " +
"suffer, while evils are sufferable, than to right themselves by " +
"abolishing the forms to which they are accustomed. But when a long train " +
"of abuses and usurpations, pursuing invariably the same Object evinces a " +
"design to reduce them under absolute Despotism, it is their right, it is " +
"their duty, to throw off such Government, and to provide new Guards for " +
"their future security. Such has been the patient sufferance of these " +
"Colonies; and such is now the necessity which constrains them to alter " +
"their former Systems of Government. The history of the present King of " +
"Great Britain is a history of repeated injuries and usurpations, all " +
"having in direct object the establishment of an absolute Tyranny over " +
"these States. To prove this, let Facts be submitted to a candid world.";

/* ---------------- 6. Wiring ---------------- */

var currentEvents = [];

function engrave() {
  stopPlayback();
  var text = document.getElementById("source").value;
  currentEvents = encode(text);
  var pages = layout(currentEvents);
  var opus = opusOf(text);

  document.getElementById("folio").innerHTML = renderPages(pages, DECLARATION_TITLE, opus);

  var noteCount = 0, restCount = 0;
  for (var i = 0; i < currentEvents.length; i++) {
    if (currentEvents[i].type === "note") noteCount++;
    if (currentEvents[i].type === "rest") restCount++;
  }
  document.getElementById("stat").textContent =
    pages.length + " pages engraved: " + noteCount + " notes, " + restCount + " rests. Op. " + opus + ".";
}

document.getElementById("engrave").addEventListener("click", engrave);
document.getElementById("play").addEventListener("click", function () { playScore(currentEvents); });
document.getElementById("print").addEventListener("click", function () { window.print(); });
document.getElementById("reveal").addEventListener("click", function () {
  document.body.classList.toggle("reveal");
  this.classList.toggle("active");
});

document.getElementById("source").value = DECLARATION_TEXT;
engrave();
