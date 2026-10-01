// ==============================
// GLOBAL STATE
// ==============================
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLOURS={white:'#ffffff',black:'#1a1a1a',navy:'#1f2a44',blue:'#3b6fb6',grey:'#8a8a8a',beige:'#d8c8a8',brown:'#7a5230',cream:'#f1e9d2',green:'#4d6b4a',red:'#b23a3a'};
const GROUP={Shirt:'top','T-shirt':'top',Hoodie:'top',Sweater:'top',Jacket:'outerwear',Coat:'outerwear',Jeans:'bottom',Trousers:'bottom',Shorts:'bottom',Skirt:'bottom',Dress:'dress',Shoes:'shoes',Sneakers:'shoes',Boots:'shoes',Accessories:'acc',Other:'other'};
const PATTERNS=['Solid','Striped','Checked','Printed','Graphic','Other'];
const STYLES=['Casual','Smart Casual','Formal','Streetwear','Sporty','Traditional','Minimal'];
const SEASONS=['Summer','Winter','Monsoon','All Season'];
const TABS=[['all','All'],['top','Tops'],['bottom','Bottoms'],['dress','Dresses'],['outerwear','Outerwear'],['shoes','Shoes'],['acc','Accessories']];
const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>';
let items=[],outfits=[],grp='all',editing=null,img=null,res=[],idx=0,P={};
const F={q:'',colour:'',style:'',season:''};
const cap=s=>s[0].toUpperCase()+s.slice(1);
const uid=()=>globalThis.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const fill=(sel,list,ph)=>{sel.innerHTML=(ph!==undefined?`<option value="">${ph}</option>`:'')+list.map(v=>`<option>${esc(v)}</option>`).join('')};
function toast(m){const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3200)}

// ==============================
// STORAGE
// ==============================
const openDB=()=>openDB.p||(openDB.p=new Promise((ok,no)=>{const r=indexedDB.open('wardrobe-ai',1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('items',{keyPath:'id'});r.result.createObjectStore('outfits',{keyPath:'id'})};
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
async function tx(store,mode,fn){const db=await openDB();return new Promise((ok,no)=>{const t=db.transaction(store,mode);const q=fn(t.objectStore(store));t.oncomplete=()=>ok(q&&q.result);t.onerror=t.onabort=()=>no(t.error)})}
const addItem=i=>tx('items','readwrite',s=>s.add(i)),getItems=()=>tx('items','readonly',s=>s.getAll()),updateItem=i=>tx('items','readwrite',s=>s.put(i)),deleteItem=id=>tx('items','readwrite',s=>s.delete(id)),clearItems=()=>tx('items','readwrite',s=>s.clear());
const addOutfit=o=>tx('outfits','readwrite',s=>s.add(o)),getOutfits=()=>tx('outfits','readonly',s=>s.getAll()),updateOutfit=o=>tx('outfits','readwrite',s=>s.put(o)),deleteOutfit=id=>tx('outfits','readwrite',s=>s.delete(id));
const getSet=(k,d)=>{try{return JSON.parse(localStorage.getItem('wa-'+k))??d}catch{return d}};
const setSet=(k,v)=>{try{localStorage.setItem('wa-'+k,JSON.stringify(v))}catch{}};
async function reload(){
  try{items=await getItems();outfits=(await getOutfits()).sort((a,b)=>b.createdAt-a.createdAt)}
  catch{toast('Could not read saved data. Check that browser storage is allowed.');items=[];outfits=[]}
}

// ==============================
// NAVIGATION
// ==============================
function go(v){
  if(!$(`[data-view="${v}"]`))v='dashboard';
  $$('[data-view]').forEach(s=>s.hidden=s.dataset.view!==v);
  $$('[data-go]').forEach(b=>b.dataset.go===(v==='results'?'stylist':v)?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  if(location.hash!=='#'+v)location.hash=v;
  if(v==='dashboard')renderDashboard();else if(v==='wardrobe')renderWardrobe();else if(v==='saved')renderSaved();else if(v==='settings')renderSettings();else if(v==='add'&&!$('#form').dataset.ready)openForm(null);
  scrollTo(0,0);
}
addEventListener('hashchange',()=>go(location.hash.slice(1)));

// ==============================
// CLOTHING MANAGEMENT
// ==============================
const card=i=>`<article class="card"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"><div class="cb"><h3>${esc(i.name)}</h3><p>${esc(i.category)} · ${esc(i.colour)} · ${esc(i.style)}</p><div class="row"><button class="ic" data-a="fav" data-id="${i.id}" aria-pressed="${!!i.favourite}" aria-label="Favourite ${esc(i.name)}">${heart}</button><button class="lnk" data-a="edit" data-id="${i.id}">Edit</button><button class="lnk" data-a="del" data-id="${i.id}">Delete</button></div></div></article>`;
const emptyBox='<div class="empty"><h2>Your wardrobe is empty</h2><p class="mut">Add your first piece, or load sample clothes to see how it works.</p><button class="btn" data-a="new">Add clothing</button> <button class="btn ghost" data-a="demo">Load Demo Wardrobe</button></div>';
function stats(){const c=k=>items.filter(i=>GROUP[i.category]===k).length;
  return [['Total items',items.length],['Tops',c('top')],['Bottoms',c('bottom')],['Shoes',c('shoes')]].map(([l,n])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}
function renderDashboard(){
  $('#stats').innerHTML=stats();
  $('#recent').innerHTML=items.length?[...items].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4).map(card).join(''):emptyBox;
}
function openForm(it){
  editing=it;img=null;$('#form').reset();$('#form').dataset.ready='1';$('#ft').textContent=it?'Edit Clothing':'Add Clothing';$('#err').textContent='';
  if(it)for(const k of ['name','category','colour','pattern','style','season'])$('#f-'+k).value=it[k];
  $('#prev').src=it?it.image:'';$('#prev').hidden=!it;
}
async function submitForm(e){
  e.preventDefault();
  const image=img||editing?.image;
  if(!image){$('#err').textContent='Add a photo of the item.';return}
  const d=Object.fromEntries(['name','category','colour','pattern','style','season'].map(k=>[k,$('#f-'+k).value.trim()]));
  try{const was=!!editing;
    was?await updateItem({...editing,...d,image}):await addItem({id:uid(),...d,image,favourite:false,createdAt:Date.now()});
    await reload();$('#form').dataset.ready='';toast(was?'Changes saved':'Added to wardrobe');go('wardrobe');
  }catch{$('#err').textContent='Storage is full or blocked. Free some space or delete items, then try again.'}
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
async function pick(file){if(!file)return;try{img=await compress(file);$('#prev').src=img;$('#prev').hidden=false;$('#err').textContent=''}catch(e){img=null;$('#err').textContent=e.message}}

// ==============================
// WARDROBE FILTERING
// ==============================
function renderWardrobe(){
  $('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="tab" aria-pressed="${k===grp}" data-g="${k}">${l}</button>`).join('');
  const q=F.q.toLowerCase(),g=$('#grid');
  if(!items.length){g.innerHTML=emptyBox;return}
  const list=items.filter(i=>(grp==='all'||GROUP[i.category]===grp)&&(!q||`${i.name} ${i.category} ${i.colour}`.toLowerCase().includes(q))&&(!F.colour||i.colour===F.colour)&&(!F.style||i.style===F.style)&&(!F.season||i.season===F.season));
  g.innerHTML=list.length?list.map(card).join(''):'<div class="empty"><h2>No matches</h2><p class="mut">Try a different search or clear the filters.</p></div>';
}

// ==============================
// OUTFIT GENERATOR
// ==============================
const OCC={College:{s:['Casual','Smart Casual','Streetwear','Minimal','Sporty'],ban:[]},Work:{s:['Smart Casual','Formal','Minimal'],ban:['Shorts','Hoodie']},Casual:{s:STYLES,ban:[]},Date:{s:['Casual','Smart Casual','Formal','Minimal'],ban:['Shorts']},Party:{s:STYLES,ban:[]},Wedding:{s:['Formal','Traditional','Smart Casual'],ban:['Shorts','Hoodie','T-shirt','Sneakers']},Travel:{s:STYLES,ban:[]},Dinner:{s:['Casual','Smart Casual','Formal','Minimal'],ban:['Shorts']},Workout:{s:['Sporty'],ban:['Jeans','Dress','Skirt','Coat','Boots','Shirt']},Custom:{s:STYLES,ban:[]}};
const WX={Hot:['Hoodie','Sweater','Coat','Jacket','Boots'],Warm:['Coat','Sweater','Hoodie'],Cool:[],Cold:['Shorts'],Rainy:['Shorts']};
const WS={Hot:'Summer',Warm:'Summer',Cold:'Winter',Rainy:'Monsoon'};
const COMPAT={navy:['white','beige','grey','brown','cream'],blue:['white','grey','black','beige'],beige:['white','brown','navy','black','cream'],brown:['beige','white','navy','cream'],grey:['black','white','navy','blue'],cream:['brown','navy','beige','grey','blue','green'],green:['beige','cream','brown','white','black','navy','grey'],red:['navy','grey','beige','cream']};
const PREF={Neutral:['white','black','grey','beige','cream','navy'],Dark:['black','navy','brown','grey','green'],Light:['white','cream','beige','grey'],'Earth tones':['brown','beige','cream','green'],Bright:['red','blue','green']};
const LABEL={top:'Top',bottom:'Bottom',dress:'Dress',outerwear:'Layer',shoes:'Shoes',acc:'Accessory'};
const compat=(a,b)=>a===b||['white','black'].includes(a)||['white','black'].includes(b)||(COMPAT[a]||[]).includes(b)||(COMPAT[b]||[]).includes(a);

function generate(list,p){
  const has=g=>list.some(i=>GROUP[i.category]===g);
  if(!has('dress')&&!(has('top')&&has('bottom')))return{error:'Add at least a top and a bottom, or a dress, to your wardrobe first.'};
  const O=OCC[p.occasion]||OCC.Custom,ban=[...O.ban,...(WX[p.weather]||[])];
  const use=list.filter(i=>!ban.includes(i.category)&&(O.s.includes(i.style)||i.style===p.style));
  const [tops,bots,dr,out,sh,ac]=['top','bottom','dress','outerwear','shoes','acc'].map(g=>use.filter(i=>GROUP[i.category]===g));
  const bases=[...dr.map(d=>[d]),...tops.flatMap(t=>bots.map(b=>[t,b]))];
  const lay=['Cool','Cold','Rainy'].includes(p.weather)?(p.weather==='Cold'&&out.length?out.map(o=>[o]):[[],...out.map(o=>[o])]):[[]];
  const shoes=sh.length?sh.map(s=>[s]):[[]],accs=[[],...ac.map(a=>[a])];
  const score=pcs=>pcs.reduce((s,i)=>s+(i.style===p.style?2:0)+(O.s.includes(i.style)?1:0)+(i.season==='All Season'||i.season===WS[p.weather]?1:0)+(PREF[p.colour]?.includes(i.colour)?1:0)+(i.favourite?.5:0)+(p.weather==='Rainy'&&i.category==='Boots'?1:0),0);
  const all=[];
  for(const b of bases)for(const l of lay)for(const s of shoes)for(const a of accs){
    const pcs=[...b,...l,...s,...a];
    if(pcs.every((x,i)=>pcs.slice(i+1).every(y=>compat(x.colour,y.colour))))all.push({pcs,sc:score(pcs)+(s.length?1:0)});
  }
  if(!all.length)return{error:'No compatible outfit for these choices. Try a different style, occasion or weather, or add more pieces.'};
  const picked=[];
  for(let k=0;k<4;k++){
    const used=new Set(picked.flatMap(o=>o.pcs.map(i=>i.id)));let best=null,bs=-1e9;
    for(const o of all){if(picked.includes(o))continue;const v=o.sc-1.5*o.pcs.filter(i=>used.has(i.id)).length+Math.random()*2;if(v>bs){bs=v;best=o}}
    if(!best)break;picked.push(best);
  }
  return{outfits:picked.map(o=>({pieces:o.pcs,colours:[...new Set(o.pcs.map(i=>i.colour))],note:`Clean and versatile combination suitable for a ${p.style.toLowerCase()} ${p.occasion.toLowerCase()} look in ${p.weather.toLowerCase()} weather.`}))};
}
function showOutfit(){
  const o=res[idx];
  $('#result').innerHTML=`<h1>Your Outfit</h1><div class="meta"><span class="tag">${esc(P.occasion)}</span><span class="tag">${esc(P.style)}</span><span class="tag">${esc(P.weather)}</span><span class="tag">${esc(o.colours.join(' + '))}</span></div>
  <div class="look">${o.pieces.map(i=>`<div class="piece"><img src="${i.image}" alt="${esc(i.name)}"><div><span>${LABEL[GROUP[i.category]]||'Piece'}</span><h3>${esc(i.name)}</h3></div></div>`).join('')}</div>
  <p>${esc(o.note)}</p><div class="row" style="gap:8px"><button class="btn" data-a="save">Save Outfit</button><button class="btn ghost" data-a="again">Try Another</button><button class="btn ghost" data-go="stylist">Edit Preferences</button></div>`;
}
async function runStylist(quiet){
  const r=$('#result');
  P={occasion:$('#p-occasion').value,style:$('#p-style').value,weather:$('#p-weather').value,colour:$('#p-colour').value};
  setSet('prefs',P);if(!quiet){go('results');r.innerHTML='<div class="load">Building your look…</div>'}
  if(!items.length){r.innerHTML='<div class="empty"><h2>Your wardrobe is empty</h2><p class="mut">The stylist only uses clothes you have added.</p><button class="btn" data-a="demo">Load Demo Wardrobe</button></div>';return}
  let out;try{out=generate(items,P)}catch{out={error:'Something went wrong building this outfit. Please try again.'}}
  if(out.error){r.innerHTML=`<div class="empty"><h2>No outfit yet</h2><p class="mut">${esc(out.error)}</p><button class="btn ghost" data-go="stylist">Edit Preferences</button> <button class="btn ghost" data-go="wardrobe">Open My Wardrobe</button></div>`;return}
  res=out.outfits;idx=0;showOutfit();
}

// ==============================
// SAVED OUTFITS
// ==============================
function renderSaved(){
  const g=$('#saved');
  if(!outfits.length){g.innerHTML='<div class="empty"><h2>No saved outfits yet.</h2><p class="mut">Generate a look from your wardrobe and save it here.</p><button class="btn" data-go="stylist">Create Your First Outfit</button></div>';return}
  g.innerHTML=outfits.map(o=>`<article class="card"><div style="display:flex;flex-wrap:wrap">${o.pieces.map(p=>`<img src="${p.image}" alt="${esc(p.name)}" style="width:25%;aspect-ratio:1;object-fit:contain;background:#f0f0ee">`).join('')}</div><div class="cb"><h3>${esc(o.occasion)} · ${esc(o.style)}</h3><p>${esc(o.pieces.map(p=>p.name).join(', '))}</p><p>${esc(o.weather)} · ${new Date(o.createdAt).toLocaleDateString()}</p><div class="row"><button class="ic" data-a="ofav" data-id="${o.id}" aria-pressed="${!!o.favourite}" aria-label="Favourite outfit">${heart}</button><button class="lnk" data-a="open" data-id="${o.id}">Open</button><button class="lnk" data-a="odel" data-id="${o.id}">Delete</button></div></div></article>`).join('');
}

// ==============================
// SETTINGS
// ==============================
function applyTheme(){const t=getSet('theme','system');document.documentElement.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}
async function renderSettings(){
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
const DEMO=[['White Oxford Shirt','Shirt','white','Smart Casual','All Season'],['Black T-shirt','T-shirt','black','Casual','All Season'],['Blue Denim Shirt','Shirt','blue','Casual','All Season'],['Grey Hoodie','Hoodie','grey','Streetwear','Winter'],['Black Straight Trousers','Trousers','black','Smart Casual','All Season'],['Blue Jeans','Jeans','blue','Casual','All Season'],['Beige Chinos','Trousers','beige','Smart Casual','All Season'],['Grey Sport Shorts','Shorts','grey','Sporty','Summer'],['White Sneakers','Sneakers','white','Casual','All Season'],['Brown Leather Shoes','Shoes','brown','Formal','All Season'],['Navy Jacket','Jacket','navy','Smart Casual','Winter'],['Black Belt','Accessories','black','Minimal','All Season']];
async function loadDemo(){for(const [name,category,colour,style,season] of DEMO)await addItem({id:uid(),name,category,colour,pattern:'Solid',style,season,image:garment(GROUP[category],colour),favourite:false,createdAt:Date.now()});await reload();toast('Demo wardrobe loaded');go(location.hash.slice(1)==='results'?'stylist':(location.hash.slice(1)||'dashboard'))}

// ==============================
// INITIALIZATION
// ==============================
async function onAction(a,id){
  const it=items.find(i=>i.id===id),o=outfits.find(i=>i.id===id);
  try{
    if(a==='new'){openForm(null);go('add')}
    else if(a==='edit'&&it){openForm(it);go('add')}
    else if(a==='fav'&&it){await updateItem({...it,favourite:!it.favourite});await reload();go(location.hash.slice(1))}
    else if(a==='del'&&it&&confirm(`Delete "${it.name}" from your wardrobe?`)){await deleteItem(id);await reload();go(location.hash.slice(1));toast('Deleted')}
    else if(a==='clear'&&confirm('Delete every item in your wardrobe? This cannot be undone.')){await clearItems();await reload();renderSettings();toast('Wardrobe cleared')}
    else if(a==='demo')await loadDemo();
    else if(a==='save'){const x=res[idx];await addOutfit({id:uid(),pieces:x.pieces.map(({id,name,image,category})=>({id,name,image,category})),...P,colours:x.colours,note:x.note,favourite:false,createdAt:Date.now()});await reload();$('[data-a=save]').disabled=true;$('[data-a=save]').textContent='Saved';toast('Outfit saved')}
    else if(a==='again'){idx++;idx<res.length?showOutfit():runStylist(true)}
    else if(a==='open'&&o){$('#dbody').innerHTML=`<h2>${esc(o.occasion)} · ${esc(o.style)}</h2><div class="look">${o.pieces.map(p=>`<div class="piece"><img src="${p.image}" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3><span>${esc(p.category)}</span></div></div>`).join('')}</div><p>${esc(o.note||'')}</p>`;$('#dlg').showModal()}
    else if(a==='closedlg')$('#dlg').close();
    else if(a==='ofav'&&o){await updateOutfit({...o,favourite:!o.favourite});await reload();renderSaved()}
    else if(a==='odel'&&o&&confirm('Delete this saved outfit?')){await deleteOutfit(id);await reload();renderSaved()}
  }catch{toast('Something went wrong. Please try again.')}
}
async function init(){
  fill($('#f-category'),Object.keys(GROUP));fill($('#f-colour'),Object.keys(COLOURS).map(cap));$$('#f-colour option').forEach(o=>o.value=o.textContent.toLowerCase());
  fill($('#f-pattern'),PATTERNS);fill($('#f-style'),STYLES);fill($('#f-season'),SEASONS);
  fill($('#fc'),Object.keys(COLOURS),'All colours');fill($('#fs'),STYLES,'All styles');fill($('#fz'),SEASONS,'All seasons');
  fill($('#p-occasion'),Object.keys(OCC));fill($('#p-style'),STYLES);fill($('#p-weather'),Object.keys(WX));fill($('#p-colour'),['Any',...Object.keys(PREF)]);
  fill($('#s-style'),STYLES);fill($('#s-occasion'),Object.keys(OCC));
  $('#p-style').value=getSet('dstyle','Casual');$('#p-occasion').value=getSet('docc','College');
  const last=getSet('prefs',{});for(const k in last){const e=$('#p-'+k);if(e)e.value=last[k]}
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-g]');if(t){grp=t.dataset.g;renderWardrobe();return}
    const n=e.target.closest('[data-go]');if(n){go(n.dataset.go);return}
    const b=e.target.closest('[data-a]');if(b)onAction(b.dataset.a,b.dataset.id);
  });
  $('#q').oninput=e=>{F.q=e.target.value;renderWardrobe()};
  $('#fc').onchange=e=>{F.colour=e.target.value;renderWardrobe()};$('#fs').onchange=e=>{F.style=e.target.value;renderWardrobe()};$('#fz').onchange=e=>{F.season=e.target.value;renderWardrobe()};
  $('#file').onchange=e=>pick(e.target.files[0]);$('#cam').onchange=e=>pick(e.target.files[0]);
  const d=$('#drop');d.ondragover=e=>{e.preventDefault();d.classList.add('on')};d.ondragleave=()=>d.classList.remove('on');d.ondrop=e=>{e.preventDefault();d.classList.remove('on');pick(e.dataTransfer.files[0])};
  $('#form').onsubmit=submitForm;$('#prefs').onsubmit=e=>{e.preventDefault();runStylist()};
  $('#s-theme').onchange=e=>{setSet('theme',e.target.value);applyTheme()};
  $('#s-style').onchange=e=>{setSet('dstyle',e.target.value);$('#p-style').value=e.target.value};
  $('#s-occasion').onchange=e=>{setSet('docc',e.target.value);$('#p-occasion').value=e.target.value};
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applyTheme);
  applyTheme();await reload();go(location.hash.slice(1)||'dashboard');
}
addEventListener('error',()=>toast('Something went wrong. Please refresh the page.'));
init();
