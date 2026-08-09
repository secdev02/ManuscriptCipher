# The Manuscript Cipher

A text-to-music cipher that engraves any document as pages of sheet music in the style of a late Classical manuscript. It ships preloaded with the Declaration of Independence, rendered as "Op. 137" across roughly eleven pages of aged parchment.

The cipher is simple to state but produces genuinely complex-looking scores, and it is fully reversible: anyone holding the key can read the original text back off the page, note by note.

## Running it

No build step, no server, no dependencies. Open `index.html` in any modern browser. The fonts (IM Fell English and Cormorant Garamond) load from Google Fonts; without a connection the app still works with fallback serifs.

- **Engrave the score** re-encodes whatever is in the text box.
- **Play** performs the cipher through the Web Audio API at a brisk Allegro con brio, highlighting each note as it sounds.
- **Reveal cipher** overlays the decoded character beneath every note and rest, in faded red ink.
- **Print pages** opens the print dialog with one manuscript page per sheet.

## The cipher

Everything is written on a single treble staff in C major, common time. Three properties of each symbol carry the message: its **pitch**, its **duration class**, and its **articulation**.

### Pitch: thirteen diatonic steps

Thirteen positions run from middle C up to A5:

```
index:  0   1   2   3   4   5   6   7   8   9   10  11  12
pitch:  C4  D4  E4  F4  G4  A4  B4  C5  D5  E5  F5  G5  A5
```

C4 hangs on its own ledger line below the staff; A5 sits on the first ledger line above it. Everything in between falls on the staff proper.

### Duration: which half of the alphabet

The alphabet is split in two and folded onto those thirteen pitches. Duration tells you which half you are reading:

| Character | Written as | Pitch index |
| --- | --- | --- |
| `a` through `m` | quarter note | letter position, 0 to 12 |
| `n` through `z` | eighth note | letter position minus 13 |
| `0` through `9` | half note | the digit itself |

So `a` and `n` share the pitch C4, but `a` is a filled quarter and `n` is a flagged eighth. A half note can never be confused with a letter because letters are never half notes.

### Articulation: capitals

An uppercase letter is the same note as its lowercase form with an **accent stroke** (`>`) drawn above it. `W` is an eighth note on F5 wearing an accent; `w` is the same note bare.

### Silence: spaces and punctuation

| Character | Written as |
| --- | --- |
| space | quarter rest |
| `,` `;` `:` | eighth rest |
| `.` `?` `!` | half rest |
| `!` only | half rest plus an *sf* marking in the old hand |
| line break | the current system ends early and a new one begins |

Characters outside this set (hyphens, apostrophes, quotation marks) are passed over in silence and are the only information the cipher discards.

### Bar lines carry no meaning

Measures are filled to four beats (quarter = 1, eighth = 1/2, half = 2) and a bar line is drawn whenever the measure is full, or early when the next value would overflow it. Bar lines are purely rhythmic punctuation; ignore them entirely when decoding.

### The opus number

The opus on the title page is a checksum of the source text: each character code is weighted by its position, summed modulo 9973, then reduced modulo 137 plus one. Change a single letter of the document and the opus number almost certainly changes, so it doubles as a tamper seal.

## Decoding by hand

1. Ignore bar lines and the closing strokes at the ends of systems.
2. For each note, find its pitch index (count diatonic steps up from middle C).
3. Quarter note: the letter is `a` plus the index. Eighth note: `n` plus the index. Half note: the digit equals the index.
4. An accent above the note capitalizes it.
5. Quarter rest is a space; eighth rest a comma-class mark; half rest a sentence-ending mark (an *sf* beneath it means it was `!`).
6. A system that ends short of the right margin marks a line break in the original.

Or press **Reveal cipher** and let the manuscript confess.

## How the code works

Three files, no frameworks.

### `app.js`, a four-stage pipeline

1. **`encode(text)`** walks the source string once and emits a flat list of cipher events: notes with a pitch index and duration, rests, and system breaks. Each event remembers the character it came from, which powers both the reveal overlay and the round-trip guarantee.
2. **`layout(events)`** is the measuring stage. It tracks beats to place bar lines, advances a horizontal cursor by a per-duration width, wraps to a new system when the staff runs out of room, and pours systems onto 940 x 1240 pages. The first page reserves headroom for the title block.
3. **The engraver** (`renderPages`, `drawSystem`, `drawNote`, `drawRest`) turns positioned events into SVG. Note heads are rotated ellipses, stems flip direction at the middle line, eighth flags and rests are cubic Bezier strokes, and the treble clef is a single hand-tuned quill-style path. Drawing everything as stroked paths rather than font glyphs is what gives the page its working-manuscript feel, and it means the score needs no music font to render.
4. **`playScore(events)`** performs the event list with the Web Audio API: one triangle oscillator per note with a fast attack and exponential decay, louder on accented (capital) notes, and rests observed as true silence.

### `style.css`

Two worlds share the screen. The surrounding chrome is a dark walnut writing desk with sealing-wax red controls. The pages are parchment built entirely in CSS: layered radial gradients for uneven aging, an inset shadow for the vignette, and an inline SVG `feTurbulence` tile blended in multiply mode for paper grain. Print styles strip the desk and the aging so each page lands cleanly on its own sheet.

### `index.html`

The control panel, the cipher key legend, and an empty `folio` element the engraver fills.

## Design notes

The pitch table stays diatonic (no sharps or flats) so that decoding never requires reading accidentals, and the range stays within one ledger line of the staff so the systems pack tightly. Folding 26 letters onto 13 pitches, then using duration to disambiguate, is what makes the score look musically plausible: a one-to-one letter-to-pitch mapping would need a four-octave range and read as noise, while this one produces stepwise contours and rhythmic variety that sit convincingly on a single staff.

## Limitations 

- Case aside, the cipher is a substitution cipher and offers no real secrecy; it is a costume, not a vault. Anyone who suspects music-as-text will break it with frequency analysis in an afternoon.
- Discarded characters (apostrophes, quotes, hyphens) cannot be recovered.
- The performance is faithful to the cipher, not to Beethoven. He is not responsible for the melody your grocery list produces.
