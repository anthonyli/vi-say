# vi-say

[简体中文](README.md) | English

**Explain it with visuals and voice.**

`vi-say` combines **Visual + Say**. It is an Agent Skill for AI coding assistants that turns GitHub projects, websites, articles, recorded footage, and knowledge topics into explainer videos, with matching posters and publishing copy.

The bundled 3D-style cartoon dragon is an example visual style. Characters, colors, voices, posters, and animations can be customized separately. The agent entry point is [SKILL.md](SKILL.md); invoke the skill as `$vi-say`.

The workflow references and example posters are currently written in Chinese. State the desired narration language in your request; the local speech command defaults to Chinese.

## Examples

For complete videos, search for the creator account **ABCD伐木雷** on social media platforms.

| Pet-system walkthrough | Handy tool introduction |
|:---:|:---:|
| <img src="docs/examples/pet-system/poster-3x4.png" alt="Pet-system walkthrough poster: Claude Code connects to GPT, an impeccable case study" width="320"> | <img src="docs/examples/handy/poster-3x4.png" alt="Handy introduction poster: write by speaking" width="320"> |
| [3:4 original](docs/examples/pet-system/poster-3x4.png) · [4:3 original](docs/examples/pet-system/poster-4x3.png) · [Wide original](docs/examples/pet-system/poster-wide.png) | [3:4 original](docs/examples/handy/poster-3x4.png) · [4:3 original](docs/examples/handy/poster-4x3.png) · [Wide original](docs/examples/handy/poster-wide.png) |

## Install and use

### 1. Install the skill

Clone or download this repository, then enter its root directory containing `SKILL.md`. For a first local installation in Codex, create a user-level symbolic link so source changes are available through the installed skill:

```sh
mkdir -p "$HOME/.agents/skills"
ln -s "$PWD" "$HOME/.agents/skills/vi-say"
```

If a skill with that name already exists, update the existing installation instead of creating another link inside it.

You can also copy the complete skill directory to `~/.agents/skills/vi-say/`. A `vi-say.skill` distribution is a ZIP archive: extract its `vi-say/` directory into your agent's skill directory. Keep `SKILL.md`, `LICENSE`, `references/`, `scripts/`, and `assets/` together.

Codex also supports project-level skills under `.agents/skills/vi-say/`. See the [official skill documentation](https://learn.chatgpt.com/docs/build-skills) for discovery locations, symbolic links, and explicit invocation. For other agents, use their supported installation locations and invocation methods; this repository has not been verified individually with every agent.

### 2. Invoke `$vi-say`

Open your production project and describe the task to your agent. Include `$vi-say` to explicitly select this skill. In the Codex CLI or IDE extension, use `/skills` or type `$` to find it. Restart Codex if a new installation has not been discovered.

Copy this template and replace the bracketed values:

```text
Use $vi-say to turn [project URL / website / article / topic / local video path]
into an explainer video for [audience], focused on [one problem or benefit].
Target duration: [duration]. Aspect ratio: [ratio]. Narration language: [language].
Audio: [preserve the recording / use an authorized local voice].
Show one representative poster first, then create the script, demonstration,
and animation. Deliver the video, posters, and publishing copy.
```

Provide the information you already have. The bundled style supplies defaults, so you do not need to fill in every configuration field manually. To review the direction before production, add: **"Only create the poster and outline first. Wait for my confirmation before making the video."**

### 3. Choose a scenario

| Scenario | Example request |
|---|---|
| GitHub / open-source project | Use $vi-say to introduce [repository URL] to developers. Explain the problem it solves, key features, basic usage, and who it is for. Show the poster first. |
| Website / product | Use $vi-say to introduce [product website] through one practical use case, showing the real interface and results. |
| Article / link | Use $vi-say to explain [article URL]. Extract three key ideas, preserve conditions and sources, and use diagrams where useful. |
| Recorded-video editing | Use $vi-say to edit [recording path]. Preserve the original audio and full screen content, remove repetition and excess pauses, and add chapters and highlights. |
| Knowledge explainer | Use $vi-say to explain [topic] to beginners through examples, flowcharts, and state changes. Start with a poster and outline. |
| Practical case study | Use $vi-say to explain this project: [goal and material paths]. Show before and after, then the key steps and final result. |

These scenarios can be combined. A GitHub introduction can include a real demonstration and an explanation of the underlying mechanism. Research and source collection use the agent's available browser or connectors; the repository does not provide a universal link-scraping service.

### 4. Prepare capabilities and iterate

The agent checks the environment needed for the task. Editing and rendering require Python, Node/npm, FFmpeg, suitable fonts, and the corresponding dependencies. New narration also requires a local model and an authorized reference voice; see [local speech setup](references/tools/local-tts.md). Store voice samples, accurate transcripts, and configuration in the production project's `private/voice/`. Private voice assets are not bundled with the public skill. You can request a silent preview while speech prerequisites are being prepared.

By default, download speech models into **the current production project's `private/models/`**. They stay with that project when it is moved or deleted. You can instead reuse a shared model through a relative configuration path or a project-local symbolic link. Installing or removing the skill does not automatically download or delete models.

Keep authorized voice profiles in separate directories such as `private/voice/female/` and `private/voice/male/`. Choose a profile explicitly or randomly once per episode. Narration, revisions, and the outro reuse that selection; see [voice selection](references/tools/local-tts.md#多音色与每期选择).

Final posters normally use the image-generation tool available to your agent. Script-generated covers are optional layout drafts. Source links require browser or connector access, and local files must be accessible to the agent.

After reviewing a poster or preview, you can ask for a different headline, revised narration, a flowchart, or a new transition. Keep episode-specific requests in the task conversation. For lasting defaults, edit the relevant [workflow stage](references/workflow.md); for new behavior, follow the [extension guide](references/extensions.md).

## Shared production workflow

**Understand the material → find the core idea → preview a poster → write the full script and storyboard → edit original audio or synthesize narration → build the timeline and visuals → preview → review and deliver.**

| Stage | Expected result |
|---|---|
| Understand and distill | Audience, one core problem, concrete benefit, and supporting material |
| **Early poster** | One representative poster showing the topic, emphasis, and visual direction |
| Script and storyboard | Complete narration or original-audio ranges, with the objects, actions, and results to show |
| Audio | An edited original recording, or local narration checked for terminology and listening quality |
| Timeline and visuals | Captions, characters, flowcharts, demonstrations, emphasis, and transitions timed to the final audio |
| Preview | Review of key layouts, motion, joins, and audio/visual correspondence |
| Delivery | Video, audio, required captions, posters in three aspect ratios, publishing copy, and actual review records |

The poster appears before full script writing and narration. Balance a full composition with comfortable outer margins; distribute 16:9 content across the width. Include the fixed typography/material reference in every image call, and preserve established lettering, sizes, layout, subject proportions, and accents during targeted revisions. By default, make one generation call per required ratio, check and show the result, then reuse it throughout production and delivery. Report issues without automatically generating more images. When the user explicitly requests a change, generate one revision for the specified ratio; see the [poster stopping rules](references/stages/poster.md#生成次数与停止条件). At delivery, check consistency with the video and complete only ratios not previously attempted. The poster helps assess the subject and visual direction; motion, pronunciation, and demonstration accuracy need later review. Wait for poster approval when the user explicitly requests that pause; otherwise continue within the task's existing instructions.

Generated narration uses complete-sentence samples covering every term, then full-track listening for pronunciation, fluency, and voice consistency. Formal audible cartoon output validates that record against the current files; unreviewed audio requires an explicit, visibly marked candidate. See the [voice workflow](references/stages/voice.md) and [render gate](references/tools/production.md#底层有声小龙门禁).

## Shared capabilities

| Capability | Current implementation or workflow |
|---|---|
| Content and scripts | Agent-led research, topic selection, narration, storyboarding, and source checks |
| Language and voice | Original audio, authorized local voice references, language settings, terminology, pauses, and loudness processing |
| Captions and timing | Timestamp input, caption alignment, emphasis, SRT, and caption post-processing |
| Characters and visuals | Dragon artwork, left/right placement, mirroring, audio-volume-driven mouth movement, colors, and fonts |
| Diagrams and demonstrations | Steps, comparisons, flow relationships, bar charts, screenshots, recordings, and state changes |
| Animation and transitions | Explicit action durations, character movement, four default transitions, and shared-element tools |
| Consistent outro | Comment → follow → like, with the same voice and measured word timings |
| Posters | Early preview, image-generation guidance, and separate compositions for three aspect ratios |
| Publishing copy | Episode title, body, relevant links, engagement prompts, and hashtags |
| Review and delivery | Timing and structure checks, evidence and hashes, visual review, audio revision records, and packaging |

`production.py` integrates the default character scenes, asset preparation, mouth analysis, cover drafts, and Remotion rendering. Narration, recording edits, captions, and specialized animation use separate entry points. A single render command does not automatically perform research, writing, narration, and every review step.

## Script commands for development

For everyday use, give the agent a task using the examples above. Run these commands from the repository root when developing or debugging a production project.

```sh
python scripts/production.py init work/demo --title 'Make ideas move' --subtitle 'Characters, rhythm, and color'
```

Create and show a representative poster following the [poster guidelines](references/stages/poster.md). For an optional code-composed cover draft:

```sh
python scripts/production.py covers work/demo/project.json --output-dir outputs/demo-covers
```

Fill in `narration.txt`, the terminology table, and the scenes. The initial scenes are timing examples for a silent preview; final scenes must be retimed to the actual audio:

```sh
python scripts/production.py render work/demo/project.json --output-dir outputs/demo-preview --preview
```

Final rendering requires the final WAV and a genuine listening-review record. See the [production interface](references/tools/production.md):

```sh
python scripts/production.py render work/demo/project.json --output-dir outputs/demo-final --audio work/demo/final.wav --listening work/demo/REVIEW.json
```

Python requires Pillow; mouth analysis and some graphics tools also need NumPy. Audio/video operations require FFmpeg; some scripts can use `imageio-ffmpeg`. Remotion requires Node/npm and a compatible browser. Use appropriately licensed fonts with the glyphs your content needs; set `VIDEO_FONT_BOLD` when necessary. Speech dependencies, models, and reference voices have a separate [setup guide](references/tools/local-tts.md).

Remotion dependencies are cached in `.cache/remotion/` by lockfile, architecture, and Node major version for reuse across projects.

## Repository structure and customization

```text
SKILL.md                    Agent entry point, constraints, version, and license
LICENSE                     MIT license
references/workflow.md      Shared workflow and scenario routing
references/extensions.md    Configuration, animation, and scene extension points
references/stages/          Individual workflow stages and review requirements
references/tools/           Speech, editing, rendering, and repair interfaces
references/styles/          Replaceable character and color guidance
references/runtime/         CPU dependency versions and model provenance
scripts/                    Production, narration, editing, captions, and checks
scripts/tests/              Python regression tests; excluded from skill bundles
assets/production/          Default artwork, colors, motion settings, and outro
assets/remotion/            Scenes, diagrams, transitions, and rendering
assets/shared-motion/       Shared elements and spatial transitions
assets/editorial-motion/    Six editorial layouts and silent examples
assets/anatomy-video/       Time-driven SVG explainer rendering
```

### Script responsibilities

| Purpose | Scripts |
|---|---|
| Default production, cover drafts, and mouth movement | `production.py`, `production_design.py`, `speech_motion.py` |
| Voice selection, local speech, tempo, and terminology | `select_voice.py`, `local_voice.py`, `local_voice_segments.py`, `run_cpu_voice.sh`, `audio_timing.py`, `pronunciation.py` |
| Recording edits and captions | `prepare_recording.py`, `align_captions.py`, `render_captions.py` |
| Simple image-timeline video | `render_video.py` |
| Motion/spatial plans, visual changes, and delivery records | `audit_motion.py`, `scan_visual_holds.py`, `check_spatial_plan.py`, `check_visual_plan.py`, `check_acceptance.py` |
| Audio revision records, energy changes, and noise-reduction evidence | `audio_acceptance_candidate.py`, `audio_revision_audit.py`, `check_audio_energy_regression.py`, `check_background_utility.py` |

With the Python dependencies installed, run the regression tests:

```sh
python -m unittest discover -s scripts/tests -p 'test_*.py'
```

### Replace individual parts

| What to change | Where to start |
|---|---|
| Colors | [Color guidance](references/styles/colors.md), `style.json.palette` |
| Poster style | [Poster stage](references/stages/poster.md), `style.json.poster`, and reference images |
| Voice and language | [Local speech](references/tools/local-tts.md) and the production project's private voice configuration |
| Character and mouth movement | [Character guidance](references/styles/character.md), character artwork, `src/cartoon.jsx` |
| Motion timing and default transition pool | `style.json.motion` |
| New or replacement transitions | `cartoon-transitions.mjs`, called through `cartoon-motion.mjs` |
| New diagrams or scenes | The relevant JSX/Python/SVG implementation and input validation; see [extensions](references/extensions.md) |
| Outro | `assets/production/outro.json`, retimed to the actual narration in each episode |
| Publishing copy | [Publishing-copy stage](references/stages/publishing-copy.md) |

All eleven workflow stages have separate Markdown files. Edit the relevant stage to change reusable guidance. New behavior outside existing parameters also requires implementation and validation; the extension guide describes where it belongs. Keep one-off choices in the current production task.

## Current scope

- The default dragon and complete Remotion editorial scenes support 16:9 video. Posters have separate 4:3, 3:4, and 16:9 compositions. Vertical character video needs its own layout implementation.
- The character uses transparent image layers with a 3D-style appearance. Mouth opening follows audio volume; this is not a 3D rig or phoneme-based lip sync.
- Local speech supports MLX or PyTorch CPU backends. Captions require external ASR/alignment results; there is no unified ASR installation and conversion entry point yet.
- The default speech language is Chinese. Specify English or another desired language and test it with your chosen model and voice before producing the full narration. Bundled example text also needs to be adapted to that language.
- Automated checks validate structure, timing, records, and artifact identity. Visual quality and listening still require actual review. Specialized rendering routes are not all integrated into the default production command.

## Versioning and distribution

The single version source is `metadata.version` in [SKILL.md](SKILL.md), using the [Agent Skills metadata field](https://agentskills.io/specification#metadata-field). Development versions use a `-dev` suffix. For a release, update the version without that suffix and create the corresponding Git tag. The existing `0.0.1` tag preserves the earlier main-branch baseline.

```sh
python scripts/production.py pack outputs/vi-say.skill
```

A `.skill` file is a ZIP archive whose top-level directory is `vi-say`. Its `SKILL.md` carries the same version, and its `LICENSE` carries the MIT notice. The package includes runtime instructions, scripts, and assets while excluding tests, caches, working directories, outputs, and private material.

Editing this repository does not update separately copied skill installations. The repository is [anthonyli/vi-say](https://github.com/anthonyli/vi-say); the skill name and invocation are `vi-say` and `$vi-say`.

## License

This project is licensed under the [MIT License](LICENSE). Character-generation provenance is recorded in `assets/production/character.json`. Third-party dependencies, reference materials, fonts, and voices remain subject to their respective licenses. Private voices, models, fonts, credentials, and dependency caches are not distributed with the skill.
