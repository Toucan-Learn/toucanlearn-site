// Three compositions are public domain; Runaway (8 notes) and No One Noticed (2 bars)
// are short credited quotations. Joshua, 19 Oct 2026: "the first 2 bars ... good for no one
// noticed" / vocal tab: G F# E, G F# E.
// Joshua, 19 Oct 2026: "keep the original entertainer snippet you originally
// selected the first time. keep the dreamy song in its length. get rid of other
// one i think or take a small snippet thats lovely like the entertainer" and
// "kanyes intro is 8 notes total". The three public-domain compositions are below. Notes transcribed from Public Domain
// Mutopia Project MIDI editions using /tmp/toucan-midi/extract_melodies.py.
// Source pages (each states "Copyright: Public Domain") and downloaded MIDI files:
// The Entertainer: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263
// https://www.mutopiaproject.org/ftp/JoplinS/entertainer/entertainer.mid (22,084 bytes)
// Maple Leaf Rag: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23
// https://www.mutopiaproject.org/ftp/JoplinS/maple/maple.mid (21,518 bytes)
// Gymnopédie No. 1: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37
// https://www.mutopiaproject.org/ftp/SatieE/gymnopedie_1/gymnopedie_1.mid (2,892 bytes)
// Use zero-indexed track 1 (treble), MIDI channel 1, in all three files.
// At each onset keep only the highest new pitch, and suppress it if a higher
// pitch is still held. Simultaneous chords/octaves yield one note. Keep MIDI
// event order and encoded repeats; no manual repeat expansion or octave shifts.
// Satie: the treble staff also contains accompaniment. Skip its four opening
// chord-only onsets; the upper melody enters at tick 4992 (bar 5, beat 2).
// Entertainer: retain all 16 introduction notes; the D D# E C theme starts at
// note 17. Starting with that theme would omit or reorder the introduction.
// Sharp spellings are enharmonic MIDI names (e.g. G# = Ab, D# = Eb).
// Provenance links above are comments; exported data has no runtime URLs.
// Joshua, 17 Oct 2026 ("too shrill"): Joplin melodies have any 8-note run that
// climbs above A5 moved down by octaves (shape kept); Gymnopédie sits an octave down.

export const songs = [
  {
    "id": "entertainer",
    "title": "The Entertainer",
    "composer": "Scott Joplin",
    "year": 1902,
    "source": "First-strain opening, melody only, as first chosen on 17 Oct 2026 (Mutopia Project edition)",
    "licence": "Public Domain",
    "notes": [
      "D4",
      "D#4",
      "E4",
      "C5",
      "E4",
      "C5",
      "E4",
      "C5",
      "C5",
      "D5",
      "D#5",
      "E5",
      "C5",
      "D5",
      "E5",
      "B4",
      "D5",
      "C5",
      "D4",
      "D#4",
      "E4",
      "C5",
      "E4",
      "C5",
      "E4",
      "C5",
      "A4",
      "G4",
      "F#4",
      "A4",
      "C5",
      "E5",
      "D5",
      "C5",
      "A4",
      "D5"
    ]
  },
  {
    "id": "maple-leaf-rag",
    "title": "Maple Leaf Rag",
    "composer": "Scott Joplin",
    "year": 1899,
    "source": "Opening four bars, melody only (Mutopia Project, Mutopia-2011/11/13-23, maple.mid; treble track 1, MIDI channel 1)",
    "licence": "Public Domain",
    "notes": [
      "G#4",
      "D#5",
      "G#4",
      "C5",
      "D#5",
      "G4",
      "D#5",
      "G4",
      "A#4",
      "D#5",
      "G#4",
      "D#5",
      "G#4",
      "C5",
      "D#5",
      "G4",
      "D#5",
      "G4",
      "A#4",
      "D#5"
    ]
  },
  {
    "id": "gymnopedie-1",
    "title": "Gymnopédie No. 1",
    "composer": "Erik Satie",
    "year": 1888,
    "source": "Mutopia Project, Mutopia-2014/12/14-37, gymnopedie_1.mid; treble track 1, MIDI channel 1",
    "licence": "Public Domain",
    "notes": [
      "F#4",
      "A4",
      "G4",
      "F#4",
      "C#4",
      "B3",
      "C#4",
      "D4",
      "A3",
      "F#3",
      "F#3",
      "F#3",
      "F#3",
      "F#3",
      "F#4",
      "A4",
      "G4",
      "F#4",
      "C#4",
      "B3",
      "C#4",
      "D4",
      "A3",
      "C#4",
      "F#4",
      "E3",
      "A3",
      "B3",
      "C4",
      "E4",
      "D4",
      "B3",
      "D4",
      "C4",
      "B3",
      "D4",
      "D4",
      "E4",
      "F4",
      "G4",
      "A4",
      "C4",
      "D4",
      "E4",
      "D4",
      "B3",
      "D4",
      "D4",
      "G4",
      "F#4",
      "B3",
      "A3",
      "B3",
      "C#4",
      "D4",
      "E4",
      "C#4",
      "D4",
      "E4",
      "F#3",
      "G3",
      "C4",
      "D4",
      "G4",
      "F4",
      "B3",
      "C4",
      "F4",
      "E4",
      "D4",
      "C4",
      "E4",
      "D4",
      "C4",
      "F3",
      "G3",
      "C4",
      "D4"
    ]
  },
  {
    "id": "runaway",
    "title": "Runaway (intro)",
    "composer": "Kanye West",
    "year": 2010,
    "source": "The opening piano figure: one note, eight times",
    "licence": "Short credited quotation (8 notes)",
    "notes": [
      "E5",
      "E5",
      "E5",
      "E5",
      "E5",
      "E5",
      "E5",
      "E5"
    ]
  },
  {
    "id": "no-one-noticed",
    "title": "No One Noticed (opening)",
    "composer": "The Marías",
    "year": 2024,
    "source": "The opening vocal line, two bars",
    "licence": "Short credited quotation (2 bars)",
    "notes": [
      "G5",
      "F#5",
      "E5",
      "G5",
      "F#5",
      "E5"
    ]
  }
];
