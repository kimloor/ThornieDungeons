# ElevenLabs Tool

Reusable GitHub Actions workflow for generating ThornieDungeons audio assets with ElevenLabs.

Workflow:

`.github/workflows/elevenlabs-tool.yml`

## Secret

Create this GitHub Actions repository secret:

`ELEVENLABS_API_KEY`

Do not commit the API key to the repository.

## Modes

### 1. `voices`

Read-only discovery mode. Lists voices available to the ElevenLabs account and uploads:

- `voices.json`
- `voices.tsv`
- `manifest.json`

Optional input:

- `voice_search` — filter by voice name/metadata.

Use this mode first to obtain a `voice_id`. It does not create audio.

### 2. `tts`

Generate speech.

Required inputs:

- `text`
- `voice_id`

Default model:

- `eleven_v3`

The v3 model is the preferred default for ThornieDungeons because it supports Thai and expressive character dialogue.

Output:

- `audio.mp3`
- `manifest.json`

### 3. `sfx`

Generate a sound effect from a text description.

Required input:

- `text`

Optional:

- `duration_seconds` — 0.5 to 30 seconds. Leave blank for automatic duration.
- `loop` — request a seamless loop.

Model:

- `eleven_text_to_sound_v2`

Output:

- `audio.mp3`
- `manifest.json`

### 4. `music`

Generate an instrumental or vocal music track from a natural-language prompt.

Required input:

- `text` — music-generation prompt.

Defaults:

- `music_model_id`: `music_v2_5`
- `music_length_seconds`: `75`

Allowed music length:

- 3 to 600 seconds.

For ThornieDungeons game BGM, explicitly request instrumental music and a loop-friendly ending unless vocals are intentionally required.

Output:

- `audio.mp3`
- `manifest.json`

The Music API requires an ElevenLabs paid plan.

## How to run

1. Open GitHub -> Actions.
2. Select **ElevenLabs Tool**.
3. Choose **Run workflow**.
4. Select a mode and fill its inputs.
5. Download the generated artifact from the completed workflow run.

Recommended first run:

- mode: `voices`
- voice_search: blank
- output_name: `elevenlabs-voices`

This verifies authentication without generating paid audio.

## ThornieDungeons workflow

Current V1 flow:

`ChatGPT / user request -> ElevenLabs Tool -> GitHub artifact -> review -> approved game asset`

V1 intentionally does **not** upload directly to R2 or edit `assets/manifest.json`. Audio should be reviewed before becoming a production asset.

After an asset is approved, it can be added to the normal R2 asset workflow separately.

## Suggested asset paths

Examples:

- `audio/bgm/main_theme.mp3`
- `audio/raid/dark_dragonlord_intro.mp3`
- `audio/raid/azure_angel_intro.mp3`
- `audio/ui/victory.mp3`
- `audio/ui/defeat.mp3`
- `audio/sfx/slash_heavy.mp3`
- `audio/sfx/boss_roar.mp3`

## Guardrails

- Never place the API key in workflow inputs, source files, logs, or manifests.
- Use `voices` to discover valid voice IDs before TTS.
- Keep generated audio as an artifact until reviewed.
- Do not overwrite production R2 assets automatically.
- Use descriptive `output_name` values so workflow artifacts are easy to identify.
- A fixed SFX duration consumes generation based on the requested duration; use automatic duration unless timing must be exact.
- Music generation remains review-first; do not automatically upload a generated song to R2.
- For reusable game BGM, request instrumental output and avoid abrupt endings where possible.

## API endpoints used

- `GET /v2/voices`
- `POST /v1/text-to-speech/{voice_id}`
- `POST /v1/sound-generation`
- `POST /v1/music`
