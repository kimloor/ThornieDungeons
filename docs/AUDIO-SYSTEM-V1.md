# AUDIO SYSTEM V1

Status: DESIGN LOCKED / READY FOR IMPLEMENTATION

Project: ThornieDungeons

## Goal

Provide one centralized audio system for background music (BGM) and sound effects (SFX) before production audio assets are integrated.

V1 intentionally keeps the controls small and predictable.

## Settings UI

Location:

`Settings -> Sound`

### BGM panel

- Slider range: `0-100%`
- Default: `50%`
- Show current percentage.
- Mute checkbox appears at the right/end of the BGM panel.
- Slider changes apply immediately.
- No Save button.

### SFX panel

- Slider range: `0-100%`
- Default: `50%`
- Show current percentage.
- Mute checkbox appears at the right/end of the SFX panel.
- Slider changes apply immediately.
- No Save button.

## Mute behavior

BGM and SFX mute states are independent.

Mute does not overwrite the stored slider value.

Example:

1. BGM volume = 50%.
2. Player checks BGM Mute.
3. Effective BGM output becomes silent.
4. Stored BGM volume remains 50%.
5. Player unchecks Mute.
6. BGM returns to 50%.

A slider value of `0%` and the Mute checkbox are separate states.

## Default state

For a new player / when no persisted audio preferences exist:

- BGM volume: `50%`
- BGM mute: `false`
- SFX volume: `50%`
- SFX mute: `false`

## Persistence

Audio preferences must persist locally and survive:

- page refresh
- browser restart
- logout/login
- route changes

V1 audio preferences are device/browser preferences and do not require server persistence.

Recommended persisted shape:

```json
{
  "bgmVolume": 0.5,
  "bgmMuted": false,
  "sfxVolume": 0.5,
  "sfxMuted": false
}
```

All loaded values must be validated/clamped before use.

## Audio Manager

Game pages/components must not create independent audio behavior.

Use one centralized audio manager/service for:

- BGM playback
- SFX playback
- current volume state
- mute state
- persistence
- track changes
- duplicate/restart prevention

Conceptual channels:

```
AudioManager
├─ BGM
└─ SFX
```

No Master Volume in V1.

No Voice channel in V1.

The architecture should allow a Voice channel to be added later without replacing the BGM/SFX settings model.

## BGM routing rule

The first approved BGM is shared by:

- Login
- Main Hub
- Dungeon Lobby

These screens are one music group.

Working group key:

`main_theme`

When navigating between screens inside the same music group:

- do not restart the track
- do not seek back to the beginning
- continue the currently playing instance
- keep the current BGM volume/mute state

A track should restart/change only when the requested music group/track actually changes.

## Browser autoplay

Browser autoplay restrictions must be handled safely.

If playback cannot begin before a user gesture:

- do not treat it as an application error
- start/resume the requested BGM after the next valid user interaction
- do not create duplicate playback instances

## Initial ThornieDungeons main theme

Working title:

`Echoes Beneath Thornie`

Usage:

- Login
- Main Hub
- Dungeon Lobby

Direction:

- instrumental
- dark fantasy adventure
- approximately 70% Mystic Dark Fantasy
- approximately 30% Heroic Adventure
- mysterious but not oppressive
- suitable for repeated listening
- recognizable short melodic motif
- soft piano or harp/plucked motif
- warm strings
- subtle choir texture without lyrics
- distant bells/chimes
- restrained low percussion / light taiko pulse
- no aggressive combat drums
- no vocals
- loop-friendly ending

Suggested tempo:

`72-82 BPM`

Suggested first generation length:

`60-90 seconds`

Current first-test target:

`75 seconds`

## Asset workflow

Generated audio is review-first.

Flow:

`ElevenLabs -> GitHub Actions artifact -> user review -> approved asset -> R2 asset workflow`

Do not automatically overwrite production audio or update the production asset manifest from a generation run.

Suggested approved path:

`audio/bgm/main_theme.mp3`

Suggested manifest key:

`audio.bgm.mainTheme`

Exact production path/key must be verified against the asset manifest before integration.

## V1 implementation acceptance

Audio Settings V1 is ready when all of the following pass:

- BGM slider defaults to 50%.
- SFX slider defaults to 50%.
- BGM Mute works independently.
- SFX Mute works independently.
- Muting preserves the previous slider value.
- Unmuting restores playback at the stored slider value.
- Slider changes affect audio immediately.
- Settings survive reload.
- Login -> Main Hub -> Dungeon Lobby does not restart the same BGM.
- Re-entering the same music group does not create overlapping duplicate playback.
- Browser autoplay failure is recoverable after user interaction.
- Existing navigation/gameplay behavior remains unchanged.

## Out of scope for V1

- Master Volume
- Voice Volume
- account/server audio preference sync
- audio equalizer
- per-skill volume categories
- dynamic combat music layering
- crossfade system beyond what is necessary for safe track switching
