// ==============================
// GLOBAL STATE
// ==============================
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLOURS={white:'#ffffff',black:'#1a1a1a',navy:'#1f2a44',blue:'#3b6fb6',grey:'#8a8a8a',beige:'#d8c8a8',brown:'#7a5230',cream:'#f1e9d2',green:'#4d6b4a',red:'#b23a3a',yellow:'#e2c044',other:'#bdbdbd'};
const GROUP={Shirt:'top','T-Shirt':'top','T-shirt':'top',Hoodie:'top',Sweater:'top',Jacket:'outerwear',Coat:'outerwear',Jeans:'bottom',Trousers:'bottom',Shorts:'bottom',Skirt:'bottom',Dress:'dress',Shoes:'shoes',Sneakers:'shoes',Boots:'shoes',Accessories:'acc',Other:'other'};
const PATTERNS=['Solid','Striped','Checked','Printed','Graphic','Textured'];
const STYLES=['Casual','Smart Casual','Formal','Streetwear','Sporty','Traditional','Minimal'];
const SEASONS=['Summer','Winter','Monsoon','All Season'];
const TABS=[['all','All'],['top','Tops'],['bottom','Bottoms'],['dress','Dresses'],['outerwear','Outerwear'],['shoes','Shoes'],['acc','Accessories']];
const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>';
let items=[],outfits=[],grp='all',editing=null,img=null,removed=false,res=[],idx=0,P={},cur={};const seen=new Set();
const F={q:'',cat:'',colour:'',style:'',season:'',fav:'',sort:'new'};
const CATS=['T-Shirt','Shirt','Hoodie','Sweater','Jacket','Coat','Jeans','Trousers','Shorts','Dress','Skirt','Shoes','Accessories','Other'];
const cap=s=>s[0].toUpperCase()+s.slice(1);
const uid=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const fill=(sel,list,ph)=>{sel.innerHTML=(ph!==undefined?`<option value="">${ph}</option>`:'')+list.map(v=>`<option>${esc(v)}</option>`).join('')};
function toast(m){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3200)}

// V1 items lack V2 fields: give them defaults (nothing is rewritten until the item is next saved)
const norm=i=>({pattern:'Solid',timesWorn:0,lastWorn:null,favourite:false,subcategory:'',secondaryColours:[],material:'',formality:'',aiAnalyzed:false,aiConfidence:null,...i,category:i.category==='T-shirt'?'T-Shirt':i.category});
const ago=t=>{const d=Math.floor((Date.now()-t)/864e5);return d<1?'today':d===1?'yesterday':d+' days ago'};

// ---- V3 AI configuration. NEVER put a secret key in this file or the repo.
// A real AI service needs a backend/serverless proxy that holds the key. The proxy is expected to expose:
//   POST {endpoint}/analyze  {image}                     -> {category,subcategory,primaryColour,secondaryColours,pattern,material,style,formality,season,confidence}
//   POST {endpoint}/stylist  {request,profile,feedback,candidates,wardrobe} -> {outfits:[{items:[ids],title,reason}],missing?}
//   POST {endpoint}/chat     {message,history,profile,wardrobe}             -> {reply,items:[ids]}
//   POST bgEndpoint {image} -> {image:'data:image/png;base64,...'}      POST weatherEndpoint {lat,lon} -> {tempC,rain}
const AI_CONFIG={enabled:false,endpoint:'',weatherEndpoint:'',bgEndpoint:'',provider:'Not configured',timeoutMs:12000};
const AI_FALLBACK="AI styling is unavailable right now. Using your wardrobe's local styling engine.";
let aiData=null,aiAcc=false,aiMsg='',lastOpts={},lastMissing='',wxInfo='';
const AIS=()=>({style:false,analyze:false,images:false,weather:false,...getSet('ai',{})});
const aiOn=k=>AI_CONFIG.enabled&&!!AI_CONFIG.endpoint&&!!AIS()[k];
const PROFILE=()=>({styles:[],colours:[],avoid:[],fit:'Regular',goal:'Simple',...getSet('profile',{})});

// ---- V4 virtual try-on configuration. No secrets here: the endpoint is your own secure backend/serverless function.
const TRY_ON_CONFIG={enabled:true,endpoint:'api/tryon',provider:'huggingface',providerName:'Hugging Face (IDM-VTON compatible Space)',modelName:'IDM-VTON (compatible Space)',pollMs:3000,maxWaitMs:180000,experimentalMulti:false};
const DEBUG_V4=false;const v4=(...a)=>{if(DEBUG_V4)console.log('[V4]',...a)};
let looks=[],T=null,tryBusy=false;const tryCache=new Map();
// ==============================
// STORAGE
// ==============================
const openDB=()=>openDB.p||(openDB.p=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe-ai',2);
  r.onupgradeneeded=()=>{const d=r.result;for(const n of ['items','outfits','looks'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'})};
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
async function tx(store,mode,fn){const db=await openDB();return new Promise((ok,no)=>{const t=db.transaction(store,mode);const q=fn(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result);t.onerror=t.onabort=()=>no(t.error)})}
const addItem=i=>tx('items','readwrite',s=>s.add(i)),getItems=()=>tx('items','readonly',s=>s.getAll()),updateItem=i=>tx('items','readwrite',s=>s.put(i)),deleteItem=id=>tx('items','readwrite',s=>s.delete(id)),clearItems=()=>tx('items','readwrite',s=>s.clear());
const addOutfit=o=>tx('outfits','readwrite',s=>s.add(o)),getOutfits=()=>tx('outfits','readonly',s=>s.getAll()),updateOutfit=o=>tx('outfits','readwrite',s=>s.put(o)),deleteOutfit=id=>tx('outfits','readwrite',s=>s.delete(id));
const getSet=(k,d)=>{try{return JSON.parse(localStorage.getItem('wa-'+k))??d}catch{return d}};
const setSet=(k,v)=>{try{localStorage.setItem('wa-'+k,JSON.stringify(v))}catch{}};
const addLook=l=>tx('looks','readwrite',s=>s.add(l)),getLooks=()=>tx('looks','readonly',s=>s.getAll()),updateLook=l=>tx('looks','readwrite',s=>s.put(l)),deleteLook=id=>tx('looks','readwrite',s=>s.delete(id));
async function reload(){
  try{looks=(await getLooks()).sort((a,b)=>b.createdAt-a.createdAt)}catch{looks=[]}
  try{items=(await getItems()).map(norm);outfits=(await getOutfits()).map(o=>({saved:true,worn:null,...o})).sort((a,b)=>b.createdAt-a.createdAt)}
  catch{toast('Could not read saved data. Check that browser storage is allowed.');items=[];outfits=[]}
}

// ==============================
// NAVIGATION
// ==============================
function go(v){
  if(!$(`[data-view="${v}"]`))v='dashboard';
  $$('[data-view]').forEach(s=>s.hidden=s.dataset.view!==v);
  $$('[data-go]').forEach(b=>b.dataset.go===(['results','chat','tryon'].includes(v)?'stylist':v==='looks'?'saved':v)?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  if(location.hash!=='#'+v)location.hash=v;
  if(v==='dashboard')renderDashboard();else if(v==='wardrobe')renderWardrobe();else if(v==='saved')renderSaved();else if(v==='settings')renderSettings();else if(v==='chat')renderChat();else if(v==='tryon')renderTryOn();else if(v==='looks')renderLooks();else if(v==='add'&&!$('#form').dataset.ready)openForm(null);
  scrollTo(0,0);
}
addEventListener('hashchange',()=>go(location.hash.slice(1)));

// ==============================
// CLOTHING MANAGEMENT
// ==============================
const worn=i=>i.lastWorn?'Worn '+ago(i.lastWorn):'Never worn';
const tile=i=>`<article class="card"><button class="qv" data-a="view" data-id="${i.id}" aria-label="Quick view ${esc(i.name)}"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"></button><div class="cb"><h3>${esc(i.name)}</h3><p>${esc(i.category)} · ${worn(i)}</p></div></article>`;
const card=i=>`<article class="card"><button class="qv" data-a="view" data-id="${i.id}" aria-label="Quick view ${esc(i.name)}"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"></button><div class="cb"><h3>${esc(i.name)}</h3><p>${esc(i.category)} · ${esc(i.colour)} · ${esc(i.style)}</p><p>${worn(i)}</p><div class="row"><button class="ic" data-a="fav" data-id="${i.id}" aria-pressed="${!!i.favourite}" aria-label="Favourite ${esc(i.name)}">${heart}</button><button class="lnk" data-a="view" data-id="${i.id}">View</button><button class="lnk" data-a="stylethis" data-id="${i.id}">Style This</button><button class="lnk" data-a="edit" data-id="${i.id}">Edit</button><button class="lnk" data-a="del" data-id="${i.id}">Delete</button></div></div></article>`;
const emptyBox='<div class="empty"><h2>Your wardrobe is empty.</h2><p class="mut">Add your first piece, or load sample clothes to see how it works.</p><button class="btn" data-a="new">Add Your First Item</button> <button class="btn ghost" data-a="demo">Load Demo Wardrobe</button></div>';
function renderDashboard(){
  const c=k=>items.filter(i=>GROUP[i.category]===k).length;
  $('#stats').innerHTML=[['Total items',items.length],['Never worn',items.filter(i=>!i.timesWorn).length],['Tops',c('top')],['Bottoms',c('bottom')],['Outfits',outfits.filter(o=>o.saved).length]].map(([l,n])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('#d-weather').value=$('#p-weather').value;renderToday();
  if(!items.length){$('#dash').innerHTML=emptyBox;return}
  const most=items.filter(i=>i.timesWorn).sort((a,b)=>b.timesWorn-a.timesWorn).slice(0,4);
  const least=[...items].sort((a,b)=>(a.lastWorn||0)-(b.lastWorn||0)).slice(0,4);
  const recent=[...items].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);
  const sec=(t,l,e)=>`<h2>${t}</h2><div class="grid">${l.length?l.map(tile).join(''):`<p class="mut">${e}</p>`}</div>`;
  $('#dash').innerHTML=sec('Most worn',most,'Mark outfits as worn to see them here.')+sec('Least worn',least,'')+sec('Recently added',recent,'')+recentOutfits();
}
function fillForm(){fill($('#f-category'),CATS);fill($('#f-colour'),Object.keys(COLOURS).map(cap));$$('#f-colour option').forEach(o=>o.value=o.textContent.toLowerCase());fill($('#f-pattern'),PATTERNS);fill($('#f-style'),STYLES);fill($('#f-season'),SEASONS)}
function syncChips(){$$('.chips').forEach(c=>{const s=$('#'+c.dataset.for);c.innerHTML=[...s.options].map(o=>`<button type="button" class="chip" aria-pressed="${o.value===s.value}" data-v="${esc(o.value)}">${esc(o.textContent)}</button>`).join('')})}
function setPrev(src){$('#prev').src=src||'';$('#prev').hidden=!src;$('#rm').hidden=!src}
function openForm(it){
  editing=it;img=null;removed=false;aiData=null;aiAcc=false;$('#ai-box').hidden=true;$('#form').reset();fillForm();$('#form').dataset.ready='1';$('#ft').textContent=it?'Edit Clothing':'Add Clothing';$('#err').textContent='';
  if(it)for(const k of ['name','category','colour','pattern','style','season']){const s=$('#f-'+k);if(s.tagName==='SELECT'&&![...s.options].some(o=>o.value===it[k]))s.add(new Option(it[k],it[k]));s.value=it[k]}
  syncChips();setPrev(it?it.image:null);
}
async function submitForm(e){
  e.preventDefault();
  const image=img||(removed?null:editing?.image);
  if(!image){$('#err').textContent='Add a photo of the item.';return}
  const d=Object.fromEntries(['name','category','colour','pattern','style','season'].map(k=>[k,$('#f-'+k).value.trim()]));
  const ai=aiAcc&&aiData?{subcategory:aiData.subcategory,secondaryColours:aiData.secondaryColours,material:aiData.material,formality:aiData.formality,aiAnalyzed:true,aiConfidence:aiData.confidence}:{};
  try{const was=!!editing;
    was?await updateItem({...editing,...d,...ai,image}):await addItem({id:uid(),...d,...ai,image,favourite:false,timesWorn:0,lastWorn:null,createdAt:Date.now()});
    await reload();$('#form').dataset.ready='';toast(was?'Changes saved':'Added to wardrobe');go('wardrobe');
  }catch{$('#err').textContent='Storage is full or blocked. Free some space or delete items, then try again.'}
}
function quickView(it){
  $('#dbody').innerHTML=`<h2>${esc(it.name)}</h2><img src="${it.image}" alt="${esc(it.name)}" style="width:100%;max-height:50vh;object-fit:contain;background:#f0f0ee;border-radius:12px"><p class="mut" style="margin-top:12px">${esc([it.category,it.colour,it.pattern,it.style,it.season].join(' · '))}</p><p>Added ${new Date(it.createdAt).toLocaleDateString()}. ${worn(it)}, ${it.timesWorn||0} time${it.timesWorn===1?'':'s'} in total.</p>`;$('#dlg').showModal();
}

const setSel=(k,v)=>{const s=$('#f-'+k);if(![...s.options].some(o=>o.value===v))s.add(new Option(v,v));s.value=v};
async function runAnalysis(src){
  const a=await analyzeClothing(src);
  if(a)return showAI(a);
  if(aiOn('analyze')&&aiOn('images')){const b=$('#ai-box');b.hidden=false;b.innerHTML='<p class="mut" style="margin:0">AI analysis is unavailable right now. Fill in the details yourself.</p>'}
}
function showAI(a){
  aiData=a;const b=$('#ai-box');b.hidden=false;
  b.innerHTML=`<h3>Detected: ${esc(cap(a.colour))} ${esc(a.subcategory||a.category)}</h3><p class="mut">${esc([a.category,a.colour,a.style,a.pattern,a.season].join(' · '))} · ${Math.round(a.confidence*100)}% confident. AI can be wrong, so check the details.</p><div class="row" style="gap:8px"><button type="button" class="btn" data-a="aiuse">Use This</button><button type="button" class="btn ghost" data-a="aiedit">Edit</button></div>`;
}
function applyAI(accept){
  if(!aiData)return;
  for(const k of ['category','colour','pattern','style','season'])setSel(k,aiData[k]);
  if(!$('#f-name').value)$('#f-name').value=cap(`${aiData.colour} ${aiData.subcategory||aiData.category}`).slice(0,60);
  aiAcc=accept;syncChips();$('#ai-box').hidden=true;toast(accept?'AI details applied':'Review and edit the details');
}
// ==============================
// IMAGE UPLOAD
// ==============================
async function compress(file,max=900){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Unsupported file. Use a JPG, PNG or WEBP image.');
  if(file.size>12*1024*1024)throw new Error('This image is over 12 MB. Choose a smaller photo.');
  const url=URL.createObjectURL(file);
  try{const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('This image could not be read.'));i.src=url});
    const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8)}
  finally{URL.revokeObjectURL(url)}
}
async function pick(file){if(!file)return;try{img=await compress(file);removed=false;setPrev(img);$('#err').textContent='';runAnalysis(img)}catch(e){img=null;$('#err').textContent=e.message}}

// ==============================
// WARDROBE FILTERING
// ==============================
const SORTS={new:(a,b)=>b.createdAt-a.createdAt,old:(a,b)=>a.createdAt-b.createdAt,name:(a,b)=>a.name.localeCompare(b.name),most:(a,b)=>b.timesWorn-a.timesWorn,least:(a,b)=>a.timesWorn-b.timesWorn};
function renderWardrobe(){
  $('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="tab" aria-pressed="${k===grp}" data-g="${k}">${l}</button>`).join('');
  const q=F.q.toLowerCase(),g=$('#grid');
  if(!items.length){g.innerHTML=emptyBox;return}
  const list=items.filter(i=>(grp==='all'||GROUP[i.category]===grp)&&(!F.cat||i.category===F.cat)&&(!F.colour||i.colour===F.colour)&&(!F.style||i.style===F.style)&&(!F.season||i.season===F.season)&&(!F.fav||i.favourite)&&(!q||`${i.name} ${i.category} ${i.colour} ${i.style}`.toLowerCase().includes(q))).sort(SORTS[F.sort]||SORTS.new);
  g.innerHTML=list.length?list.map(card).join(''):'<div class="empty"><h2>No clothing matches your filters.</h2><button class="btn ghost" data-a="clearf">Clear Filters</button></div>';
}
function clearFilters(){Object.assign(F,{q:'',cat:'',colour:'',style:'',season:'',fav:'',sort:'new'});grp='all';$('#q').value='';['fk','fc','fs','fz','ff'].forEach(id=>$('#'+id).value='');$('#fo').value='new';renderWardrobe()}
// ==============================
// OUTFIT GENERATOR
// ==============================
const OCC={College:{s:['Casual','Smart Casual','Streetwear','Minimal','Sporty'],ban:[]},Work:{s:['Smart Casual','Formal','Minimal'],ban:['Shorts','Hoodie']},Casual:{s:STYLES,ban:[]},Date:{s:['Casual','Smart Casual','Formal','Minimal'],ban:['Shorts']},Party:{s:STYLES,ban:[]},Wedding:{s:['Formal','Traditional','Smart Casual'],ban:['Shorts','Hoodie','T-Shirt','Sneakers']},Travel:{s:STYLES,ban:[]},Dinner:{s:['Casual','Smart Casual','Formal','Minimal'],ban:['Shorts']},Workout:{s:['Sporty'],ban:['Jeans','Dress','Skirt','Coat','Boots','Shirt']},Custom:{s:STYLES,ban:[]}};
const WX={Hot:['Hoodie','Sweater','Coat','Jacket','Boots'],Warm:['Coat','Sweater','Hoodie'],Cool:[],Cold:['Shorts'],Rainy:['Shorts']};
const WS={Hot:'Summer',Warm:'Summer',Cold:'Winter',Rainy:'Monsoon'};
const COMPAT={navy:['white','beige','grey','brown','cream'],blue:['white','grey','black','beige'],beige:['white','brown','navy','black','cream'],brown:['beige','white','navy','cream'],grey:['black','white','navy','blue'],cream:['brown','navy','beige','grey','blue','green'],green:['beige','cream','brown','white','black','navy','grey'],red:['navy','grey','beige','cream'],yellow:['navy','grey','blue','white','black','brown']};
const PREF={Neutral:['white','black','grey','beige','cream','navy'],Dark:['black','navy','brown','grey','green'],Light:['white','cream','beige','grey'],'Earth tones':['brown','beige','cream','green'],Bright:['red','blue','green']};
const LABEL={top:'Top',bottom:'Bottom',dress:'Dress',outerwear:'Layer',shoes:'Shoes',acc:'Accessory'};
const compat=(a,b)=>a===b||['white','black','other'].includes(a)||['white','black','other'].includes(b)||(COMPAT[a]||[]).includes(b)||(COMPAT[b]||[]).includes(a);

const NEUTRALS=['white','black','grey','beige','cream','navy'];
const sigOf=pcs=>pcs.map(i=>i.id).sort().join('|');
const hasLayer=pcs=>pcs.some(i=>GROUP[i.category]==='outerwear'||['Hoodie','Sweater'].includes(i.category));
const weatherFit=(pcs,w)=>w==='Cold'?(hasLayer(pcs)?1:.2):w==='Cool'?(hasLayer(pcs)?1:.6):w==='Rainy'?(pcs.some(i=>i.category==='Boots'||GROUP[i.category]==='outerwear')?1:.6):1;
const recency=i=>{if(!i.lastWorn)return 0;const d=(Date.now()-i.lastWorn)/864e5;return d<1?6:d<2?4:d<4?2:0};
// Future AI hooks: local/mock for V2, swap bodies later without touching callers
// ---- AI client: one entry point with a timeout; every caller must handle failure and fall back to local
async function aiCall(path,body,base=AI_CONFIG.endpoint){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),AI_CONFIG.timeoutMs);
  try{const r=await fetch(path?base.replace(/\/$/,'')+'/'+path:base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});
    if(!r.ok)throw new Error('http '+r.status);return await r.json()}
  finally{clearTimeout(t)}
}
const brief=i=>({id:i.id,name:i.name,category:i.category,colour:i.colour,pattern:i.pattern,style:i.style,season:i.season,formality:i.formality,timesWorn:i.timesWorn,lastWorn:i.lastWorn});
const hashImg=s=>{let h=5381;for(let i=0;i<s.length;i+=97)h=((h<<5)+h+s.charCodeAt(i))|0;return s.length+':'+h};
const pickOf=(list,v)=>list.find(x=>x.toLowerCase().replace(/[^a-z]/g,'')===String(v||'').toLowerCase().replace(/[^a-z]/g,''));
function cleanAnalysis(r){ // never trust AI output: validate against known lists
  if(!r||typeof r!=='object')return null;
  const colour=String(r.primaryColour||'').toLowerCase();
  return{category:pickOf(CATS,r.category)||pickOf(CATS,r.subcategory)||'Other',colour:COLOURS[colour]?colour:'other',pattern:pickOf(PATTERNS,r.pattern)||'Solid',style:pickOf(STYLES,r.style)||'Casual',
    season:[].concat(r.season||[]).map(s=>pickOf(SEASONS,s)).find(Boolean)||'All Season',subcategory:String(r.subcategory||'').slice(0,60),
    secondaryColours:[].concat(r.secondaryColours||[]).slice(0,3).map(s=>String(s).slice(0,20)),material:String(r.material||'').slice(0,40),formality:String(r.formality||'').slice(0,30),confidence:Math.max(0,Math.min(1,+r.confidence||0))};
}
async function analyzeClothing(img){ // only runs when AI + analysis + sending images are all switched on; cached per image
  if(!(aiOn('analyze')&&aiOn('images')))return null;
  const key=hashImg(img),cache=getSet('aicache',{});if(cache[key])return cache[key];
  try{const a=cleanAnalysis(await aiCall('analyze',{image:img}));if(a){cache[key]=a;const ks=Object.keys(cache);if(ks.length>40)delete cache[ks[0]];setSet('aicache',cache)}return a}catch{return null}
}
async function removeBackground(src){ // keeps the original unless a service is configured and returns a valid image
  if(!AI_CONFIG.bgEndpoint||!AIS().images)return src;
  try{const r=await aiCall('',{image:src},AI_CONFIG.bgEndpoint);return typeof r.image==='string'&&r.image.startsWith('data:image/')&&r.image.length<2e6?r.image:src}catch{return src}
}
async function getWeather(){ // manual selector is always the fallback
  const manual=$('#d-weather').value||$('#p-weather').value;wxInfo='';
  if(!(AIS().weather&&AI_CONFIG.weatherEndpoint&&navigator.geolocation))return manual;
  const c=getSet('wx',null);if(c&&Date.now()-c.t<18e5){wxInfo=c.info;return c.w}
  try{const pos=await new Promise((ok,no)=>navigator.geolocation.getCurrentPosition(ok,no,{timeout:8000}));
    const r=await aiCall('',{lat:+pos.coords.latitude.toFixed(1),lon:+pos.coords.longitude.toFixed(1)},AI_CONFIG.weatherEndpoint),t=+r.tempC;
    if(isNaN(t))throw 0;const w=r.rain?'Rainy':t>=32?'Hot':t>=24?'Warm':t>=15?'Cool':'Cold';wxInfo=`${Math.round(t)}°C`;setSet('wx',{t:Date.now(),w,info:wxInfo});return w}
  catch{toast('Weather is unavailable. Choose weather manually.');return manual}
}
function profileAdj(pcs){
  const PR=PROFILE(),avg=f=>pcs.reduce((t,i)=>t+f(i),0)/pcs.length,neutral=pcs.every(i=>NEUTRALS.includes(i.colour));
  return 4*avg(i=>PR.styles.includes(i.style)?1:0)+3*avg(i=>PR.colours.includes(i.colour)?1:0)-8*pcs.filter(i=>PR.avoid.includes(i.colour)).length+(['Simple','Elegant'].includes(PR.goal)&&neutral?2:0)+(PR.goal==='Experimental'&&!neutral?2:0);
}
function feedbackAdj(pcs,sig){ // likes, dislikes and ratings nudge future local scoring
  let s=0;const fb=getSet('fb',[]),bad={};
  for(const f of fb){if(f.sig===sig)s+=f.like?6:-40;if(!f.like)f.ids.forEach(id=>bad[id]=(bad[id]||0)+1)}
  for(const i of pcs)s-=Math.min(6,2*(bad[i.id]||0));
  for(const r of getSet('ratings',[]))if(r.sig===sig)s+=(r.rating-3)*3;
  return s;
}
// Hybrid: the local engine proposes valid candidates, the AI may only re-rank/explain them using wardrobe ids
async function generateAIOutfit(list,p,avoid,opts={}){
  const out=generate(list,p,avoid,opts);
  if(!out.outfits?.length||!aiOn('style'))return out;
  try{
    const r=await aiCall('stylist',{request:p,profile:PROFILE(),feedback:getSet('fb',[]).slice(0,10).map(({ids,like,reason})=>({ids,like,reason})),candidates:out.outfits.map(o=>o.pieces.map(i=>i.id)),wardrobe:list.map(brief)});
    const cand=new Map(out.outfits.map(o=>[o.sig,o])),got=[];
    for(const o of r.outfits||[]){
      const pcs=(o.items||[]).map(id=>list.find(i=>i.id===id));
      if(!pcs.length||pcs.some(x=>!x))continue;
      const c=cand.get(sigOf(pcs));if(!c)continue;
      got.push({...c,note:String(o.reason||c.note).slice(0,300),title:String(o.title||'').slice(0,60)});
    }
    if(!got.length)throw 0;
    return{...out,outfits:got,missing:r.missing?String(r.missing).slice(0,240):''};
  }catch{aiMsg=AI_FALLBACK;return out}
}

// Scoring (internal only): colour 30, style 25, occasion 20, weather 15, season 10, minus a small penalty for recently worn items
function generate(list,p,avoid=new Set(),opts={}){
  const has=g=>list.some(i=>GROUP[i.category]===g);
  if(!has('dress')&&!(has('top')&&has('bottom')))return{error:'Add at least a top and a bottom, or a dress, to your wardrobe first.'};
  const O=OCC[p.occasion]||OCC.Custom,ban=[...O.ban,...(WX[p.weather]||[])];
  const use=list.filter(i=>!ban.includes(i.category)&&(O.s.includes(i.style)||i.style===p.style));
  const [tops,bots,dr,out,sh,ac]=['top','bottom','dress','outerwear','shoes','acc'].map(g=>use.filter(i=>GROUP[i.category]===g));
  const bases=[...dr.map(d=>[d]),...tops.flatMap(t=>bots.map(b=>[t,b]))];
  if(!bases.length)return{error:'No compatible outfit for these choices. Try a different style, occasion or weather, or add more pieces.'};
  const lay=['Cool','Cold','Rainy'].includes(p.weather)?(p.weather==='Cold'&&out.length?out.map(o=>[o]):[[],...out.map(o=>[o])]):[[]];
  const shoes=sh.length?sh.map(s=>[s]):[[]],accs=[[],...ac.map(a=>[a])];
  const all=[];
  for(const b of bases)for(const l of lay)for(const s of shoes)for(const a of accs){
    const pcs=[...b,...l,...s,...a],pairs=[];
    pcs.forEach((x,i)=>pcs.slice(i+1).forEach(y=>pairs.push(compat(x.colour,y.colour))));
    const cr=pairs.length?pairs.filter(Boolean).length/pairs.length:1,avg=f=>pcs.reduce((t,i)=>t+f(i),0)/pcs.length;
    const sc=30*cr+25*avg(i=>i.style===p.style?1:O.s.includes(i.style)?.6:.3)+20*avg(i=>O.s.includes(i.style)?1:.4)+15*weatherFit(pcs,p.weather)+10*avg(i=>i.season==='All Season'||i.season===WS[p.weather]?1:.4)+3*avg(i=>PREF[p.colour]?.includes(i.colour)?1:0)+2*avg(i=>i.favourite?1:0)-pcs.reduce((t,i)=>t+recency(i),0)+profileAdj(pcs)+feedbackAdj(pcs,sigOf(pcs))+(opts.boost?pcs.filter(i=>opts.boost.has(i.id)).length*10:0);
    all.push({pcs,sc,cr,sig:sigOf(pcs)});
  }
  const base0=opts.must?all.filter(o=>o.pcs.some(i=>i.id===opts.must)):all;
  if(!base0.length)return{error:opts.must?'This item does not suit the chosen weather. Try another weather or add more pieces.':'No compatible outfit for these choices. Try a different style, occasion or weather, or add more pieces.'};
  const strict=base0.filter(o=>o.cr>=.6),pool=(strict.length?strict:base0).filter(o=>!avoid.has(o.sig));
  if(!pool.length)return{outfits:[],exhausted:true};
  const picked=[];
  for(let k=0;k<8;k++){
    const used=new Set(picked.flatMap(o=>o.pcs.map(i=>i.id)));let best=null,bs=-1e9;
    for(const o of pool){if(picked.includes(o))continue;const v=o.sc-3*o.pcs.filter(i=>used.has(i.id)).length+Math.random()*2;if(v>bs){bs=v;best=o}}
    if(!best)break;picked.push(best);
  }
  return{outfits:picked.map(o=>{const colours=[...new Set(o.pcs.map(i=>i.colour))];
    return{pieces:o.pcs,colours,sig:o.sig,note:`${colours.every(c=>NEUTRALS.includes(c))?'Clean neutral colours':'Well-matched colours'} create a ${p.style.toLowerCase()} combination that's easy to wear for ${p.occasion.toLowerCase()}${['Cold','Rainy'].includes(p.weather)?`, and it suits ${p.weather.toLowerCase()} weather`:''}.`}})};
}
function logGen(o){const g=getSet('gen',[]);if(g[0]?.sig===o.sig)return;g.unshift({id:uid(),sig:o.sig,ids:o.pieces.map(i=>i.id),occasion:P.occasion,style:P.style,weather:P.weather,createdAt:Date.now()});setSet('gen',g.slice(0,12))}
function showOutfit(){
  const o=res[idx];cur={};seen.add(o.sig);logGen(o);
  if(lastOpts.today)setSet('today',{date:new Date().toDateString(),ids:o.pieces.map(i=>i.id),note:o.note,style:P.style,occasion:P.occasion,weather:P.weather});
  const pcs=o.pieces.map(i=>`<div class="piece"><img src="${i.image}" alt="${esc(i.name)}"><div><span>${LABEL[GROUP[i.category]]||'Piece'}</span><h3>${esc(i.name)}</h3></div></div>`).join('<div class="plus" aria-hidden="true">+</div>');
  $('#result').innerHTML=`<h1>${esc(o.title||lastOpts.title||'Your Look')}</h1><div class="look">${pcs}</div><div class="meta"><span class="tag">${esc(P.occasion)}</span><span class="tag">${esc(P.style)}</span><span class="tag">${esc(P.weather)} weather${wxInfo?' ('+esc(wxInfo)+')':''}</span></div><h3>Why this works</h3><p>${esc(o.note)}</p>${aiMsg?`<p class="mut">${esc(aiMsg)}</p>`:''}${lastMissing?`<p class="mut">${esc(lastMissing)}</p>`:''}<div class="row" style="gap:8px;margin-bottom:8px"><button class="btn ghost" data-a="like">Like</button><button class="btn ghost" data-a="dislike">Dislike</button></div><div id="fbx"></div><div id="rate"></div><div class="row sticky" style="gap:8px"><button class="btn" data-a="save">Save Outfit</button><button class="btn" data-a="tryon">See It On a Model</button><button class="btn" data-a="wore">I Wore This</button><button class="btn ghost" data-a="again">Try Another</button><button class="btn ghost" data-go="stylist">Change Preferences</button></div>`;
}
async function runStylist(quiet,opts={}){
  if(quiet)opts=lastOpts;else lastOpts=opts;
  aiMsg='';lastMissing='';
  const r=$('#result');
  P={occasion:$('#p-occasion').value,style:$('#p-style').value,weather:$('#p-weather').value,colour:$('#p-colour').value};
  if(opts.p)P=opts.p;else setSet('prefs',P);
  if(!quiet){go('results');seen.clear();r.innerHTML='<div class="load">Styling your wardrobe...</div>';await new Promise(k=>setTimeout(k,450))}
  if(!items.length){r.innerHTML='<div class="empty"><h2>Your wardrobe is empty.</h2><p class="mut">The stylist only uses clothes you have added.</p><button class="btn" data-a="demo">Load Demo Wardrobe</button></div>';return}
  let out;
  try{
    const recent=new Set(outfits.filter(o=>o.worn).sort((a,b)=>b.worn-a.worn).slice(0,5).map(o=>sigOf(o.pieces)));
    out=await generateAIOutfit(items,P,new Set([...seen,...recent]),opts.o);
    if(out.exhausted)out=await generateAIOutfit(items,P,seen,opts.o);
    if(out.exhausted){seen.clear();out=await generateAIOutfit(items,P,seen,opts.o)}
  }catch{out={error:'Something went wrong building this outfit. Please try again.'}}
  if(out.error){r.innerHTML=`<div class="empty"><h2>No outfit yet</h2><p class="mut">${esc(out.error)}</p><button class="btn ghost" data-go="stylist">Change Preferences</button> <button class="btn ghost" data-go="wardrobe">Open My Wardrobe</button></div>`;return}
  lastMissing=out.missing||'';res=out.outfits.slice(0,opts.limit||8);idx=0;showOutfit();
}
// Record an outfit; pieces keep ids only (images are looked up from the wardrobe)
const mkRec=(x,extra)=>({id:uid(),pieces:x.pieces.map(({id,name,category})=>({id,name,category})),itemIds:x.pieces.map(i=>i.id),...P,colours:x.colours||[],note:x.note||'',favourite:false,createdAt:Date.now(),saved:false,worn:null,...extra});
async function markWorn(pieces){const now=Date.now();for(const p of pieces){const it=items.find(i=>i.id===p.id);if(it)await updateItem({...it,timesWorn:(it.timesWorn||0)+1,lastWorn:now})}}
// ==============================
// SAVED OUTFITS
// ==============================
const pic=p=>p.image||items.find(i=>i.id===p.id)?.image||garment(GROUP[p.category]||'top','other');
const ocard=(o,acts)=>`<article class="card"><div style="display:flex;flex-wrap:wrap">${o.pieces.map(p=>`<img src="${pic(p)}" alt="${esc(p.name)}" style="width:25%;aspect-ratio:1;object-fit:contain;background:#f0f0ee">`).join('')}</div><div class="cb"><h3>${esc(o.occasion)} · ${esc(o.style)}</h3><p>${esc(o.pieces.map(p=>p.name).join(', '))}</p><p>${esc(o.weather)} · ${o.worn?'Worn '+ago(o.worn):(o.saved===false?'Generated ':'Saved ')+new Date(o.createdAt).toLocaleDateString()}</p><div class="row">${acts}</div></div></article>`;
function renderSaved(){
  const sv=outfits.filter(o=>o.saved),wn=outfits.filter(o=>o.worn).sort((a,b)=>b.worn-a.worn).slice(0,4);
  const acts=o=>`<button class="ic" data-a="ofav" data-id="${o.id}" aria-pressed="${!!o.favourite}" aria-label="Favourite outfit">${heart}</button><button class="lnk" data-a="open" data-id="${o.id}">Open</button><button class="lnk" data-a="owear" data-id="${o.id}">I wore this</button><button class="lnk" data-a="odel" data-id="${o.id}">Delete</button>`;
  $('#saved').innerHTML=sv.length?sv.map(o=>ocard(o,acts(o))).join(''):`<div class="empty"><h2>You haven't saved any outfits yet.</h2><button class="btn" data-go="stylist">Create Outfit</button></div>`;
  $('#worn').innerHTML=wn.length?wn.map(o=>ocard(o,`<button class="lnk" data-a="open" data-id="${o.id}">Open</button>`)).join(''):'<p class="mut">Nothing marked as worn yet.</p>';
  const gen=getSet('gen',[]).map(g=>({...g,saved:false,pieces:g.ids.map(id=>items.find(i=>i.id===id)).filter(Boolean)})).filter(g=>g.pieces.length).slice(0,4);
  $('#gen').innerHTML=gen.length?gen.map(g=>ocard(g,`<button class="lnk" data-a="gsave" data-id="${g.id}">Save</button>`)).join(''):'<p class="mut">Generated looks will appear here.</p>';
}
const recentOutfits=()=>{const ro=outfits.slice(0,3);return '<h2>Recent outfits</h2><div class="grid">'+(ro.length?ro.map(o=>ocard(o,`<button class="lnk" data-a="open" data-id="${o.id}">Open</button>`)).join(''):'<p class="mut">No outfits yet.</p>')+'</div>'};
function renderToday(){
  const t=getSet('today',null),ps=t&&t.date===new Date().toDateString()?t.ids.map(id=>items.find(i=>i.id===id)).filter(Boolean):[];
  $('#today').innerHTML="<h2>Today's Outfit</h2>"+(ps.length?`<div class="look compact">${ps.map(i=>`<div class="piece"><img src="${i.image}" alt="${esc(i.name)}"><div><h3>${esc(i.name)}</h3></div></div>`).join('')}</div><p>${esc(t.note)}</p><p class="mut">${esc(t.style)} · ${esc(t.occasion)} · ${esc(t.weather)} weather</p>`:'<p class="mut" style="margin:0">Nothing styled yet today. Tap Style Me above.</p>');
}
// ==============================
// AI STYLIST CHAT
// ==============================
const SUGG=['What should I wear today?','Give me a date outfit.','Make this outfit more casual.','Use my least-worn clothes.','Create a minimalist outfit.','What goes with these trousers?'];
let chatLog=[];
function renderChat(){
  $('#chat-note').textContent=aiOn('style')?'Your wardrobe details (not photos) are sent to the AI service to answer.':'AI styling is off, so answers come from the local styling engine. You can turn AI on in Settings.';
  $('#sugg').innerHTML=SUGG.map(s=>`<button type="button" class="chip" data-a="sugg" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  $('#chat').innerHTML=chatLog.map(m=>`<div class="msg ${m.me?'me':''}"><p>${esc(m.t)}</p>${(m.ids||[]).length?`<div class="look compact">${m.ids.map(id=>items.find(i=>i.id===id)).filter(Boolean).map(i=>`<div class="piece"><img src="${i.image}" alt="${esc(i.name)}"><div><h3>${esc(i.name)}</h3></div></div>`).join('')}</div>`:''}</div>`).join('')||'<p class="mut">Ask for an outfit, or tap a suggestion.</p>';
}
function localChat(text){
  const s=text.toLowerCase();
  if(!items.length)return{t:'Your wardrobe is empty. Add some clothes or load the demo wardrobe first.'};
  let p={occasion:'Casual',style:PROFILE().styles[0]||'Casual',weather:$('#p-weather').value,colour:'Any'},o={};
  const m=/goes with|match|style this/.test(s)&&items.find(i=>s.includes(i.name.toLowerCase())||s.includes(i.category.toLowerCase()));
  if(m){o={must:m.id};p.style=m.style}
  else if(/date/.test(s))p={...p,occasion:'Date',style:'Smart Casual'};
  else if(/minimal/.test(s))p={...p,style:'Minimal'};
  else if(/least|forgotten|unworn/.test(s))o={boost:new Set([...items].sort((a,b)=>(a.timesWorn||0)-(b.timesWorn||0)).slice(0,4).map(i=>i.id))};
  else if(/formal|presentation|interview|work/.test(s))p={...p,occasion:'Work',style:'Formal'};
  else if(/casual|relax/.test(s))p={...p,style:'Casual'};
  const r=generate(items,p,new Set(),o);
  if(r.error||!r.outfits?.length)return{t:r.error||'I could not find a good combination for that.'};
  const x=r.outfits[0];
  return{t:(aiOn('style')?AI_FALLBACK+' ':'')+`Try ${x.pieces.map(i=>i.name).join(', ')}. ${x.note}`,ids:x.pieces.map(i=>i.id)};
}
async function chatSend(text){
  text=text.trim();if(!text)return;
  chatLog.push({me:true,t:text});renderChat();let reply=null;
  if(aiOn('style')&&items.length){
    try{const r=await aiCall('chat',{message:text,history:chatLog.slice(-6).map(m=>m.t),profile:PROFILE(),wardrobe:items.map(brief)});
      if(r.reply)reply={t:String(r.reply).slice(0,500),ids:(r.items||[]).filter(id=>items.some(i=>i.id===id))}}catch{}
  }
  chatLog.push(reply||localChat(text));renderChat();
}
// ==============================
// VIRTUAL TRY ON
// ==============================
const MODELS=[['Model A','Male-presenting adult'],['Model B','Female-presenting adult'],['Model C','Androgynous adult']];
const TOPT={modelBuild:['Slim','Average','Athletic','Plus-size'],pose:['Standing','Relaxed','Walking','Full Body','Half Body'],background:['Studio','Minimal Room','Street','Outdoor','Neutral'],lighting:['Natural','Studio','Soft']};
const TLABEL={modelBuild:'Model build',pose:'Pose',background:'Background',lighting:'Lighting'};
const STAGES=['Preparing your clothing...','Connecting to AI try-on...','Waiting for GPU...','AI is generating your look...','Finishing your try-on...'];
const defSettings=()=>({presentation:'Model A',modelBuild:'Average',pose:'Full Body',background:'Neutral',lighting:'Soft',...getSet('tryon-settings',{})});

// ---- V4.2: try-on via our backend gateway (/api/tryon) -> Hugging Face (Gradio) Space. Provider specifics live behind tryOnProvider.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const refsOk=async ps=>{for(const p of ps){
  if(!/^data:image\/(jpeg|png|webp);base64,/.test(p.image||'')||p.image.length*.75>25*1048576)return false;
  const ok=await new Promise(r=>{const i=new Image();i.onload=()=>r(i.width>=15&&i.height>=15);i.onerror=()=>r(false);i.src=p.image});if(!ok)return false}return true};
// IDM-VTON's auto-mask handles upper-body garments, so only tops and jackets can be tried on.
const tryable=ps=>ps.filter(i=>['top','outerwear'].includes(GROUP[i.category]));
const tryList=()=>{const ok=tryable(T.pieces);if(TRY_ON_CONFIG.experimentalMulti)return ok;const s=ok.find(i=>i.id===T.selId)||ok[0];return s?[s]:[]};
async function tryOnApi(init,query=''){
  let r;try{r=await fetch(new URL(TRY_ON_CONFIG.endpoint,location.href).href+query,init)}catch{throw Object.assign(new Error('network'),{code:'net'})}
  let d=null;try{d=await r.json()}catch{}
  if(d&&d.success)return d;
  const c=d?.error?.code,st=r.status;
  const code=c==='TRYON_BUSY'||(!c&&st===429)?'busy':c==='TRYON_INCOMPATIBLE'?'incompat':c==='TRYON_NOT_CONFIGURED'?'notconf':c==='INVALID_IMAGE'?'refs':c==='TRYON_FAILED'?'gen':(c==='TRYON_UNAVAILABLE'||(!c&&(st===404||st===408||st>=500)))?'unavailable':'gen';
  throw Object.assign(new Error(c||'http '+st),{code});
}
const huggingFaceTryOnProvider={
  async generate(p){return tryOnApi({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})},
  async getStatus(jobId){return tryOnApi({method:'GET'},'?job='+encodeURIComponent(jobId))},
  async cancel(){} // a free Space job can't be cancelled from here; we simply stop polling
};
const tryOnProvider=huggingFaceTryOnProvider; // swap for another provider object with the same three methods
async function pollTryOnStatus(jobId,onStatus){
  const t0=Date.now();
  while(Date.now()-t0<TRY_ON_CONFIG.maxWaitMs){
    const d=await tryOnProvider.getStatus(jobId);
    if(onStatus)onStatus(d.status);
    if(d.status==='completed'&&d.image)return d;
    await sleep(TRY_ON_CONFIG.pollMs);
  }
  await tryOnProvider.cancel(jobId);
  throw Object.assign(new Error('timeout'),{code:'timeout'});
}
async function generateVirtualTryOn(o,s,{fresh=false,onStatus}={}){
  if(!TRY_ON_CONFIG.enabled||!TRY_ON_CONFIG.endpoint)throw Object.assign(new Error('off'),{code:'off'});
  const modelId='model-'+s.presentation.slice(-1).toLowerCase(),seed=fresh?Math.floor(Math.random()*2147483647):42;
  const key=[TRY_ON_CONFIG.provider,o.outfitId,modelId,seed,...o.pieces.map(i=>i.id+':'+hashImg(i.image))].join('|');
  if(!fresh&&tryCache.has(key))return tryCache.get(key);
  let prev=null,last=null,jobId=null;
  for(const g of o.pieces){ // one garment per request; several garments chain results (experimental, off by default)
    if(onStatus)onStatus('start');
    const j=await tryOnProvider.generate({outfitId:o.outfitId||null,modelId,clothingItems:[{id:g.id,name:g.name,category:g.category,image:g.image}],previousImage:prev,seed});
    jobId=j.jobId;last=await pollTryOnStatus(jobId,onStatus);prev=last.source;
  }
  const out={image:last.image,generationId:jobId,modelId,seed};tryCache.set(key,out);return out;
}
function errPanel(msg,back){
  const retry='<button class="btn" data-a="tretry">Try Again</button>',chg='<button class="btn ghost" data-a="tmodel">Change Model</button>';
  const M={refs:["Can't use this image","This image can't be used for AI try-on. Please upload another clothing photo.",back+'<button class="btn ghost" data-go="wardrobe">Open Wardrobe</button>'],
    busy:['Free AI generation is temporarily unavailable','The free GPU service may be busy or your daily quota may be exhausted. Please try again later.',retry+back],
    unavailable:['AI try-on is temporarily unavailable','Please try again later. The rest of Wardrobe AI keeps working.',retry+back],
    notconf:['Virtual try-on is not configured yet','The site owner still needs to finish setting up the AI service.',back],
    incompat:['AI service not compatible','The configured Hugging Face Space does not expose a compatible API endpoint.',back],
    timeout:['The AI generation took too long','The free GPU service may be busy. Please try again later.',retry+back],
    net:['Connection problem','Connection problem. Please try again.',retry+back],
    nogarment:['No supported garment in this outfit',"This try-on model supports tops and jackets. Your outfit doesn't include one.",back],
    gen:['The AI model could not generate this look.','Try again or change the model.',retry+chg+back]};
  const [h,p,b]=M[T.err]||M.gen;return msg(h,p,b);
}
const askConsent=()=>getSet('tryon-consent-hf',false)?Promise.resolve(true):new Promise(ok=>{
  $('#dbody').innerHTML='<h2>Use AI Virtual Try-On?</h2><p>Your selected clothing images will be processed by an external AI service to create this virtual try-on image.</p><p class="mut">Privacy information is in <a href="#settings">Settings</a>.</p><p>Continue?</p><div class="row" style="gap:8px"><button class="btn ghost" id="c-no">Cancel</button><button class="btn" id="c-ok">Continue</button></div>';
  const d=$('#dlg');d.showModal();$('#c-ok').onclick=()=>{setSet('tryon-consent-hf',true);d.close();ok(true)};$('#c-no').onclick=()=>{d.close();ok(false)};d.addEventListener('close',()=>ok(false),{once:true});
});
function openTryOn(){
  const x=res[idx];if(!x)return;
  if(!items.length){toast('Add some clothes to your wardrobe first.');return}
  T={pieces:x.pieces.map(p=>items.find(i=>i.id===p.id)||p),outfitId:cur.id||null,occasion:P.occasion,style:P.style,settings:defSettings(),step:'setup',image:null,look:null,from:'results'};
  v4('Opening virtual try-on');go('tryon');
}
function openLook(l){
  if(!l)return;const pieces=l.clothingItemIds.map(id=>items.find(i=>i.id===id)).filter(Boolean);
  if(!pieces.length){toast('The clothes in this look are no longer in your wardrobe.');return}
  T={pieces,outfitId:l.outfitId,occasion:l.occasion,style:l.style,settings:{...defSettings(),...l.modelSettings},step:'result',image:lookSrc(l),look:l,from:'looks',tried:pieces};go('tryon');
}
async function runGen(fresh){
  if(tryBusy||!T)return;
  const toTry=tryList();if(!toTry.length){T.step='error';T.err='nogarment';return renderTryOn()}
  if(!await refsOk(toTry)){T.step='error';T.err='refs';return renderTryOn()}
  if(!TRY_ON_CONFIG.enabled||!TRY_ON_CONFIG.endpoint){T.step='off';return renderTryOn()}
  if(!await askConsent())return;
  tryBusy=true;T.step='busy';renderTryOn();let k=0;const show=()=>{const e=$('#tstage');if(e)e.textContent=STAGES[k]};
  const iv=0;
  try{const g=await generateVirtualTryOn({...T,pieces:toTry},T.settings,{fresh,onStatus:s=>{k=s==='queued'?2:s==='processing'?3:s==='start'?1:k;show()}});T.image=g.image;T.generationId=g.generationId;T.modelId=g.modelId;T.tried=toTry;T.step='result';T.look=null}
  catch(e){console.warn('[V4.1] generation failed:',e.code||e.name,e.message);T.step='error';T.err=e.code||'gen'}
  finally{clearInterval(iv);tryBusy=false}
  renderTryOn();
}
const modelSvg=n=>`<svg viewBox="0 0 60 100" aria-hidden="true"><circle cx="30" cy="14" r="9"/>${n==='Model A'?'<path d="M10 30q20-6 40 0l-3 34H13z"/>':n==='Model B'?'<path d="M16 30q14-4 28 0l-2 18 8 16H10l8-16z"/>':'<path d="M13 30q17-5 34 0l-2 34H15z"/>'}<rect x="21" y="64" width="7" height="30" rx="3"/><rect x="32" y="64" width="7" height="30" rx="3"/></svg>`;
const tpieces=ps=>`<div class="tpieces">${ps.map(i=>`<div class="tp"><img src="${i.image}" alt="${esc(i.name)}">${esc(i.name)}</div>`).join('')}</div>`;
function renderTryOn(){
  const b=$('#tryon-body');
  if(!T){b.innerHTML='<div class="empty"><h2>Choose an outfit first</h2><p class="mut">Generate an outfit, then tap See It On a Model.</p><button class="btn" data-go="stylist">Open AI Stylist</button></div>';return}
  const s=T.settings,names=(T.step==='result'&&T.tried?T.tried:T.pieces).map(i=>i.name),msg=(h,p,btns)=>`<div class="empty"><h2>${h}</h2><p class="mut">${p}</p><div class="row" style="gap:8px;justify-content:center">${btns}</div></div>`;
  const back='<button class="btn ghost" data-a="tback">Back to Outfit</button>';
  const grp=(k,list)=>`<fieldset class="fs" id="tg-${k}"><legend>${TLABEL[k]}</legend><div class="chips">${list.map(v=>`<button type="button" class="chip" aria-pressed="${s[k]===v}" data-a="topt" data-k="${k}" data-tv="${v}">${v}</button>`).join('')}</div></fieldset>`;
  let left=`<h3>Your outfit</h3>${tpieces(T.pieces)}`,right='';
  if(T.step==='result'){
    const l=T.look;
    left+=`<h2>Your Look</h2><p>${esc(names.join(' + '))}</p><p class="mut">${[T.occasion,T.style].filter(Boolean).map(esc).join(' • ')}</p>${l?`<p class="mut">Model: Adult ${esc(s.presentation)} · Created ${new Date(l.createdAt).toLocaleDateString()}</p>`:''}
    <div class="row sticky" style="gap:8px">${l?`<button class="btn ghost" data-a="tfav" aria-pressed="${!!l.favourite}">${l.favourite?'Unfavourite':'Favourite'}</button>`:'<button class="btn" data-a="tsave">Save Look</button>'}<button class="btn ghost" data-a="tregen">Generate Again</button><button class="btn ghost" data-a="tmodel">Change Model</button><button class="btn ghost" data-a="toutfit">Change Outfit</button>${l?'<button class="btn ghost" data-a="tdel">Delete</button>':''}<button class="btn ghost" data-a="tback">Back</button></div>`;
    right=`<img class="timg" src="${T.image}" alt="AI-generated adult model wearing ${esc(names.join(', '))}"><details class="cmp"><summary>Before and after</summary><div><div><h3>Wardrobe items</h3>${tpieces(T.pieces)}</div><div><h3>AI model wearing the outfit</h3><img class="timg" src="${T.image}" alt="AI model wearing the outfit"></div></div></details>`;
  }else{
    left+=`<h3>Choose your model</h3><div class="models" id="tg-model">${MODELS.map(([n,d])=>`<button type="button" class="mcard" aria-pressed="${s.presentation===n}" data-a="topt" data-k="presentation" data-tv="${n}">${modelSvg(n)}<b>${n}</b><span>${d}</span></button>`).join('')}</div>${tryable(T.pieces).length?`<h3>Garment to try</h3><div class="chips" style="margin-bottom:12px">${tryable(T.pieces).map(i=>`<button type="button" class="chip" aria-pressed="${(tryList()[0]||{}).id===i.id}" data-a="tpick" data-id="${i.id}">${esc(i.name)}</button>`).join('')}</div>`:'<p class="pnote">This try-on model supports tops and jackets. Your outfit has none.</p>'}<p class="pnote">The selected model photo controls the pose, body presentation and background. Shoes, trousers and accessories aren't supported by this model.</p><p class="pnote">Powered by Hugging Face + a compatible virtual try-on model (IDM-VTON). Free GPU access is limited and result quality isn't guaranteed.</p><details class="cmp"><summary>Tips for better results</summary><ul class="pnote"><li>Photograph one garment clearly</li><li>Use good lighting</li><li>Keep the garment fully visible</li><li>Avoid extreme blur and heavy obstruction</li><li>Use a simple background when possible</li></ul></details>
    <div class="box"><h3>Your look</h3><p class="mut" style="margin:0">${esc(names.join(', '))}<br>Model: Adult ${esc(s.presentation)}<br>${tryList().length?'Garment: '+esc(tryList().map(i=>i.name).join(', '))+' · 1 generation':'No supported garment (tops and jackets only)'}</p></div>
    <p class="pnote">Privacy: Your selected clothing image may be sent to the connected AI service to generate the try-on result. Only the selected garment and model are sent, never your whole wardrobe. <a href="#settings">Privacy information</a></p>
    <div class="row sticky" style="gap:8px"><button class="btn" data-a="tgen"${tryBusy||!tryList().length?' disabled':''}>Generate Look</button>${back}</div>`;
    right=T.step==='busy'?`<div class="tbusy" role="status" aria-live="polite"><div class="skel"></div><p id="tstage">${STAGES[0]}</p></div>`
      :T.step==='off'?msg("Virtual Try-On isn't connected yet.",'Connect a supported image-generation or virtual try-on service to preview your outfit on a model.',back)
      :T.step==='error'?errPanel(msg,back)
      :`<div class="tbusy">${modelSvg(s.presentation).replace('<svg','<svg style="width:90px;height:150px;fill:currentColor;opacity:.35"')}<p>Your look appears here after you press Generate Look.</p></div>`;
  }
  b.innerHTML=`<div class="head"><div><h1>Virtual Try-On</h1><p class="mut" style="margin:0">See your clothes on a model.</p></div></div><div class="tryon"><div class="tleft">${left}</div><div class="tright${T.step==='setup'?' ph':''}">${right}</div></div>`;
  if(T.focus){const e=$('#tg-'+T.focus);if(e)e.scrollIntoView({block:'center'});T.focus=null}
}
const urlCache=new WeakMap();
const lookSrc=l=>typeof l.image==='string'?l.image:(urlCache.get(l.image)||(urlCache.set(l.image,URL.createObjectURL(l.image)),urlCache.get(l.image)));
async function saveLook(){
  if(!T?.image)return;
  try{
    let img=T.image;try{const r=await fetch(T.image);if(!r.ok)throw 0;img=await r.blob()}catch{toast("This image couldn't be copied to your device. Saving a temporary link only.")}
    const l={id:uid(),image:img,outfitId:T.outfitId,clothingItemIds:T.pieces.map(i=>i.id),names:T.pieces.map(i=>i.name),provider:'huggingface',model:TRY_ON_CONFIG.modelName,clothingItems:(T.tried||T.pieces).map(i=>({id:i.id,name:i.name})),generationId:T.generationId||null,modelId:T.modelId||null,modelSettings:{...T.settings},background:T.settings.background,pose:T.settings.pose,lighting:T.settings.lighting,occasion:T.occasion,style:T.style,favourite:false,createdAt:Date.now()};
    await addLook(l);looks.unshift(l);T.look=l;v4('Look saved');toast('Look saved');renderTryOn();
  }catch(e){console.warn('[V4] save failed:',e.name);toast("This generated image couldn't be saved on this device.")}
}
async function toggleLookFav(l,gallery){l.favourite=!l.favourite;try{await updateLook(l)}catch{toast("Couldn't update this look.")}gallery?renderLooks():renderTryOn()}
async function removeLook(id,fromTryOn){
  if(!confirm('Delete this look?'))return;
  try{await deleteLook(id);looks=looks.filter(l=>l.id!==id);if(fromTryOn){T=null;go('looks')}else renderLooks()}catch{toast("Couldn't delete this look.")}
}
const tryBack=()=>T?.from==='looks'?go('looks'):go(res.length?'results':'stylist');
function renderLooks(){
  $('#looks').innerHTML=looks.length?looks.map(l=>`<article class="card"><button class="qv lk" data-a="lopen" data-id="${l.id}" aria-label="Open look: ${esc((l.names||[]).join(', '))}"><img src="${lookSrc(l)}" alt="Model wearing ${esc((l.names||[]).join(', '))}" loading="lazy"></button><div class="cb"><h3>${esc((l.names||[]).join(' + '))}</h3><p>${new Date(l.createdAt).toLocaleDateString()} · ${esc(l.pose||'')}</p><div class="row"><button class="ic" data-a="lfav" data-id="${l.id}" aria-pressed="${!!l.favourite}" aria-label="Favourite look">${heart}</button><button class="lnk" data-a="lopen" data-id="${l.id}">Open</button><button class="lnk" data-a="ldel" data-id="${l.id}">Delete</button></div></div></article>`).join(''):`<div class="empty"><h2>You haven't created any model looks yet.</h2><p class="mut">Generate an outfit, then tap See It On a Model.</p><button class="btn" data-go="stylist">Style an Outfit</button></div>`;
}
// ==============================
// SETTINGS
// ==============================
function applyTheme(){const t=getSet('theme','system');document.documentElement.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}
function renderProfile(){
  const pr=PROFILE(),mk=(id,list,k)=>$('#'+id).innerHTML=list.map(v=>`<button type="button" class="chip" aria-pressed="${pr[k].includes(v)}" data-a="pf" data-k="${k}" data-pv="${esc(v)}">${esc(cap(v))}</button>`).join('');
  mk('pf-styles',STYLES,'styles');mk('pf-colours',Object.keys(COLOURS),'colours');mk('pf-avoid',Object.keys(COLOURS),'avoid');
  fill($('#pf-fit'),['Relaxed','Regular','Slim','Oversized','Mixed']);fill($('#pf-goal'),['Simple','Trendy','Elegant','Practical','Experimental']);$('#pf-fit').value=pr.fit;$('#pf-goal').value=pr.goal;
}
async function renderSettings(){
  renderProfile();$$('[data-ai]').forEach(c=>c.checked=!!AIS()[c.dataset.ai]);
  $('#ai-status').textContent=AI_CONFIG.enabled&&AI_CONFIG.endpoint?'An AI service is connected.':'No AI service is configured, so AI features are unavailable and the local engine is used.';$('#ai-prov').textContent=AI_CONFIG.provider;$('#tryon-prov').textContent=TRY_ON_CONFIG.providerName;
  $('#s-theme').value=getSet('theme','system');$('#s-style').value=getSet('dstyle','Casual');$('#s-occasion').value=getSet('docc','College');
  let s=`${items.length} wardrobe item${items.length===1?'':'s'} and ${outfits.length} saved outfit${outfits.length===1?'':'s'} stored in this browser.`;
  try{const e=await navigator.storage.estimate();s+=` Using about ${(e.usage/1048576).toFixed(1)} MB of roughly ${Math.round(e.quota/1048576)} MB available.`}catch{}
  $('#storage').textContent=s;
}

// ==============================
// DEMO DATA
// ==============================
const SHAPE={top:'M30 20l20-8q10 8 20 0l20 8 14 22-16 8v50H32V50L16 42z',bottom:'M32 14h56l6 88H66L60 44l-6 58H26z',outerwear:'M28 16l22-6 10 12 10-12 22 6 14 30-14 6v52H28V52L14 46z',dress:'M46 10h28l4 30 18 66H24l18-66z',shoes:'M14 70h30l14 12h40q10 0 10 14v6H14z',acc:'M10 52h100v16H10z'};
const garment=(g,c)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#f0f0ee"/><path d="${SHAPE[g]||SHAPE.top}" fill="${COLOURS[c]}" stroke="#00000033" stroke-width="2"/></svg>`);
const DEMO=[['White Shirt','Shirt','white','Smart Casual','All Season'],['Black T-Shirt','T-Shirt','black','Casual','All Season'],['Blue Oxford Shirt','Shirt','blue','Smart Casual','All Season'],['Grey Hoodie','Hoodie','grey','Streetwear','Winter'],['Black Trousers','Trousers','black','Smart Casual','All Season'],['Blue Jeans','Jeans','blue','Casual','All Season'],['Beige Trousers','Trousers','beige','Smart Casual','All Season'],['White Sneakers','Sneakers','white','Casual','All Season'],['Black Sneakers','Sneakers','black','Streetwear','All Season'],['Brown Shoes','Shoes','brown','Formal','All Season'],['Black Jacket','Jacket','black','Smart Casual','Winter'],['Beige Overshirt','Jacket','beige','Casual','All Season'],['Black Belt','Accessories','black','Minimal','All Season'],['Brown Belt','Accessories','brown','Smart Casual','All Season'],['Grey Sport Shorts','Shorts','grey','Sporty','Summer'],['Navy Sport T-Shirt','T-Shirt','navy','Sporty','Summer']];
async function loadDemo(){for(const [name,category,colour,style,season] of DEMO)await addItem({id:uid(),name,category,colour,pattern:'Solid',style,season,image:garment(GROUP[category],colour),favourite:false,timesWorn:0,lastWorn:null,createdAt:Date.now()-Math.random()*864e5*3});await reload();toast('Demo wardrobe loaded');go(location.hash.slice(1)==='results'?'stylist':(location.hash.slice(1)||'dashboard'))}

// ==============================
// INITIALIZATION
// ==============================
async function onAction(a,id,b){
  const it=items.find(i=>i.id===id),o=outfits.find(i=>i.id===id);
  try{
    if(a==='new'){openForm(null);go('add')}
    else if(a==='edit'&&it){openForm(it);go('add')}
    else if(a==='fav'&&it){await updateItem({...it,favourite:!it.favourite});await reload();go(location.hash.slice(1))}
    else if(a==='del'&&it&&confirm(`Delete "${it.name}" from your wardrobe?`)){await deleteItem(id);await reload();go(location.hash.slice(1));toast('Deleted')}
    else if(a==='clear'&&confirm('Delete every item in your wardrobe? This cannot be undone.')){await clearItems();await reload();renderSettings();toast('Wardrobe cleared')}
    else if(a==='demo')await loadDemo();
    else if(a==='view'&&it)quickView(it);
    else if(a==='tryon')openTryOn();
    else if(a==='tpick'&&T){T.selId=id;renderTryOn()}
    else if(a==='topt'&&T){T.settings[b.dataset.k]=b.dataset.tv;setSet('tryon-settings',T.settings);renderTryOn()}
    else if(a==='tgen'||a==='tretry')runGen(false);
    else if(a==='tregen')runGen(true);
    else if(a==='tmodel'||a==='tbg'){T.step='setup';T.focus=a==='tbg'?'background':'model';renderTryOn()}
    else if(a==='tsave')await saveLook();
    else if(a==='toutfit')go('stylist');
    else if(a==='tback')tryBack();
    else if(a==='tfav'&&T?.look)await toggleLookFav(T.look,false);
    else if(a==='lfav'){const l=looks.find(x=>x.id===id);if(l)await toggleLookFav(l,true)}
    else if(a==='tdel'&&T?.look)await removeLook(T.look.id,true);
    else if(a==='ldel')await removeLook(id,false);
    else if(a==='lopen')openLook(looks.find(x=>x.id===id));
    else if(a==='stylethis'&&it)await runStylist(false,{p:{occasion:'Custom',style:it.style,weather:$('#p-weather').value,colour:'Any'},o:{must:it.id},limit:3,title:'Styled around '+it.name});
    else if(a==='forgotten'){const boost=new Set([...items].sort((x,y)=>(x.timesWorn||0)-(y.timesWorn||0)||(x.lastWorn||0)-(y.lastWorn||0)).slice(0,Math.max(3,Math.ceil(items.length/4))).map(i=>i.id));$('#p-weather').value=await getWeather();await runStylist(false,{o:{boost},title:'Give your forgotten clothes a chance'})}
    else if(a==='aiuse')applyAI(true);
    else if(a==='aiedit')applyAI(false);
    else if(a==='cleanimg'){const src=img||(removed?null:editing?.image);if(!src)toast('Add a photo first.');else if(!AI_CONFIG.bgEndpoint||!AIS().images)toast('Background cleaning is not set up. Your original photo is kept.');else{const c=await removeBackground(src);if(c!==src){img=c;removed=false;setPrev(c);toast('Image cleaned')}else toast('Could not clean the image. Your original is kept.')}}
    else if(a==='sugg')chatSend(b.dataset.s);
    else if(a==='pf'){const pr=PROFILE(),l=pr[b.dataset.k],v=b.dataset.pv;pr[b.dataset.k]=l.includes(v)?l.filter(x=>x!==v):[...l,v];setSet('profile',pr);renderProfile()}
    else if(a==='like'||a==='reason'){const x=res[idx],fb=getSet('fb',[]);fb.unshift({sig:x.sig,ids:x.pieces.map(i=>i.id),like:a==='like',reason:b.dataset.r||'',date:Date.now()});setSet('fb',fb.slice(0,60));$('#fbx').innerHTML='';toast(a==='like'?'Glad you like it':'Thanks, future looks will adjust')}
    else if(a==='dislike')$('#fbx').innerHTML='<p class="mut">Why don\'t you like it? (optional)</p><div class="chips">'+['Too formal','Too casual',"Colours don't work",'Not my style',"Don't like this item",'Other'].map(r=>`<button class="chip" data-a="reason" data-r="${esc(r)}">${esc(r)}</button>`).join('')+'</div>';
    else if(a==='rate'){const n=+b.dataset.n,x=res[idx],rec=outfits.find(r=>r.id===cur.id),rt=getSet('ratings',[]);rt.unshift({outfitId:cur.id,sig:x.sig,rating:n,feedback:'',date:Date.now()});setSet('ratings',rt.slice(0,100));if(rec)await updateOutfit({...rec,rating:n});$('#rate').innerHTML='<p class="mut">Thanks, rated '+n+' out of 5.</p>'}
    else if(a==='rmimg'){img=null;removed=true;setPrev(null)}
    else if(a==='clearf')clearFilters();
    else if(a==='styleme'){$('#p-weather').value=await getWeather();$('#p-occasion').value=getSet('docc','College');$('#p-style').value=PROFILE().styles[0]||getSet('dstyle','Casual');$('#p-colour').value='Any';await runStylist(false,{today:true})}
    else if(a==='wore'){const x=res[idx],now=Date.now();if(cur.id){await updateOutfit({...outfits.find(r=>r.id===cur.id),worn:now})}else{cur.id=uid();await addOutfit(mkRec(x,{id:cur.id,worn:now}))}await markWorn(x.pieces);await reload();$('[data-a=wore]').disabled=true;toast('Marked as worn');$('#rate').innerHTML='<h3>How was this outfit?</h3><div class="chips">'+[1,2,3,4,5].map(n=>`<button class="chip" data-a="rate" data-n="${n}" aria-label="${n} out of 5">${n}</button>`).join('')+'</div>'}
    else if(a==='owear'&&o){await updateOutfit({...o,worn:Date.now()});await markWorn(o.pieces);await reload();renderSaved();toast('Marked as worn')}
    else if(a==='gsave'){const g=getSet('gen',[]).find(x=>x.id===id);if(g){const ps=g.ids.map(k=>items.find(i=>i.id===k)).filter(Boolean);await addOutfit(mkRec({pieces:ps},{occasion:g.occasion,style:g.style,weather:g.weather,saved:true}));await reload();renderSaved();toast('Outfit saved')}}
    else if(a==='save'){const x=res[idx];if(cur.id){await updateOutfit({...outfits.find(r=>r.id===cur.id),saved:true})}else{cur.id=uid();await addOutfit(mkRec(x,{id:cur.id,saved:true}))}await reload();$('[data-a=save]').disabled=true;$('[data-a=save]').textContent='Saved';toast('Outfit saved')}
    else if(a==='again'){idx++;idx<res.length?showOutfit():runStylist(true)}
    else if(a==='open'&&o){$('#dbody').innerHTML=`<h2>${esc(o.occasion)} · ${esc(o.style)}</h2><div class="look">${o.pieces.map(p=>`<div class="piece"><img src="${pic(p)}" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3><span>${esc(p.category)}</span></div></div>`).join('')}</div><p>${esc(o.note||'')}</p>`;$('#dlg').showModal()}
    else if(a==='closedlg')$('#dlg').close();
    else if(a==='ofav'&&o){await updateOutfit({...o,favourite:!o.favourite});await reload();renderSaved()}
    else if(a==='odel'&&o&&confirm('Delete this saved outfit?')){await deleteOutfit(id);await reload();renderSaved()}
  }catch{toast('Something went wrong. Please try again.')}
}
async function init(){
  fillForm();
  fill($('#fk'),[...CATS,'Sneakers','Boots'],'All categories');fill($('#fc'),Object.keys(COLOURS),'All colours');fill($('#fs'),STYLES,'All styles');fill($('#fz'),SEASONS,'All seasons');fill($('#ff'),['Favourites'],'All items');
  $('#fo').innerHTML='<option value="new">Recently added</option><option value="old">Oldest</option><option value="name">Name</option><option value="most">Most worn</option><option value="least">Least worn</option>';
  fill($('#d-weather'),Object.keys(WX));
  fill($('#p-occasion'),Object.keys(OCC));fill($('#p-style'),STYLES);fill($('#p-weather'),Object.keys(WX));fill($('#p-colour'),['Any',...Object.keys(PREF)]);
  fill($('#s-style'),STYLES);fill($('#s-occasion'),Object.keys(OCC));
  $('#p-style').value=getSet('dstyle','Casual');$('#p-occasion').value=getSet('docc','College');
  const last=getSet('prefs',{});for(const k in last){const e=$('#p-'+k);if(e)e.value=last[k]}
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-g]');if(t){grp=t.dataset.g;renderWardrobe();return}
    const ch=e.target.closest('.chip[data-v]');if(ch){$('#'+ch.parentElement.dataset.for).value=ch.dataset.v;syncChips();return}
    const n=e.target.closest('[data-go]');if(n){go(n.dataset.go);return}
    const b=e.target.closest('[data-a]');if(b)onAction(b.dataset.a,b.dataset.id,b);
  });
  $('#fk').onchange=e=>{F.cat=e.target.value;renderWardrobe()};$('#ff').onchange=e=>{F.fav=e.target.value;renderWardrobe()};$('#fo').onchange=e=>{F.sort=e.target.value;renderWardrobe()};
  $('#d-weather').onchange=e=>{$('#p-weather').value=e.target.value};
  $('#q').oninput=e=>{F.q=e.target.value;renderWardrobe()};
  $('#fc').onchange=e=>{F.colour=e.target.value;renderWardrobe()};$('#fs').onchange=e=>{F.style=e.target.value;renderWardrobe()};$('#fz').onchange=e=>{F.season=e.target.value;renderWardrobe()};
  $('#file').onchange=e=>pick(e.target.files[0]);$('#cam').onchange=e=>pick(e.target.files[0]);
  const d=$('#drop');d.ondragover=e=>{e.preventDefault();d.classList.add('on')};d.ondragleave=()=>d.classList.remove('on');d.ondrop=e=>{e.preventDefault();d.classList.remove('on');pick(e.dataTransfer.files[0])};
  $('#form').onsubmit=submitForm;$('#prefs').onsubmit=e=>{e.preventDefault();runStylist()};
  $$('[data-ai]').forEach(c=>c.onchange=()=>setSet('ai',{...AIS(),[c.dataset.ai]:c.checked}));
  $('#pf-fit').onchange=e=>setSet('profile',{...PROFILE(),fit:e.target.value});$('#pf-goal').onchange=e=>setSet('profile',{...PROFILE(),goal:e.target.value});
  $('#chatf').onsubmit=e=>{e.preventDefault();const v=$('#chat-in').value;$('#chat-in').value='';chatSend(v)};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&location.hash==='#tryon'&&!tryBusy&&!$('#dlg').open&&T)tryBack()});
  $('#s-theme').onchange=e=>{setSet('theme',e.target.value);applyTheme()};
  $('#s-style').onchange=e=>{setSet('dstyle',e.target.value);$('#p-style').value=e.target.value};
  $('#s-occasion').onchange=e=>{setSet('docc',e.target.value);$('#p-occasion').value=e.target.value};
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applyTheme);
  applyTheme();await reload();go(location.hash.slice(1)||'dashboard');
}
addEventListener('error',()=>toast('Something went wrong. Please refresh the page.'));
init();
