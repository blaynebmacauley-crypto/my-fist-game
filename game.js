import * as THREE from './vendor/three.module.js';
import {Drive} from './rules.js?v=career4';
import {createCareer,stars,offers,schools,practice,complete,commit,validCareer} from './career.js?v=career4';
const $=id=>document.getElementById(id), canvas=$('game');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('loading').textContent='This browser cannot start WebGL. Try a current Chrome, Safari, Firefox, or Edge with graphics enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#647a90');scene.fog=new THREE.Fog('#647a90',100,290);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,450);
scene.add(new THREE.HemisphereLight(0xb5d5ff,0x32482a,2));
const sun=new THREE.DirectionalLight(0xffdfb5,3);sun.position.set(-45,70,-30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,far:200});sun.shadow.bias=-.0004;scene.add(sun);
const mats={};function mat(color,roughness=.75,metalness=0){const key=color+':'+roughness+':'+metalness;return mats[key]??=new THREE.MeshStandardMaterial({color,roughness,metalness});}
const boxGeo=new THREE.BoxGeometry(1,1,1),sphereGeo=new THREE.SphereGeometry(1,20,14);
function box(parent,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(boxGeo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=true;parent.add(m);return m;}
function oval(parent,x,y,z,sx,sy,sz,color,metal=0){const m=new THREE.Mesh(sphereGeo,mat(color,.5,metal));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
function textTexture(text,color='#ffffff',bg=null,width=512,height=128){const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);}ctx.fillStyle=color;ctx.font='900 '+Math.floor(height*.68)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,width/2,height/2,width*.95);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function groundText(text,x,z,w,h,color='#fff',bg=null){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(text,color,bg),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.025,z);scene.add(m);return m;}
// World units are yards, field runs along +Z, end zones at 0 and 100.
const turf=document.createElement('canvas');turf.width=turf.height=256;const ctx=turf.getContext('2d');let seed=17;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
ctx.fillStyle='#245838';ctx.fillRect(0,0,256,256);for(let i=0;i<14000;i++){const g=55+rand()*70;ctx.fillStyle=`rgba(65,${g|0},35,.45)`;ctx.fillRect(rand()*256,rand()*256,1,2);}const grass=new THREE.CanvasTexture(turf);grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(18,40);grass.colorSpace=THREE.SRGBColorSpace;
const field=new THREE.Mesh(new THREE.PlaneGeometry(53.33,120),new THREE.MeshStandardMaterial({map:grass,roughness:1}));field.rotation.x=-Math.PI/2;field.position.z=50;field.receiveShadow=true;scene.add(field);
box(scene,0,-.15,50,170,.2,220,'#314444');
for(let z=0;z<100;z+=10)box(scene,0,.006,z+2.5,53.3,.006,5,'#2b613c');
box(scene,0,.01,-5,53.3,.01,10,'#771c34');box(scene,0,.01,105,53.3,.01,10,'#152f49');
groundText('STATE',0,-5,39,7,'#fff');groundText('VALLEY',0,105,39,7,'#fff');
for(const x of [-26.67,26.67])box(scene,x,.015,50,.16,.02,120,'#ebebd8');
for(let z=0;z<=100;z+=5){box(scene,0,.016,z,53.33,.018,z%10===0?.15:.08,'#eeeedd');if(z>0&&z<100&&z%10===0){const n=z<=50?z:100-z;groundText(String(n),-20,z,3.8,2.2);groundText(String(n),20,z,3.8,2.2).rotation.z=Math.PI;}}
for(let z=1;z<100;z++)for(const x of [-9,9,-26,26])box(scene,x,.02,z,.5,.02,.06,'#e4e6d4');
for(const z of [-10,110]){box(scene,0,2.5,z,.18,5,.18,'#efb546');box(scene,0,5,z,6,.16,.16,'#efb546');for(const x of [-3,3])box(scene,x,7,z,.13,4,.13,'#efb546');}
groundText('SATURDAY LIGHTS',0,50,17,5,'#efe9d5','#6c2137');
// Grandstands, crowd instancing, light towers, sidelines.
for(const side of [-1,1]){
 for(let row=0;row<13;row++)box(scene,side*(36+row*1.65),row*.8+.4,50,2,.8,142,row%3?'#687c83':'#3e505c');
 box(scene,side*34,1,50,.6,2,146,'#1e2c36');
 const crowd=new THREE.InstancedMesh(new THREE.BoxGeometry(.48,.8,.45),[mat('#9d3243'),mat('#e7d5c2'),mat('#263a50')][side===1?0:2],13*160);const dummy=new THREE.Object3D();let i=0;
 for(let row=0;row<13;row++)for(let c=0;c<160;c++){dummy.position.set(side*(36+row*1.65),row*.8+1.2,-20+c*.88);dummy.scale.set(.8+rand()*.4,.7+rand()*.5,1);dummy.updateMatrix();crowd.setMatrixAt(i++,dummy.matrix);}scene.add(crowd);
 for(const z of [-12,35,80,115]){box(scene,side*32,13,z,.35,26,.35,'#8c979a');box(scene,side*32,26,z,7,1,.6,'#26333b');for(let k=-2;k<=2;k++)box(scene,side*32+k*1.2,26,z-.4,.8,.7,.1,'#fff1cf');}
 for(let z=12;z<94;z+=18){box(scene,side*29,.45,z,1,.9,5,'#c5c7bc');box(scene,side*30,1.3,z,1.5,2.5,1.2,'#cb6538');}
}
box(scene,0,15,126,32,10,1,'#15202a');const stadiumBoard=new THREE.Mesh(new THREE.PlaneGeometry(30,8),new THREE.MeshBasicMaterial({map:textTexture('SATURDAY LIGHTS','#ffc275','#101c25',1024,256)}));stadiumBoard.position.set(0,15,125.4);stadiumBoard.rotation.y=Math.PI;scene.add(stadiumBoard);
const lineScrim=box(scene,0,.04,25,53,.015,.07,'#4d9ad4'),lineGain=box(scene,0,.045,35,53,.015,.09,'#ffd05d');
function segment(parent,x,y,z,top,bottom,height,depth,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,12),mat(color));m.scale.z=depth/Math.max(top,bottom);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function makePlayer(defense,number,index){
 const root=new THREE.Group();scene.add(root);const skin=['#925a3d','#c68c66','#603b2c','#d3a582'][index%4],jersey=defense?'#e8e8df':'#872039',pants=defense?'#1c354d':'#e3ded0',helmet=defense?'#1e3b57':'#8a1d37';
 // Articulated anatomical forms: padded torso, shoulders, neck, helmet, arms, thighs, shins, gloves and cleats.
 segment(root,0,1.14,0,.29,.23,.58,.18,jersey);segment(root,-.3,1.37,0,.17,.14,.21,.18,jersey);segment(root,.3,1.37,0,.17,.14,.21,.18,jersey);segment(root,0,.83,0,.25,.22,.23,.17,pants);oval(root,0,1.53,0,.09,.12,.09,skin);
 oval(root,0,1.77,0,.2,.235,.2,helmet,.25);oval(root,0,1.71,.12,.13,.13,.11,skin);box(root,0,1.8,.194,.26,.065,.045,'#131a20');
 for(const x of [-.16,.16]){box(root,x,1.66,.22,.025,.18,.025,'#c6c6bc');}box(root,0,1.6,.23,.32,.025,.025,'#c6c6bc');box(root,0,1.69,.24,.32,.022,.022,'#c6c6bc');box(root,0,1.94,.04,.04,.03,.28,'#eee7db');
 const limbs=[];for(const side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.37,1.32,0);root.add(arm);segment(arm,0,-.14,0,.105,.085,.33,.1,skin);segment(arm,0,-.39,.03,.08,.06,.26,.08,skin);oval(arm,0,-.52,.06,.09,.1,.07,'#e7e9df');limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.15,.83,0);root.add(leg);segment(leg,0,-.2,0,.13,.095,.42,.13,pants);segment(leg,0,-.54,0,.08,.055,.3,.08,skin);oval(leg,0,-.68,0,.08,.11,.08,'#e9e4da');oval(leg,0,-.77,.08,.1,.065,.19,'#141a20');limbs.push(leg);
 }
 const num=new THREE.Mesh(new THREE.PlaneGeometry(.36,.29),new THREE.MeshBasicMaterial({map:textTexture(String(number),'#fff',null,128,128),transparent:true}));num.position.set(0,1.22,.193);root.add(num);const back=num.clone();back.position.z=-.194;back.rotation.y=Math.PI;root.add(back);
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.45,20),new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:.18,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;root.add(shadow);
 return {root,limbs,number,defense,index,speed:0,phase:rand()*6,home:new THREE.Vector3(),prev:new THREE.Vector3()};
}
const players=Array.from({length:22},(_,i)=>makePlayer(i>=11,i===0?7:i<6?60+i:i<11?75+i:20+i,i));
const ball=new THREE.Group();oval(ball,0,0,0,.13,.13,.24,'#713d24');for(let i=-2;i<=2;i++)box(ball,0,.127,i*.035,.09,.012,.012,'#e8d6b6');scene.add(ball);
function ring(color,size){const m=new THREE.Mesh(new THREE.RingGeometry(size,size+.055,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.04;scene.add(m);return m;}
const activeRing=ring('#63d8e1',.58),receiverRing=ring('#ffc266',.6);
const routeLabels=[];for(let i=0;i<3;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(String(i+1),'#112431','#ffc274',128,128),depthTest:false}));s.scale.set(.7,.7,1);scene.add(s);routeLabels.push(s);}
const drive=new Drive(),keys=new Set();let mode='intro',playState='ready',carrier=0,flight=null,selected=0,playTime=0,deadTimer=0,totalTime=180,gameIndex=0,away=0,passPlay=false,paused=false,wide=false,started=false,td=0,comp=0,attempts=0,yards=0,gameYards=0,gameTD=0,gameComp=0,recruit=0,playStart=25,release=null,audio=null,sound=false,gamepadLatch={};
const games=['Season Opener','Rivalry Game','State Championship'];let bannerTimer=0;function announce(text,seconds=2){$('banner').textContent=text;bannerTimer=seconds;}
function formation(){
 carrier=0;flight=null;playState='ready';playTime=0;passPlay=false;playStart=drive.spot;
 players.forEach((p,i)=>{let x=0,z=drive.spot;if(i===0)z-=4;else if(i<6){x=(i-3)*1.5;z-=.6;}else if(i<9){x=[-20,18,-11][i-6];z-=1;}else if(i===9){x=4;z-=4;}else if(i===10){x=-3;z-=5;}else {const j=i-11;if(j<4){x=(j-1.5)*2;z+=1;}else if(j<7){x=(j-5)*6;z+=5;}else if(j<9){x=j===7?-20:18;z+=4;}else{x=j===9?-9:9;z+=15;}}
  p.root.position.set(x,0,z);p.home.copy(p.root.position);p.root.rotation.set(0,i>=11?Math.PI:0,0);p.speed=0;p.velocity=new THREE.Vector3();
 });lineScrim.position.z=drive.spot;lineGain.position.z=drive.line;activeRing.visible=true;updateHUD();
}
function updateHUD(){
 $('home').textContent=drive.score;$('away').textContent=away;$('gameNo').textContent=gameIndex+1;const label=$('gameNo').parentElement;label.firstChild.textContent=careerActive&&career?.games>=3?'COLLEGE · GAME ':'HIGH SCHOOL · GAME ';
 const t=Math.max(0,Math.ceil(totalTime));$('clock').textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
 $('down').textContent=['1ST','2ND','3RD','4TH'][drive.down-1]+' & '+Math.ceil(drive.line-drive.spot)+' · BALL ON '+Math.round(drive.spot);
 $('phase').textContent=paused?'PAUSED':playState==='ready'?'PRE-SNAP':playState==='live'?'LIVE PLAY':'DEAD BALL';$('target').textContent=role+' · '+Math.round(stamina*100)+'% STAMINA · TARGET #'+players[6+selected].number;
 $('stats').textContent=(role==='LB'?gameTackles+' TKL · ':'')+`${Math.round(yards)} YDS · ${td} TD · ${comp}/${attempts} PASS`;
}
function start(){document.querySelector('.keys').children[2].innerHTML=role==='LB'?'<kbd>E</kbd> TACKLE':role==='WR'?'<kbd>1</kbd> CALL PASS':role==='RB'?'<kbd>WASD</kbd> FIND GAP':'<kbd>1 2 3</kbd> PASS';$('touch').querySelector('[data-action="1"]').textContent=role==='LB'?'TKL':'1';document.body.dataset.screen='play';mode='play';started=true;$('intro').hidden=true;$('summary').hidden=true;$('athlete').textContent=($('name').value.trim()||'Jordan Hayes').toUpperCase();const college=careerActive&&career.games>=3;const team=college?schools.find(s=>s.name===career.school):null;
 document.querySelector('.home b').textContent=role==='LB'?'STATE':team?.name||'STATE';document.querySelector('.away b').textContent=role==='LB'?(team?.name||'VALLEY'):'VALLEY';
 mat('#872039').color.set(team?.color||'#872039');mat('#1c354d').color.set(role==='LB'?(team?.color||'#1c354d'):'#1c354d');
 formation();announce(role+' · '+games[gameIndex].toUpperCase(),2.3);$('athlete').nextElementSibling.textContent=role+' · '+roleDescriptions[role];}
function snap(){if(mode!=='play'||paused||playState!=='ready')return;playState='live';playTime=0;updateHUD();beep(180,.1);}
function throwBall(target){if(mode!=='play'||paused||playState!=='live'||carrier!==0||flight||passPlay)return;selected=target;passPlay=true;attempts++;const p=players[6+target];release=players[0].root.position.clone().add(new THREE.Vector3(.3,1.35,.3));const distance=release.distanceTo(p.root.position);const duration=Math.max(.45,Math.min(1.6,distance/23));let end=p.root.position.clone();end.z+=target===2?duration*4:duration*5;end.x+=target===0?duration*1.4:target===1?-duration*1.2:0;end.y=1.3;flight={start:release,end,t:0,duration,target:6+target};carrier=-1;updateHUD();beep(380,.06);}
function finish(reason,incomplete=false,turnover=false){if(playState!=='live')return;let spot=carrier>=0?players[carrier].root.position.z:drive.spot;let gain=incomplete?0:spot-playStart;
 if(turnover){away+=7;drive.reset();}else {yards+=gain;gameYards+=gain;const outcome=drive.finish(spot,incomplete);if(outcome==='TOUCHDOWN'){td++;gameTD++;reason='TOUCHDOWN';beep(620,.4);}if(outcome==='SAFETY'){away+=2;reason='SAFETY';}if(outcome==='TURNOVER ON DOWNS'){away+=3;reason=outcome;}if(outcome==='FIRST DOWN'&&reason==='TACKLED')reason='FIRST DOWN';}
 playState='dead';deadTimer=2.4;flight=null;announce(reason,2.3);updateHUD();beep(720,.12);
}
function action(key){if(key==='1'&&role==='LB')key='e';if(key==='p'&&mode==='play'){paused=!paused;announce(paused?'PAUSED':'PLAY RESUMED',paused?999:1);updateHUD();return;}if(key==='c'){wide=!wide;return;}if(key===' '||key==='snap')snap();if(key==='e'&&mode==='play'&&!paused&&role==='LB'&&playState==='live'&&tackleCooldown===0){tackleCooldown=1.2;if(carrier>=0&&players[16].root.position.distanceTo(players[carrier].root.position)<1.5){gameTackles++;finish('TACKLE');}}if(['1','2','3'].includes(key)){if(role==='WR')throwBall(0);else if(role==='QB')throwBall(Number(key)-1);}}
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();keys.add(k);if(!e.repeat){if(k==='tab'){selected=(selected+1)%3;updateHUD();}else action(k);}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(started&&mode==='play'){paused=true;announce('PAUSED · PRESS P TO RESUME',999);updateHUD();}});
$('start').onclick=()=>{careerActive=false;role=$('position').value;gameIndex=0;resetGame();start();};
$('pause').onclick=()=>{action('p');$('pause').textContent=paused?'RESUME':'PAUSE';};
function endGame(){if(careerActive){complete(career,{yards:role==='LB'?0:gameYards,td:role==='LB'?0:gameTD,comp:role==='LB'?0:gameComp,home:role==='LB'?away:drive.score,away:role==='LB'?drive.score:away,tackles:gameTackles});saveCareer();}mode='summary';$('summary').hidden=false;recruit+=Math.max(0,gameYards)*.12+gameTD*12+gameComp*2+(drive.score>away?20:0);const stars=Math.max(1,Math.min(5,1+Math.floor(recruit/35)));$('resultTitle').textContent=gameIndex===2?'YOUR RECRUITING GRADE':games[gameIndex].toUpperCase();$('resultText').textContent=`${$('name').value.trim()||'Jordan Hayes'} · ${document.querySelector('.home b').textContent} ${drive.score} – ${document.querySelector('.away b').textContent} ${away}. ${Math.round(gameYards)} yards, ${gameTD} touchdowns. ${'★'.repeat(stars)}${'☆'.repeat(5-stars)} fictional prospect.${gameIndex===2?' Three challenges complete. This is a prototype grade, not a full recruiting simulation.':' Your next challenge is '+games[gameIndex+1]+'.'}`;if(careerActive){$('resultTitle').textContent=career.games<=3?'HIGH SCHOOL RESULT':'COLLEGE GAME RESULT';}
$('next').textContent=careerActive?'RETURN TO CAREER →':gameIndex===2?'PLAY AGAIN →':'NEXT GAME →';}
$('next').onclick=()=>{if(careerActive){showHub();return;}if(gameIndex===2){gameIndex=0;recruit=0;td=comp=attempts=yards=0;}else gameIndex++;resetGame();start();};
let career=null,careerActive=false;
let role="QB",stamina=1,gameTackles=0;
const roleDescriptions={QB:"Read coverage, pass with 1 / 2 / 3, or scramble. Shift sprints with limited stamina.",RB:"Take the handoff after the snap, find a gap, then use WASD to carry the ball. Shift sprints.",WR:"Run your own route with WASD. Press 1 to call for a pass after the snap. Catch automatically in range, then run.",LB:"Control the middle linebacker. Read the run, cover underneath, or blitz. Close on the ball carrier to tackle. E gives a short tackle reach with a miss cooldown."};
let tackleCooldown=0;
function athleteIndex(){return role==="LB"?16:role==="WR"?6:role==="RB"?10:0;}
function controlledIndex(){return role==="QB"&&carrier>=0&&carrier<11?carrier:athleteIndex();}
function selectCareerTab(tab){for(const t of ["Play","Recruitment","Player"])$("panel"+t).hidden=t!==tab;for(const b of document.querySelectorAll("[data-tab]"))b.setAttribute("aria-selected",String(b.dataset.tab===tab));}
for(const b of document.querySelectorAll("[data-tab]"))b.onclick=()=>selectCareerTab(b.dataset.tab);
try{const saved=JSON.parse(localStorage.getItem('saturday-career-v1'));if(saved){const legacy={'Pine Valley State':'Auburn','Lakeview Tech':'Florida','Coastal Union':'Texas','Redwood University':'Georgia'};saved.school=legacy[saved.school]||saved.school;saved.position||='QB';saved.tackles||=0;}if(validCareer(saved))career=saved;}catch{}
$('careerContinue').hidden=!career;
function saveCareer(){try{localStorage.setItem('saturday-career-v1',JSON.stringify(career));$('saveStatus').textContent='Progress saved in this browser after each completed game and coach meeting.';}catch{$('saveStatus').textContent='Browser storage unavailable. Keep this tab open to retain progress.';}}
function resetGame(){stamina=1;gameTackles=0;gameYards=gameTD=gameComp=0;drive.score=0;drive.reset();away=0;totalTime=180;paused=false;keys.clear();}
function home(){document.body.dataset.screen='intro';mode='intro';paused=false;$('intro').hidden=false;$('summary').hidden=true;$('careerHub').hidden=true;$('careerContinue').hidden=!career;}
$('homeButton').onclick=()=>{if(mode==='play'&&!confirm('Return home? The current game will restart. Completed career games stay saved.'))return;home();};
$('careerHome').onclick=home;
$('careerStart').onclick=()=>{if(career&&!confirm('Start a new career and replace your saved career?'))return;career=createCareer($('name').value,$('position').value);careerActive=true;saveCareer();showHub();};
$('careerContinue').onclick=()=>{careerActive=true;showHub();};
function showHub(){selectCareerTab(career.games===3&&!career.school?'Recruitment':'Play');document.body.dataset.screen='career';mode='career';paused=false;$('intro').hidden=true;$('summary').hidden=true;$('careerHub').hidden=false;$('careerTitle').textContent=career.name.toUpperCase();
 const college=career.games>=3,finished=career.games>=15,year=Math.min(4,Math.floor((career.games-3)/3)+1);
 $('careerStage').textContent=finished?'CAREER COMPLETE':!college?'HIGH SCHOOL · '+games[career.games]:!career.school?'NATIONAL SIGNING DAY':career.school+' · YEAR '+year+' · GAME '+((career.games-3)%3+1)+' / 3';
 $('playerProfile').textContent=career.name+' · '+(career.position||'QB')+' · '+career.xp+' XP · '+(career.tackles||0)+' tackles · '+(career.school||'Uncommitted');$('roleHelp').textContent=roleDescriptions[career.position||'QB'];
 $('careerMetrics').textContent='★'.repeat(stars(career))+' · COACH TRUST '+career.trust+' / 100 · '+career.xp+' XP · '+career.wins+' WINS';
 const school=schools.find(s=>s.name===career.school);$('coachName').textContent=school?.coach||'Coach Morgan · State High School';
 $('coachMessage').textContent=(career.position==='LB'&&!finished)?'Read your run gap first, then cover the underneath receiver. Aim for three tackles. Use E or the first touch action to attempt a tackle.':finished?'You built your career one Saturday at a time. Keep working and carry these lessons forward.':career.trust>=65?'You have earned my trust. Keep your eyes downfield and turn completions into first downs.':'Protect the football. Read your three receivers before throwing. This week, aim for three completions.';
 $('practice').disabled=career.practiced===career.games||finished;$('practice').textContent=career.practiced===career.games?'FILM SESSION COMPLETE':'FILM SESSION · +20 XP / +5 TRUST';
 const board=$('offers');board.replaceChildren();for(const s of schools){const row=document.createElement('div');row.className='offer';const title=document.createElement('b');title.textContent=s.name;const detail=document.createElement('p');const offered=offers(career).some(o=>o.name===s.name);detail.textContent=s.coach+' · '+s.style+' · '+(career.school===s.name?'COMMITTED':offered?'SCHOLARSHIP OFFER':'NEEDS '+s.need+' STARS');row.append(title,detail);if(career.games===3&&!career.school&&offered){const btn=document.createElement('button');btn.className='secondary';btn.textContent='COMMIT TO THIS SCHOOL';btn.onclick=()=>{if(commit(career,s.name)){saveCareer();showHub();}};row.append(btn);}board.append(row);}
 $('careerNote').textContent=finished?'Four condensed college seasons complete. Start a new career from Home.':college&&!career.school?'Choose an available scholarship to begin college. Real college names; coaches and offers are fictional.':'Play three high-school games to finalize your recruiting grade, then four condensed college seasons of three games each. This is a simplified career, not full college scheduling.';
 $('careerPlay').disabled=finished||(college&&!career.school);$('careerPlay').textContent=college?'PLAY COLLEGE GAME →':'PLAY '+games[career.games].toUpperCase()+' →';
}
$('practice').onclick=()=>{if(practice(career)){saveCareer();showHub();}};
$('careerPlay').onclick=()=>{careerActive=true;role=career.position||'QB';$('name').value=career.name;gameIndex=career.games<3?career.games:(career.games-3)%3;resetGame();$('careerHub').hidden=true;start();if(career.games>=3)announce(career.school+' · YEAR '+(Math.floor((career.games-3)/3)+1),2);};

for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);});for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>keys.delete(b.dataset.key));}
for(const b of document.querySelectorAll('[data-action]'))b.addEventListener('pointerdown',e=>{e.preventDefault();action(b.dataset.action);});
$('sound').onclick=()=>{sound=!sound;if(sound&&!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio?.state==='suspended')audio.resume();$('sound').textContent=sound?'SOUND ON':'SOUND OFF';beep(440,.1);};
function beep(hz,duration){if(!sound||!audio)return;const osc=audio.createOscillator(),g=audio.createGain();osc.connect(g);g.connect(audio.destination);osc.frequency.value=hz;g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.start();osc.stop(audio.currentTime+duration);}
const v=new THREE.Vector3();function move(p,x,z,speed,dt){v.set(x,0,z);if(v.lengthSq()>1)v.normalize();v.multiplyScalar(speed);p.velocity??=new THREE.Vector3();p.velocity.lerp(v,1-Math.exp(-dt*9));p.root.position.addScaledVector(p.velocity,dt);p.speed=p.velocity.length();if(p.speed>.1){const target=Math.atan2(p.velocity.x,p.velocity.z);const diff=Math.atan2(Math.sin(target-p.root.rotation.y),Math.cos(target-p.root.rotation.y));p.root.rotation.y+=diff*(1-Math.exp(-dt*12));}}

function pursue(p,goal,speed,dt){const dx=goal.x-p.root.position.x,dz=goal.z-p.root.position.z;if(dx*dx+dz*dz>.12)move(p,dx,dz,speed,dt);else p.speed=0;}
function step(dt,draw=true){
 if(bannerTimer>0){bannerTimer-=dt;if(bannerTimer<=0)$('banner').textContent='';}
 const pad=navigator.getGamepads?.()[0];let ax=0,az=0,sprint=keys.has('shift');if(pad){ax=Math.abs(pad.axes[0])>.17?pad.axes[0]:0;az=Math.abs(pad.axes[1])>.17?-pad.axes[1]:0;sprint||=pad.buttons[10]?.pressed;for(const [i,k]of [[0,' '],[2,'1'],[3,'2'],[1,'3'],[9,'p'],[4,'c']]){if(pad.buttons[i]?.pressed&&!gamepadLatch[i])action(k);gamepadLatch[i]=pad.buttons[i]?.pressed;}}
 if(mode==='play'&&!paused){
 if(playState==='dead'){deadTimer-=dt;if(deadTimer<=0){if(totalTime<=0)endGame();else formation();}}
 if(playState==='live'){
 totalTime=Math.max(0,totalTime-dt);playTime+=dt;tackleCooldown=Math.max(0,tackleCooldown-dt);stamina=THREE.MathUtils.clamp(stamina+(sprint?-.23:.15)*dt,0,1);
 let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+ax,z=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+az;
 const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();const direction=forward.multiplyScalar(z).addScaledVector(right,x);
 const controlled=controlledIndex();move(players[controlled],direction.x,direction.z,sprint&&stamina>.05?6.4:5.5,dt);players[controlled].root.position.x=THREE.MathUtils.clamp(players[controlled].root.position.x,-28,28);
 if(playTime>.55&&role==='RB'&&carrier===0&&!passPlay){carrier=10;passPlay=true;announce('HANDOFF · FIND THE GAP',1);}
 if(role!=='QB'&&role!=='RB'&&carrier===0&&!flight&&playTime>2.3&&!passPlay)throwBall(role==='WR'?0:(gameIndex%3));
 if(controlled!==0&&carrier===0&&!flight){const qb=players[0];pursue(qb,qb.home,4,dt);}
 for(let i=1;i<11;i++){if(i===controlled)continue;const p=players[i];if(i===carrier){move(p,0,1,6.2,dt);continue;}if(i<6){const defender=players[11+(i-1)%4];const maxZ=drive.spot+2;const goal=defender.root.position.clone();goal.z=Math.min(goal.z,maxZ);pursue(p,goal,3.7,dt);}else{const t=playTime;let goal=p.home.clone();if(flight?.target===i){goal.copy(flight.end);pursue(p,goal,6.3,dt);}else{goal.z+=Math.min(38,t*(i===8?5.3:6));goal.x+=i===6?Math.min(9,t*1.3):i===7?-Math.min(8,t):i===8?Math.min(12,Math.max(0,t-1.5)*3):i===9?-Math.min(14,t*2):Math.min(10,t*2);pursue(p,goal,5.5,dt);}}}
 for(let i=11;i<22;i++){if(i===controlled)continue;const p=players[i];let goal;const runner=players[Math.max(0,carrier)];
 const isRun=carrier>0&&!flight;const qbScramble=carrier===0&&players[0].root.position.z>drive.spot+1;
 if(isRun||qbScramble){const lead=Math.min(.6,p.root.position.distanceTo(runner.root.position)/20);goal=runner.root.position.clone().addScaledVector(runner.velocity||new THREE.Vector3(),lead);}
 else if(i<15){goal=players[0].root.position.clone();if(i===11||i===14)goal.x+=(i===11?-2:2);}
 else if(flight&&p.root.position.distanceTo(flight.end)<16&&playTime>.5){goal=flight.end;}
 else if(i>=19){goal=p.home.clone();goal.z=Math.max(goal.z,players[6+(i-19)%3].root.position.z+4);goal.x=THREE.MathUtils.clamp(players[0].root.position.x,-12,12)+(i===19?-8:i===20?8:0);}
 else if(i>=17){goal=players[i===17?6:7].root.position.clone();goal.z+=1.4;}
 else{goal=p.home.clone();goal.x=THREE.MathUtils.clamp(players[0].root.position.x,-10,10);goal.z=Math.max(drive.spot+4,Math.min(drive.spot+10,players[8].root.position.z));}
 let speed=i<15?5.6:6.45;
 if(playTime<.25)speed=0;
 if(i<15)for(let j=1;j<6;j++)if(p.root.position.distanceTo(players[j].root.position)<1.4){speed*=.58;break;}
 pursue(p,goal,speed,dt);
 }
 if(flight){flight.t+=dt;const a=Math.min(1,flight.t/flight.duration);ball.position.lerpVectors(flight.start,flight.end,a);ball.position.y+=Math.sin(a*Math.PI)*Math.max(2.5,flight.start.distanceTo(flight.end)*.16);ball.rotation.z+=dt*16;
  if(a>=1){const target=flight.target;let interceptor=-1;for(let i=11;i<22;i++)if(players[i].root.position.distanceTo(new THREE.Vector3(flight.end.x,0,flight.end.z))<1.1)interceptor=i;
   if(interceptor>=0&&players[target].root.position.distanceTo(new THREE.Vector3(flight.end.x,0,flight.end.z))>1.4){carrier=interceptor;flight=null;finish('INTERCEPTED',false,true);}else if(players[target].root.position.distanceTo(new THREE.Vector3(flight.end.x,0,flight.end.z))<2){carrier=target;comp++;gameComp++;flight=null;announce('CAUGHT · RUN WITH '+['WASD','THE LEFT STICK'][pad?1:0],1.2);beep(500,.08);}else{flight=null;finish('INCOMPLETE',true);}
  }
 }
 if(playState==='live'&&carrier>=0){const p=players[carrier].root.position;ball.position.copy(p).add(new THREE.Vector3(.26,1,.2));ball.rotation.set(.4,0,0);if(p.z>=100)finish('TOUCHDOWN');else if(p.z<=0)finish('SAFETY');else if(Math.abs(p.x)>26.67)finish('OUT OF BOUNDS');else if(playTime>.8){for(let i=11;i<22;i++)if(players[i].root.position.distanceTo(p)<.78){if(role==='LB'&&i===16)gameTackles++;finish('TACKLED');break;}}}
 if(playState==='live'&&(playTime>18||totalTime<=0))finish(totalTime<=0?'FINAL WHISTLE':'PLAY CLOCK',flight!==null);
 updateHUD();
 }
 }
 if(playState==='ready')ball.position.copy(players[0].root.position).add(new THREE.Vector3(.25,1,.22));
 const focus=players[controlledIndex()].root.position;
 for(const p of players){const run=playState==='live'&&!paused?p.speed:0;p.phase+=dt*run*2.7;const swing=Math.sin(p.phase)*Math.min(.85,run*.14);p.limbs[0].rotation.x=swing;p.limbs[2].rotation.x=-swing;p.limbs[1].rotation.x=-swing;p.limbs[3].rotation.x=swing;p.root.position.y=run?Math.abs(Math.sin(p.phase))* .035:0;}
 activeRing.position.set(focus.x,.04,focus.z);receiverRing.position.set(players[6+selected].root.position.x,.05,players[6+selected].root.position.z);
 for(let i=0;i<3;i++){routeLabels[i].position.copy(players[6+i].root.position).add(new THREE.Vector3(0,2.6,0));routeLabels[i].visible=mode==='play'&&carrier===0;}
 receiverRing.visible=mode==='play'&&carrier===0;
 let desired,look;if(mode==='intro'){const t=performance.now()*.00005;desired=new THREE.Vector3(42+Math.sin(t)*8,22,4);look=new THREE.Vector3(0,0,40);}else {desired=new THREE.Vector3(focus.x*(wide?.3:.8)+(wide?20:0),wide?26:10,focus.z-(wide?28:16));look=new THREE.Vector3(focus.x,1,focus.z+10);}
 camera.position.lerp(desired,1-Math.exp(-dt*4));camera.lookAt(look);
 if(draw)renderer.render(scene,camera);
}
// Batch static stadium and field boxes by material to reduce draw calls.
const batches=new Map();
for(const m of [...scene.children])if(m.isMesh&&m.geometry===boxGeo&&m!==lineScrim&&m!==lineGain){if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(m);}
for(const [material,meshes] of batches){const batch=new THREE.InstancedMesh(boxGeo,material,meshes.length);meshes.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);scene.remove(m);});batch.receiveShadow=true;scene.add(batch);}
formation();camera.position.set(42,22,4);$('loading').remove();let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// Read-only inspection for automated readiness checks; no developer controls in the player UI.
window.football={get state(){return {mode,playState,paused,carrier,players:players.length,flight:!!flight,spot:drive.spot,down:drive.down,role,controlled:controlledIndex(),stamina,tackles:gameTackles,score:drive.score,attempts,comp,yards,time:totalTime,game:gameIndex+1,positions:players.map(p=>({x:p.root.position.x,z:p.root.position.z}))};}};

export {step};
