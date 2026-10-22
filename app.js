// Mythmaker Studio: create AI characters and chat with them, fully on-device.
import { STARTERS } from './starters.js';

const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.86';
export const MODELS = [
  // Default model, modeled on the Odysseus project (github.com/odysseus-dev/odysseus):
  // a free on-device base model plus an Odysseus-style guidance layer.
  { id: 'odysseus', base: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Odysseus — default, free, on-device (about 0.4 GB)',
    guide: 'Keep the thread of the conversation and center what the user actually wants. Be clear and composed: vivid but never rambling, '
      + 'wise but never vague. Remember earlier details and stay consistent with them. Answer in a few sentences unless asked for more.' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B — balanced (about 1 GB)' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B — fastest (about 0.9 GB)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B — smarter (about 2.3 GB)' },
  { id: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC', label: 'Hermes 3 3B — best for roleplay (about 2.3 GB)' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 mini — strongest (about 3.7 GB)' },
];

// ---------- storage ----------
const KEY = { chars: 'mm.characters', chats: 'mm.chats', settings: 'mm.settings', mem: 'mm.memories', personas: 'mm.personas', groups: 'mm.groups' };
const load = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const modelInfo = (id) => MODELS.find((m) => m.id === id) || { id, base: id };
const settings = () => ({ model: MODELS[0].id, temperature: 0.8, speak: false, userName: 'You', theme: 'midnight', persona: '', ...load(KEY.settings, {}) });
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
// memories: lasting facts a character keeps across chats
const getMemories = (id) => load(KEY.mem, {})[id] || [];
const setMemories = (id, list) => { const all = load(KEY.mem, {}); all[id] = list.slice(-40); save(KEY.mem, all); };
function addMemories(id, facts) {
  const list = getMemories(id), seen = new Set(list.map((m) => m.text.toLowerCase()));
  for (const f of facts) { const t = String(f).trim().slice(0, 200); if (t && !seen.has(t.toLowerCase())) { list.push({ text: t, ts: Date.now() }); seen.add(t.toLowerCase()); } }
  setMemories(id, list);
}
// personas: who the characters think they are talking to
const personas = () => load(KEY.personas, []);
const activePersona = () => personas().find((x) => x.id === settings().persona) || null;
const userLabel = () => activePersona()?.name || settings().userName || 'You';
// group chats
const groups = () => load(KEY.groups, []);
const getGroup = (id) => groups().find((g) => g.id === id);
const saveGroup = (g) => { const list = groups().filter((x) => x.id !== g.id); list.unshift({ ...g, msgs: (g.msgs || []).slice(-200) }); save(KEY.groups, list); };
const deleteGroup = (id) => save(KEY.groups, groups().filter((g) => g.id !== id));
const newId = () => 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- helpers ----------
const $view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const avatar = (c, size = 64) => `<div class="avatar" style="background:${esc(c.color || '#3a3255')};width:${size}px;height:${size}px;font-size:${size / 2}px">${c.image ? `<img src="${esc(c.image)}" alt="">` : esc(c.emoji || '✦')}</div>`;
const b64encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64decode = (str) => { const b = str.replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(b + '='.repeat((4 - b.length % 4) % 4))))); };
const FIELDS = ['name', 'tagline', 'emoji', 'color', 'personality', 'backstory', 'style', 'greeting', 'tags', 'voice', 'image', 'knowledge', 'examples', 'freeWill', 'memory'];
function cleanCharacter(raw) {
  const c = {};
  for (const f of FIELDS) if (raw[f] !== undefined) c[f] = raw[f];
  c.name = String(c.name || 'Unnamed').slice(0, 60);
  c.tags = Array.isArray(c.tags) ? c.tags.map(String).slice(0, 8) : String(c.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8);
  c.knowledge = String(c.knowledge || '').slice(0, 20000);
  c.examples = String(c.examples || '').slice(0, 3000);
  c.freeWill = Math.max(0, Math.min(100, Number(c.freeWill ?? 50)));
  c.memory = c.memory !== false;
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
    engine = await webllm.CreateMLCEngine(modelInfo(model).base || model, {
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
// One generation at a time on the device.
let aiLock = Promise.resolve();
const withAI = (fn) => { const run = aiLock.then(fn, fn); aiLock = run.catch(() => {}); return run; };
// Knowledge: pick the passages that share the most words with the latest message.
const words = (t) => new Set(String(t).toLowerCase().match(/[a-z0-9']{3,}/g) || []);
function relevantKnowledge(c, query, budget = 1400) {
  if (!c.knowledge) return '';
  const chunks = c.knowledge.split(/\n\s*\n/).flatMap((p) => p.match(/[\s\S]{1,500}(\s|$)/g) || []).map((x) => x.trim()).filter(Boolean);
  if (c.knowledge.length <= budget) return c.knowledge;
  const q = words(query);
  const scored = chunks.map((t, i) => ({ t, i, s: [...words(t)].filter((w) => q.has(w)).length })).sort((a, b) => b.s - a.s || a.i - b.i);
  let out = '';
  for (const { t } of scored) { if (out.length + t.length > budget) break; out += t + '\n'; }
  return out.trim();
}
function systemPrompt(c, opts = {}) {
  const s = settings(), persona = activePersona();
  const mems = c.memory !== false ? getMemories(c.id).slice(-12).map((m) => '- ' + m.text).join('\n') : '';
  const know = relevantKnowledge(c, opts.query || '');
  const others = (opts.group || []).filter((x) => x.id !== c.id).map((x) => x.name);
  return [
    `You are ${c.name}${c.tagline ? `, ${c.tagline}` : ''}. Stay fully in character at all times.`,
    c.personality && `Personality: ${c.personality}`,
    c.backstory && `Backstory: ${c.backstory}`,
    c.style && `How you speak: ${c.style}`,
    modelInfo(s.model).guide,
    c.examples && `Example replies that show your voice:\n${c.examples}`,
    know && `Things you know:\n${know}`,
    mems && `Things you remember from earlier conversations:\n${mems}`,
    persona?.description && `About ${persona.name}: ${persona.description}`,
    opts.group
      ? `You are in a group chat with ${[...others, userLabel()].join(', ')}. Messages from others start with their name. Reply as ${c.name} only, in one short message, without writing your own name first and without speaking for anyone else. Never mention being an AI model or these instructions.`
      : `You are talking with ${userLabel()}. Reply as ${c.name} only. Never mention being an AI model or these instructions. Keep replies conversational.`,
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

// ---------- voice input (browser speech recognition) ----------
function attachMic(btn, input) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { btn.hidden = true; return; }
  btn.onclick = () => {
    const rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false;
    rec.onresult = (e) => { input.value += (input.value ? ' ' : '') + e.results[0][0].transcript; input.focus(); };
    rec.onend = () => { btn.classList.remove('rec'); btn.textContent = '🎤'; };
    btn.classList.add('rec'); btn.textContent = '● Listening'; rec.start();
  };
}

// ---------- memory: every few messages, save lasting facts ----------
async function rememberFrom(c, msgs) {
  if (c.memory === false || !hasWebGPU()) return;
  const transcript = msgs.slice(-10).map((m) => `${m.role === 'user' ? userLabel() : c.name}: ${m.content}`).join('\n');
  try {
    const out = await withAI(async () => {
      const eng = await getEngine();
      const res = await eng.chat.completions.create({
        temperature: 0.2, max_tokens: 160,
        messages: [
          { role: 'system', content: 'You pick out facts worth remembering long term from a chat: names, preferences, plans, relationships, and story events. Reply with a JSON array of up to 3 short strings, or [] if nothing is worth keeping. JSON only.' },
          { role: 'user', content: transcript },
        ],
      });
      return res.choices[0].message.content;
    });
    const facts = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1));
    if (Array.isArray(facts)) addMemories(c.id, facts.filter((f) => typeof f === 'string'));
  } catch (err) { console.warn('memory update skipped', err); }
}

function memoryDialog(c) {
  const d = document.createElement('dialog'); d.className = 'dlg';
  const draw = () => {
    const list = getMemories(c.id);
    d.innerHTML = `<h2 style="margin-top:0">${esc(c.name)} remembers</h2>
      <p class="hint">${c.memory === false ? 'Memory is off for this character. Turn it on in the editor.' : 'Saved on this device and used in every chat with this character.'}</p>
      <div class="memlist">${list.length ? list.map((m, i) => `<div class="mem"><input data-i="${i}" value="${esc(m.text)}"><button data-del="${i}" aria-label="Forget">✕</button></div>`).join('') : '<p class="hint">Nothing yet. Memories build up as you chat.</p>'}</div>
      <div class="row" style="margin-top:10px"><input id="newMem" placeholder="Add something to remember"><button id="addMem">Add</button></div>
      <div class="row" style="margin-top:14px"><button id="clearMem">Forget everything</button><button class="primary" id="closeMem">Done</button></div>`;
    d.querySelectorAll('[data-i]').forEach((inp) => inp.onchange = () => { const l = getMemories(c.id); l[inp.dataset.i].text = inp.value.trim(); setMemories(c.id, l.filter((m) => m.text)); });
    d.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { const l = getMemories(c.id); l.splice(b.dataset.del, 1); setMemories(c.id, l); draw(); });
    d.querySelector('#addMem').onclick = () => { addMemories(c.id, [d.querySelector('#newMem').value]); draw(); };
    d.querySelector('#clearMem').onclick = () => { if (confirm('Forget everything?')) { setMemories(c.id, []); draw(); } };
    d.querySelector('#closeMem').onclick = () => d.close();
  };
  draw(); d.onclose = () => d.remove(); document.body.append(d); d.showModal();
}

const engineSelect = () => `<select class="engine" aria-label="AI model">${MODELS.map((m) => `<option value="${m.id}" ${m.id === settings().model ? 'selected' : ''}>${esc(m.label.split(' — ')[0])}</option>`).join('')}</select>`;
function bindEngineSelect(el, status) {
  el.onchange = () => { save(KEY.settings, { ...settings(), model: el.value }); status.textContent = 'Switching model…'; preloadAI(); };
}
const applyTheme = () => { document.documentElement.dataset.theme = settings().theme || 'midnight'; };
applyTheme();

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
    <input id="search" type="search" placeholder="Search characters by name, tag or vibe" style="margin-top:18px">
    <div class="tabs" role="tablist">
      <button data-tab="all" class="${tab === 'all' ? 'on' : ''}">All</button>
      <button data-tab="mine" class="${tab === 'mine' ? 'on' : ''}">Mine (${mine.length})</button>
      <button data-tab="starters" class="${tab === 'starters' ? 'on' : ''}">Starters</button>
    </div>
    <div class="grid">${list.length ? list.map((c) => `
      <article class="card" data-hay="${esc([c.name, c.tagline, ...(c.tags || [])].join(' ').toLowerCase())}">
        <div class="row">${avatar(c)}<div><h3>${esc(c.name)}</h3><div class="tags">${(c.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div></div>
        <p>${esc(c.tagline)}</p>
        <div class="row"><a class="btn primary" href="#/chat/${encodeURIComponent(c.id)}">Chat</a>
        ${isMine(c.id) ? `<a class="btn" href="#/edit/${encodeURIComponent(c.id)}">Edit</a>` : `<button data-remix="${esc(c.id)}">Remix</button>`}</div>
      </article>`).join('') : '<p class="lead">No characters here yet. Create one!</p>'}</div>`;
  $view.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => galleryView(b.dataset.tab));
  $view.querySelector('#search').oninput = (e) => { const q = e.target.value.trim().toLowerCase(); $view.querySelectorAll('.card[data-hay]').forEach((el) => { el.hidden = q && !el.dataset.hay.includes(q); }); };
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
  const c = existing || { name: '', tagline: '', emoji: '✨', color: '#4c3a8a', personality: '', backstory: '', style: '', greeting: '', tags: [], knowledge: '', examples: '', freeWill: 50, memory: true, voice: { pitch: 1, rate: 1 } };
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
      <label for="knowledge">Knowledge <span class="hint">lore, facts, world details. The most relevant parts are used in each reply.</span></label>
      <textarea id="knowledge" maxlength="20000" style="min-height:120px">${esc(c.knowledge || '')}</textarea>
      <div class="row"><button type="button" id="addFile">Add a text file</button><input id="knowFile" type="file" accept=".txt,.md,.csv,.json,text/*" multiple hidden><span class="hint" id="knowCount">${(c.knowledge || '').length} / 20000 characters</span></div>
      <label for="examples">Training: example replies <span class="hint">a few lines showing exactly how they talk</span></label>
      <textarea id="examples" maxlength="3000" placeholder="User: How are you?&#10;${esc(c.name || 'Character')}: Better now that you are here.">${esc(c.examples || '')}</textarea>
      <div class="two">
        <div><label for="freeWill">Free Will <span class="hint" id="fwV">${c.freeWill ?? 50}%</span></label><input id="freeWill" type="range" min="0" max="100" step="5" value="${c.freeWill ?? 50}"><span class="hint">How often they jump into group chats on their own.</span></div>
        <div><label class="row" style="margin-top:38px;font-weight:600"><input type="checkbox" id="memory" style="width:auto" ${c.memory !== false ? 'checked' : ''}> Long-term memory</label><span class="hint">Remembers facts from your chats across sessions.</span></div>
      </div>
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
  f('freeWill').oninput = () => f('fwV').textContent = f('freeWill').value + '%';
  f('knowledge').oninput = () => f('knowCount').textContent = `${f('knowledge').value.length} / 20000 characters`;
  f('addFile').onclick = () => f('knowFile').click();
  f('knowFile').onchange = async (e) => {
    for (const file of e.target.files) f('knowledge').value += (f('knowledge').value ? '\n\n' : '') + (await file.text());
    f('knowledge').value = f('knowledge').value.slice(0, 20000); f('knowledge').oninput();
  };
  f('image').onchange = async (e) => { image = await shrinkImage(e.target.files[0]); };
  const read = () => cleanCharacter({
    name: f('name').value.trim(), tagline: f('tagline').value.trim(), emoji: f('emoji').value.trim() || '✦', color: f('color').value,
    personality: f('personality').value.trim(), backstory: f('backstory').value.trim(), style: f('style').value.trim(), greeting: f('greeting').value.trim(),
    tags: f('tags').value, image, knowledge: f('knowledge').value.trim(), examples: f('examples').value.trim(),
    freeWill: f('freeWill').value, memory: f('memory').checked, voice: { pitch: f('pitch').value, rate: f('rate').value, name: f('voiceName').value },
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
        ${engineSelect()}<button id="memBtn">Memories</button><button id="shareBtn">Share</button><button id="resetBtn">New chat</button></div>
      <div class="log" id="log" aria-live="polite"></div>
      <div>
        <div class="bar"><i id="bar"></i></div><p class="status" id="status">${!hasWebGPU() ? 'This browser has no WebGPU, so chat cannot run here.' : aiReady() ? '' : 'Getting the AI ready…'}</p>
        <form class="composer" id="composer"><textarea id="input" placeholder="Message ${esc(c.name)}…" ${hasWebGPU() ? '' : 'disabled'}></textarea><button type="button" id="mic" title="Speak your message">🎤</button><button class="primary" id="send" ${hasWebGPU() ? '' : 'disabled'}>Send</button><button type="button" id="stop" hidden>Stop</button></form>
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
  $view.querySelector('#memBtn').onclick = () => memoryDialog(c);
  bindEngineSelect($view.querySelector('.engine'), status);
  attachMic($view.querySelector('#mic'), input);
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
      const reply = { role: 'assistant', content: '' };
      await withAI(async () => {
        const eng = await getEngine((p, t) => { $view.querySelector('#bar').style.width = `${Math.round(p * 100)}%`; status.textContent = t; });
        status.textContent = `${c.name} is typing…`; stop.hidden = false; stopRequested = false;
        msgs.push(reply);
        const history = msgs.slice(-24).map(({ role, content }) => ({ role, content }));
        const stream = await eng.chat.completions.create({
          stream: true, temperature: Number(settings().temperature) || 0.8, max_tokens: 400,
          messages: [{ role: 'system', content: systemPrompt(c, { query: text }) }, ...history.slice(0, -1)],
        });
        for await (const chunk of stream) {
          reply.content += chunk.choices[0]?.delta?.content || '';
          const last = log.lastElementChild;
          if (last && last.classList.contains('assistant') && msgs[msgs.length - 1] === reply) last.textContent = reply.content; else render();
          log.scrollTop = log.scrollHeight;
        }
      });
      reply.content = reply.content.trim() || '…';
      render(); setChat(id, msgs);
      if (msgs.filter((m) => m.role === 'user').length % 4 === 0) rememberFrom(c, msgs);
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

// ---------- group chats ----------
function groupsView() {
  setNav('groups');
  const list = groups(), chars = allCharacters();
  $view.innerHTML = `
    <h1>Group chats</h1>
    <p class="lead">Put up to five characters in one room. They talk to you and to each other, and Free Will decides who jumps in.</p>
    <form class="panel" id="gform">
      <label for="gname">Group name</label><input id="gname" maxlength="60" placeholder="e.g. The tavern crew" required>
      <label>Members <span class="hint" id="gcount">0 / 5 picked</span></label>
      <div class="pick">${chars.map((c) => `<label class="pickitem"><input type="checkbox" value="${esc(c.id)}">${avatar(c, 32)}<span>${esc(c.name)}</span></label>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button class="primary">Create group</button><span class="status" id="gstatus"></span></div>
    </form>
    <div class="grid" style="margin-top:18px">${list.map((g) => {
      const mem = g.members.map(findCharacter).filter(Boolean);
      return `<article class="card"><h3>${esc(g.name)}</h3><div class="row">${mem.map((c) => avatar(c, 36)).join('')}</div>
        <p>${esc(mem.map((c) => c.name).join(', '))}</p>
        <div class="row"><a class="btn primary" href="#/group/${encodeURIComponent(g.id)}">Open</a><button data-gdel="${esc(g.id)}">Delete</button></div></article>`;
    }).join('')}</div>`;
  const boxes = [...$view.querySelectorAll('.pick input')];
  boxes.forEach((b) => b.onchange = () => {
    const n = boxes.filter((x) => x.checked).length;
    if (n > 5) { b.checked = false; return; }
    $view.querySelector('#gcount').textContent = `${Math.min(n, 5)} / 5 picked`;
  });
  $view.querySelector('#gform').onsubmit = (e) => {
    e.preventDefault();
    const members = boxes.filter((x) => x.checked).map((x) => x.value);
    if (members.length < 2) { $view.querySelector('#gstatus').textContent = 'Pick at least two characters.'; return; }
    const g = { id: 'g-' + newId(), name: $view.querySelector('#gname').value.trim(), members, msgs: [] };
    saveGroup(g); location.hash = `#/group/${g.id}`;
  };
  $view.querySelectorAll('[data-gdel]').forEach((b) => b.onclick = () => { if (confirm('Delete this group chat?')) { deleteGroup(b.dataset.gdel); groupsView(); } });
}

function groupChatView(gid) {
  setNav('groups');
  const g = getGroup(gid);
  if (!g) { location.hash = '#/groups'; return; }
  const members = g.members.map(findCharacter).filter(Boolean);
  let msgs = g.msgs || [];
  $view.innerHTML = `
    <section class="chat">
      <div class="chathead"><div class="row">${members.map((c) => avatar(c, 40)).join('')}</div><div class="grow"><h2>${esc(g.name)}</h2><div class="status">${esc(members.map((c) => c.name).join(', '))}</div></div>
        ${engineSelect()}<button id="nudge" title="Let someone speak up on their own">Let them talk</button><button id="gclear">Clear chat</button></div>
      <div class="log" id="log" aria-live="polite"></div>
      <div>
        <div class="bar"><i id="bar"></i></div><p class="status" id="status">${!hasWebGPU() ? 'This browser has no WebGPU, so chat cannot run here.' : aiReady() ? 'Mention someone by name to make sure they answer.' : 'Getting the AI ready…'}</p>
        <form class="composer" id="composer"><textarea id="input" placeholder="Message the group…" ${hasWebGPU() ? '' : 'disabled'}></textarea><button type="button" id="mic" title="Speak your message">🎤</button><button class="primary" id="send" ${hasWebGPU() ? '' : 'disabled'}>Send</button><button type="button" id="stop" hidden>Stop</button></form>
      </div>
    </section>`;
  const log = $view.querySelector('#log'), input = $view.querySelector('#input'), status = $view.querySelector('#status');
  const bubble = (m) => {
    if (m.role === 'user') return `<div class="msg user"><b class="who">${esc(m.name || userLabel())}</b>${esc(m.content)}</div>`;
    const c = findCharacter(m.charId) || { name: m.name, emoji: '✦' };
    return `<div class="gmsg">${avatar(c, 30)}<div class="msg assistant"><b class="who">${esc(c.name)}</b><span class="txt">${esc(m.content)}</span></div></div>`;
  };
  const render = () => { log.innerHTML = msgs.map(bubble).join(''); log.scrollTop = log.scrollHeight; };
  const persist = () => saveGroup({ ...g, msgs });
  render();
  if (hasWebGPU() && !aiReady()) onAIProgress((p, t) => {
    if (!$view.contains(status)) return;
    $view.querySelector('#bar').style.width = t === 'ready' ? '0%' : `${Math.round(p * 100)}%`;
    status.textContent = t === 'ready' ? 'Everyone is here. Say hello!' : t;
  });
  bindEngineSelect($view.querySelector('.engine'), status);
  attachMic($view.querySelector('#mic'), input);
  let stopped = false, busy = false;
  const send = $view.querySelector('#send'), stop = $view.querySelector('#stop'), nudge = $view.querySelector('#nudge');
  stop.onclick = () => { stopped = true; engine?.interruptGenerate(); };
  $view.querySelector('#gclear').onclick = () => { if (confirm('Clear this group chat?')) { msgs = []; persist(); render(); } };

  // Who speaks: anyone named first, then each member by their Free Will, never the last speaker twice in a row.
  function pickSpeakers(text, lastId) {
    const lower = String(text || '').toLowerCase();
    const named = members.filter((c) => lower.includes(c.name.toLowerCase().split(' ')[0]));
    const rest = members.filter((c) => !named.includes(c) && c.id !== lastId && Math.random() * 100 < (c.freeWill ?? 50));
    let out = [...named, ...rest.sort(() => Math.random() - 0.5)].slice(0, 3);
    if (!out.length) { const pool = members.filter((c) => c.id !== lastId); out = [pool[Math.floor(Math.random() * pool.length)] || members[0]]; }
    return out;
  }
  async function speakAs(c, query) {
    const reply = { role: 'assistant', charId: c.id, name: c.name, content: '' };
    await withAI(async () => {
      if (stopped) return;
      const eng = await getEngine((p, t) => { $view.querySelector('#bar').style.width = `${Math.round(p * 100)}%`; status.textContent = t; });
      status.textContent = `${c.name} is typing…`;
      msgs.push(reply); log.insertAdjacentHTML('beforeend', bubble(reply));
      const el = log.lastElementChild.querySelector('.txt');
      const history = msgs.slice(-20, -1).map((m) => m.charId === c.id
        ? { role: 'assistant', content: m.content }
        : { role: 'user', content: `${m.role === 'user' ? (m.name || userLabel()) : m.name}: ${m.content}` });
      if (!history.length || history[history.length - 1].role !== 'user') history.push({ role: 'user', content: `(${c.name}, say something to the group.)` });
      const stream = await eng.chat.completions.create({
        stream: true, temperature: Number(settings().temperature) || 0.8, max_tokens: 220,
        messages: [{ role: 'system', content: systemPrompt(c, { group: members, query }) }, ...history],
      });
      for await (const chunk of stream) { reply.content += chunk.choices[0]?.delta?.content || ''; el.textContent = reply.content; log.scrollTop = log.scrollHeight; }
    });
    reply.content = reply.content.replace(new RegExp('^\\s*' + c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*', 'i'), '').trim();
    if (!reply.content) { const i = msgs.indexOf(reply); if (i >= 0) msgs.splice(i, 1); }
    render(); persist();
    if (reply.content && settings().speak) speak(reply.content, c);
    return reply;
  }
  async function round(text) {
    if (busy) return; busy = true; stopped = false;
    send.disabled = nudge.disabled = true; stop.hidden = false;
    try {
      let last = msgs[msgs.length - 1];
      for (const c of pickSpeakers(text, last?.charId)) { if (stopped) break; last = await speakAs(c, text); }
      // Free Will: sometimes another character reacts to what was just said.
      const keen = members.filter((c) => c.id !== last?.charId);
      const extra = keen.find((c) => Math.random() * 100 < (c.freeWill ?? 50) / 2);
      if (extra && !stopped && last?.content) await speakAs(extra, last.content);
      status.textContent = stopped ? 'Stopped.' : '';
    } catch (err) {
      console.error(err); render(); persist();
      status.textContent = 'The on-device model could not run. Check Settings, try a smaller model, or reload.';
    } finally { busy = false; send.disabled = nudge.disabled = false; stop.hidden = true; input.focus(); }
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $view.querySelector('#composer').requestSubmit(); } });
  $view.querySelector('#composer').onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || busy) return;
    input.value = ''; msgs.push({ role: 'user', name: userLabel(), content: text }); render(); persist(); round(text);
  };
  nudge.onclick = () => round('');
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
      <label for="uname">What characters call you <span class="hint">used when no persona is active</span></label><input id="uname" maxlength="40" value="${esc(s.userName)}">
      <label for="theme">Theme</label><select id="theme">${[['midnight', 'Midnight'], ['ocean', 'Ocean'], ['rose', 'Rose'], ['forest', 'Forest'], ['light', 'Light']].map(([v, l]) => `<option value="${v}" ${v === s.theme ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="row" style="margin-top:18px"><button class="primary">Save settings</button><span class="status" id="sstatus"></span></div>
    </form>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Personas</h3>
      <p class="lead">Profiles of you that characters can see, like a name, an age or a role in the story. Pick one to use in every chat.</p>
      <div id="plist"></div>
      <div class="two"><div><label for="pname">Persona name</label><input id="pname" maxlength="40"></div><div><label for="pdesc">About this persona</label><input id="pdesc" maxlength="400" placeholder="e.g. A traveling bard who owes everyone money"></div></div>
      <div class="row" style="margin-top:12px"><button id="padd">Add persona</button></div>
    </div>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Your data</h3>
      <p class="lead">Characters and chats are saved in this browser only.</p>
      <div class="row"><button id="backup">Download backup</button><button id="wipe">Delete all my characters and chats</button></div>
      <p class="status">WebGPU: ${hasWebGPU() ? 'available' : 'not available in this browser'}</p>
    </div>`;
  const q = (k) => $view.querySelector('#' + k);
  q('temp').oninput = () => q('tempV').textContent = q('temp').value;
  q('theme').onchange = () => { save(KEY.settings, { ...settings(), theme: q('theme').value }); applyTheme(); };
  const drawPersonas = () => {
    const list = personas(), cur = settings().persona;
    q('plist').innerHTML = `<label class="pickitem"><input type="radio" name="persona" value="" ${!cur ? 'checked' : ''}><span>No persona</span></label>` +
      list.map((x) => `<div class="row"><label class="pickitem" style="flex:1"><input type="radio" name="persona" value="${esc(x.id)}" ${x.id === cur ? 'checked' : ''}><span><b>${esc(x.name)}</b> <span class="hint">${esc(x.description)}</span></span></label><button data-pdel="${esc(x.id)}">Delete</button></div>`).join('');
    q('plist').querySelectorAll('[name=persona]').forEach((r) => r.onchange = () => save(KEY.settings, { ...settings(), persona: r.value }));
    q('plist').querySelectorAll('[data-pdel]').forEach((b) => b.onclick = () => {
      save(KEY.personas, personas().filter((x) => x.id !== b.dataset.pdel));
      if (settings().persona === b.dataset.pdel) save(KEY.settings, { ...settings(), persona: '' });
      drawPersonas();
    });
  };
  drawPersonas();
  q('padd').onclick = () => {
    const name = q('pname').value.trim(); if (!name) return;
    const x = { id: 'p-' + newId(), name, description: q('pdesc').value.trim() };
    save(KEY.personas, [...personas(), x]); save(KEY.settings, { ...settings(), persona: x.id });
    q('pname').value = q('pdesc').value = ''; drawPersonas();
  };
  q('sform').onsubmit = (e) => { e.preventDefault(); save(KEY.settings, { ...settings(), model: q('model').value, temperature: Number(q('temp').value), userName: q('uname').value.trim() || 'You' }); q('sstatus').textContent = 'Saved.'; if (!aiReady()) preloadAI(); };
  q('backup').onclick = () => download('mythmaker-backup.json', JSON.stringify({ characters: myCharacters(), chats: load(KEY.chats, {}), memories: load(KEY.mem, {}), personas: personas(), groups: groups() }, null, 2));
  q('wipe').onclick = () => { if (confirm('Delete every character and chat you made? This cannot be undone.')) { [KEY.chars, KEY.chats, KEY.mem, KEY.personas, KEY.groups].forEach((k) => localStorage.removeItem(k)); q('sstatus').textContent = 'Deleted.'; } };
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
  else if (page === 'groups') groupsView();
  else if (page === 'group') groupChatView(id);
  else galleryView();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
preloadAI();
