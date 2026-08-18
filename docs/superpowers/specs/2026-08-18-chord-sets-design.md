# Chord Sets Design

## Goal

Add profile-level visual input chords to Kanata Studio. A chord is two or more physical input keys pressed within a timeout that trigger one existing Studio `ActionSpec`, while the same keys retain their normal individual mappings when the chord does not complete.

## Approved behavior

- Chords use physical/input keys, before remapping.
- Default chord timeout is 50 ms and is configurable per Chord Set.
- Longest matching chord wins when chords overlap, e.g. `J+K` and `J+K+L`.
- A completed chord consumes its member-key actions; an incomplete chord falls back to normal mappings.
- Chord Sets are profile-level and can apply to all layers or a selected subset.
- Duplicate active chords with overlapping layer scope at the same profile precedence are invalid and block Apply.
- A more-specific app/device profile may override the same chord from a less-specific profile, matching existing mapping precedence.
- Chord outputs reuse the complete existing `ActionSpec` model, including normal keys, shortcuts, text, app launch, URL, media, TapHold, Macro, Multi, TapDance, and layer actions.
- `defchordsv2` output uses `first-release`.
- Minimum chord size is 2 keys; there is no Studio-defined maximum beyond Kanata support.
- Raw `.kbd` profiles remain authoritative and unchanged.

## Domain model

Extend `AdvancedVisualConfig` with `chord_sets` / `chordSets`, defaulting to an empty list for backward compatibility.

```text
ChordSet
  name: string
  timeoutMs: u16/u32
  layers: string[]   // empty means all layers
  chords: ChordEntry[]

ChordEntry
  keys: string[]     // canonical physical input key atoms, 2+
  action: ActionSpec
```

Chord keys are canonicalized for comparison by sorting/deduplicating only for identity/validation; UI preserves a deterministic display order.

## Resolution and precedence

`ResolvedProfile` carries effective chord sets/chords alongside mappings and layers. Profiles continue to be considered from least to most specific. A later/more-specific chord with the same canonical key set and overlapping active layer scope replaces the less-specific definition. Conflicts remaining at equal precedence are errors.

Layer scope is represented in the Studio model as enabled layers because that is easier for users. The compiler converts enabled scope to `defchordsv2`'s `disabled-layers` list using the full resolved layer set (`base` plus visual layers).

## Compilation

Visual compilation emits at most one `defchordsv2` block after layer definitions. Every chord action is compiled through the existing `action_expression()` pipeline so external actions continue to register `push-msg` bindings exactly as they do for ordinary mappings.

Each emitted row is conceptually:

```text
(keys...) action-expression timeout-ms first-release (disabled-layers...)
```

Studio validation runs before/while compiling and rejects invalid key atoms, duplicate keys inside one chord, fewer than two participants, blank set names, zero timeout, unknown layer names, and unresolved duplicate active chords.

## UI

Advanced Visual gains a `Layers | Chords` mode switch.

The Chords view contains:

- Left rail: Chord Sets.
- Main panel: selected set name, timeout (default 50 ms), active-layer selector, and chord rows.
- `Add chord` starts record mode: physical keyboard presses populate a combination such as `J + K`; a manual key picker remains available.
- Each row renders `J + K → Escape` (or an action summary).
- Selecting the output opens/reuses the existing action editor rather than introducing a chord-specific action editor.
- Invalid/conflicting rows show inline errors and prevent Apply.
- Chords never appear as a pseudo-action in the ordinary single-key action picker.

## Migration and compatibility

Serde/TypeScript reads missing `chordSets` as `[]`. Existing visual profiles serialize normally after editing. No migration is needed for raw profiles.

## Tests

Backend tests cover:

- backward-compatible deserialization with no `chordSets`;
- validation of 2+ unique physical keys, layer names, timeout, and duplicate/conflicting chords;
- profile precedence where app/device-specific chords override global chords;
- simultaneous support for `J+K` and `J+K+L`;
- one generated `defchordsv2` block with `50 first-release` and correct disabled layers;
- all chord actions flowing through `action_expression`, including external actions;
- raw profiles remaining untouched.

Frontend tests cover:

- Chords mode and Chord Set rail;
- creating/editing/removing a set and chord;
- physical record-mode key capture and minimum two-key validation;
- layer scope and timeout editing;
- reuse of the existing action editor;
- visible conflict error and Apply blocking.
