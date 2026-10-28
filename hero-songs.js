// Three compositions are public domain. Runaway uses the owner's exact 16 attacks.
// No One Noticed follows Joshua's supplied vocal tab (26 Oct 2026, 22:26), bars 1-16:
// 43 new attacks, with tied continuations counted once. Standard tuning as labelled:
// B8/e3=G4, B7/e2=F#4, B1=C4, B3=D4, B0=B3, G0=G3.
// Joshua amended the repeating phrase pairs to G4 F#4 C4, then G4 F#4 B3.
// Subsequent repeated notes follow their phrase destination (C4 or B3), 26 Oct 2026.
// The site advances one note per interaction. noteBeats guides the next attack;
// it includes ties/rests between onsets and never schedules automatic audio.
// Joshua, 19 Oct 2026: "keep the original entertainer snippet you originally
// selected the first time. keep the dreamy song in its length. get rid of other
// one i think or take a small snippet thats lovely like the entertainer".
// 28 Oct 2026: Runaway starts on the four-note progression, without the long
// repeated-note intro, retaining the repeated high hits and low octave responses.
// The three public-domain compositions are below. Notes transcribed from Public Domain
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
// Entertainer: the opening four-bar phrase, bars 5-8 in the printed 2/4 score.
// Move the pickup to the start of the loop and keep the final resolving C.
// Transpose the whole melody down one octave; never fold independent chunks.
// Maple Leaf: include the separate final Eb5 attack in bar 4 after its rest.
// Both transcriptions and bar boundaries are in tests/fixtures/joplin-openings.json.
// Sharp spellings are enharmonic MIDI names (e.g. G# = Ab, D# = Eb).
// Provenance links above are comments; exported data has no runtime URLs.
// Gymnopédie's approved low-register arrangement is unchanged.

export const songs = [
  {
    "id": "entertainer",
    "title": "The Entertainer",
    "composer": "Scott Joplin",
    "year": 1902,
    "source": "Opening four-bar phrase, bars 5-8 in the printed 2/4 score, melody only; Mutopia-2016/11/25-263, entertainer.ly, top staff. Entire melody transposed down one octave to D3-E5, preserving intervals. Pickup D3 D#3 appears once at the loop start; the phrase ends on its resolving C5.",
    "licence": "Public Domain",
    "notes": [
      "D3",
      "D#3",
      "E3",
      "C4",
      "E3",
      "C4",
      "E3",
      "C4",
      "C5",
      "D5",
      "D#5",
      "E5",
      "C5",
      "D5",
      "E5",
      "B4",
      "D5",
      "C5"
    ]
  },
  {
    "id": "maple-leaf-rag",
    "title": "Maple Leaf Rag",
    "composer": "Scott Joplin",
    "year": 1899,
    "source": "Opening four bars, melody only (Mutopia-2011/11/13-23, maple.ly, top staff, bars 1-4). Tied continuations are held; the separate final D#5 attack in bar 4 is included.",
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
      "D#5",
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
    "title": "Runaway (piano riff)",
    "composer": "Kanye West",
    "year": 2010,
    "source": "Owner-specified 16-note riff, 28 October 2026: three E6 hits then E5; three D#6 then D#5; three C#6 then C#5; A5, A5, G#5, E6. The long opening run of E6 is cut to three hits. Keyboard shifted up one octave to retain the original register.",
    "keyboardOctave": 1,
    "licence": "Short credited quotation (16-note piano riff)",
    "notes": [
      "E6",
      "E6",
      "E6",
      "E5",
      "D#6",
      "D#6",
      "D#6",
      "D#5",
      "C#6",
      "C#6",
      "C#6",
      "C#5",
      "A5",
      "A5",
      "G#5",
      "E6"
    ]
  },
  {
    "id": "no-one-noticed",
    "title": "No One Noticed (verse excerpt)",
    "composer": "The Marías",
    "year": 2024,
    "source": "Vocal tab supplied by Joshua, 26 October 2026 at 22:26, amended by ear: repeated descent pairs are G4 F#4 C4, then G4 F#4 B3, including their subsequent repeated notes. Bars 1-16 at 98 BPM; tied continuations are not new attacks.",
    "licence": "User-supplied excerpt; no licence asserted",
    "tempo": 98,
    // Onset gaps from outputs/website-plan-20261026/piano-verse/no-one-noticed-score.json.
    // Last gap includes the written ending up to totalBeats=62.5, then loops.
    "noteBeats": [1, 1, 6, 1, 1, 6, 1, 1, 1, 5, 1, 1, 1, 5, 1, 1, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 2, 1, 1, 1, 5, 1, 1, 1, 3.5],
    "notes": [
      "G4",
      "F#4",
      "C4",
      "G4",
      "F#4",
      "B3",
      "C4",
      "D4",
      "C4",
      "B3",
      "C4",
      "G3",
      "B3",
      "B3",
      "G4",
      "F#4",
      "C4",
      "C4",
      "C4",
      "C4",
      "C4",
      "C4",
      "C4",
      "C4",
      "C4",
      "C4",
      "G4",
      "F#4",
      "B3",
      "B3",
      "B3",
      "B3",
      "B3",
      "B3",
      "B3",
      "C4",
      "D4",
      "C4",
      "B3",
      "C4",
      "G3",
      "B3",
      "B3"
    ]
  }
];
