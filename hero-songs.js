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
// 29 Oct 2026: Entertainer uses the full first A strain, bars 5-20, first ending.
// Keep its internal pickups. Move only the loop-boundary pickup to the start.
// Transpose the whole melody down one octave; never fold independent chunks.
// Its noteBeats follows the published ties and attack onsets at a chosen 100 BPM.
// Maple Leaf: full first A strain, bars 1-16, first ending, upper-staff melody.
// Keep bar 4's final Eb5 attack and hold the ties across bars 9-15.
// Bar 7 crosses to the lower staff and is silent in this upper-staff excerpt.
// Keep the published onset gaps at the existing 100 BPM practice pace; wrap
// the opening sixteenth rest into the final gap for exactly sixteen 2/4 bars.
// Both transcriptions and bar boundaries are in tests/fixtures/joplin-openings.json.
// Sharp spellings are enharmonic MIDI names (e.g. G# = Ab, D# = Eb).
// Provenance links above are comments; exported data has no runtime URLs.
// 29 Oct 2026: Gymnopédie ends at the first phrase boundary (bar 12), the first
// 14 attacks of the existing arrangement; pitches and effective timing retained.

export const songs = [
  {
    "id": "entertainer",
    "title": "The Entertainer",
    "composer": "Scott Joplin",
    "year": 1902,
    "source": "Full first A strain, printed bars 5-20 (first ending), melody only; Mutopia-2016/11/25-263, entertainer.ly, reproduction of the original 1902 edition. One consistent -12-semitone transposition, D3-E5. Internal connecting pickups retained; the boundary D3 D#3 pickup appears at the start of the loop, not again after the final C5 cadence. Published rhythm at a chosen moderate quarter note = 100 (the score says Not fast).",
    "licence": "Public Domain",
    "tempo": 100,
    // Quarter-note onset gaps from the published first strain, including ties.
    "noteBeats": [
      0.25, 0.25, 0.25, 0.5, 0.25, 0.5, 0.25, 1.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.25,
      0.5, 1.5, 0.25, 0.25, 0.25, 0.5, 0.25, 0.5, 0.25, 1.75, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5,
      0.25, 0.25, 0.25, 1.5, 0.25, 0.25, 0.25, 0.5, 0.25, 0.5, 0.25, 1.5, 0.25, 0.25, 0.25, 0.25,
      0.25, 0.25, 0.5, 0.25, 0.5, 1.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.25, 0.25, 0.25, 0.25,
      0.25, 0.25, 0.5, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.25, 0.5, 1.5
    ],
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
      "C5",
      "D3",
      "D#3",
      "E3",
      "C4",
      "E3",
      "C4",
      "E3",
      "C4",
      "A4",
      "G4",
      "F#4",
      "A4",
      "C5",
      "E5",
      "D5",
      "C5",
      "A4",
      "D5",
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
      "C5",
      "C5",
      "D5",
      "E5",
      "C5",
      "D5",
      "E5",
      "C5",
      "D5",
      "C5",
      "E5",
      "C5",
      "D5",
      "E5",
      "C5",
      "D5",
      "C5",
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
    "source": "Full first A strain, printed bars 1-16 (first ending), upper-staff melody only (Mutopia-2011/11/13-23, maple.ly and maple.mid, treble track 1, MIDI channel 1). Bar 7's cross-staff lower-staff notes are omitted, with their time retained as silence. Highest new pitch per onset; tied continuations are held, including the ties across bars 9-15. Bar 4's separate final D#5 attack is retained. C-flat and F-flat are spelled B and E. Original pitches G4-G#6; keyboard shifted up one octave. Published onset gaps at the existing chosen practice tempo, quarter note = 100. The opening sixteenth rest wraps into the final gap after the first-ending G#4 cadence, making the loop exactly sixteen bars of 2/4 (32 quarter-note beats).",
    "licence": "Public Domain",
    "keyboardOctave": 1,
    "tempo": 100,
    // Quarter-note onset gaps, including ties, rests and the silent upper staff in bar 7.
    "noteBeats": [
      0.25, 0.25, 0.25, 0.25, 0.5, 0.25,
      0.25, 0.25, 0.25, 1.5,
      0.25, 0.25, 0.25, 0.25, 0.5, 0.25,
      0.25, 0.25, 0.25, 1, 0.5,
      0.25, 0.25, 0.5, 0.5, 0.5,
      0.25, 0.25, 0.5, 3,
      0.25, 0.25, 0.5, 0.25, 0.25, 0.25,
      0.5, 0.5, 0.5, 0.25, 0.5,
      0.25, 0.25, 0.25, 0.25, 0.5, 0.5,
      0.25, 0.25, 0.25, 0.25, 0.5, 0.25,
      0.25, 0.25, 0.5, 0.75, 0.75,
      0.5, 0.5, 0.25, 0.5,
      0.25, 0.25, 0.25, 0.25, 0.5, 0.5,
      0.25, 0.25, 0.25, 0.25, 0.5, 0.25,
      0.25, 0.25, 0.5, 1.25
    ],
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
      "D#5",
      "G#4",
      "B4",
      "E5",
      "D#5",
      "D#5",
      "G#4",
      "B4",
      "E5",
      "D#5",
      "G#4",
      "B4",
      "G#5",
      "G#5",
      "B5",
      "G#6",
      "G#6",
      "G#6",
      "G#6",
      "G#6",
      "G#6",
      "D#6",
      "F6",
      "C6",
      "D#6",
      "F6",
      "G#5",
      "A#5",
      "B5",
      "G#5",
      "A#5",
      "C6",
      "G#5",
      "C6",
      "G#5",
      "A#5",
      "G#5",
      "G#5",
      "G#5",
      "G#5",
      "G#5",
      "G#5",
      "D#5",
      "F5",
      "C5",
      "D#5",
      "F5",
      "G#4",
      "A#4",
      "B4",
      "G#4",
      "A#4",
      "C5",
      "G#4",
      "C5",
      "G#4",
      "A#4",
      "G#4"
    ]
  },
  {
    "id": "gymnopedie-1",
    "title": "Gymnopédie No. 1",
    "composer": "Erik Satie",
    "year": 1888,
    "source": "Opening phrase through printed bar 12, ending on low F#3 before the melody re-enters in bar 13; Mutopia-2014/12/14-37, gymnopedie_1.ly and gymnopedie_1.mid, treble track 1, MIDI channel 1. First 14 attacks of the existing low-register arrangement retained, including its repeated low F#3 accompaniment attacks. Existing timing preserved: no explicit noteBeats/tempo map was present, so the current practice pulse is unchanged.",
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
      "F#3"
    ]
  },
  {
    "id": "runaway",
    "title": "Runaway (piano riff)",
    "composer": "Kanye West",
    "year": 2010,
    "source": "Owner-specified 16-note riff, 28 October 2026: three E6 hits then E5; three D#6 then D#5; three C#6 then C#5; A5, A5, G#5, E6. The long opening run of E6 is cut to three hits. Keyboard shifted up one octave to retain the original register. Owner, 29 October 2026: tempo 85 BPM (the default 100 was too fast); classic piano voice.",
    "keyboardOctave": 1,
    "tempo": 85,
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
    "source": "Vocal tab supplied by Joshua, 26 October 2026 at 22:26, amended by ear: repeated descent pairs are G4 F#4 C4, then G4 F#4 B3, including their subsequent repeated notes. Bars 1-16 at 98 BPM; tied continuations are not new attacks. Owner, 29 October 2026: long holds between phrases shortened to 2 beats.",
    "licence": "User-supplied excerpt; no licence asserted",
    "tempo": 98,
    // Onset gaps from outputs/website-plan-20261026/piano-verse/no-one-noticed-score.json.
    // Last gap includes the written ending up to totalBeats=62.5, then loops.
    "noteBeats": [1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1.5,
      0.5, 0.5, 0.5, 0.5, 0.5, 2, 1, 1, 1, 2, 1, 1, 1, 2],
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
