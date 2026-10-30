import * as THREE from './vendor/three.module.js';
import {offensivePlay,offensivePlays,routePoint,predictReceiver} from './playbook.js?v=playmaker10';
import {defensiveFormations,defensiveFormation,defensiveAlignment,getFormation,pursuitTarget,defensiveReaction} from './defense.js?v=playmaker10';
import {enhanceAthlete,enhanceStadium,applyPlayerLook,setJerseyNumber} from './presentation.js?v=playmaker10';
import {prepareAthleteRig,resetAthletePose,animateAthlete,animateContact} from './motion.js?v=playmaker10';
import {normalizeProfile,defaultProfile,skinTones,physique,profileSummary} from './player-profile.js?v=playmaker10';
import {createPlayerCreator} from './creator.js?v=playmaker10';
import {Drive,liveBoundary,catchEligible,movementSpeed,ballCarrierDown,tackleBreaks,forwardPassAllowed,skillMove} from './rules.js?v=playmaker10';
import {simulatePossession,deadBallRunoff} from './possessions.js?v=playmaker10';
import {createCareer,stars,offers,schools,practice,complete,commit,validCareer,archetypes,upgradeDefinitions,ensureDevelopment,availableXP,upgradeCost,purchaseUpgrade,playerAttributes} from './career.js?v=playmaker10';
const $=id=>document.getElementById(id), canvas=$('game');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){$('loading').textContent='This browser cannot start WebGL. Try a current Chrome, Safari, Firefox, or Edge with graphics enabled.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#647a90');scene.fog=new THREE.Fog('#647a90',100,290);
const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,650);
scene.add(new THREE.HemisphereLight(0xb5d5ff,0x32482a,2));
const sun=new THREE.DirectionalLight(0xffdfb5,3);sun.position.set(-45,70,-30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,far:200});sun.shadow.bias=-.0004;scene.add(sun);
const mats={};function mat(color,roughness=.75,metalness=0){const key=color+':'+roughness+':'+metalness;return mats[key]??=new THREE.MeshStandardMaterial({color,roughness,metalness});}
const boxGeo=new THREE.BoxGeometry(1,1,1),sphereGeo=new THREE.SphereGeometry(1,20,14);
function box(parent,x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(boxGeo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.receiveShadow=true;m.userData.baseColor=color;parent.add(m);return m;}
function oval(parent,x,y,z,sx,sy,sz,color,metal=0){const m=new THREE.Mesh(sphereGeo,mat(color,.5,metal));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.userData.baseColor=color;parent.add(m);return m;}
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
const stadiumScreen=document.createElement('canvas');stadiumScreen.width=1024;stadiumScreen.height=256;const stadiumTexture=new THREE.CanvasTexture(stadiumScreen);stadiumTexture.colorSpace=THREE.SRGBColorSpace;stadiumBoard.material.map=stadiumTexture;let screenKey='';
const lineScrim=box(scene,0,.04,25,53,.015,.07,'#4d9ad4'),lineGain=box(scene,0,.045,35,53,.015,.09,'#ffd05d');
enhanceStadium(THREE,{scene,renderer,sun,field,grass});
function segment(parent,x,y,z,top,bottom,height,depth,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,12),mat(color));m.scale.z=depth/Math.max(top,bottom);m.position.set(x,y,z);m.castShadow=true;m.userData.baseColor=color;parent.add(m);return m;}
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
 const player={root,limbs,number,defense,index,speed:0,phase:rand()*6,home:new THREE.Vector3(),prev:new THREE.Vector3()};prepareAthleteRig(THREE,player);enhanceAthlete(THREE,player);return player;
}
const players=Array.from({length:22},(_,i)=>makePlayer(i>=11,i===0?7:i<6?60+i:i<11?75+i:20+i,i));
const ball=new THREE.Group();oval(ball,0,0,0,.13,.13,.24,'#713d24');for(let i=-2;i<=2;i++)box(ball,0,.127,i*.035,.09,.012,.012,'#e8d6b6');scene.add(ball);
function ring(color,size){const m=new THREE.Mesh(new THREE.RingGeometry(size,size+.055,40),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.04;scene.add(m);return m;}
const activeRing=ring('#63d8e1',.58),receiverRing=ring('#ffc266',.6);
const routeLabels=[];for(let i=0;i<3;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(String(i+1),'#112431','#ffc274',128,128),depthTest:false}));s.scale.set(.7,.7,1);scene.add(s);routeLabels.push(s);}
const drive=new Drive(),keys=new Set();let mode='intro',playState='ready',carrier=0,flight=null,selected=0,playTime=0,deadTimer=0,totalTime=180,gameIndex=0,away=0,passPlay=false,paused=false,wide=false,started=false,td=0,comp=0,attempts=0,yards=0,gameYards=0,gameTD=0,gameComp=0,recruit=0,playStart=25,release=null,audio=null,sound=false,gamepadLatch={};
const games=['Season Opener','Rivalry Game','State Championship'];let bannerTimer=0;function announce(text,seconds=2){$('banner').textContent=text;bannerTimer=seconds;}
function formation(){
 carrier=0;crossedScrimmage=false;juke=null;jukeCooldown=0;catchGrace=0;flight=null;tackle=null;requestedPass=false;currentPlay=offensivePlays(role).find(p=>p.id===selectedOffense)||offensivePlay(playNumber,role);currentDefense=role==='LB'&&selectedDefense!=='auto'?getFormation(selectedDefense):defensiveFormation(playNumber,{spot:drive.spot});assignments=defensiveAlignment(currentDefense,drive.spot);playState='ready';playTime=0;passPlay=false;playStart=drive.spot;
 players.forEach((p,i)=>{let x=0,z=drive.spot;if(i===0)z-=4;else if(i<6){x=(i-3)*1.5;z-=.6;}else if(i<9){x=[-20,18,-11][i-6];z-=1;}else if(i===9){x=4;z-=4;}else if(i===10){x=-3;z-=5;}else {const assignment=assignments.find(a=>a.index===i);x=assignment.x;z=assignment.z;}
  p.root.position.set(x,0,z);p.home.copy(p.root.position);p.root.rotation.set(0,i>=11?Math.PI:0,0);p.speed=0;p.routeSettled=false;p.contactCooldown=0;p.stumble=0;p.overcommit=0;p.readTarget=null;p.velocity=new THREE.Vector3();resetAthletePose(p);
 });assignBlocks();lineScrim.position.z=drive.spot;lineGain.position.z=drive.line;activeRing.visible=true;syncPlayMenus();updateHUD();
}
function updateHUD(){
 updateStadiumScreen();
 $('home').textContent=homeScore();$('away').textContent=visitorScore();$('gameNo').textContent=gameIndex+1;const label=$('gameNo').parentElement;label.firstChild.textContent=careerActive&&career?.games>=3?'COLLEGE · GAME ':'HIGH SCHOOL · GAME ';
 const t=Math.max(0,Math.ceil(totalTime));$('clock').textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
 $('down').textContent=['1ST','2ND','3RD','4TH'][drive.down-1]+' & '+Math.ceil(drive.line-drive.spot)+' · BALL ON '+Math.round(drive.spot);
 $('phase').textContent=paused?'PAUSED':playState==='ready'?'PRE-SNAP':playState==='live'?'LIVE PLAY':playState==='tackle'?'TACKLE':playState==='simulation'?'OTHER POSSESSION':'DEAD BALL';$('target').textContent=role+' · '+Math.round(stamina*100)+'% · '+(role==='LB'&&playState==='ready'?'READ THE OFFENSE':currentPlay.name.toUpperCase())+' · '+currentDefense.name+' · '+(role==='QB'&&carrier===0&&crossedScrimmage?'RUN ONLY · LINE CROSSED':'#'+players[6+selected].number);
 if(role==='QB'&&carrier===0&&crossedScrimmage&&playState==='live')$('target').textContent='QB · RUN ONLY · LINE CROSSED · '+Math.round(stamina*100)+'%';
 $('stats').textContent=(role==='LB'?gameTackles+' TKL · ':'')+`${Math.round(yards)} YDS · ${td} TD · ${comp}/${attempts} PASS`;
}
function updateStadiumScreen(){
 const home=document.querySelector('.home b').textContent,visitor=document.querySelector('.away b').textContent,t=Math.max(0,Math.ceil(totalTime));
 const key=[home,visitor,homeScore(),visitorScore(),t].join(':');if(key===screenKey)return;screenKey=key;
 const c=stadiumScreen.getContext('2d');c.fillStyle='#07131f';c.fillRect(0,0,1024,256);c.fillStyle='#ecb96f';c.fillRect(0,0,1024,9);c.font='bold 23px Arial';c.textAlign='center';c.fillText('SATURDAY LIGHTS',512,41);c.fillStyle='#ffffff';c.font='bold 32px Arial';c.fillText(home.toUpperCase(),228,94,370);c.fillText(visitor.toUpperCase(),796,94,370);c.font='bold 92px Arial';c.fillText(String(homeScore()),228,200);c.fillText(String(visitorScore()),796,200);c.fillStyle='#ffd48c';c.font='bold 44px Arial';c.fillText(Math.floor(t/60)+':'+String(t%60).padStart(2,'0'),512,153);c.font='18px Arial';c.fillText('HOME',228,235);c.fillText('AWAY',796,235);stadiumTexture.needsUpdate=true;
}
function start(){activeProfile=normalizeProfile(careerActive?career.profile:career?.profile);buildPlayMenus();activeRatings=playerAttributes(careerActive?career:createCareer($('name').value,role,$('archetype').value));document.querySelector('.keys').children[4].innerHTML=role==='LB'?'<kbd>Q</kbd> CUT':'<kbd>Q / E</kbd> JUKE';document.querySelector('.keys').children[2].innerHTML=role==='LB'?'<kbd>E</kbd> TACKLE':role==='WR'?'<kbd>1</kbd> CALL PASS':role==='RB'?'<kbd>WASD</kbd> FIND GAP':'<kbd>1 2 3</kbd> PASS';$('touch').querySelector('[data-action="1"]').textContent=role==='LB'?'TKL':'1';document.body.dataset.screen='play';mode='play';started=true;$('intro').hidden=true;$('summary').hidden=true;$('athlete').textContent=($('name').value.trim()||'Jordan Hayes').toUpperCase();const college=careerActive&&career.games>=3;const team=college?schools.find(s=>s.name===career.school):null;
 document.querySelector('.home b').textContent=team?.name||(careerActive?career.highSchool:'STATE')||'STATE';document.querySelector('.away b').textContent='VALLEY';
 // The created athlete always represents the home team, including on defense.
 const ownColor=team?.color||'#872039';
 mat('#872039').color.set(role==='LB'?'#e8e8df':ownColor);mat('#e8e8df',.5).color.set(role==='LB'?ownColor:'#e8e8df');
 // Oval parts and tapered parts use separate roughness defaults.
 mat('#e8e8df').color.set(role==='LB'?ownColor:'#e8e8df');mat('#1c354d').color.set(role==='LB'?'#e3ded0':'#1c354d');mat('#e3ded0').color.set(role==='LB'?'#1c354d':'#e3ded0');
 mat('#8a1d37',.5,.25).color.set(role==='LB'?'#1e3b57':ownColor);mat('#1e3b57',.5,.25).color.set(role==='LB'?ownColor:'#1e3b57');
 configureAthletes(ownColor);$('callBall').hidden=role!=='WR';$('driveFeed').textContent='';
 formation();placeCamera(true);announce(role+' · '+games[gameIndex].toUpperCase(),2.3);$('athlete').nextElementSibling.textContent=role+' · '+roleDescriptions[role];}
function snap(){if(mode!=='play'||paused||playState!=='ready')return;playState='live';playTime=0;playNumber++;$('driveFeed').textContent='';$('driveFeed').dataset.highlight='false';syncPlayMenus();updateHUD();beep(180,.1);}
function throwBall(target){
 if(mode!=='play'||paused||playState!=='live'||carrier!==0||flight||passPlay)return;
 if(!forwardPassAllowed({passerZ:players[0].root.position.z,scrimmageZ:drive.spot,crossed:crossedScrimmage})){crossedScrimmage=true;announce('PAST SCRIMMAGE · RUN ONLY',1.4);updateHUD();return;}
 selected=target;requestedPass=false;passPlay=true;attempts++;
 const p=players[6+target],skill=role==='QB'?activeRatings.throwing:87;
 release=players[0].root.position.clone().add(new THREE.Vector3(role==='QB'&&activeProfile.dominantHand==='left'?-.3:.3,1.35,.3));
 const duration=THREE.MathUtils.clamp(release.distanceTo(p.root.position)/(23+(skill-65)*.12),.4,1.65);
 const lead=predictReceiver(p.root.position,p.velocity,duration,{controlled:role==='WR'&&target===0,throwing:skill});
 const end=new THREE.Vector3(lead.x,1.3,lead.z);
 flight={start:release,end,t:0,duration,target:6+target};carrier=-1;updateHUD();beep(380,.06);
}

function homeScore(){return role==='LB'?away:drive.score;}
function visitorScore(){return role==='LB'?drive.score:away;}
function finish(reason,incomplete=false,turnover=false,contactSpot=null){
 if(playState!=='live')return;
 const spot=contactSpot??(carrier>=0?players[carrier].root.position.z:drive.spot),gain=incomplete?0:spot-playStart;
 let ended=turnover,downResult='';
 if(turnover){pendingPossession={start:THREE.MathUtils.clamp(100-spot,10,90)};drive.reset();}
 else{
  yards+=gain;gameYards+=gain;
  const outcome=drive.finish(spot,incomplete);downResult=outcome;
  if(outcome==='TOUCHDOWN'){td++;gameTD++;reason='TOUCHDOWN';ended=true;beep(620,.4);}
  if(outcome==='SAFETY'){away+=2;reason='SAFETY';ended=true;}
  if(outcome==='TURNOVER ON DOWNS'){reason=outcome;ended=true;drive.reset();}
  if(outcome==='FIRST DOWN'&&reason==='TACKLED')reason='FIRST DOWN';
  if(ended)pendingPossession={start:outcome==='TURNOVER ON DOWNS'?THREE.MathUtils.clamp(100-spot,10,90):25};
 }
 for(const p of players){p.velocity?.set(0,0,0);p.speed=0;}juke=null;
 const signed=(gain>=0?'+':'')+Math.round(gain)+' YDS';
 $('driveFeed').textContent=reason==='TOUCHDOWN'?'TOUCHDOWN · '+Math.max(0,Math.round(gain))+' YARD PLAY':turnover||reason==='TURNOVER ON DOWNS'?'TURNOVER · DEFENSE TAKES OVER':incomplete?'INCOMPLETE · GET THE NEXT ONE':reason==='SAFETY'?'SAFETY · +2 FOR THE DEFENSE':signed+(gain>=20?' · EXPLOSIVE PLAY':'')+(downResult==='FIRST DOWN'?' · MOVE THE CHAINS':'');
 $('driveFeed').dataset.highlight=String(reason==='TOUCHDOWN'||gain>=20);
 runoffRemaining=ended?0:deadBallRunoff(reason);playState='dead';deadTimer=2.4;flight=null;announce(reason,2.3);updateHUD();beep(720,.12);
}
function beginTackle(defender,downed=carrier,roll=Math.random()){
 if(playState!=='live'||carrier<0||carrier>=11||downed!==carrier||!Number.isInteger(defender)||defender<11||defender>=22)return false;
 const runner=players[carrier],other=players[defender];
 let direction=runner.velocity?.clone()||new THREE.Vector3();direction.y=0;
 if(direction.lengthSq()<.5)direction.subVectors(runner.root.position,other.root.position);direction.y=0;if(direction.lengthSq()<.01)direction.set(0,0,1);direction.normalize();
 if(other.contactCooldown>0)return false;
 const toward=other.root.position.clone().sub(runner.root.position).normalize().dot(direction);const style=toward>.4?'front':toward<-.55?'trip':'side';
 if(tackleBreaks({speed:runner.speed,leverage:toward,power:carrier===athleteIndex()?activeRatings.blocking:65,tackling:defender===athleteIndex()?activeRatings.tackling:65,roll})){
  other.contactCooldown=1.05;other.stumble=.8;runner.stumble=.4;catchGrace=.32;
  const away=new THREE.Vector3().subVectors(other.root.position,runner.root.position);away.y=0;if(away.lengthSq()<.01)away.set(1,0,0);away.normalize();other.root.position.addScaledVector(away,.55);other.velocity.multiplyScalar(.3);runner.velocity.multiplyScalar(.8);
  announce('BROKEN TACKLE · KEEP RUNNING',1.1);return false;
 }
 const initialPose=[runner,other].map(p=>({objects:[p.root,...p.limbs,...p.rig.elbows,...p.rig.knees,...p.rig.ankles],rotations:[p.root,...p.limbs,...p.rig.elbows,...p.rig.knees,...p.rig.ankles].map(o=>o.quaternion.clone()),y:p.root.position.y}));
 tackle={initialPose,carrier,defender,t:0,duration:style==='front'?1.45:style==='trip'?1.25:1.35,style,phase:'wrap',spot:runner.root.position.z,start:runner.root.position.clone(),otherStart:other.root.position.clone(),direction,yaw:Math.atan2(direction.x,direction.z)};
 playState='tackle';flight=null;for(const p of players){p.velocity?.set(0,0,0);p.speed=0;}
 if(role==='LB'&&defender===16)gameTackles++;
 announce(style==='trip'?'PURSUIT TACKLE':style==='side'?'WRAP & DRIVE':'SQUARE-UP TACKLE',1.3);updateHUD();return true;
}
function animateTackle(dt){
 tackle.t=Math.min(tackle.duration,tackle.t+dt);const t=tackle.t/tackle.duration;
 const runner=players[tackle.carrier],defender=players[tackle.defender];
 const contact=animateContact(THREE,{runner,defender,t,style:tackle.style,direction:tackle.direction,runnerStart:tackle.start,defenderStart:tackle.otherStart});tackle.phase=contact.phase;
 if(t<.22){const blend=THREE.MathUtils.smoothstep(t,0,.22);for(const pose of tackle.initialPose){for(let i=0;i<pose.objects.length;i++){const target=pose.objects[i].quaternion.clone();pose.objects[i].quaternion.slerpQuaternions(pose.rotations[i],target,blend);}pose.objects[0].position.y=THREE.MathUtils.lerp(pose.y,pose.objects[0].position.y,blend);}}
 attachFootball(runner);
 totalTime=Math.max(0,totalTime-dt);
 if(t>=1){const downed=tackle;playState='live';if(ballCarrierDown(carrier,downed.carrier,{grounded:downed.phase==='ground'}))finish('TACKLED',false,false,downed.spot);else{tackle=null;resetAthletePose(runner);resetAthletePose(defender);}}
}

function startSimulation(){
 const result=simulatePossession({difficulty:gameIndex,start:pendingPossession.start});pendingPossession=null;
 simulation={...result,t:0,duration:4.2,clockStart:totalTime,clockRun:Math.min(totalTime,result.seconds),complete:totalTime>=result.seconds};
 playState='simulation';const team=document.querySelector(role==='LB'?'.home b':'.away b').textContent;
 $('driveFeed').textContent=team+' TAKES POSSESSION';announce(team+' HAS THE BALL',2);updateHUD();
}
function updateSimulation(dt){
 simulation.t=Math.min(simulation.duration,simulation.t+dt);const f=simulation.t/simulation.duration;
 totalTime=Math.max(0,simulation.clockStart-simulation.clockRun*f);
 const team=document.querySelector(role==='LB'?'.home b':'.away b').textContent;const stage=f<.28?'TAKES THE FIELD':f<.62?'WORKING DOWNFIELD':'DRIVE IN PROGRESS';$('driveFeed').textContent=team+' · '+stage;
 if(f>=1){
  const points=simulation.complete?simulation.points:0;away+=points;
  const team=document.querySelector(role==='LB'?'.home b':'.away b').textContent;
  const result=simulation.complete?simulation.outcome:'CLOCK EXPIRES — DRIVE UNFINISHED';
  possessionLog.push({team,points,seconds:simulation.clockRun,outcome:result});$('driveFeed').textContent=team+' · '+result+' · '+Math.round(simulation.clockRun)+'s';
  announce(points?team+' +'+points:'DEFENSIVE STOP',2);simulation=null;drive.reset();playState='dead';deadTimer=2;runoffRemaining=0;updateHUD();
 }
}
function callForBall(){if(role==='WR'&&mode==='play'&&!paused&&playState==='live'&&carrier===0&&!passPlay){requestedPass=true;announce('CALL RECEIVED · QB READING THE ROUTE',1);if(playTime>=.9)throwBall(0);}}
$('callBall').onclick=callForBall;
$('skillButton').onclick=()=>startSkill();
function startSkill(side=0){
 if(mode!=='play'||paused||playState!=='live')return false;
 const moveSpec=skillMove({speed:activeRatings.speed,stamina,cooldown:jukeCooldown,active:!!juke});if(!moveSpec)return false;
 const index=controlledIndex(),runner=players[index],forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();
 const opponents=players.filter(p=>role==='LB'?p.index<11:p.index>=11);
 const nearest=opponents.reduce((best,p)=>!best||p.root.position.distanceTo(runner.root.position)<best.root.position.distanceTo(runner.root.position)?p:best,null);
 if(!side)side=keys.has('a')?-1:keys.has('d')?1:nearest&&nearest.root.position.clone().sub(runner.root.position).dot(right)>0?-1:1;
 juke={...moveSpec,index,side,elapsed:0,right,evaded:null};jukeCooldown=moveSpec.cooldown;stamina=Math.max(0,stamina-moveSpec.cost);
 // A well-timed cut can wrong-foot the nearest pursuer. Other defenders can
 // still tackle, and a cut into contact provides no invulnerability.
 if(carrier===index&&nearest&&nearest.root.position.distanceTo(runner.root.position)>1&&nearest.root.position.distanceTo(runner.root.position)<3.4){nearest.overcommit=.5;nearest.readTarget=runner.root.position.clone().addScaledVector(runner.velocity,.35);nearest.stumble=.45;juke.evaded=nearest.index;}
 announce(role==='WR'&&carrier!==index?'ROUTE CUT':role==='LB'?'LATERAL CUT':'JUKE '+(side<0?'LEFT':'RIGHT'),.7);return true;
}

function action(key){if(key==='skill'||key==='q'||(key==='e'&&role!=='LB'))startSkill(key==='q'?-1:key==='e'?1:0);if(key==='1'&&role==='LB')key='e';if(key==='p'&&mode==='play'){paused=!paused;announce(paused?'PAUSED':'PLAY RESUMED',paused?999:1);updateHUD();return;}if(key==='c'){wide=!wide;return;}if(key===' '||key==='snap')snap();if(key==='e'&&mode==='play'&&!paused&&role==='LB'&&playState==='live'&&tackleCooldown===0){tackleCooldown=1.5-activeRatings.tackling*.007;if(carrier>=0&&players[16].root.position.distanceTo(players[carrier].root.position)<1.2+activeRatings.tackling*.006){beginTackle(16);}}if(['1','2','3'].includes(key)){if(role==='WR')callForBall();else if(role==='QB')throwBall(Number(key)-1);}}
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(mode==='creator')return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();keys.add(k);if(!e.repeat){if(k==='tab'){selected=(selected+1)%3;updateHUD();}else action(k);}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(started&&mode==='play'){paused=true;announce('PAUSED · PRESS P TO RESUME',999);updateHUD();}});
$('start').onclick=()=>{careerActive=false;role=$('position').value;gameIndex=0;resetGame();start();};
$('pause').onclick=()=>{action('p');$('pause').textContent=paused?'RESUME':'PAUSE';};
function endGame(){
 if(careerActive){complete(career,{yards:role==='LB'?0:gameYards,td:role==='LB'?0:gameTD,comp:role==='LB'?0:gameComp,home:homeScore(),away:visitorScore(),tackles:gameTackles});saveCareer();}
 mode='summary';$('summary').hidden=false;
 recruit+=(role==='LB'?gameTackles*4:Math.max(0,gameYards)*.12+gameTD*12+gameComp*2)+(homeScore()>visitorScore()?20:0);
 const ratingStars=careerActive?stars(career):Math.max(1,Math.min(5,1+Math.floor(recruit/35)));
 $('resultTitle').textContent=careerActive?(career.games<=3?'HIGH SCHOOL RESULT':'COLLEGE GAME RESULT'):gameIndex===2?'YOUR RECRUITING GRADE':games[gameIndex].toUpperCase();
 const production=role==='LB'?gameTackles+' tackles':Math.round(gameYards)+' yards, '+gameTD+' touchdowns';
 const next=careerActive?(career.games===3?'National Signing Day: choose a scholarship in Recruitment.':career.games===15?'Four condensed college seasons complete.':'Return to your coach for the next game week.'):gameIndex===2?'Three challenges complete.':'Next challenge: '+games[gameIndex+1]+'.';
 $('resultText').textContent=($('name').value.trim()||'Jordan Hayes')+' · '+document.querySelector('.home b').textContent+' '+homeScore()+' – '+document.querySelector('.away b').textContent+' '+visitorScore()+'. '+production+'. '+possessionLog.length+' simulated possessions. '+'★'.repeat(ratingStars)+'☆'.repeat(5-ratingStars)+' prototype recruiting grade. '+next;
 $('next').textContent=careerActive?'RETURN TO CAREER →':gameIndex===2?'PLAY AGAIN →':'NEXT GAME →';
}

$('next').onclick=()=>{if(careerActive){showHub();return;}if(gameIndex===2){gameIndex=0;recruit=0;td=comp=attempts=yards=0;}else gameIndex++;resetGame();start();};
let career=null,careerActive=false;
let role="QB",stamina=1,gameTackles=0,catchGrace=0;
let crossedScrimmage=false,juke=null,jukeCooldown=0;
let playNumber=0,currentPlay=offensivePlay(0,'QB'),requestedPass=false,blockingPairs=[];
let currentDefense=defensiveFormation(0),assignments=defensiveAlignment(currentDefense,25),selectedOffense='auto',selectedDefense='auto';
let activeProfile=defaultProfile(),animationTime=0;
let activeRatings={speed:65,stamina:65,throwing:65,catching:65,tackling:65,blocking:65};
const roleDescriptions={QB:"Read coverage, pass with 1 / 2 / 3, or scramble. Shift sprints; Q/E jukes. Forward passes lock after crossing the blue line.",RB:"Take the handoff after the snap, find a gap, then use WASD to carry the ball. Shift sprints; Q/E jukes.",WR:"Run your own route with WASD. Use CALL FOR BALL or press 1 after the snap. Catch automatically in range, then run. Q/E cuts or jukes.",LB:"Control the middle linebacker. Read the run, cover underneath, or blitz. Close on the ball carrier to tackle. E gives a short tackle reach with a miss cooldown. Q makes a lateral cut."};
let tackleCooldown=0,tackle=null,pendingPossession=null,simulation=null,runoffRemaining=0;let possessionLog=[];
function athleteIndex(){return role==="LB"?16:role==="WR"?6:role==="RB"?10:0;}
function controlledIndex(){return role==="QB"&&carrier>=0&&carrier<11?carrier:athleteIndex();}
function selectCareerTab(tab){for(const t of ["Play","Recruitment","Player"]){const panel=$("panel"+t);if(t===tab&&panel.hidden)panel.scrollTop=0;panel.hidden=t!==tab;}for(const b of document.querySelectorAll("[data-tab]"))b.setAttribute("aria-selected",String(b.dataset.tab===tab));}
for(const b of document.querySelectorAll("[data-tab]"))b.onclick=()=>selectCareerTab(b.dataset.tab);
try{const saved=JSON.parse(localStorage.getItem('saturday-career-v1'));if(saved){const legacy={'Pine Valley State':'Auburn','Lakeview Tech':'Florida','Coastal Union':'Texas','Redwood University':'Georgia'};saved.school=legacy[saved.school]||saved.school;saved.position||='QB';saved.tackles||=0;saved.highSchool||='STATE';}if(validCareer(saved)){career=ensureDevelopment(saved);career.profile=normalizeProfile(saved.profile);}}catch{}
$('careerContinue').hidden=!career;
function saveCareer(){try{localStorage.setItem('saturday-career-v1',JSON.stringify(career));$('saveStatus').textContent='Progress saved in this browser after each completed game and coach meeting.';}catch{$('saveStatus').textContent='Browser storage unavailable. Keep this tab open to retain progress.';}}
function resetGame(){selectedOffense='auto';selectedDefense='auto';playNumber=0;requestedPass=false;tackle=null;simulation=null;pendingPossession=null;runoffRemaining=0;possessionLog=[];stamina=1;gameTackles=0;gameYards=gameTD=gameComp=0;drive.score=0;drive.reset();away=0;totalTime=180;paused=false;keys.clear();crossedScrimmage=false;juke=null;jukeCooldown=0;}
function home(){creator.close();document.body.dataset.screen='intro';mode='intro';paused=false;$('intro').hidden=false;$('summary').hidden=true;$('careerHub').hidden=true;$('careerContinue').hidden=!career;}
$('homeButton').onclick=()=>{if(mode==='play'&&!confirm('Return home? The current game will restart. Completed career games stay saved.'))return;home();};
$('careerHome').onclick=home;
const creator=createPlayerCreator(THREE,{
 renderer,environment:scene.environment,
 makeAthlete:()=>{const p=makePlayer(false,7,22);scene.remove(p.root);return p;},
 onSave:(data,editing)=>{
  if(editing){career.name=data.name;career.profile=data.profile;}
  else{if(career&&!confirm('Replace your saved career with this new athlete?'))return false;career=createCareer(data.name,data.position,data.archetype);career.profile=data.profile;}
  $('name').value=data.name;$('position').value=data.position;refreshArchetypes();$('archetype').value=data.archetype;describeArchetype();
  careerActive=true;saveCareer();showHub();return true;
 },
 onCancel:editing=>{if(editing&&career)showHub();else home();}
});
function openCreator(editing=false){mode='creator';paused=false;keys.clear();document.body.dataset.screen='creator';$('intro').hidden=true;$('careerHub').hidden=true;$('summary').hidden=true;creator.open(editing?career:{name:$('name').value,position:$('position').value,archetype:$('archetype').value,profile:defaultProfile()},{editing});}
$('careerStart').onclick=()=>openCreator(false);
$('editAppearance').onclick=()=>{if(career)openCreator(true);};

$('careerContinue').onclick=()=>{careerActive=true;showHub();};
function refreshArchetypes(){const list=archetypes[$('position').value];$('archetype').replaceChildren();for(const a of list){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;$('archetype').append(o);}describeArchetype();}
function describeArchetype(){$('archetypeDescription').textContent=archetypes[$('position').value].find(a=>a.id===$('archetype').value)?.description||'';}
$('position').addEventListener('change',refreshArchetypes);$('archetype').addEventListener('change',describeArchetype);refreshArchetypes();
function renderUpgrades(){
 ensureDevelopment(career);const role=career.position,ratings=playerAttributes(career),arch=archetypes[role].find(a=>a.id===career.archetype);
 $('developmentTitle').textContent=arch.name+' · '+availableXP(career)+' XP AVAILABLE';$('upgradeNote').textContent=career.games===0?'Complete your first game to unlock upgrades.':'Spend earned XP between games. Three levels per skill; each level raises its rating by four.';
 const list=$('upgrades');list.replaceChildren();
 for(const d of upgradeDefinitions.filter(d=>d.positions.includes(role))){
  const row=document.createElement('section');row.className='upgrade-row';const label=document.createElement('b');label.textContent=d.name+' · '+ratings[d.key]+' OVR · LV '+career.upgrades[d.key]+' / '+d.maxLevel;
  const detail=document.createElement('p');detail.textContent=d.description;const button=document.createElement('button');button.className='secondary';const cost=upgradeCost(career,d.key);button.textContent=Number.isFinite(cost)?'UPGRADE · '+cost+' XP':'MAX LEVEL';button.disabled=career.games===0||career.games>=15||!Number.isFinite(cost)||availableXP(career)<cost;
  button.dataset.upgrade=d.key;button.onclick=()=>{if(mode==='career'&&purchaseUpgrade(career,d.key)){saveCareer();renderUpgrades();$('careerMetrics').textContent='★'.repeat(stars(career))+' · TRUST '+career.trust+' · '+availableXP(career)+' XP AVAILABLE · '+career.wins+' WINS';}};
  row.append(label,detail,button);list.append(row);
 }
}

function showHub(){creator.close();selectCareerTab(career.games===3&&!career.school?'Recruitment':'Play');document.body.dataset.screen='career';mode='career';paused=false;$('intro').hidden=true;$('summary').hidden=true;$('careerHub').hidden=false;$('careerTitle').textContent=career.name.toUpperCase();
 const college=career.games>=3,finished=career.games>=15,year=Math.min(4,Math.floor((career.games-3)/3)+1);
 $('careerStage').textContent=finished?'CAREER COMPLETE':!college?(career.highSchool||'STATE')+' HIGH SCHOOL · '+games[career.games]:!career.school?'NATIONAL SIGNING DAY':career.school+' · YEAR '+year+' · GAME '+((career.games-3)%3+1)+' / 3';
 $('playerProfile').textContent=career.name+' · '+(career.position||'QB')+' · '+career.xp+' LIFETIME XP · '+(career.tackles||0)+' tackles · '+(career.school||career.highSchool||'STATE');$('appearanceSummary').textContent=profileSummary(career.profile);$('roleHelp').textContent=roleDescriptions[career.position||'QB'];renderUpgrades();
 $('careerMetrics').textContent='★'.repeat(stars(career))+' · COACH TRUST '+career.trust+' / 100 · '+availableXP(career)+' XP AVAILABLE · '+career.wins+' WINS';
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
const v=new THREE.Vector3();function move(p,x,z,speed,dt){v.set(x,0,z);if(v.lengthSq()>1)v.normalize();v.multiplyScalar(speed*(p.stumble>0?.72:1));if(juke&&juke.index===p.index){const u=juke.elapsed/juke.duration;v.addScaledVector(juke.right,juke.side*juke.distance*6*u*(1-u)/juke.duration);v.clampLength(0,8.4);}p.velocity??=new THREE.Vector3();p.velocity.lerp(v,1-Math.exp(-dt*9));p.root.position.addScaledVector(p.velocity,dt);p.speed=p.velocity.length();if(p.speed>.1){const target=Math.atan2(p.velocity.x,p.velocity.z);const diff=Math.atan2(Math.sin(target-p.root.rotation.y),Math.cos(target-p.root.rotation.y));p.root.rotation.y+=diff*(1-Math.exp(-dt*12));}}

function pursue(p,goal,speed,dt){const dx=goal.x-p.root.position.x,dz=goal.z-p.root.position.z;if(dx*dx+dz*dz>.12)move(p,dx,dz,speed,dt);else{p.speed=0;p.velocity?.set(0,0,0);}}
function buildPlayMenus(){
 $('offensePlay').replaceChildren();const auto=document.createElement('option');auto.value='auto';auto.textContent=role==='LB'?'Opponent play call':'COACH PICKS THE PLAY';$('offensePlay').append(auto);
 if(role!=='LB')for(const p of offensivePlays(role)){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$('offensePlay').append(o);}
 $('defensePlay').replaceChildren();const cpu=document.createElement('option');cpu.value='auto';cpu.textContent='AUTO / SITUATIONAL';$('defensePlay').append(cpu);
 for(const d of defensiveFormations){const o=document.createElement('option');o.value=d.id;o.textContent=d.name;$('defensePlay').append(o);}
}
function syncPlayMenus(){
 $('offensePlay').value=selectedOffense;$('offensePlay').disabled=role==='LB'||playState!=='ready';$('defensePlay').value=selectedDefense;$('defensePlay').disabled=role!=='LB'||playState!=='ready';
 $('formationRead').textContent=currentDefense.name+' · '+(role==='LB'?'Choose your defensive front':'Opponent defensive front');
}
$('offensePlay').onchange=()=>{if(mode==='play'&&playState==='ready'&&role!=='LB'){selectedOffense=$('offensePlay').value;formation();placeCamera(true);}};
$('defensePlay').onchange=()=>{if(mode==='play'&&playState==='ready'&&role==='LB'){selectedDefense=$('defensePlay').value;formation();placeCamera(true);}};
function assignBlocks(){
 const rush=assignments.filter(a=>a.assignment==='rush'||a.assignment==='blitz').map(a=>a.index),support=assignments.filter(a=>a.assignment==='zone').map(a=>a.index);
 const available=[...rush,...support];blockingPairs=[];
 for(let i=1;i<=5;i++){
  const front=available.filter(n=>rush.includes(n));const pool=front.length?front:available;if(!pool.length)break;
  pool.sort((a,b)=>players[i].home.distanceTo(players[a].home)-players[i].home.distanceTo(players[b].home));const target=pool[0];available.splice(available.indexOf(target),1);blockingPairs.push({blocker:i,defender:target});
 }
 if(currentPlay.type==='run'){const used=new Set(blockingPairs.map(p=>p.defender)),target=support.find(i=>!used.has(i))||16;blockingPairs.push({blocker:9,defender:target});}
}

function blockerGoal(pair){
 const b=players[pair.blocker],d=players[pair.defender];
 if(currentPlay.type==='run'){
  const gap=currentPlay.direction*(currentPlay.id.includes('stretch')?7:2.8),side=d.root.position.x<gap?-1:1;
  return new THREE.Vector3(d.root.position.x+side*.65,0,Math.max(drive.spot+Math.min(6,playTime*1.2),d.root.position.z-.8));
 }
 return new THREE.Vector3(THREE.MathUtils.clamp(d.root.position.x,b.home.x-1.8,b.home.x+1.8),0,drive.spot-.8-Math.min(1.2,playTime*.45));
}
function resolveBlocks(dt){
 for(const pair of blockingPairs){
  const b=players[pair.blocker],d=players[pair.defender],dist=b.root.position.distanceTo(d.root.position);
  const hold=currentPlay.type==='run'?2.8+(activeRatings.blocking-65)*.035:role==='WR'?5:3.8;
  pair.engaged=dist<1.45&&playTime<hold;
  if(!pair.engaged)continue;
  const offset=new THREE.Vector3().subVectors(d.root.position,b.root.position);offset.y=0;if(offset.lengthSq()<.01)offset.set(0,0,1);offset.normalize();
  if(dist<1.12)d.root.position.addScaledVector(offset,1.12-dist);
  if(currentPlay.type==='run'){const gap=currentPlay.direction*2.8;d.root.position.x+=(d.root.position.x<gap?-1:1)*dt*.65;d.root.position.z+=dt*.35;}
  d.velocity?.multiplyScalar(.35);
 }
}
function bestRead(){let best=0,value=-Infinity;for(let i=0;i<3;i++){const rec=players[6+i];let nearest=99;for(let j=15;j<22;j++)nearest=Math.min(nearest,rec.root.position.distanceTo(players[j].root.position));const score=nearest+(role==='WR'&&i===0?.8:0);if(score>value){value=score;best=i;}}return best;}
function pocketQB(dt){
 const qb=players[0];let danger=99,pressureX=0;for(const {index:i} of assignments.filter(a=>a.assignment==='rush'||a.assignment==='blitz')){const dist=qb.root.position.distanceTo(players[i].root.position);if(dist<danger){danger=dist;pressureX=players[i].root.position.x;}}
 const drop=qb.home.clone();drop.z-=Math.min(1.5,playTime*1.4);if(danger<3)drop.x+=pressureX>qb.root.position.x?-1.2:1.2;
 // Slide within the pocket; never turn a receiver career into an AI scramble.
 pursue(qb,drop,2.5,dt);
 if(role==='WR'){
  if(requestedPass&&playTime>=.9)throwBall(0);
  else if(!passPlay&&((playTime>3.2&&danger<2.2)||playTime>5.5))throwBall(bestRead());
 }else if(role==='LB'&&currentPlay.type==='pass'&&!passPlay&&playTime>=currentPlay.throwTime)throwBall(bestRead());
}
function configureAthletes(teamColor){
 const created=athleteIndex(),home=p=>role==='LB'?p.index>=11:p.index<11;
 for(const ownSide of [true,false]){
  const used=new Set(ownSide?[activeProfile.jersey]:[]);
  for(const p of players.filter(p=>home(p)===ownSide)){
   const isCreated=p.index===created;
   let number=isCreated?activeProfile.jersey:p.index===0?7:p.index<6?60+p.index:p.index<11?75+p.index:20+p.index;
   if(!isCreated){while(used.has(number))number=number%99+1;used.add(number);}
   const profile=isCreated?activeProfile:{...defaultProfile(),skinTone:skinTones[p.index%skinTones.length].id,jersey:number,visor:'none',sleeves:'none'};
   applyPlayerLook(THREE,p,profile,{teamColor:ownSide?teamColor:'#e8e8df'});
   const scale=isCreated?physique(profile):{x:1,y:1,z:1};p.root.scale.set(scale.x,scale.y,scale.z);p.carryHand=isCreated?profile.dominantHand:'right';
  }
 }
}
function attachFootball(player){
 if(!player?.rig)return;player.root.updateMatrixWorld(true);
 const side=player.carryHand==='left'?0:1;const hand=player.rig.elbows[side].localToWorld(new THREE.Vector3(0,-.21,.055));ball.position.copy(hand);ball.quaternion.copy(player.root.getWorldQuaternion(new THREE.Quaternion()));ball.rotateX(.35);
}
function step(dt,draw=true){
 if(mode==='creator'){creator.render(dt,draw);return;}
 animationTime+=paused?0:dt;
 if(bannerTimer>0){bannerTimer-=dt;if(bannerTimer<=0)$('banner').textContent='';}
 const pad=navigator.getGamepads?.()[0];let ax=0,az=0,sprint=keys.has('shift');if(pad){ax=Math.abs(pad.axes[0])>.17?pad.axes[0]:0;az=Math.abs(pad.axes[1])>.17?-pad.axes[1]:0;sprint||=pad.buttons[7]?.pressed||pad.buttons[10]?.pressed;for(const [i,k]of [[0,' '],[2,'1'],[3,'2'],[1,'3'],[9,'p'],[4,'c'],[5,'skill']]){if(pad.buttons[i]?.pressed&&!gamepadLatch[i])action(k);gamepadLatch[i]=pad.buttons[i]?.pressed;}}
 if(mode==='play'&&!paused){
 if(playState==='dead'){
  const runoff=Math.min(runoffRemaining,dt*2.5,totalTime);runoffRemaining-=runoff;totalTime-=runoff;deadTimer-=dt;
  if(deadTimer<=0){if(totalTime<=0)endGame();else if(pendingPossession)startSimulation();else formation();}updateHUD();
 }
 else if(playState==='tackle')animateTackle(dt);
 else if(playState==='simulation')updateSimulation(dt);
 if(playState==='live'){
 jukeCooldown=Math.max(0,jukeCooldown-dt);if(juke){juke.elapsed=Math.min(juke.duration,juke.elapsed+dt);if(juke.elapsed>=juke.duration){juke=null;}}
 for(const p of players){p.overcommit=Math.max(0,(p.overcommit||0)-dt);p.contactCooldown=Math.max(0,(p.contactCooldown||0)-dt);p.stumble=Math.max(0,(p.stumble||0)-dt);}
 totalTime=Math.max(0,totalTime-dt);playTime+=dt;catchGrace=Math.max(0,catchGrace-dt);tackleCooldown=Math.max(0,tackleCooldown-dt);stamina=THREE.MathUtils.clamp(stamina+(sprint?-(.28-activeRatings.stamina*.0013):.16)*dt,0,1);
 let x=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+ax,z=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+az;
 const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();const direction=forward.multiplyScalar(z).addScaledVector(right,x);
 const controlled=controlledIndex();move(players[controlled],direction.x,direction.z,movementSpeed(activeRatings.speed,{sprint,stamina}),dt);players[controlled].root.position.x=THREE.MathUtils.clamp(players[controlled].root.position.x,-28,28);if(carrier!==controlled){const pos=players[controlled].root.position;pos.z=THREE.MathUtils.clamp(pos.z,-8,108);if(pos.z===108||pos.z===-8)players[controlled].velocity.z=0;}
 if(carrier===0&&players[0].root.position.z>drive.spot)crossedScrimmage=true;
 if(currentPlay.type==='run'&&playTime>currentPlay.handoffTime&&carrier===0&&!passPlay){carrier=10;passPlay=true;announce('HANDOFF · '+currentPlay.name.toUpperCase(),1.2);}
 if(controlled!==0&&carrier===0&&!flight)pocketQB(dt);
 for(let i=1;i<11;i++){
  if(i===controlled)continue;const p=players[i];
  if(i===carrier){const lane=currentPlay.direction*(currentPlay.id.includes('stretch')?8:3);const goal=new THREE.Vector3(currentPlay.type==='run'&&p.root.position.z<drive.spot+3?lane:p.root.position.x,0,p.root.position.z+10);pursue(p,goal,6.05,dt);continue;}
  const block=blockingPairs.find(pair=>pair.blocker===i);
  if(block){pursue(p,blockerGoal(block),currentPlay.type==='run'?4.8:4.5,dt);continue;}
  if(currentPlay.type==='run'&&i>=6){const target=players[17+(i%3)];const goal=target.root.position.clone();goal.z-=.8;pursue(p,goal,5.2,dt);}
  else if(flight?.target===i)pursue(p,flight.end,6.2,dt);
  else{const goal=routePoint(currentPlay,i,p.home,{spot:drive.spot,time:playTime+.3});pursue(p,new THREE.Vector3(goal.x,0,goal.z),5.9,dt);p.routeSettled=p.speed===0&&drive.spot>=80&&playTime>1;if(p.routeSettled){const qb=players[0].root.position;p.root.rotation.y=Math.atan2(qb.x-p.root.position.x,qb.z-p.root.position.z);}}
 }

 for(let i=11;i<22;i++){
  if(i===controlled)continue;const p=players[i],job=assignments.find(a=>a.index===i),rusher=job.assignment==='rush'||job.assignment==='blitz';let goal;
  const runner=players[Math.max(0,carrier)],isRun=carrier>0&&!flight,qbScramble=carrier===0&&players[0].root.position.z>drive.spot+1;
  if(isRun||qbScramble){const v=runner.velocity||new THREE.Vector3(),target=pursuitTarget({index:i,runner:{x:runner.root.position.x,z:runner.root.position.z,vx:v.x,vz:v.z},defender:{x:p.root.position.x,z:p.root.position.z},spot:drive.spot,elapsed:playTime});goal=new THREE.Vector3(target.x,0,target.z);}
  else if(rusher){goal=players[0].root.position.clone();if(Math.abs(job.x)>3)goal.x+=Math.sign(job.x)*1.5;}
  else if(flight&&flight.t>.22&&p.root.position.distanceTo(flight.end)<14&&playTime>.7){goal=flight.end.clone();}
  else if(job.assignment==='man'){goal=players[job.cover].root.position.clone();goal.z+=2.1;}
  else if(job.assignment==='deep'){
   const receivers=players.slice(6,9).filter(r=>job.x===0||Math.sign(r.root.position.x)===Math.sign(job.x));const threat=receivers.reduce((a,b)=>!a||b.root.position.z>a.root.position.z?b:a,null);
   goal=new THREE.Vector3(job.zoneX,0,Math.max(job.zoneZ,(threat?.root.position.z||drive.spot)+3));if(threat)goal.x=THREE.MathUtils.lerp(job.zoneX,threat.root.position.x,.3);
  }else{goal=new THREE.Vector3(job.zoneX+THREE.MathUtils.clamp(players[0].root.position.x*.25,-3,3),0,job.zoneZ+Math.min(3,playTime*.5));}
  if(p.overcommit>0&&p.readTarget)goal.copy(p.readTarget);
  goal.z=THREE.MathUtils.clamp(goal.z,-8,108);goal.x=THREE.MathUtils.clamp(goal.x,-26,26);
  let speed=rusher?5.4:job.assignment==='man'?5.75:6.15;
  if(playTime<defensiveReaction(i,playNumber)+(job.assignment==='blitz'?.2:job.assignment==='man'?.12:0))speed=0;
  if(rusher)for(const pair of blockingPairs)if(pair.defender===i&&p.root.position.distanceTo(players[pair.blocker].root.position)<1.4){speed*=.48;break;}
  pursue(p,goal,speed,dt);
 }

 resolveBlocks(dt);
 for(const p of players)if(p.index!==carrier)p.root.position.z=THREE.MathUtils.clamp(p.root.position.z,-8,108);
 if(flight){flight.t+=dt;const a=Math.min(1,flight.t/flight.duration);ball.position.lerpVectors(flight.start,flight.end,a);ball.position.y+=Math.sin(a*Math.PI)*Math.max(2.5,flight.start.distanceTo(flight.end)*.16);ball.rotation.z+=dt*16;
  if(a>=1){const target=flight.target;let interceptor=-1;for(let i=11;i<22;i++)if(players[i].root.position.distanceTo(new THREE.Vector3(flight.end.x,0,flight.end.z))<1.1)interceptor=i;
   if(interceptor>=0&&players[target].root.position.distanceTo(new THREE.Vector3(flight.end.x,0,flight.end.z))>1.4){carrier=interceptor;flight=null;finish('INTERCEPTED',false,true);}else if(role==='WR'&&target===6?catchEligible(players[target].root.position,flight.end,activeRatings.catching):Math.hypot(players[target].root.position.x-flight.end.x,players[target].root.position.z-flight.end.z)<2.05){carrier=target;catchGrace=.3;comp++;gameComp++;flight=null;announce('CAUGHT · RUN WITH '+['WASD','THE LEFT STICK'][pad?1:0],1.2);beep(500,.08);}else{flight=null;finish('INCOMPLETE',true);}
  }
 }
 if(playState==='live'&&carrier>=0){const p=players[carrier].root.position;ball.position.copy(p).add(new THREE.Vector3(.26,1,.2));ball.rotation.set(.4,0,0);const boundary=liveBoundary({x:p.x,z:p.z});if(boundary)finish(boundary==='SAFETY_OUT'?'SAFETY':boundary==='OUT_OF_BOUNDS'?'OUT OF BOUNDS':boundary);else if(playTime>.8&&catchGrace<=0){for(let i=11;i<22;i++)if(players[i].contactCooldown<=0&&players[i].root.position.distanceTo(p)<.78){beginTackle(i);break;}}}
 // A live down continues after the game clock expires; only a dead ball ends it.
 updateHUD();
 }
 }
 if(playState==='ready')ball.position.copy(players[0].root.position).add(new THREE.Vector3(.25,1,.22));
 const focus=players[controlledIndex()].root.position;
 for(const p of players){
  if(tackle&&(p.index===tackle.carrier||p.index===tackle.defender))continue;
  const blocking=playState==='live'&&blockingPairs.some(pair=>pair.blocker===p.index&&pair.engaged);
  animateAthlete(THREE,p,{dt:paused?0:dt,time:animationTime,speed:p.speed,live:playState==='live'&&!paused,ballCarrier:p.index===carrier,handedness:p.carryHand||'right',blocking,settled:p.routeSettled,turn:0,stumble:p.stumble});
  if(juke&&juke.index===p.index&&playState==='live'){const lean=Math.sin(juke.elapsed/juke.duration*Math.PI);p.root.rotation.z-=juke.side*lean*.25;p.root.position.y-=lean*.045;}
 }
 if(carrier>=0&&playState!=='tackle'&&playState!=='simulation'&&!(tackle&&playState==='dead'))attachFootball(players[carrier]);

 activeRing.position.set(focus.x,.04,focus.z);receiverRing.position.set(players[6+selected].root.position.x,.05,players[6+selected].root.position.z);
 for(let i=0;i<3;i++){routeLabels[i].position.copy(players[6+i].root.position).add(new THREE.Vector3(0,2.6,0));routeLabels[i].visible=mode==='play'&&carrier===0&&!crossedScrimmage;}
 receiverRing.visible=mode==='play'&&carrier===0&&!crossedScrimmage;
 placeCamera(false,dt);
 $('skillButton').hidden=mode!=='play';$('skillButton').disabled=paused||playState!=='live'||stamina<.18||jukeCooldown>0;
 $('skillButton').firstChild.textContent=(jukeCooldown>0?jukeCooldown.toFixed(1)+'s':role==='LB'?'CUT':'JUKE')+' ';$('skillHint').textContent=role==='LB'?'Q / PAD RB':'Q · E / PAD RB';
 for(const b of document.querySelectorAll('#touch [data-action]'))if(['1','2','3'].includes(b.dataset.action))b.disabled=mode==='play'&&role==='QB'&&(playState!=='live'||carrier!==0||crossedScrimmage);
 $('callBall').disabled=mode!=='play'||paused||playState!=='live'||carrier!==0||passPlay||requestedPass;
 $('callBall').hidden=mode!=='play'||role!=='WR';
 $('driveFeed').hidden=mode!=='play'||!$('driveFeed').textContent.trim();$('playPicker').hidden=mode!=='play'||playState!=='ready';
 if(draw)renderer.render(scene,camera);
}
function placeCamera(immediate=false,dt=.04){
 const focus=players[controlledIndex()].root.position;let desired,look;
 if(mode==='intro'){const t=performance.now()*.00005;desired=new THREE.Vector3(42+Math.sin(t)*8,22,4);look=new THREE.Vector3(0,0,40);}
 else{const sign=role==='LB'?-1:1;desired=new THREE.Vector3(focus.x*(wide?.3:.8)+(wide?20:0),wide?26:10,focus.z-sign*(wide?28:16));look=new THREE.Vector3(focus.x,1,focus.z+sign*10);}
 if(immediate)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-dt*4));camera.lookAt(look);
}
// Batch static stadium and field boxes by material to reduce draw calls.
const batches=new Map();
for(const m of [...scene.children])if(m.isMesh&&m.geometry===boxGeo&&m!==lineScrim&&m!==lineGain){if(!batches.has(m.material))batches.set(m.material,[]);batches.get(m.material).push(m);}
for(const [material,meshes] of batches){const batch=new THREE.InstancedMesh(boxGeo,material,meshes.length);meshes.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);scene.remove(m);});batch.receiveShadow=true;scene.add(batch);}
formation();camera.position.set(42,22,4);$('loading').remove();let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// Read-only inspection for automated readiness checks; no developer controls in the player UI.
window.football={get state(){return {mode,creator:creator.state,profile:{...activeProfile},appearance:{number:players[athleteIndex()].number,carryHand:players[athleteIndex()].carryHand,scale:players[athleteIndex()].root.scale.toArray(),appliedProfile:{...players[athleteIndex()].root.userData.appliedProfile}},pose:{knees:players[controlledIndex()].rig.knees.map(k=>k.rotation.x),elbows:players[controlledIndex()].rig.elbows.map(k=>k.rotation.x)},playState,paused,carrier,crossedScrimmage,canPass:playState==='live'&&carrier===0&&!passPlay&&forwardPassAllowed({passerZ:players[0].root.position.z,scrimmageZ:drive.spot,crossed:crossedScrimmage}),skill:{cooldown:jukeCooldown,active:!!juke,side:juke?.side||0,evaded:juke?.evaded??null},players:players.length,flight:!!flight,spot:drive.spot,down:drive.down,role,defense:{...currentDefense},assignments:assignments.map(a=>({...a})),play:{...currentPlay},playTime,requestedPass,ratings:{...activeRatings},blocks:blockingPairs.map(p=>({...p})),controlled:controlledIndex(),stamina,tackles:gameTackles,score:drive.score,homeScore:homeScore(),awayScore:visitorScore(),playerTeam:document.querySelector('.home b').textContent,opponentTeam:document.querySelector('.away b').textContent,tackle:tackle?{t:tackle.t,style:tackle.style,phase:tackle.phase,carrier:tackle.carrier,defender:tackle.defender,spot:tackle.spot,pitch:players[tackle.carrier].root.rotation.x}:null,runoff:runoffRemaining,simulation:simulation?{t:simulation.t,seconds:simulation.clockRun}:null,possessions:possessionLog.map(p=>({...p})),cameraDirection:camera.getWorldDirection(new THREE.Vector3()).toArray(),attempts,comp,yards,time:totalTime,game:gameIndex+1,positions:players.map(p=>({x:p.root.position.x,z:p.root.position.z,speed:p.speed,settled:!!p.routeSettled}))};}};

// Export the drive model and formation reset for deterministic integration scenarios.
export {step,drive,formation,players,beginTackle};
