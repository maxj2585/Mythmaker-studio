// Mythmaker Studio: create AI characters and chat with them, fully on-device.
import { STARTERS } from './starters.js';

const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.86';
export const MODELS = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 0.5B — quickest to get ready (about 0.4 GB)' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B — balanced (about 1 GB)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B — fastest (about 0.9 GB)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B — smarter (about 2.3 GB)' },
  { id: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC', label: 'Hermes 3 3B — best for roleplay (about 2.3 GB)' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 mini — strongest (about 3.7 GB)' },
];

// ---------- storage ----------
const KEY = { chars: 'mm.characters', chats: 'mm.chats', settings: 'mm.settings' };
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const settings = () => ({ model: MODELS[0].id, temperature: 0.8, speak: false, userName: 'You', ...load(KEY.settings, {}) });
const myCharacters = () => load(KEY.chars, []);
const allCharacters = () => [...myCharacters(), ...STARTERS];
const findCharacter = (id) => allCharacters().find((c) => c.id === id);
const isMine = (id) => myCharacters().some((c) => c.id === id);
function saveCharacter(char) {
  const list = myCharacters().filter((c) => c.id !== char.id);
  list.unshift(char); save(KEY.chars, list);
}
function deleteCharacter(id) {
  save(KEY.chars, myCharacters().filter((c) => c.id !== id));
  const chats = load(KEY.chats, {}); delete chats[id]; save(KEY.chats, chats);
}
const getChat = (id) => load(KEY.chats, {})[id] || [];
const setChat = (id, msgs) => { const chats = load(KEY.chats, {}); chats[id] = msgs.slice(-200); save(KEY.chats, chats); };
const newId = () => 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- helpers ----------
const $view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const avatar = (c, size = 64) => `<div class="avatar" style="background:${esc(c.color || '#3a3255')};width:${size}px;height:${size}px;font-size:${size / 2}px">${c.image ? `<img src="${esc(c.image)}" alt="">` : esc(c.emoji || '✦')}</div>`;
const b64encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64decode = (str) => { const b = str.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '='.repeat((4 - b.length % 4) % 4))))); };
const FIELDS = ['name', 'tagline', 'emoji', 'color', 'personality', 'backstory', 'style', 'greeting', 'tags', 'voice', 'image'];
function cleanCharacter(raw) {
  const c = {};
  for (const f of FIELDS) if (raw[f] !== undefined) c[f] = raw[f];
  c.name = String(c.name || 'Unnamed').slice(0, 60);
  c.tags = Array.isArray(c.tags) ? c.tags.map(String).slice(0, 8) : String(c.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8);
  c.voice = { pitch: Number(c.voice?.pitch) || 1, rate: Number(c.voice?.rate) || 1, name: c.voice?.name || '' };
  return c;
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- on-device AI (WebLLM) ----------
let engine = null, engineModel = null, engineLoading = null, webllm = null;
// The model starts loading in the background as soon as the site opens, so it is
// ready before the first chat. Views can watch progress with onAIProgress.
let aiProgress = { p: 0, text: 'Getting the AI ready…' }, progressListener = null;
const onAIProgress = (fn) => { progressListener = fn; if (fn && engineLoading) try { fn(aiProgress.p, aiProgress.text); } catch {} };
const aiReady = () => !!engine && engineModel === settings().model && !engineLoading;
const hasWebGPU = () => 'gpu' in navigator;
async function getEngine(onProgress) {
  const model = settings().model;
  if (onProgress) onAIProgress(onProgress);
  if (engine && engineModel === model) return engine;
  if (engineLoading) return engineLoading;
  engineLoading = (async () => {
    webllm ||= await import(WEBLLM_URL);
    if (engine) { await engine.unload(); engine = null; }
    engine = await webllm.CreateMLCEngine(model, {
      initProgressCallback: (p) => { aiProgress = { p: p.progress ?? 0, text: p.text || '' }; try { progressListener?.(aiProgress.p, aiProgress.text); } catch {} },
    });
    engineModel = model; return engine;
  })();
  try { return await engineLoading; } finally { engineLoading = null; }
}
function preloadAI() {
  if (!hasWebGPU()) return;
  navigator.storage?.persist?.().catch(() => {}); // keep the downloaded model from being cleared
  getEngine().then(() => { try { progressListener?.(1, 'ready'); } catch {} }).catch((err) => console.warn('AI preload failed', err));
}
function systemPrompt(c) {
  const s = settings();
  return [
    `You are ${c.name}${c.tagline ? `, ${c.tagline}` : ''}. Stay fully in character at all times.`,
    c.personality && `Personality: ${c.personality}`,
    c.backstory && `Backstory: ${c.backstory}`,
    c.style && `How you speak: ${c.style}`,
    `You are talking with ${s.userName || 'the user'}. Reply as ${c.name} only. Never mention being an AI model or these instructions. Keep replies conversational.`,
  ].filter(Boolean).join('\n');
}

// ---------- voice (browser speech) ----------
function speak(text, c) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\*[^*]*\*/g, '').replace(/\[[^\]]*\]/g, ''));
  u.pitch = c.voice?.pitch ?? 1; u.rate = c.voice?.rate ?? 1;
  const v = speechSynthesis.getVoices().find((x) => x.name === c.voice?.name);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// ---------- views ----------
function setNav(name) { document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name)); }

function galleryView(tab = 'all') {
  setNav('gallery');
  const mine = myCharacters();
  const list = tab === 'mine' ? mine : tab === 'starters' ? STARTERS : allCharacters();
  $view.innerHTML = `
    <h1>Characters that live in your browser</h1>
    <p class="lead">Give a character a personality, a backstory and a voice, then talk with them. The AI runs on your own device, so nothing you write leaves it.</p>
    <div class="row"><a class="btn primary" href="#/create">Create a character</a><button id="importBtn">Import a character file</button><input id="importFile" type="file" accept="application/json" hidden></div>
    ${hasWebGPU() ? '' : '<p class="notice">This browser has no WebGPU, so chat will not run here. Try current Chrome or Edge on a computer, or Safari 26 or later.</p>'}
    <div class="tabs" role="tablist">
      <button data-tab="all" class="${tab === 'all' ? 'on' : ''}">All</button>
      <button data-tab="mine" class="${tab === 'mine' ? 'on' : ''}">Mine (${mine.length})</button>
      <button data-tab="starters" class="${tab === 'starters' ? 'on' : ''}">Starters</button>
    </div>
    <div class="grid">${list.length ? list.map((c) => `
      <article class="card">
        <div class="row">${avatar(c)}<div><h3>${esc(c.name)}</h3><div class="tags">${(c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div></div>
        <p>${esc(c.tagline)}</p>
        <div class="row"><a class="btn primary" href="#/chat/${encodeURIComponent(c.id)}">Chat</a>
        ${isMine(c.id) ? `<a class="btn" href="#/edit/${encodeURIComponent(c.id)}">Edit</a>` : `<button data-remix="${esc(c.id)}">Remix</button>`}</div>
      </article>`).join('') : '<p class="lead">No characters here yet. Create one!</p>'}</div>`;
  $view.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => galleryView(b.dataset.tab));
  $view.querySelectorAll('[data-remix]').forEach((b) => b.onclick = () => {
    const src = findCharacter(b.dataset.remix);
    const copy = { ...cleanCharacter(src), id: newId(), name: src.name + ' (remix)' };
    saveCharacter(copy); location.hash = `#/edit/${copy.id}`;
  });
  $view.querySelector('#importBtn').onclick = () => $view.querySelector('#importFile').click();
  $view.querySelector('#importFile').onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      const c = { ...cleanCharacter(data.character || data), id: newId() };
      saveCharacter(c); location.hash = `#/chat/${c.id}`;
    } catch { alert('That file is not a Mythmaker character.'); }
  };
}

function editorView(id) {
  setNav('create');
  const existing = id ? findCharacter(id) : null;
  if (id && (!existing || !isMine(id))) { location.hash = '#/'; return; }
  const c = existing || { name: '', tagline: '', emoji: '✨', color: '#4c3a8a', personality: '', backstory: '', style: '', greeting: '', tags: [], voice: { pitch: 1, rate: 1 } };
  $view.innerHTML = `
    <h1>${existing ? 'Edit ' + esc(c.name) : 'Create a character'}</h1>
    <div class="panel">
      <label for="idea">Quick start <span class="hint">Describe an idea and let the on-device AI fill in the details.</span></label>
      <div class="row"><input id="idea" placeholder="e.g. a retired pirate who now runs a bakery"><button id="genBtn">Generate</button></div>
      <div class="bar" style="margin-top:10px"><i id="genBar"></i></div><p class="status" id="genStatus"></p>
    </div>
    <form id="form" class="panel" style="margin-top:16px">
      <div class="two">
        <div><label for="name">Name</label><input id="name" required maxlength="60" value="${esc(c.name)}"></div>
        <div><label for="tagline">Tagline</label><input id="tagline" maxlength="120" value="${esc(c.tagline)}"></div>
      </div>
      <div class="two">
        <div class="row" style="align-items:flex-end">
          <div style="flex:1"><label for="emoji">Emoji</label><input id="emoji" maxlength="4" value="${esc(c.emoji)}"></div>
          <div style="width:90px"><label for="color">Color</label><input id="color" type="color" value="${esc(c.color)}" style="height:44px;padding:4px"></div>
        </div>
        <div><label for="image">Picture <span class="hint">optional, stays on this device</span></label><input id="image" type="file" accept="image/*"></div>
      </div>
      <label for="personality">Personality</label><textarea id="personality" maxlength="1200">${esc(c.personality)}</textarea>
      <label for="backstory">Backstory</label><textarea id="backstory" maxlength="2000">${esc(c.backstory)}</textarea>
      <label for="style">Speaking style</label><textarea id="style" maxlength="600">${esc(c.style)}</textarea>
      <label for="greeting">First message</label><textarea id="greeting" maxlength="600">${esc(c.greeting)}</textarea>
      <label for="tags">Tags <span class="hint">comma separated</span></label><input id="tags" value="${esc((c.tags || []).join(', '))}">
      <div class="two">
        <div><label for="pitch">Voice pitch <span class="hint" id="pitchV">${c.voice?.pitch ?? 1}</span></label><input id="pitch" type="range" min="0.5" max="2" step="0.05" value="${c.voice?.pitch ?? 1}"></div>
        <div><label for="rate">Voice speed <span class="hint" id="rateV">${c.voice?.rate ?? 1}</span></label><input id="rate" type="range" min="0.5" max="1.6" step="0.05" value="${c.voice?.rate ?? 1}"></div>
      </div>
      <label for="voiceName">Voice</label><select id="voiceName"><option value="">Browser default</option></select>
      <div class="row" style="margin-top:18px">
        <button class="primary" type="submit">Save character</button>
        <button type="button" id="testVoice">Test voice</button>
        ${existing ? '<button type="button" id="exportBtn">Export file</button><button type="button" id="engineBtn">Export for game engines</button><button type="button" id="deleteBtn">Delete</button>' : ''}
      </div>
    </form>`;
  let image = c.image || '';
  const f = (k) => $view.querySelector('#' + k);
  const fillVoices = () => {
    const sel = f('voiceName'); if (!sel) return;
    const voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
    sel.innerHTML = '<option value="">Browser default</option>' + voices.map((v) => `<option ${v.name === c.voice?.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  };
  fillVoices(); if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = fillVoices;
  f('pitch').oninput = () => f('pitchV').textContent = f('pitch').value;
  f('rate').oninput = () => f('rateV').textContent = f('rate').value;
  f('image').onchange = async (e) => { image = await shrinkImage(e.target.files[0]); };
  const read = () => cleanCharacter({
    name: f('name').value.trim(), tagline: f('tagline').value.trim(), emoji: f('emoji').value.trim() || '✦', color: f('color').value,
    personality: f('personality').value.trim(), backstory: f('backstory').value.trim(), style: f('style').value.trim(), greeting: f('greeting').value.trim(),
    tags: f('tags').value, image, voice: { pitch: f('pitch').value, rate: f('rate').value, name: f('voiceName').value },
  });
  f('testVoice').onclick = () => { const r = read(); speak(r.greeting || `Hello, I am ${r.name}.`, r); };
  f('form').onsubmit = (e) => { e.preventDefault(); const r = { ...read(), id: existing?.id || newId() }; saveCharacter(r); location.hash = `#/chat/${r.id}`; };
  if (existing) {
    f('exportBtn').onclick = () => download(`${c.name.replace(/\W+/g, '-').toLowerCase()}.mythmaker.json`, JSON.stringify({ format: 'mythmaker-character', version: 1, character: cleanCharacter(c) }, null, 2));
    f('engineBtn').onclick = () => download(`${c.name.replace(/\W+/g, '-').toLowerCase()}.npc.json`, JSON.stringify(engineExport(c), null, 2));
    f('deleteBtn').onclick = () => { if (confirm(`Delete ${c.name} and its chats?`)) { deleteCharacter(c.id); location.hash = '#/'; } };
  }
  f('genBtn').onclick = async () => {
    const idea = f('idea').value.trim(); if (!idea) { f('genStatus').textContent = 'Type an idea first.'; return; }
    if (!hasWebGPU()) { f('genStatus').textContent = 'This browser cannot run the on-device AI (no WebGPU).'; return; }
    f('genBtn').disabled = true;
    try {
      const eng = await getEngine((p, t) => { f('genBar').style.width = `${Math.round(p * 100)}%`; f('genStatus').textContent = t; });
      f('genStatus').textContent = 'Writing your character…';
      const res = await eng.chat.completions.create({
        temperature: 0.9, max_tokens: 700,
        messages: [
          { role: 'system', content: 'You design characters for interactive stories. Reply with JSON only, no extra text.' },
          { role: 'user', content: `Create an original character from this idea: "${idea}". Return JSON with keys: name, tagline (under 12 words), emoji (one emoji), personality (2 sentences), backstory (3 sentences), style (how they talk, 1-2 sentences), greeting (their first line to the user, in character), tags (array of 3 short words).` },
        ],
      });
      const text = res.choices[0].message.content;
      const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      for (const k of ['name', 'tagline', 'emoji', 'personality', 'backstory', 'style', 'greeting']) if (data[k]) f(k).value = String(data[k]);
      if (data.tags) f('tags').value = [].concat(data.tags).join(', ');
      f('genStatus').textContent = 'Done. Tweak anything you like, then save.';
    } catch (err) {
      console.error(err); f('genStatus').textContent = 'Generation failed. Try again or fill in the fields yourself.';
    } finally { f('genBtn').disabled = false; }
  };
}

function engineExport(c) {
  return {
    format: 'mythmaker-npc', version: 1,
    note: 'Load this in Unity, Unreal or Godot and pass systemPrompt to any chat model. Voice values map to typical TTS pitch and rate.',
    name: c.name, tagline: c.tagline, tags: c.tags,
    systemPrompt: systemPrompt(c), greeting: c.greeting,
    voice: { pitch: c.voice?.pitch ?? 1, rate: c.voice?.rate ?? 1 },
  };
}

async function shrinkImage(file) {
  if (!file) return '';
  const img = await createImageBitmap(file);
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const s = Math.min(img.width, img.height);
  canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function chatView(id) {
  setNav('');
  const c = findCharacter(id);
  if (!c) { location.hash = '#/'; return; }
  let msgs = getChat(id);
  if (!msgs.length && c.greeting) msgs = [{ role: 'assistant', content: c.greeting }];
  $view.innerHTML = `
    <section class="chat">
      <div class="chathead">${avatar(c, 52)}<div class="grow"><h2>${esc(c.name)}</h2><div class="status">${esc(c.tagline)}</div></div>
        <label class="row" style="margin:0;font-weight:400"><input type="checkbox" id="speakToggle" style="width:auto" ${settings().speak ? 'checked' : ''}> Speak replies</label>
        <button id="shareBtn">Share</button><button id="resetBtn">New chat</button></div>
      <div class="log" id="log" aria-live="polite"></div>
      <div>
        <div class="bar"><i id="bar"></i></div><p class="status" id="status">${!hasWebGPU() ? 'This browser has no WebGPU, so chat cannot run here.' : aiReady() ? '' : 'Getting the AI ready…'}</p>
        <form class="composer" id="composer"><textarea id="input" placeholder="Message ${esc(c.name)}…" ${hasWebGPU() ? '' : 'disabled'}></textarea><button class="primary" id="send" ${hasWebGPU() ? '' : 'disabled'}>Send</button><button type="button" id="stop" hidden>Stop</button></form>
      </div>
    </section>`;
  const log = $view.querySelector('#log'), input = $view.querySelector('#input'), status = $view.querySelector('#status');
  const render = () => {
    log.innerHTML = msgs.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  };
  render();
  if (hasWebGPU() && !aiReady()) onAIProgress((p, t) => {
    if (!$view.contains(status)) return;
    $view.querySelector('#bar').style.width = t === 'ready' ? '0%' : `${Math.round(p * 100)}%`;
    status.textContent = t === 'ready' ? `${c.name} is ready to chat.` : t;
  });
  $view.querySelector('#speakToggle').onchange = (e) => save(KEY.settings, { ...settings(), speak: e.target.checked });
  $view.querySelector('#resetBtn').onclick = () => { if (!confirm('Start a new chat? This clears the current one.')) return; msgs = c.greeting ? [{ role: 'assistant', content: c.greeting }] : []; setChat(id, msgs); render(); };
  $view.querySelector('#shareBtn').onclick = async () => {
    const { image, ...rest } = cleanCharacter(c);
    const url = `${location.origin}${location.pathname}#/import/${b64encode(rest)}`;
    try { await navigator.clipboard.writeText(url); status.textContent = 'Share link copied. Anyone who opens it gets a copy of this character (pictures are not included).'; }
    catch { prompt('Copy this share link:', url); }
  };
  let stopRequested = false;
  $view.querySelector('#stop').onclick = () => { stopRequested = true; engine?.interruptGenerate(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $view.querySelector('#composer').requestSubmit(); } });
  $view.querySelector('#composer').onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text) return;
    input.value = ''; msgs.push({ role: 'user', content: text }); render(); setChat(id, msgs);
    const send = $view.querySelector('#send'), stop = $view.querySelector('#stop');
    send.disabled = true;
    try {
      const eng = await getEngine((p, t) => { $view.querySelector('#bar').style.width = `${Math.round(p * 100)}%`; status.textContent = t; });
      status.textContent = `${c.name} is typing…`; stop.hidden = false; stopRequested = false;
      const reply = { role: 'assistant', content: '' }; msgs.push(reply);
      const history = msgs.slice(-24).map(({ role, content }) => ({ role, content }));
      const stream = await eng.chat.completions.create({
        stream: true, temperature: Number(settings().temperature) || 0.8, max_tokens: 400,
        messages: [{ role: 'system', content: systemPrompt(c) }, ...history.slice(0, -1)],
      });
      for await (const chunk of stream) {
        reply.content += chunk.choices[0]?.delta?.content || '';
        const last = log.lastElementChild;
        if (last && last.classList.contains('assistant') && msgs[msgs.length - 1] === reply) last.textContent = reply.content; else render();
        log.scrollTop = log.scrollHeight;
      }
      reply.content = reply.content.trim() || '…';
      render(); setChat(id, msgs);
      status.textContent = stopRequested ? 'Stopped.' : '';
      if (settings().speak) speak(reply.content, c);
    } catch (err) {
      console.error(err);
      if (msgs[msgs.length - 1]?.role === 'assistant' && !msgs[msgs.length - 1].content) msgs.pop();
      render(); setChat(id, msgs);
      status.textContent = 'The on-device model could not run. Check Settings, try a smaller model, or reload.';
    } finally { send.disabled = false; stop.hidden = true; input.focus(); }
  };
}

function importView(code) {
  try {
    const c = { ...cleanCharacter(b64decode(code)), id: newId() };
    saveCharacter(c); location.replace(`#/chat/${c.id}`);
  } catch (err) { console.error(err); $view.innerHTML = '<h1>That share link is broken.</h1><p class="lead"><a href="#/">Back to the gallery</a></p>'; }
}

function settingsView() {
  setNav('settings');
  const s = settings();
  $view.innerHTML = `
    <h1>Settings</h1>
    <form class="panel" id="sform">
      <label for="model">AI model <span class="hint">Starts loading when the site opens and is saved in your browser, so chats never wait on a download after the first visit.</span></label>
      <select id="model">${MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
      <label for="temp">Creativity <span class="hint" id="tempV">${s.temperature}</span></label>
      <input id="temp" type="range" min="0.1" max="1.4" step="0.05" value="${s.temperature}">
      <label for="uname">What characters call you</label><input id="uname" maxlength="40" value="${esc(s.userName)}">
      <div class="row" style="margin-top:18px"><button class="primary">Save settings</button><span class="status" id="sstatus"></span></div>
    </form>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Your data</h3>
      <p class="lead">Characters and chats are saved in this browser only.</p>
      <div class="row"><button id="backup">Download backup</button><button id="wipe">Delete all my characters and chats</button></div>
      <p class="status">WebGPU: ${hasWebGPU() ? 'available' : 'not available in this browser'}</p>
    </div>`;
  const q = (k) => $view.querySelector('#' + k);
  q('temp').oninput = () => q('tempV').textContent = q('temp').value;
  q('sform').onsubmit = (e) => { e.preventDefault(); save(KEY.settings, { ...settings(), model: q('model').value, temperature: Number(q('temp').value), userName: q('uname').value.trim() || 'You' }); q('sstatus').textContent = 'Saved.'; if (!aiReady()) preloadAI(); };
  q('backup').onclick = () => download('mythmaker-backup.json', JSON.stringify({ characters: myCharacters(), chats: load(KEY.chats, {}) }, null, 2));
  q('wipe').onclick = () => { if (confirm('Delete every character and chat you made? This cannot be undone.')) { localStorage.removeItem(KEY.chars); localStorage.removeItem(KEY.chats); q('sstatus').textContent = 'Deleted.'; } };
}

// ---------- router ----------
function route() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const [, page, arg] = (location.hash || '#/').split('/');
  const id = arg ? decodeURIComponent(arg) : '';
  if (page === 'create') editorView();
  else if (page === 'edit') editorView(id);
  else if (page === 'chat') chatView(id);
  else if (page === 'import') importView(arg);
  else if (page === 'settings') settingsView();
  else galleryView();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
preloadAI();
