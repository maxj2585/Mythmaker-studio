# Mythmaker Studio

Create AI characters with a personality, backstory, speaking style and voice, then chat with them. The language model runs entirely in your browser with [WebLLM](https://github.com/mlc-ai/web-llm), so there is no server, no API key, and nothing you write leaves your device.

## Features
- **Gallery** of starter characters plus your own, with Remix to copy any starter.
- **Character creator** with an on-device "Generate from an idea" button, emoji or picture avatar, tags, and voice pitch/speed.
- **Chat** with streaming replies, per-character history, Stop, and optional spoken replies (browser speech).
- **Share links** that carry a character in the URL, plus JSON import/export.
- **Game-engine export**: a simple NPC JSON (system prompt, greeting, voice) for Unity, Unreal or Godot.
- **Model picker**: Qwen 2.5 1.5B (default), Llama 3.2 1B/3B, Hermes 3 3B, Phi 3.5 mini.

## Requirements
A browser with WebGPU: current Chrome or Edge on desktop, or Safari 26+. The first chat downloads the model (about 1 GB for the default) and caches it.

## Run locally
Any static server works: `python3 -m http.server 8080`, then open http://localhost:8080.

## Credits
Original code, MIT licensed. WebLLM by MLC AI is Apache-2.0 and is loaded from a CDN at runtime.
