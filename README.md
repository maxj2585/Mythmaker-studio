# Mythmaker Studio

Create AI characters with a personality, backstory, speaking style and voice, then chat with them. The language model runs entirely in your browser with [WebLLM](https://github.com/mlc-ai/web-llm), so there is no server, no API key, and nothing you write leaves your device.

## Features
- **Gallery** of starter characters (including Odysseus, king of Ithaca) plus your own, with Remix to copy any starter.
- **Character creator** with an on-device "Generate from an idea" button, emoji or picture avatar, tags, and voice pitch/speed.
- **Chat** with streaming replies, per-character history, Stop, and optional spoken replies (browser speech).
- **Share links** that carry a character in the URL, plus JSON import/export.
- **Game-engine export**: a simple NPC JSON (system prompt, greeting, voice) for Unity, Unreal or Godot.
- **Model picker**: only models without heavy refusal training: Odysseus (default; Odysseus-style guidance on Hermes 3 3B), Hermes 3 3B, Hermes 3 8B, OpenHermes 2.5 Mistral 7B, Mistral 7B v0.3.

## Inspired by Shapes (original code)
- **Group chats** with up to five characters, who answer you and each other.
- **Free Will**: each character's setting decides how often they jump in on their own, plus a "Let them talk" button.
- **Long-term memory** per character, saved on your device, with a Memories panel to view, edit, add or forget.
- **Knowledge** (paste lore or add text files) and **Training** (example replies).
- **Personas**: profiles of you that characters can see.
- **Voice input** (browser speech recognition), **themes**, gallery **search**, and in-chat model switching.

## Requirements
A browser with WebGPU: current Chrome or Edge on desktop, or Safari 26+. The model starts downloading in the background as soon as the site opens (about 0.4 GB for the default) and is cached with persistent storage, so chats never wait on a download after that.

## Run locally
Any static server works: `python3 -m http.server 8080`, then open http://localhost:8080.

## Credits
Original code, MIT licensed. WebLLM by MLC AI is Apache-2.0 and is loaded from a CDN at runtime.

## Rooms (chat with real people)

Rooms let several people chat live with each other and with characters. Messages are stored in Firebase Realtime Database (free Spark plan). One person's device runs the AI for the room; anyone can take over with **Run the AI here**. Config lives in `firebase-config.js`.
