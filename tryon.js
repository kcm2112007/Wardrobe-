// Cloudflare Pages Function: /api/tryon. Provider: Hugging Face (Gradio) virtual try-on Space (IDM-VTON compatible).
// Secrets only via context.env (HF_TOKEN, optional). Config: HF_SPACE_ID or HF_SPACE_URL, optional HF_ENDPOINT, MODEL_A/B/C_IMAGE.
const MODELS = { 'model-a': 'MODEL_A_IMAGE', 'model-b': 'MODEL_B_IMAGE', 'model-c': 'MODEL_C_IMAGE' };
const CODE = { unavailable: 'TRYON_UNAVAILABLE', notconf: 'TRYON_NOT_CONFIGURED', failed: 'TRYON_FAILED', busy: 'TRYON_BUSY', incompat: 'TRYON_INCOMPATIBLE', bad: 'TRYON_BAD_REQUEST', image: 'INVALID_IMAGE' };
const MSG = {
  unavailable: 'AI try-on is temporarily unavailable. Please try again later.', notconf: 'Virtual try-on is not configured yet.',
  failed: "We couldn't generate this look.", bad: 'Invalid request.', image: "This image can't be used for AI try-on. Please upload another clothing photo.",
  busy: 'Free AI generation is temporarily unavailable. The free GPU service may be busy or your daily quota may be exhausted. Please try again later.',
  incompat: 'The configured Hugging Face Space does not expose a compatible API endpoint.',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (k, s = 400) => json({ success: false, error: { code: CODE[k], message: MSG[k] } }, s);
const auth = (env) => (env.HF_TOKEN ? { Authorization: 'Bearer ' + env.HF_TOKEN } : {});
const enc = (o) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s) => { try { return JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; } };
async function fetchT(url, init = {}, ms = 20000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}
function spaceBase(env) {
  let u = env.HF_SPACE_URL;
  if (!u && env.HF_SPACE_ID) u = 'https://' + env.HF_SPACE_ID.toLowerCase().replace(/[/._]/g, '-') + '.hf.space';
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.endsWith('.hf.space') ? x.origin : null; } catch { return null; }
}
const bytesOf = (uri) => { const m = /^data:([^;]+);base64,(.*)$/s.exec(uri); return m ? { mime: m[1], bytes: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)) } : null; };

// Read the Space's real API schema instead of assuming endpoint names or input order.
async function discover(env, base) {
  let reached = false;
  for (const prefix of ['/gradio_api', '']) {
    let r; try { r = await fetchT(base + prefix + '/info', { headers: auth(env) }, 10000); } catch { continue; }
    let info; try { info = await r.json(); reached = true; } catch { continue; }
    const eps = info?.named_endpoints || {}, names = Object.keys(eps);
    const name = env.HF_ENDPOINT || names.find((k) => /try-?on/i.test(k)) || (names.length === 1 ? names[0] : null);
    if (name && eps[name]) return { prefix, name, params: eps[name].parameters || [] };
    if (names.length || info?.named_endpoints) return { error: 'incompat' };
  }
  return { error: reached ? 'incompat' : 'unavailable' };
}
const IMG = /^(image|imageeditor|sketchpad|paint)/i;
function buildData(params, v) { // map by component type and parameter name; never guess unknown required inputs
  const imgs = params.filter((p) => IMG.test(p.component || ''));
  const gp = imgs.find((p) => /garm|cloth|garment|product|item/i.test(p.parameter_name || p.label || '')) || imgs[1], pp = imgs.find((p) => p !== gp);
  if (!gp || !pp) return null;
  const out = [];
  for (const p of params) {
    const n = p.parameter_name || p.label || '', c = p.component || '';
    if (p === pp) out.push(/editor/i.test(c) ? { background: v.person, layers: [], composite: null } : v.person);
    else if (p === gp) out.push(v.garment);
    else if (/seed/i.test(n)) out.push(v.seed);
    else if (/textbox/i.test(c) && /des|prompt|caption/i.test(n)) out.push(v.desc);
    else if (p.parameter_has_default) out.push(p.parameter_default);
    else if (/checkbox/i.test(c)) out.push(!/crop/i.test(n));
    else if (/textbox/i.test(c)) out.push('');
    else return null;
  }
  return out;
}
async function upload(env, base, prefix, { mime, bytes }, name) {
  const fd = new FormData(); fd.append('files', new Blob([bytes], { type: mime }), name);
  const r = await fetchT(base + prefix + '/upload', { method: 'POST', body: fd, headers: auth(env) }, 30000);
  if (!r.ok) throw new Error('upload ' + r.status);
  const p = (await r.json())?.[0]; if (!p) throw new Error('upload empty');
  return { path: p, orig_name: name, meta: { _type: 'gradio.FileData' } };
}
async function loadImage(env, url, headers = {}) {
  const r = await fetchT(url, { headers }, 20000); if (!r.ok) return null;
  const mime = (r.headers.get('Content-Type') || '').split(';')[0];
  const buf = new Uint8Array(await r.arrayBuffer());
  return /^image\/(jpeg|png|webp)$/.test(mime) && buf.length > 0 && buf.length < 15e6 ? { mime, bytes: buf } : null;
}
const httpFail = (s) => (s === 429 ? fail('busy', 429) : s === 404 ? fail('incompat', 502) : fail('unavailable', 503));

const huggingface = {
  async start(env, request, b) {
    const base = spaceBase(env); if (!base) return fail('notconf', 503);
    const item = Array.isArray(b?.clothingItems) && b.clothingItems.length === 1 ? b.clothingItems[0] : null;
    if (!item || typeof item.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(item.image) || item.image.length * 0.75 > 25 * 1048576) return fail('image');
    const garment = bytesOf(item.image); if (!garment || !garment.bytes.length) return fail('image');
    let person = null; const prev = b.previousImage ?? null;
    try {
      if (prev) { if (new URL(prev).origin !== base) return fail('bad'); person = await loadImage(env, prev, auth(env)); }
      else {
        const e = MODELS[b.modelId]; if (!e) return fail('bad');
        person = await loadImage(env, env[e] || new URL(`/assets/models/${b.modelId}.jpg`, request.url).href);
      }
    } catch { person = null; }
    if (!person) { console.error('[tryon] model image unavailable'); return fail('notconf', 503); }
    const seed = Number.isInteger(b.seed) && b.seed >= 0 && b.seed <= 2147483647 ? b.seed : 42;
    try {
      const d = await discover(env, base); if (d.error) return fail(d.error, d.error === 'incompat' ? 502 : 503);
      const [pf, gf] = await Promise.all([upload(env, base, d.prefix, person, 'model.jpg'), upload(env, base, d.prefix, garment, 'garment.jpg')]);
      const data = buildData(d.params, { person: pf, garment: gf, desc: String(item.name || 'garment').slice(0, 80), seed });
      if (!data) return fail('incompat', 502);
      const r = await fetchT(`${base}${d.prefix}/call/${d.name.replace(/^\//, '')}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth(env) }, body: JSON.stringify({ data }) }, 20000);
      if (!r.ok) { console.error('[tryon] call HTTP', r.status); return httpFail(r.status); }
      const j = await r.json(); if (!j?.event_id) return fail('failed', 502);
      return json({ success: true, status: 'processing', message: 'Your look is being generated.', jobId: enc({ p: d.prefix, e: d.name.replace(/^\//, ''), i: j.event_id }) });
    } catch (e) { console.error('[tryon] start failed:', e.name); return fail('unavailable', 503); }
  },
  async status(env, request, jobId) {
    const base = spaceBase(env); if (!base) return fail('notconf', 503);
    const j = dec(jobId || ''); if (!j || !/^[\w/-]{0,20}$/.test(j.p ?? '') || !/^[\w-]{1,80}$/.test(j.e || '') || !/^[\w-]{4,100}$/.test(j.i || '')) return fail('bad');
    const ctl = new AbortController(), wait = Math.min(+env.STATUS_WAIT_MS || 20000, 25000), t = setTimeout(() => ctl.abort(), wait);
    let last = null;
    try {
      const r = await fetch(`${base}${j.p}/call/${j.e}/${j.i}`, { headers: auth(env), signal: ctl.signal });
      if (!r.ok) { console.error('[tryon] status HTTP', r.status); return httpFail(r.status); }
      const rd = r.body.getReader(), td = new TextDecoder(); let buf = '';
      const timeout = new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('wait'), { name: 'AbortError' })), wait));
      for (;;) {
        const { done, value } = await Promise.race([rd.read(), timeout]); if (done) break;
        buf += td.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const blk = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /event: *(.*)/.exec(blk)?.[1]?.trim(), data = /data: *([\s\S]*)/.exec(blk)?.[1];
          if (ev === 'complete') {
            let out; try { out = JSON.parse(data)?.[0]; } catch {}
            const url = out?.url || (out?.path ? `${base}${j.p}/file=${out.path}` : null);
            if (!url || new URL(url).origin !== base) return fail('failed', 502);
            return json({ success: true, status: 'completed', image: '/api/tryon?file=' + encodeURIComponent(url), source: url });
          }
          if (ev === 'error') { console.error('[tryon] space error event'); return /quota|exceed|zerogpu|gpu|capacity|busy|rate/i.test(data || '') ? fail('busy', 429) : fail('failed', 502); }
          if (ev) last = { ev, data };
        }
      }
    } catch (e) { if (e.name !== 'AbortError') { console.error('[tryon] status failed:', e.name); return fail('unavailable', 503); } }
    finally { clearTimeout(t); ctl.abort(); }
    if (last?.ev === 'estimation') { try { const rank = JSON.parse(last.data).rank; if (Number.isInteger(rank)) return json({ success: true, status: 'queued', position: rank + 1 }); } catch {} }
    return json({ success: true, status: 'processing', message: 'Your look is being generated.' });
  },
  async file(env, url) { // same-origin proxy: keeps the token server-side and lets the browser keep a permanent copy
    const base = spaceBase(env); let ok = false; try { ok = base && new URL(url).origin === base; } catch {}
    if (!ok) return fail('bad');
    try {
      const r = await fetchT(url, { headers: auth(env), redirect: 'error' }, 25000); const ct = r.headers.get('Content-Type') || '';
      if (!r.ok || !/^image\//.test(ct)) throw 0;
      return new Response(r.body, { headers: { 'Content-Type': ct, 'Cache-Control': 'no-store' } });
    } catch { return fail('unavailable', 502); }
  },
};
const PROVIDERS = { huggingface }; // add future providers here (the browser never needs to change)
const pick = (env) => PROVIDERS[env.TRYON_PROVIDER || 'huggingface'];

export async function onRequestPost({ request, env }) {
  const p = pick(env); if (!p) return fail('notconf', 503);
  let b; try { b = await request.json(); } catch { return fail('bad'); }
  return p.start(env, request, b);
}
export async function onRequestGet({ request, env }) {
  const p = pick(env); if (!p) return fail('notconf', 503);
  const q = new URL(request.url).searchParams;
  if (q.get('file')) return p.file(env, q.get('file'));
  if (q.get('job')) return p.status(env, request, q.get('job'));
  return fail('bad');
}
export const onRequest = () => fail('bad', 405);
