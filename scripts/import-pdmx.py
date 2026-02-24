"""
PDMX MusicXML → Song JSON Converter

Parses MusicXML files from the Piano-MIDI.de corpus using music21,
extracts piano parts, splits into sections by rehearsal marks or
bar groups, and outputs Song JSON files.

Usage:
    python scripts/import-pdmx.py --input-dir ./pdmx-data --output-dir ./songs-json
    python scripts/import-pdmx.py --file ./pdmx-data/beethoven/fur_elise.xml

Prerequisites:
    pip install music21

Output format matches src/core/songs/songTypes.ts Song interface.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    import music21
except ImportError:
    print("Error: music21 is required. Install with: pip install music21")
    sys.exit(1)


def midi_note_number(pitch: music21.pitch.Pitch) -> int:
    """Convert a music21 Pitch to MIDI note number."""
    return pitch.midi


def beats_from_offset(offset: float, time_sig_denominator: int = 4) -> float:
    """Convert music21 offset (quarter notes) to beat position."""
    return float(offset)


def duration_in_beats(dur: music21.duration.Duration) -> float:
    """Convert music21 Duration to beats (quarter note = 1)."""
    return float(dur.quarterLength)


def extract_key_signature(score: music21.stream.Score) -> str:
    """Extract key signature from score."""
    keys = score.flatten().getElementsByClass(music21.key.KeySignature)
    if keys:
        ks = keys[0]
        if hasattr(ks, "asKey"):
            return str(ks.asKey())
        return f"{ks.sharps} sharps" if ks.sharps >= 0 else f"{abs(ks.sharps)} flats"
    return "C"


def extract_time_signature(score: music21.stream.Score) -> tuple[int, int]:
    """Extract time signature from score."""
    ts_list = score.flatten().getElementsByClass(music21.meter.TimeSignature)
    if ts_list:
        ts = ts_list[0]
        return (ts.numerator, ts.denominator)
    return (4, 4)


def extract_tempo(score: music21.stream.Score) -> int:
    """Extract tempo from score (default 120)."""
    tempos = score.flatten().getElementsByClass(music21.tempo.MetronomeMark)
    if tempos:
        return int(tempos[0].number)
    return 120


def score_to_note_events(score: music21.stream.Score) -> list[dict[str, Any]]:
    """Extract all notes from a score as NoteEvent dicts."""
    notes = []
    for element in score.flatten().notesAndRests:
        if isinstance(element, music21.note.Note):
            notes.append({
                "note": midi_note_number(element.pitch),
                "startBeat": beats_from_offset(element.offset),
                "durationBeats": duration_in_beats(element.duration),
            })
        elif isinstance(element, music21.chord.Chord):
            for pitch in element.pitches:
                notes.append({
                    "note": midi_note_number(pitch),
                    "startBeat": beats_from_offset(element.offset),
                    "durationBeats": duration_in_beats(element.duration),
                })
    notes.sort(key=lambda n: (n["startBeat"], n["note"]))
    return notes


def split_into_sections(
    notes: list[dict[str, Any]],
    beats_per_bar: int,
    bars_per_section: int = 16,
) -> list[dict[str, Any]]:
    """Split notes into sections of N bars each."""
    if not notes:
        return []

    beats_per_section = beats_per_bar * bars_per_section
    sections: list[dict[str, Any]] = []
    current_notes: list[dict[str, Any]] = []
    section_start = 0.0
    section_idx = 0

    for note in notes:
        if note["startBeat"] >= section_start + beats_per_section and current_notes:
            sections.append({
                "id": f"section-{section_idx}",
                "label": f"Section {section_idx + 1}",
                "startBeat": section_start,
                "endBeat": section_start + beats_per_section,
                "difficulty": 3,
                "layers": {
                    "melody": current_notes,
                    "full": current_notes,
                },
            })
            section_start += beats_per_section
            current_notes = []
            section_idx += 1
        current_notes.append(note)

    # Final section
    if current_notes:
        last = current_notes[-1]
        sections.append({
            "id": f"section-{section_idx}",
            "label": f"Section {section_idx + 1}",
            "startBeat": section_start,
            "endBeat": last["startBeat"] + last["durationBeats"],
            "difficulty": 3,
            "layers": {
                "melody": current_notes,
                "full": current_notes,
            },
        })

    return sections


def estimate_difficulty(notes: list[dict[str, Any]], tempo: int) -> int:
    """Heuristic difficulty from note density and tempo."""
    if not notes:
        return 1
    last_beat = max(n["startBeat"] + n["durationBeats"] for n in notes)
    density = len(notes) / max(last_beat, 1)
    score = density * (tempo / 120)
    if score < 0.5:
        return 1
    elif score < 1.0:
        return 2
    elif score < 2.0:
        return 3
    elif score < 3.0:
        return 4
    else:
        return 5


def estimate_duration(notes: list[dict[str, Any]], tempo: int) -> int:
    """Estimate duration in seconds."""
    if not notes:
        return 60
    last = max(n["startBeat"] + n["durationBeats"] for n in notes)
    return max(int((last / tempo) * 60), 10)


def convert_file(filepath: str) -> dict[str, Any] | None:
    """Convert a single MusicXML file to Song JSON."""
    try:
        score = music21.converter.parse(filepath)
    except Exception as e:
        print(f"  Error parsing {filepath}: {e}")
        return None

    notes = score_to_note_events(score)
    if len(notes) < 4:
        print(f"  Skipping {filepath}: too few notes ({len(notes)})")
        return None

    tempo = extract_tempo(score)
    time_sig = extract_time_signature(score)
    key_sig = extract_key_signature(score)
    difficulty = min(5, max(1, estimate_difficulty(notes, tempo)))

    sections = split_into_sections(notes, time_sig[0])
    if not sections:
        return None

    # Generate song ID from filename
    basename = Path(filepath).stem.lower().replace(" ", "-").replace("_", "-")
    song_id = f"pdmx-{basename}"

    # Try to extract title/artist from metadata or filename
    title = basename.replace("-", " ").title()
    if hasattr(score, "metadata") and score.metadata:
        if score.metadata.title:
            title = score.metadata.title
        artist = score.metadata.composer or "Classical"
    else:
        artist = "Classical"

    return {
        "id": song_id,
        "version": 1,
        "type": "song",
        "source": "pdmx",
        "metadata": {
            "title": title,
            "artist": artist,
            "genre": "classical",
            "difficulty": difficulty,
            "durationSeconds": estimate_duration(notes, tempo),
            "attribution": f"Piano-MIDI.de corpus",
        },
        "sections": sections,
        "settings": {
            "tempo": tempo,
            "timeSignature": list(time_sig),
            "keySignature": key_sig,
            "countIn": 4,
            "metronomeEnabled": True,
            "loopEnabled": True,
        },
        "scoring": {
            "timingToleranceMs": 50,
            "timingGracePeriodMs": 150,
            "passingScore": 70,
            "starThresholds": [70, 85, 95],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="PDMX MusicXML → Song JSON converter")
    parser.add_argument("--file", help="Single MusicXML file to convert")
    parser.add_argument("--input-dir", help="Directory of MusicXML files")
    parser.add_argument("--output-dir", default="./songs-json", help="Output directory")
    args = parser.parse_args()

    if not args.file and not args.input_dir:
        parser.error("Provide either --file or --input-dir")

    os.makedirs(args.output_dir, exist_ok=True)

    files: list[str] = []
    if args.file:
        files = [args.file]
    else:
        for root, _, filenames in os.walk(args.input_dir):
            for f in filenames:
                if f.endswith((".xml", ".mxl", ".musicxml")):
                    files.append(os.path.join(root, f))

    print(f"Found {len(files)} MusicXML files to process")

    success = 0
    for filepath in sorted(files):
        print(f"Processing: {filepath}")
        song = convert_file(filepath)
        if song:
            out_path = os.path.join(args.output_dir, f"{song['id']}.json")
            with open(out_path, "w") as f:
                json.dump(song, f, indent=2)
            print(f"  ✓ {song['id']} → {out_path}")
            success += 1

    print(f"\nDone! Converted {success}/{len(files)} files")


if __name__ == "__main__":
    main()
