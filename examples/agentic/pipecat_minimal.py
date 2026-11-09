"""Minimal pipecat agent that speaks and listens through local ElevenVoice.

ElevenVoice defaults to a local OpenAI-compatible TTS/STT provider. For remote
use, point it only at a protected tailnet URL. See docs/agentic-voice.md.

Run ElevenVoice first (default http://localhost:3900), then:

    uv pip install "pipecat-ai[openai,silero]"
    python examples/agentic/pipecat_minimal.py

This is a deliberately tiny skeleton: it wires the ElevenVoice TTS/STT services
into a pipecat pipeline and leaves the transport + LLM for you to choose. It
does not run a phone call or a server — that is the "agentic v1" scope
(ElevenVoice as provider, you bring the runtime).
"""

from __future__ import annotations

import os

ELEVENVOICE_BASE_URL = os.environ.get("ELEVENVOICE_API_URL", "http://localhost:3900") + "/v1"
# ElevenVoice ignores the key for local use; if you set ELEVENVOICE_API_KEY on a
# remote backend, pass that same value here.
ELEVENVOICE_API_KEY = os.environ.get("ELEVENVOICE_API_KEY", "not-needed-locally")
# A voice-profile id from GET /v1/audio/voices, or "default".
ELEVENVOICE_VOICE = os.environ.get("ELEVENVOICE_VOICE", "default")


def build_services():
    """Return (stt, tts) backed by local ElevenVoice.

    Imported lazily so this file is importable (and lint-clean) without
    pipecat installed — the smoke test in CI checks the wiring shape, not a
    live pipeline.
    """
    from pipecat.services.openai.stt import OpenAISTTService
    from pipecat.services.openai.tts import OpenAITTSService

    stt = OpenAISTTService(
        base_url=ELEVENVOICE_BASE_URL,
        api_key=ELEVENVOICE_API_KEY,
    )
    tts = OpenAITTSService(
        base_url=ELEVENVOICE_BASE_URL,
        api_key=ELEVENVOICE_API_KEY,
        voice=ELEVENVOICE_VOICE,
        model="omnivoice",
        sample_rate=24000,  # OmniVoice's default output rate
    )
    return stt, tts


def main() -> None:
    stt, tts = build_services()
    print("ElevenVoice STT + TTS services constructed against", ELEVENVOICE_BASE_URL)
    print("Wire `stt` and `tts` into your pipecat Pipeline with a transport")
    print("and an LLM service. See docs/agentic-voice.md.")


if __name__ == "__main__":
    main()
