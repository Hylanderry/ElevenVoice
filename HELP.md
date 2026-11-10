# ElevenVoice help

Short answers for the messages ElevenVoice shows. If something here doesn't solve it, open an issue at https://github.com/Hylanderry/ElevenVoice/issues with the diagnostic bundle from **Settings → Diagnostics**.

- [Generation](#generation)
- [Startup and install](#startup-and-install)
- [Models and licences](#models-and-licences)
- [Engines](#engines)
- [Graphics cards](#graphics-cards)
- [Integrations](#integrations)

## Generation

<a name="troubleshooting"></a><a name="generation-failure-diagnosis"></a>
### A generation failed
Read the first line of the error card; it names the cause. The usual ones:
- **Out of GPU or system memory** — close other heavy apps, pick a lighter engine (Pocket TTS, KittenTTS, Supertonic) or set **Settings → Performance → Device** to CPU.
- **Disk full** — free space on the drive that holds the app data and models (Settings → Storage shows where they are).
- **Blocked by Windows App Control or antivirus** — allow the ElevenVoice folder and retry.
- **Audio could not be read or written** — re-export the file as WAV or MP3 and try again.

ElevenVoice limits the load it puts on your hardware automatically (see [power guard](#power-guard)); if your computer still restarts during generation, set `ELEVENVOICE_POWER_MODE=safe`.

<a name="unreadable-source-file"></a>
### The video or audio file can't be read
The file is damaged, still downloading, or uses an unusual codec. Re-export it as MP4 (H.264 + AAC) or WAV and drop it in again.

<a name="diarization"></a>
### Speaker separation (diarization)
Speaker separation uses a pyannote model. Install it from **Settings → Models**, accept its licence, and add a Hugging Face token if the model asks for one ([how](#huggingface-token)).

<a name="local-installation-and-repair"></a>
#### Installing or repairing the speaker model
Open **Settings → Models**, find the speaker separation model and choose **Install** (or **Repair** if it is already listed). Keep the app open until the download finishes.

## Startup and install

<a name="backend_startup_failed"></a>
### The voice engine didn't start
Restart ElevenVoice. If it happens again, open **Settings → Diagnostics**, copy the log and check the sections below for the reason it names.

<a name="startup_timeout_silent"></a><a name="startup_timeout_output"></a>
### The engine took too long to start
The first start after an install or update can take several minutes while the runtime is prepared. Leave the app open. If it keeps timing out, restart the computer and try again.

<a name="port_in_use"></a>
### Port already in use
Another program (or a second copy of ElevenVoice) is using the engine port. Quit the other copy from the tray icon, or restart the computer.

<a name="runtime_download_stalled"></a><a name="runtime_download_interrupted"></a>
### The runtime download stopped
Check your connection and choose **Retry**. Downloads resume where they stopped. If your network blocks Hugging Face or PyPI, set a mirror in **Settings → Network**.

<a name="runtime_files_locked"></a><a name="antivirus_blocked"></a>
### Files locked or blocked by antivirus
An antivirus or another process is holding the runtime files. Allow the ElevenVoice folder in your antivirus, close other copies of the app and retry.

<a name="runtime_folder_denied"></a><a name="exec_refused"></a><a name="exec_noexec_mount"></a>
### The runtime folder can't be written or run
Choose a folder you own on a local drive (not a network share, not a drive mounted without execute permission) in **Settings → Storage**.

<a name="runtime_in_synced_folder"></a>
### The runtime is inside a synced folder
OneDrive, Dropbox and similar tools lock files while they sync. Move the runtime to a folder that is not synced.

<a name="broken_venv"></a><a name="source_env_incomplete"></a><a name="pkg_resources-missing"></a>
### The Python environment is incomplete
Choose **Repair** on the error screen; ElevenVoice reinstalls the runtime. Your voices, history and models are kept.

<a name="system_library_problem"></a><a name="native_crash"></a><a name="native_access_violation"></a><a name="native_illegal_instruction"></a>
### A native library crashed
Update your graphics driver and Windows, then restart. On older processors, switch the device to CPU in **Settings → Performance**.

<a name="unsupported_platform"></a>
### This system isn't supported
ElevenVoice runs on 64-bit Windows 10/11, macOS on Apple Silicon and 64-bit Linux.

<a name="macos"></a><a name="macos-gatekeeper"></a><a name="gatekeeper-quarantine"></a>
### macOS says the app is damaged or can't be opened
Move ElevenVoice to Applications, then right-click it and choose **Open**. If macOS still refuses, run `xattr -dr com.apple.quarantine /Applications/ElevenVoice.app` in Terminal.

<a name="appimage-white-screen-on-fedora-44--ubuntu-2404"></a>
### Linux AppImage opens a white screen
Start it with `--disable-gpu`, or install the `.deb` package instead.

<a name="uninstall"></a>
### Uninstalling
Uninstall from **Windows Settings → Apps**. Voices, history and models stay in `%APPDATA%\ElevenVoice` and `%LOCALAPPDATA%\ElevenVoice`; delete those folders to remove everything.

## Models and licences

<a name="license-acceptance-flow"></a>
### Model licences
On first launch you agree once to the ElevenVoice terms and to the licences of the models it can download. Each model's licence is shown in **Settings → Models**, where you can withdraw it at any time. Some models only allow personal or research use — check before paid work.

<a name="huggingface-token"></a>
### Hugging Face token
A few models require a free Hugging Face account. Create a read token at https://huggingface.co/settings/tokens, accept the model's terms on its Hugging Face page and paste the token in **Settings → Credentials**.

<a name="pockettts-gated-weights"></a>
### Pocket TTS weights are gated
Pocket TTS weights need a Hugging Face token and accepted terms on the model page ([how](#huggingface-token)).

<a name="downloading-models"></a>
### Downloading models
Models download once from **Settings → Models** and are reused offline. Large models show progress in the download panel; keep the app open until they finish.

## Engines

<a name="engines"></a>
Install engines from **Settings → Models**. Engines marked GPU need a graphics card with the memory listed; on a smaller card they run on the CPU, which is much slower.

<a name="omnivoice"></a><a name="omnivoice-subprocess"></a><a name="omnivoice-gguf"></a>
#### OmniVoice (default)
Multilingual cloning and design in 600+ languages. Runs on GPUs from about 4 GB and on CPU; the GGUF build is the lighter option for small cards.

<a name="pockettts"></a>
#### Pocket TTS
Fast and light, runs on the CPU. Good for quick drafts. Needs a Hugging Face token ([how](#huggingface-token)).

<a name="kittentts"></a><a name="supertonic3"></a><a name="sherpa-onnx"></a>
#### KittenTTS, Supertonic, sherpa-onnx
Small engines that run well on any computer.

<a name="voxcpm2"></a>
#### VoxCPM2
High quality in 30 languages, but it needs a GPU with 8 GB or more. On smaller cards it falls back to the CPU and takes minutes per sentence — use OmniVoice or Pocket TTS there.

<a name="indextts"></a><a name="moss-tts-v15"></a><a name="moss-tts-nano"></a><a name="confucius4-tts"></a><a name="dots-tts"></a><a name="cosyvoice"></a><a name="cosyvoice-gguf"></a><a name="gpt-sovits"></a>
#### IndexTTS, MOSS-TTS, Confucius4, dots.tts, CosyVoice, GPT-SoVITS
These engines install into their own environment the first time you select them. If the automatic install fails, retry from **Settings → Models**; keep the app open and connected while it downloads.

<a name="audio-cpp"></a>
#### audio.cpp engines
Native engines that use Vulkan on any GPU. Install them from **Settings → Models**; update your graphics driver if they fail to start.

<a name="mlx-audio"></a>
#### MLX engines
Apple Silicon only.

## Graphics cards

<a name="power-guard"></a>
### Power guard
ElevenVoice picks a load profile from your graphics card so long generations never push it to the point of restarting the computer:

| Profile | GPU memory | CPU | Active time | Used on |
|---|---|---|---|---|
| Safe | 70% | 50% | 60% | GPUs up to 6 GB |
| Balanced | 85% | 75% | 85% | GPUs up to 10 GB and computers without a GPU |
| Performance | 90% | 90% | 95% | larger GPUs |
| Full | 100% | 100% | 100% | only when chosen |

On NVIDIA cards it also rests longer when the card runs hot or near its power limit. Set `ELEVENVOICE_POWER_MODE` to `safe`, `balanced`, `performance`, `full` or `auto`.

<a name="windows-rocm"></a><a name="amd-gpu-rocm"></a><a name="rocm_not_configured"></a>
### AMD graphics cards
AMD cards use ROCm where it is supported, and Vulkan (audio.cpp engines) everywhere else. If ROCm isn't set up, choose CPU or an audio.cpp engine in **Settings → Performance**.

<a name="remote-gpu"></a>
### Using a GPU on another computer
Run ElevenVoice on the computer with the GPU, turn on network access there, and connect to it from **Settings → Remote engine**.

## Integrations

<a name="mcp"></a>
### MCP (Claude, Cursor, Codex, Hermes Agent)
Turn on **Local MCP server** in **Integrations**, then copy the ready-made configuration for your agent from the same page. The server is at `http://127.0.0.1:3900/mcp/` while ElevenVoice is open or in the tray.

<a name="api-auth"></a>
### Local API and keys
The OpenAI-compatible API is at `http://127.0.0.1:3900/v1` (`tts-1` for speech, `whisper-1` for transcription). Calls from the same computer need no key. To reach it from another device, set `ELEVENVOICE_API_KEY` and send it as a bearer token over HTTPS.

<a name="openai-agents-sdk"></a>
### OpenAI Agents SDK
Point the SDK's base URL at `http://127.0.0.1:3900/v1` and use any key on the same computer.

<a name="n8n"></a>
### n8n
Use an OpenAI node with base URL `http://127.0.0.1:3900/v1`, model `tts-1` for speech or `whisper-1` for transcription. A ready workflow is on the Integrations page.

<a name="docker"></a>
### Docker
Use the compose file in `deploy/docker-compose.yml` on a Linux machine with an NVIDIA GPU and the NVIDIA container toolkit.

<a name="calls"></a><a name="twilio"></a>
### Phone calls
Connect a Twilio number in **Integrations → Twilio**; ElevenVoice answers with the voice and model you choose.

<a name="integration-directory"></a><a name="desktop-account-client"></a>
### Other integrations
Every supported tool is listed in **Integrations**, each with its own setup steps.
