'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const KEY='organizador.v1';
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const FQ={once:'Uma única vez',daily:'Todos os dias',weekly:'Toda semana',biweekly:'A cada 15 dias',monthly:'Todo mês',yearly:'Todo ano',workdays:'Dias úteis',weekend:'Finais de semana'};
const DEF={tasks:[],rec:[],recDone:{},projects:[],notes:[],cats:['Pessoal','Estudos','Trabalho','Casa','Saúde'],custom:[],prefs:{tab:'diario',notif:{on:false,time:'08:00',last:''}}};

const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const utc=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)};
const dayDiff=(a,b)=>Math.round((utc(a)-utc(b))/864e5);
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const br=s=>s.split('-').reverse().join('/');
const fmt=s=>{const d=parse(s);return `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`};
const stamp=x=>new Date(x).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const chips=a=>a.filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join('');

let db=load(),today=iso(new Date()),sel=today,view=parse(today),pf='all',spc={};
view.setDate(1);

function load(){
  try{const j=JSON.parse(localStorage.getItem(KEY)||'{}');return {...structuredClone(DEF),...j,prefs:{...DEF.prefs,...(j.prefs||{})}}}
  catch{return structuredClone(DEF)}
}
function save(){
  spc={};
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch{toast('Não foi possível salvar os dados')}
  render();
}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2400)}

/* ---------- Feriados e datas comemorativas ---------- */
function easter(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
  h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
  mo=Math.floor((h+l-7*m+114)/31),da=(h+l-7*m+114)%31+1;
  return new Date(y,mo-1,da);
}
function specials(y){
  if(spc[y])return spc[y];
  const m={},add=(d,name,t)=>{const k=typeof d==='string'?d:iso(d);(m[k]=m[k]||[]).push({name,t})};
  [['01-01','Confraternização Universal'],['04-21','Tiradentes'],['05-01','Dia do Trabalho'],['09-07','Independência do Brasil'],
   ['10-12','Nossa Sra. Aparecida e Dia das Crianças'],['11-02','Finados'],['11-15','Proclamação da República'],
   ['11-20','Consciência Negra'],['12-25','Natal']].forEach(([d,n])=>add(`${y}-${d}`,n,'h'));
  [['02-14','Dia de São Valentim'],['03-08','Dia Internacional da Mulher'],['06-12','Dia dos Namorados'],['08-11','Dia do Estudante'],
   ['09-21','Dia da Árvore'],['10-15','Dia do Professor'],['12-24','Véspera de Natal'],['12-31','Véspera de Ano Novo']].forEach(([d,n])=>add(`${y}-${d}`,n,'c'));
  const nthSun=(mo,n)=>{const f=new Date(y,mo,1);return new Date(y,mo,1+(7-f.getDay())%7+7*(n-1))};
  add(nthSun(4,2),'Dia das Mães','c');add(nthSun(7,2),'Dia dos Pais','c');
  const p=easter(y);
  add(addD(p,-48),'Segunda de Carnaval','c');add(addD(p,-47),'Carnaval','c');add(addD(p,-46),'Quarta-feira de Cinzas','c');
  add(addD(p,-2),'Sexta-feira Santa','h');add(p,'Páscoa','c');add(addD(p,60),'Corpus Christi','c');
  db.custom.forEach(c=>{
    if(c.yearly){const [,mm,dd]=c.date.split('-');if(mm==='02'&&dd==='29'&&dim(y,1)<29)add(`${y}-02-28`,c.name,'u');else add(`${y}-${mm}-${dd}`,c.name,'u')}
    else if(c.date.startsWith(y+'-'))add(c.date,c.name,'u');
  });
  return spc[y]=m;
}

/* ---------- Recorrência ---------- */
function occurs(r,d){
  if(!r.active||d<r.start||(r.end&&d>r.end))return false;
  const [y,m,dd]=d.split('-').map(Number),[sy,sm,sd]=r.start.split('-').map(Number),wd=parse(d).getDay(),diff=dayDiff(d,r.start);
  const dayOK=dd===Math.min(sd,dim(y,m-1));
  const monthOK=n=>((y-sy)*12+m-sm)%n===0&&dayOK;
  switch(r.freq){
    case 'once':return d===r.start;
    case 'daily':return true;
    case 'dow':return (r.days||[]).includes(wd);
    case 'weekly':return diff%7===0;
    case 'biweekly':return diff%14===0;
    case 'monthly':return monthOK(1);
    case 'months':return monthOK(Math.max(1,+r.interval||1));
    case 'yearly':return m===sm&&dayOK;
    case 'workdays':return wd>0&&wd<6;
    case 'weekend':return wd===0||wd===6;
    case 'custom':{const n=Math.max(1,+r.interval||1);return r.unit==='months'?monthOK(n):r.unit==='weeks'?diff%(7*n)===0:diff%n===0}
  }
  return false;
}
function freqLabel(r){
  const n=+r.interval||1;
  if(r.freq==='dow')return (r.days||[]).map(d=>DIAS[d].slice(0,3)).join(', ');
  if(r.freq==='months')return `A cada ${n} ${n>1?'meses':'mês'}`;
  if(r.freq==='custom')return `A cada ${n} ${{days:n>1?'dias':'dia',weeks:n>1?'semanas':'semana',months:n>1?'meses':'mês'}[r.unit]}`;
  return FQ[r.freq]||r.freq;
}

/* ---------- Itens de cada dia ---------- */
function items(d){
  const out=[];
  db.tasks.filter(t=>t.date===d).forEach(t=>out.push({k:'t',id:t.id,title:t.title,desc:t.desc,cat:t.cat,pri:t.pri,color:t.color,notify:!!t.notify,done:!!t.done,doneAt:t.doneAt}));
  db.rec.filter(r=>occurs(r,d)).forEach(r=>{const x=db.recDone[r.id+'|'+d];out.push({k:'r',id:r.id,title:r.title,desc:r.desc,cat:r.cat,pri:r.pri,color:r.color,notify:!!r.notify,done:!!x,doneAt:x})});
  db.projects.filter(p=>p.due===d).forEach(p=>out.push({k:'p',id:p.id,title:p.title,desc:p.desc,cat:p.cat,pri:p.pri,notify:!!p.notify,done:p.status==='done',doneAt:p.doneAt,tag:'Prazo do projeto'}));
  return out.sort((a,b)=>a.done-b.done);
}
function dayState(l,d){
  if(!l.length)return '';
  if(l.every(x=>x.done))return 'done';
  return d<today?'late':'pend';
}
function toggle(k,id,d){
  const now=new Date().toISOString();
  if(k==='t'){const t=db.tasks.find(x=>x.id===id);t.done=!t.done;t.doneAt=t.done?now:null}
  else if(k==='r'){const key=id+'|'+d;if(db.recDone[key])delete db.recDone[key];else db.recDone[key]=now}
  else{const p=db.projects.find(x=>x.id===id);if(p.status==='done'){p.status='pending';p.doneAt=null}else{p.status='done';p.doneAt=now}}
  save();
}
function del(k,id){
  if(k==='r'){if(!confirm('Excluir esta rotina e todas as suas ocorrências?'))return;
    db.rec=db.rec.filter(r=>r.id!==id);Object.keys(db.recDone).forEach(x=>{if(x.startsWith(id+'|'))delete db.recDone[x]})}
  else if(k==='p'){if(!confirm('Excluir esta atividade?'))return;db.projects=db.projects.filter(p=>p.id!==id)}
  else{if(!confirm('Excluir esta tarefa?'))return;db.tasks=db.tasks.filter(t=>t.id!==id)}
  save();
}

/* ---------- Renderização ---------- */
function row(it,d){
  const st=it.done?'done':d<today?'late':'pend';
  return `<li class="task ${st}" style="--c:${esc(it.color||'transparent')}">
    <button class="chk" data-act="tog" data-k="${it.k}" data-id="${it.id}" data-d="${d}" role="checkbox" aria-checked="${it.done}" aria-label="Concluir ${esc(it.title)}">${it.done?'✓':''}</button>
    <div class="tx"><strong>${esc(it.title)}</strong>${it.desc?`<small>${esc(it.desc)}</small>`:''}
    <div>${chips([it.notify?'🔔 Avisa':'',it.k==='r'?'Rotina':it.tag,it.cat,it.pri&&it.pri!=='Média'?'Prioridade '+it.pri.toLowerCase():'',it.done&&it.doneAt?'Concluída em '+stamp(it.doneAt):''])}</div></div>
    <button class="ic" data-act="edit" data-k="${it.k}" data-id="${it.id}" aria-label="Editar">✎</button>
    <button class="ic" data-act="del" data-k="${it.k}" data-id="${it.id}" aria-label="Excluir">🗑</button></li>`;
}
function renderCal(){
  const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1).getDay();
  $('#calTitle').textContent=`${MESES[m]} ${y}`;
  let h='<span></span>'.repeat(first);
  for(let d=1;d<=dim(y,m);d++){
    const s=`${y}-${pad(m+1)}-${pad(d)}`,l=items(s),sp=specials(y)[s]||[];
    const cls=[dayState(l,s),s===today&&'today',s===sel&&'sel',sp.some(x=>x.t==='h')?'hol':sp.length?'com':''].filter(Boolean).join(' ');
    h+=`<button class="day ${cls}" data-d="${s}" title="${esc(sp.map(x=>x.name).join(', '))}"><span>${d}</span>${l.length?`<i>${l.length}</i>`:''}</button>`;
  }
  $('#calGrid').innerHTML=h;
}
function renderDay(){
  const d=sel,dt=parse(d),l=items(d),sp=specials(dt.getFullYear())[d]||[];
  const done=l.filter(x=>x.done).length,pct=l.length?Math.round(done/l.length*100):0;
  $('#dayTitle').textContent=fmt(d)+(d===today?' (hoje)':'');
  $('#dayWeek').textContent=DIAS[dt.getDay()]+' · '+dt.getFullYear();
  $('#specials').innerHTML=sp.map(x=>`<span class="chip sp-${x.t}">${esc(x.name)}</span>`).join('');
  $('#bAdd').textContent=sp.length?`Criar tarefa em ${sp[0].name}`:'Adicionar tarefa';
  $('#sT').textContent=l.length;$('#sD').textContent=done;$('#sP').textContent=l.length-done;
  $('#sPct').textContent=pct+'%';$('#sBar').style.width=pct+'%';
  $('#list').innerHTML=l.length?l.map(i=>row(i,d)).join(''):'<li class="empty">Nenhuma tarefa neste dia. Use o botão acima para adicionar.</li>';
  const nx=[];
  for(let i=1;i<=14&&nx.length<5;i++){const s=iso(addD(parse(today),i));items(s).filter(x=>!x.done).forEach(x=>nx.length<5&&nx.push({s,x}))}
  $('#next').innerHTML=nx.length?nx.map(({s,x})=>`<li><button class="nxb" data-goto="${s}"><span>${br(s).slice(0,5)}</span><strong>${esc(x.title)}</strong></button></li>`).join(''):'<li class="empty">Nada nos próximos 14 dias.</li>';
}
function renderRec(){
  $('#rList').innerHTML=db.rec.length?db.rec.map(r=>`<li class="task ${r.active?'rec':'off'}" style="--c:${esc(r.color||'transparent')}">
    <label class="sw" title="Ativar ou pausar"><input type="checkbox" data-act="pause" data-id="${r.id}" ${r.active?'checked':''}><span></span></label>
    <div class="tx"><strong>${esc(r.title)}</strong>${r.desc?`<small>${esc(r.desc)}</small>`:''}
    <div>${chips([freqLabel(r),'Desde '+br(r.start),r.end&&'Até '+br(r.end),r.cat,r.active?'':'Pausada'])}</div></div>
    <button class="ic" data-act="edit" data-k="r" data-id="${r.id}" aria-label="Editar">✎</button>
    <button class="ic" data-act="del" data-k="r" data-id="${r.id}" aria-label="Excluir">🗑</button></li>`).join(''):'<li class="empty">Nenhuma rotina ainda. Crie a primeira com o botão acima.</li>';
}
const isLate=p=>p.status!=='done'&&p.due&&p.due<today;
function renderProj(){
  $$('[data-pf]').forEach(b=>b.classList.toggle('on',b.dataset.pf===pf));
  const L=db.projects.filter(p=>pf==='all'||(pf==='late'?isLate(p):p.status===pf)).sort((a,b)=>(a.due||'9')>(b.due||'9')?1:-1);
  $('#pList').innerHTML=L.length?L.map(p=>{
    const st=p.status==='done'?'done':isLate(p)?'late':p.status==='doing'?'doing':'pend',done=p.status==='done';
    return `<li class="task ${st}"><button class="chk" data-act="tog" data-k="p" data-id="${p.id}" role="checkbox" aria-checked="${done}" aria-label="Concluir ${esc(p.title)}">${done?'✓':''}</button>
    <div class="tx"><strong>${esc(p.title)}</strong>${p.desc?`<small>${esc(p.desc)}</small>`:''}
    <div>${chips([p.cat,'Prioridade '+p.pri.toLowerCase(),'Início '+br(p.start),p.due&&'Limite '+br(p.due),isLate(p)?'Atrasada':'',done&&p.doneAt?'Concluída em '+stamp(p.doneAt):''])}</div></div>
    <select data-act="status" data-id="${p.id}" aria-label="Estado"><option value="pending"${p.status==='pending'?' selected':''}>Pendente</option><option value="doing"${p.status==='doing'?' selected':''}>Em andamento</option><option value="done"${done?' selected':''}>Concluída</option></select>
    <button class="ic" data-act="edit" data-k="p" data-id="${p.id}" aria-label="Editar">✎</button>
    <button class="ic" data-act="del" data-k="p" data-id="${p.id}" aria-label="Excluir">🗑</button></li>`}).join(''):'<li class="empty">Nenhuma atividade nesta lista.</li>';
}
function renderNotes(){
  const q=($('#nSearch').value||'').trim().toLowerCase();
  const L=db.notes.filter(n=>!q||(n.title+' '+n.text).toLowerCase().includes(q))
    .sort((a,b)=>a.date===b.date?(b.created||'')>(a.created||'')?1:-1:a.date<b.date?1:-1);
  $('#nList').innerHTML=L.length?L.map(n=>`<li class="task note">
    <button class="nbody" data-act="editnote" data-id="${n.id}" aria-label="Abrir anotação ${esc(n.title||br(n.date))}">
      <strong>${esc(n.title||'Sem título')}</strong>
      ${n.text?`<span class="pv">${esc(n.text.slice(0,400))}</span>`:''}
      <span>${chips([br(n.date),DIAS[parse(n.date).getDay()],(n.text.length).toLocaleString('pt-BR')+' caracteres',n.updated&&n.updated!==n.created?'Editada em '+stamp(n.updated):''])}</span>
    </button>
    <button class="ic" data-act="delnote" data-id="${n.id}" aria-label="Excluir">🗑</button></li>`).join(''):`<li class="empty">${q?'Nenhuma anotação encontrada.':'Nenhuma anotação ainda. Crie a primeira com o botão acima.'}</li>`;
}
function renderDates(){
  $('#cList').innerHTML=db.custom.length?db.custom.map(c=>`<li class="task rec"><div class="tx"><strong>${esc(c.name)}</strong><div>${chips([br(c.date),c.yearly?'Todo ano':'Só nesta data'])}</div></div><button class="ic" data-act="delc" data-id="${c.id}" aria-label="Excluir">🗑</button></li>`).join(''):'<li class="empty">Nenhuma data personalizada.</li>';
}
function render(){
  $$('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===db.prefs.tab));
  $$('.pane').forEach(p=>p.hidden=p.id!==db.prefs.tab);
  renderCal();renderDay();renderRec();renderProj();renderNotes();renderDates();
}

/* ---------- Formulários ---------- */
function fillCats(el,val){
  el.innerHTML=db.cats.map(c=>`<option>${esc(c)}</option>`).join('')+'<option value="__new">+ Nova categoria…</option>';
  el.value=db.cats.includes(val)?val:db.cats[0];
}
function syncFreq(){
  const f=$('#fTask'),v=f.fq.value;
  $('#lDt').textContent=v==='once'?'Data':'Data de início';
  $('#rEnd').hidden=$('#rAct').hidden=v==='once';
  $('#rDow').hidden=v!=='dow';
  $('#rInt').hidden=v!=='months'&&v!=='custom';
  $('#rUn').hidden=v!=='custom';
}
function openTask(o={}){
  const f=$('#fTask');f.reset();
  const src=o.id?(o.k==='r'?db.rec:db.tasks).find(x=>x.id===o.id):null;
  f.dataset.edit=o.id||'';f.dataset.kind=o.id?o.k:'';
  $('#tTitle').textContent=o.id?'Editar tarefa':o.freq?'Nova rotina':'Nova tarefa';
  fillCats(f.ct,src?.cat);
  f.ttl.value=src?.title||'';f.dsc.value=src?.desc||'';
  f.dt.value=src?(src.date||src.start):(o.d||sel);
  f.fq.value=src?(o.k==='r'?src.freq:'once'):(o.freq||'once');
  f.en.value=src?.end||'';f.iv.value=src?.interval||1;f.un.value=src?.unit||'days';
  f.pr.value=src?.pri||'Média';f.cl.value=src?.color||'';f.ac.checked=src?src.active!==false:true;f.nt.checked=!!src?.notify;
  $$('.dw',f).forEach(c=>c.checked=(src?.days||[]).includes(+c.value));
  syncFreq();$('#dTask').showModal();f.ttl.focus();
}
$('#fTask').onsubmit=e=>{
  e.preventDefault();
  const f=e.target,v=f.fq.value,isRec=v!=='once',id=f.dataset.edit,oldK=f.dataset.kind;
  const base={title:f.ttl.value.trim(),desc:f.dsc.value.trim(),cat:f.ct.value,pri:f.pr.value,color:f.cl.value,notify:f.nt.checked};
  if(!base.title||!f.dt.value)return;
  const days=$$('.dw',f).filter(c=>c.checked).map(c=>+c.value);
  if(v==='dow'&&!days.length)return toast('Escolha ao menos um dia da semana');
  if(isRec&&f.en.value&&f.en.value<f.dt.value)return toast('O término deve ser depois do início');
  const old=id?(oldK==='r'?db.rec:db.tasks).find(x=>x.id===id):null;
  const target=old&&((oldK==='r')===isRec)?old:null;
  if(old&&!target){if(oldK==='r')db.rec=db.rec.filter(x=>x.id!==id);else db.tasks=db.tasks.filter(x=>x.id!==id)}
  if(isRec){
    const data={...base,freq:v,start:f.dt.value,end:f.en.value,days:v==='dow'?days:[],interval:Math.max(1,+f.iv.value||1),unit:f.un.value,active:f.ac.checked};
    if(target)Object.assign(target,data);else db.rec.push({id:uid(),...data});
  }else{
    const data={...base,date:f.dt.value};
    if(target)Object.assign(target,data);else db.tasks.push({id:uid(),done:false,doneAt:null,...data});
    sel=f.dt.value;view=parse(sel);view.setDate(1);
  }
  $('#dTask').close();save();
};
function openProj(id){
  const f=$('#fProj'),p=id?db.projects.find(x=>x.id===id):null;f.reset();
  f.dataset.edit=id||'';$('#pTitle').textContent=id?'Editar atividade':'Nova atividade';
  fillCats(f.ct,p?.cat);f.ttl.value=p?.title||'';f.dsc.value=p?.desc||'';f.sd.value=p?.start||today;f.du.value=p?.due||'';
  f.pr.value=p?.pri||'Média';f.nt.checked=!!p?.notify;f.stt.value=p?.status||'pending';$('#dProj').showModal();f.ttl.focus();
}
$('#fProj').onsubmit=e=>{
  e.preventDefault();
  const f=e.target,id=f.dataset.edit,old=id&&db.projects.find(x=>x.id===id);
  if(f.du.value&&f.du.value<f.sd.value)return toast('A data limite deve ser depois do início');
  const data={title:f.ttl.value.trim(),desc:f.dsc.value.trim(),start:f.sd.value,due:f.du.value,cat:f.ct.value,pri:f.pr.value,notify:f.nt.checked,status:f.stt.value};
  data.doneAt=data.status==='done'?(old?.doneAt||new Date().toISOString()):null;
  if(old)Object.assign(old,data);else db.projects.push({id:uid(),...data});
  $('#dProj').close();save();
};
function countNote(){
  const t=$('#nTxt').value,w=t.trim()?t.trim().split(/\s+/).length:0;
  $('#nCount').textContent=`${t.length.toLocaleString('pt-BR')} caracteres · ${w.toLocaleString('pt-BR')} palavra${w===1?'':'s'}`;
}
function openNote(id){
  const f=$('#fNote'),n=id?db.notes.find(x=>x.id===id):null;f.reset();
  f.dataset.edit=id||'';$('#nTitle').textContent=id?'Editar anotação':'Nova anotação';
  f.ttl.value=n?.title||'';f.dt.value=n?.date||today;f.txt.value=n?.text||'';
  countNote();$('#dNote').showModal();(n?f.txt:f.ttl).focus();
}
$('#nTxt').addEventListener('input',countNote);
$('#nSearch').addEventListener('input',renderNotes);
$('#fNote').onsubmit=e=>{
  e.preventDefault();
  const f=e.target,id=f.dataset.edit,old=id&&db.notes.find(x=>x.id===id),now=new Date().toISOString();
  const data={title:f.ttl.value.trim(),date:f.dt.value,text:f.txt.value};
  if(!data.title&&!data.text.trim())return toast('Escreva um título ou um texto');
  if(old)Object.assign(old,data,{updated:now});else db.notes.push({id:uid(),created:now,updated:now,...data});
  $('#dNote').close();save();
};
$('#fCustom').onsubmit=e=>{
  e.preventDefault();const f=e.target;
  db.custom.push({id:uid(),name:f.nm.value.trim(),date:f.dt.value,yearly:f.yr.checked});
  f.reset();f.yr.checked=true;save();toast('Data adicionada');
};

/* ---------- Eventos ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-tab],[data-nav],[data-d],[data-act],[data-pf],[data-goto],[data-close]');if(!t)return;
  const D=t.dataset;
  if(D.close!==undefined)t.closest('dialog').close();
  else if(D.tab){db.prefs.tab=D.tab;save()}
  else if(D.nav){view=new Date(view.getFullYear(),view.getMonth()+(+D.nav),1);render()}
  else if(D.pf){pf=D.pf;render()}
  else if(D.goto){sel=D.goto;view=parse(sel);view.setDate(1);save()}
  else if(D.act==='tog')toggle(D.k,D.id,D.d);
  else if(D.act==='edit')D.k==='p'?openProj(D.id):openTask({k:D.k,id:D.id});
  else if(D.act==='del')del(D.k,D.id);
  else if(D.act==='new')openTask({d:sel});
  else if(D.act==='newrec')openTask({d:sel,freq:'daily'});
  else if(D.act==='newproj')openProj();
  else if(D.act==='newnote')openNote();
  else if(D.act==='editnote')openNote(D.id);
  else if(D.act==='delnote'){if(confirm('Excluir esta anotação?')){db.notes=db.notes.filter(n=>n.id!==D.id);save()}}
  else if(D.act==='today'){sel=today;view=parse(today);view.setDate(1);db.prefs.tab='diario';save()}
  else if(D.act==='dates')$('#dDates').showModal();
  else if(D.act==='notif')openNotif();
  else if(D.act==='delc'){db.custom=db.custom.filter(c=>c.id!==D.id);save()}
  else if(D.d){sel=D.d;view=parse(sel);view.setDate(1);db.prefs.tab='diario';save()}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('select.cat')&&t.value==='__new'){
    const n=(prompt('Nome da nova categoria:')||'').trim();
    if(n&&!db.cats.includes(n)){db.cats.push(n);try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}}
    $$('select.cat').forEach(s=>s!==t&&fillCats(s,s.value));
    fillCats(t,n);
  }else if(t.name==='fq')syncFreq();
  else if(t.dataset.act==='pause'){db.rec.find(r=>r.id===t.dataset.id).active=t.checked;save()}
  else if(t.dataset.act==='status'){const p=db.projects.find(x=>x.id===t.dataset.id);p.status=t.value;p.doneAt=t.value==='done'?new Date().toISOString():null;save()}
});
$('#bExport').onclick=async()=>{
  const name=`organizador-${iso(new Date())}.json`,json=JSON.stringify(db,null,2);
  const file=new File([json],name,{type:'application/json'});
  const touch=matchMedia('(pointer:coarse)').matches;
  /* No celular, abre o menu de compartilhar (salvar em Arquivos, Drive, WhatsApp...) */
  if(touch&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:'Backup do Organizador'});toast('Backup exportado');return}
    catch(err){if(err.name==='AbortError')return}
  }
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Backup baixado');
};
$('#bImport').onclick=()=>$('#fImport').click();
$('#fImport').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const j=JSON.parse(await file.text());
    if(!Array.isArray(j.tasks)||!Array.isArray(j.rec))throw 0;
    if(!confirm('Substituir todos os dados atuais por este backup?'))return;
    db={...structuredClone(DEF),...j,prefs:{...DEF.prefs,...(j.prefs||{})}};if(!Array.isArray(db.notes))db.notes=[];save();toast('Backup restaurado');
  }catch{toast('Arquivo de backup inválido')}
  e.target.value='';
};
/* ---------- Lembretes (notificações) ---------- */
let swReg=null;
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').then(r=>{swReg=r}).catch(()=>{});
}
const nCfg=()=>({on:false,time:'08:00',last:'',...(db.prefs.notif||{})});
function nState(){
  if(!('Notification' in window))return 'Este navegador não suporta notificações.';
  if(!window.isSecureContext)return 'Notificações só funcionam com o site em https (ou localhost). Abrindo o arquivo direto do aparelho, elas não funcionam.';
  if(Notification.permission==='denied')return 'As notificações foram bloqueadas. Libere nas configurações do navegador/site.';
  if(Notification.permission==='granted')return 'Notificações permitidas. Elas aparecem quando o app está aberto (inclusive em segundo plano).';
  return 'Ainda falta permitir as notificações. Ao salvar, o navegador vai pedir permissão.';
}
async function showNote(title,body,tag){
  const opt={body,tag,icon:'icon-192.png',badge:'icon-192.png'};
  try{
    const reg=swReg||(navigator.serviceWorker&&await navigator.serviceWorker.getRegistration());
    if(reg){await reg.showNotification(title,opt);return true}
    new Notification(title,opt);return true;
  }catch{return false}
}
function reminderText(now){
  const d0=iso(now),pend=items(d0).filter(x=>x.notify&&!x.done);
  let late=0;
  for(let i=1;i<=7;i++)late+=items(iso(addD(now,-i))).filter(x=>x.notify&&!x.done).length;
  const parts=[];
  if(pend.length)parts.push(`${pend.length} pendente${pend.length>1?'s':''} hoje: `+pend.slice(0,3).map(x=>x.title).join(', ')+(pend.length>3?'…':''));
  if(late)parts.push(`${late} atrasada${late>1?'s':''} nos últimos 7 dias`);
  return parts.join(' · ');
}
function checkReminder(){
  const c=nCfg();
  if(!c.on||!('Notification' in window)||Notification.permission!=='granted')return;
  const now=new Date(),hm=pad(now.getHours())+':'+pad(now.getMinutes()),d0=iso(now);
  if(c.last===d0||hm<c.time)return;
  db.prefs.notif={...c,last:d0};
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}
  const txt=reminderText(now);
  if(txt)showNote('Organizador pessoal',txt,'lembrete-'+d0);
}
function openNotif(){
  const f=$('#fNotif'),c=nCfg();
  f.on.checked=c.on;f.tm.value=c.time;$('#nStatus').textContent=nState();
  $('#dNotif').showModal();
}
$('#fNotif').onsubmit=async e=>{
  e.preventDefault();
  const f=e.target;
  if(f.on.checked&&'Notification' in window&&Notification.permission==='default')await Notification.requestPermission();
  const granted='Notification' in window&&Notification.permission==='granted';
  db.prefs.notif={on:f.on.checked&&granted,time:f.tm.value||'08:00',last:''};
  if(f.on.checked&&!granted)toast('Sem permissão, os lembretes ficaram desligados');
  else toast(db.prefs.notif.on?'Lembretes ativados':'Lembretes desligados');
  $('#dNotif').close();save();checkReminder();
};
$('#bTestNotif').onclick=async()=>{
  if(!('Notification' in window))return toast('Este navegador não suporta notificações');
  if(Notification.permission==='default')await Notification.requestPermission();
  if(Notification.permission!=='granted')return toast('Permita as notificações para testar');
  const ok=await showNote('Organizador pessoal',reminderText(new Date())||'Teste ok! Nenhuma tarefa marcada com 🔔 pendente hoje.','teste');
  toast(ok?'Notificação enviada':'Não foi possível enviar');
  $('#nStatus').textContent=nState();
};
setInterval(checkReminder,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminder()});

render();
checkReminder();
