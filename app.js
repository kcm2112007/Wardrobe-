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
const norm=i=>({pattern:'Solid',timesWorn:0,lastWorn:null,favourite:false,...i,category:i.category==='T-shirt'?'T-Shirt':i.category});
const ago=t=>{const d=Math.floor((Date.now()-t)/864e5);return d<1?'today':d===1?'yesterday':d+' days ago'};
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
  try{items=(await getItems()).map(norm);outfits=(await getOutfits()).map(o=>({saved:true,worn:null,...o})).sort((a,b)=>b.createdAt-a.createdAt)}
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
const worn=i=>i.lastWorn?'Worn '+ago(i.lastWorn):'Never worn';
const tile=i=>`<article class="card"><button class="qv" data-a="view" data-id="${i.id}" aria-label="Quick view ${esc(i.name)}"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"></button><div class="cb"><h3>${esc(i.name)}</h3><p>${esc(i.category)} · ${worn(i)}</p></div></article>`;
const card=i=>`<article class="card"><button class="qv" data-a="view" data-id="${i.id}" aria-label="Quick view ${esc(i.name)}"><img src="${i.image}" alt="${esc(i.name)}" loading="lazy"></button><div class="cb"><h3>${esc(i.name)}</h3><p>${esc(i.category)} · ${esc(i.colour)} · ${esc(i.style)}</p><p>${worn(i)}</p><div class="row"><button class="ic" data-a="fav" data-id="${i.id}" aria-pressed="${!!i.favourite}" aria-label="Favourite ${esc(i.name)}">${heart}</button><button class="lnk" data-a="view" data-id="${i.id}">View</button><button class="lnk" data-a="edit" data-id="${i.id}">Edit</button><button class="lnk" data-a="del" data-id="${i.id}">Delete</button></div></div></article>`;
const emptyBox='<div class="empty"><h2>Your wardrobe is empty.</h2><p class="mut">Add your first piece, or load sample clothes to see how it works.</p><button class="btn" data-a="new">Add Your First Item</button> <button class="btn ghost" data-a="demo">Load Demo Wardrobe</button></div>';
function renderDashboard(){
  const c=k=>items.filter(i=>GROUP[i.category]===k).length;
  $('#stats').innerHTML=[['Total items',items.length],['Tops',c('top')],['Bottoms',c('bottom')],['Shoes',c('shoes')],['Outfits',outfits.filter(o=>o.saved).length]].map(([l,n])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
  $('#d-weather').value=$('#p-weather').value;
  if(!items.length){$('#dash').innerHTML=emptyBox;return}
  const most=items.filter(i=>i.timesWorn).sort((a,b)=>b.timesWorn-a.timesWorn).slice(0,4);
  const least=[...items].sort((a,b)=>(a.lastWorn||0)-(b.lastWorn||0)).slice(0,4);
  const recent=[...items].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);
  const sec=(t,l,e)=>`<h2>${t}</h2><div class="grid">${l.length?l.map(tile).join(''):`<p class="mut">${e}</p>`}</div>`;
  $('#dash').innerHTML=sec('Most worn',most,'Mark outfits as worn to see them here.')+sec('Least worn',least,'')+sec('Recently added',recent,'');
}
function fillForm(){fill($('#f-category'),CATS);fill($('#f-colour'),Object.keys(COLOURS).map(cap));$$('#f-colour option').forEach(o=>o.value=o.textContent.toLowerCase());fill($('#f-pattern'),PATTERNS);fill($('#f-style'),STYLES);fill($('#f-season'),SEASONS)}
function syncChips(){$$('.chips').forEach(c=>{const s=$('#'+c.dataset.for);c.innerHTML=[...s.options].map(o=>`<button type="button" class="chip" aria-pressed="${o.value===s.value}" data-v="${esc(o.value)}">${esc(o.textContent)}</button>`).join('')})}
function setPrev(src){$('#prev').src=src||'';$('#prev').hidden=!src;$('#rm').hidden=!src}
function openForm(it){
  editing=it;img=null;removed=false;$('#form').reset();fillForm();$('#form').dataset.ready='1';$('#ft').textContent=it?'Edit Clothing':'Add Clothing';$('#err').textContent='';
  if(it)for(const k of ['name','category','colour','pattern','style','season']){const s=$('#f-'+k);if(s.tagName==='SELECT'&&![...s.options].some(o=>o.value===it[k]))s.add(new Option(it[k],it[k]));s.value=it[k]}
  syncChips();setPrev(it?it.image:null);
}
async function submitForm(e){
  e.preventDefault();
  const image=img||(removed?null:editing?.image);
  if(!image){$('#err').textContent='Add a photo of the item.';return}
  const d=Object.fromEntries(['name','category','colour','pattern','style','season'].map(k=>[k,$('#f-'+k).value.trim()]));
  try{const was=!!editing;
    was?await updateItem({...editing,...d,image}):await addItem({id:uid(),...d,image,favourite:false,timesWorn:0,lastWorn:null,createdAt:Date.now()});
    await reload();$('#form').dataset.ready='';toast(was?'Changes saved':'Added to wardrobe');go('wardrobe');
  }catch{$('#err').textContent='Storage is full or blocked. Free some space or delete items, then try again.'}
}
function quickView(it){
  $('#dbody').innerHTML=`<h2>${esc(it.name)}</h2><img src="${it.image}" alt="${esc(it.name)}" style="width:100%;max-height:50vh;object-fit:contain;background:#f0f0ee;border-radius:12px"><p class="mut" style="margin-top:12px">${esc([it.category,it.colour,it.pattern,it.style,it.season].join(' · '))}</p><p>Added ${new Date(it.createdAt).toLocaleDateString()}. ${worn(it)}, ${it.timesWorn||0} time${it.timesWorn===1?'':'s'} in total.</p>`;$('#dlg').showModal();
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
async function pick(file){if(!file)return;try{img=await compress(file);removed=false;setPrev(img);$('#err').textContent='';analyzeClothing(file)}catch(e){img=null;$('#err').textContent=e.message}}

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
const getWeather=async()=>$('#d-weather').value||$('#p-weather').value;
const analyzeClothing=async file=>({});
const removeBackground=async src=>src;
const generateAIOutfit=async(list,p,avoid)=>generate(list,p,avoid);

// Scoring (internal only): colour 30, style 25, occasion 20, weather 15, season 10, minus a small penalty for recently worn items
function generate(list,p,avoid=new Set()){
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
    const sc=30*cr+25*avg(i=>i.style===p.style?1:O.s.includes(i.style)?.6:.3)+20*avg(i=>O.s.includes(i.style)?1:.4)+15*weatherFit(pcs,p.weather)+10*avg(i=>i.season==='All Season'||i.season===WS[p.weather]?1:.4)+3*avg(i=>PREF[p.colour]?.includes(i.colour)?1:0)+2*avg(i=>i.favourite?1:0)-pcs.reduce((t,i)=>t+recency(i),0);
    all.push({pcs,sc,cr,sig:sigOf(pcs)});
  }
  const strict=all.filter(o=>o.cr>=.6),pool=(strict.length?strict:all).filter(o=>!avoid.has(o.sig));
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
  const pcs=o.pieces.map(i=>`<div class="piece"><img src="${i.image}" alt="${esc(i.name)}"><div><span>${LABEL[GROUP[i.category]]||'Piece'}</span><h3>${esc(i.name)}</h3></div></div>`).join('<div class="plus" aria-hidden="true">+</div>');
  $('#result').innerHTML=`<h1>Your Look</h1><div class="look">${pcs}</div><div class="meta"><span class="tag">${esc(P.occasion)}</span><span class="tag">${esc(P.style)}</span><span class="tag">${esc(P.weather)} weather</span></div><h3>Why this works</h3><p>${esc(o.note)}</p><div class="row" style="gap:8px"><button class="btn" data-a="save">Save Outfit</button><button class="btn" data-a="wore">I Wore This</button><button class="btn ghost" data-a="again">Try Another</button><button class="btn ghost" data-go="stylist">Change Preferences</button></div>`;
}
async function runStylist(quiet){
  const r=$('#result');
  P={occasion:$('#p-occasion').value,style:$('#p-style').value,weather:$('#p-weather').value,colour:$('#p-colour').value};
  setSet('prefs',P);
  if(!quiet){go('results');seen.clear();r.innerHTML='<div class="load">Styling your wardrobe...</div>';await new Promise(k=>setTimeout(k,450))}
  if(!items.length){r.innerHTML='<div class="empty"><h2>Your wardrobe is empty.</h2><p class="mut">The stylist only uses clothes you have added.</p><button class="btn" data-a="demo">Load Demo Wardrobe</button></div>';return}
  let out;
  try{
    const recent=new Set(outfits.filter(o=>o.worn).sort((a,b)=>b.worn-a.worn).slice(0,5).map(o=>sigOf(o.pieces)));
    out=await generateAIOutfit(items,P,new Set([...seen,...recent]));
    if(out.exhausted)out=await generateAIOutfit(items,P,seen);
    if(out.exhausted){seen.clear();out=await generateAIOutfit(items,P,seen)}
  }catch{out={error:'Something went wrong building this outfit. Please try again.'}}
  if(out.error){r.innerHTML=`<div class="empty"><h2>No outfit yet</h2><p class="mut">${esc(out.error)}</p><button class="btn ghost" data-go="stylist">Change Preferences</button> <button class="btn ghost" data-go="wardrobe">Open My Wardrobe</button></div>`;return}
  res=out.outfits;idx=0;showOutfit();
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
const DEMO=[['White Shirt','Shirt','white','Smart Casual','All Season'],['Black T-Shirt','T-Shirt','black','Casual','All Season'],['Blue Oxford Shirt','Shirt','blue','Smart Casual','All Season'],['Grey Hoodie','Hoodie','grey','Streetwear','Winter'],['Black Trousers','Trousers','black','Smart Casual','All Season'],['Blue Jeans','Jeans','blue','Casual','All Season'],['Beige Trousers','Trousers','beige','Smart Casual','All Season'],['White Sneakers','Sneakers','white','Casual','All Season'],['Black Sneakers','Sneakers','black','Streetwear','All Season'],['Brown Shoes','Shoes','brown','Formal','All Season'],['Black Jacket','Jacket','black','Smart Casual','Winter'],['Beige Overshirt','Jacket','beige','Casual','All Season'],['Black Belt','Accessories','black','Minimal','All Season'],['Brown Belt','Accessories','brown','Smart Casual','All Season'],['Grey Sport Shorts','Shorts','grey','Sporty','Summer'],['Navy Sport T-Shirt','T-Shirt','navy','Sporty','Summer']];
async function loadDemo(){for(const [name,category,colour,style,season] of DEMO)await addItem({id:uid(),name,category,colour,pattern:'Solid',style,season,image:garment(GROUP[category],colour),favourite:false,timesWorn:0,lastWorn:null,createdAt:Date.now()-Math.random()*864e5*3});await reload();toast('Demo wardrobe loaded');go(location.hash.slice(1)==='results'?'stylist':(location.hash.slice(1)||'dashboard'))}

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
    else if(a==='view'&&it)quickView(it);
    else if(a==='rmimg'){img=null;removed=true;setPrev(null)}
    else if(a==='clearf')clearFilters();
    else if(a==='styleme'){$('#p-weather').value=await getWeather();$('#p-occasion').value=getSet('docc','College');$('#p-style').value=getSet('dstyle','Casual');$('#p-colour').value='Any';await runStylist()}
    else if(a==='wore'){const x=res[idx],now=Date.now();if(cur.id){await updateOutfit({...outfits.find(r=>r.id===cur.id),worn:now})}else{cur.id=uid();await addOutfit(mkRec(x,{id:cur.id,worn:now}))}await markWorn(x.pieces);await reload();$('[data-a=wore]').disabled=true;toast('Marked as worn')}
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
    const ch=e.target.closest('.chip');if(ch){$('#'+ch.parentElement.dataset.for).value=ch.dataset.v;syncChips();return}
    const n=e.target.closest('[data-go]');if(n){go(n.dataset.go);return}
    const b=e.target.closest('[data-a]');if(b)onAction(b.dataset.a,b.dataset.id);
  });
  $('#fk').onchange=e=>{F.cat=e.target.value;renderWardrobe()};$('#ff').onchange=e=>{F.fav=e.target.value;renderWardrobe()};$('#fo').onchange=e=>{F.sort=e.target.value;renderWardrobe()};
  $('#d-weather').onchange=e=>{$('#p-weather').value=e.target.value};
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
