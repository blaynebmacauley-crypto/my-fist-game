import {archetypes,createCareer,playerAttributes} from './career.js?v=athlete8';
import {normalizeProfile,defaultProfile,skinTones,profileSummary,physique} from './player-profile.js?v=athlete8';
import {applyPlayerLook} from './presentation.js?v=athlete8';
import {animateAthlete} from './motion.js?v=athlete8';
const $=id=>document.getElementById(id);
const fields=['hometown','state','jersey','heightInches','weightLbs','skinTone','build','helmetFinish','visor','gloves','sleeves','dominantHand'];
export function createPlayerCreator(T,{renderer,environment,makeAthlete,onSave,onCancel}){
 let active=false,editing=false,step=0,preview=null,studio=null,camera=null,angle=.18,clock=0;
 function values(){const raw={};for(const key of fields)raw[key]=$('create_'+key).value;return normalizeProfile(raw);}
 function positionOptions(selected){const list=archetypes[$('createPosition').value];$('createArchetype').replaceChildren();for(const a of list){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;$('createArchetype').append(o);}if(list.some(a=>a.id===selected))$('createArchetype').value=selected;}
 function refresh(){
  const p=values(),position=$('createPosition').value,archetype=$('createArchetype').value;
  $('creatorMeasurements').textContent=profileSummary(p);$('createArchetypeNote').textContent=archetypes[position].find(a=>a.id===archetype).description;
  const ratings=playerAttributes(createCareer($('createName').value,position,archetype));$('creatorRatings').textContent=Object.entries(ratings).map(([k,v])=>k.toUpperCase()+' '+v).join(' · ');
  $('creatorReview').textContent=($('createName').value.trim()||'Jordan Hayes')+' · '+position+' · '+archetypes[position].find(a=>a.id===archetype).name+'\n'+profileSummary(p)+'\n'+p.dominantHand.toUpperCase()+' HANDED · '+p.helmetFinish.toUpperCase()+' HELMET · '+p.visor.toUpperCase()+' VISOR\nAppearance choices are cosmetic. Your position and archetype set your starting gameplay ratings.';
  if(preview){applyPlayerLook(T,preview,p,{teamColor:'#872039'});const scale=physique(p);preview.root.scale.set(scale.x,scale.y,scale.z);}
 }
 function setStep(n){step=Math.max(0,Math.min(3,n));for(let i=0;i<4;i++){$('creatorStep'+i).hidden=i!==step;document.querySelector('[data-creator-step="'+i+'"]').setAttribute('aria-selected',String(i===step));}$('creatorBack').textContent=step===0?'CANCEL':'← BACK';$('creatorNext').textContent=step===3?(editing?'SAVE CHANGES →':'SAVE ATHLETE & ENTER CAREER →'):'NEXT →';refresh();}
 function buildStudio(){
  if(studio)return;studio=new T.Scene();studio.background=new T.Color('#101d29');studio.environment=environment;
  studio.add(new T.HemisphereLight('#d9e9ff','#223246',2));
  const key=new T.DirectionalLight('#fff0db',3.5);key.position.set(3,5,4);studio.add(key);
  const softbox=new T.DirectionalLight('#e2efff',1.2);softbox.position.set(-1,2,5);studio.add(softbox);
  const rim=new T.DirectionalLight('#669bff',2.5);rim.position.set(-3,3,-3);studio.add(rim);
  const floor=new T.Mesh(new T.CylinderGeometry(1,1.08,.12,64),new T.MeshStandardMaterial({color:'#1c2d3c',roughness:.45,metalness:.3}));floor.position.y=.06;studio.add(floor);
  const ring=new T.Mesh(new T.TorusGeometry(.95,.012,8,80),new T.MeshBasicMaterial({color:'#ffbc65'}));ring.rotation.x=Math.PI/2;ring.position.y=.13;studio.add(ring);
  const contact=new T.Mesh(new T.CircleGeometry(.48,48),new T.MeshBasicMaterial({color:'#000000',transparent:true,opacity:.22,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.124;contact.scale.y=.55;studio.add(contact);
  preview=makeAthlete();studio.add(preview.root);camera=new T.PerspectiveCamera(32,1,.05,30);camera.position.set(2.7,1.6,4.3);camera.lookAt(0,1.08,0);
 }
 for(const tone of skinTones){const o=document.createElement('option');o.value=tone.id;o.textContent=tone.label;$('create_skinTone').append(o);}
 $('createPosition').onchange=()=>{positionOptions();refresh();};$('createArchetype').onchange=refresh;
 for(const id of ['createName',...fields.map(f=>'create_'+f)])$(id).addEventListener('input',refresh);
 for(const b of document.querySelectorAll('[data-creator-step]'))b.onclick=()=>setStep(Number(b.dataset.creatorStep));
 $('creatorBack').onclick=()=>{if(step>0)setStep(step-1);else{api.close();onCancel(editing);}};
 $('creatorNext').onclick=()=>{if(step<3){setStep(step+1);return;}const data={name:$('createName').value.trim().slice(0,18)||'Jordan Hayes',position:$('createPosition').value,archetype:$('createArchetype').value,profile:values()};if(onSave(data,editing)!==false)api.close();};
 $('rotateLeft').onclick=()=>{angle-=Math.PI/4;};$('rotateRight').onclick=()=>{angle+=Math.PI/4;};$('rotateFront').onclick=()=>{angle=.18;};
 const api={
  open(data={},options={}){active=true;editing=!!options.editing;step=0;angle=.18;buildStudio();const p=normalizeProfile(data.profile||defaultProfile());$('createName').value=data.name||'Jordan Hayes';$('createPosition').value=data.position||'QB';positionOptions(data.archetype);for(const f of fields)$('create_'+f).value=p[f];$('createPosition').disabled=editing;$('createArchetype').disabled=editing;$('creator').hidden=false;setStep(0);},
  close(){active=false;$('creator').hidden=true;},
  render(dt,draw=true){if(!active)return;clock+=dt;animateAthlete(T,preview,{dt,time:clock,speed:0,live:false,ballCarrier:false,blocking:false,settled:false,turn:0});preview.root.position.set(0,.12+Math.sin(clock*1.8)*.003,0);preview.root.rotation.set(0,angle,0);
   if(!draw)return;const r=$('creatorPreview').getBoundingClientRect();if(r.width<1||r.height<1)return;
   camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setClearColor('#0b1620',1);renderer.clear();renderer.setViewport(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(r.left,innerHeight-r.bottom,r.width,r.height);renderer.setScissorTest(true);renderer.render(studio,camera);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
  },
  get state(){return {active,editing,step,angle,preview:preview?{number:preview.number,scale:preview.root.scale.toArray(),appliedProfile:{...preview.root.userData.appliedProfile}}:null,profile:active?values():null,name:$('createName').value,position:$('createPosition').value,archetype:$('createArchetype').value};}
 };
 return api;
}
