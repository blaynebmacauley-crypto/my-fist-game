// Small deterministic playbooks for the browser prototype. Distances are yards.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pass=(id,name,route,direction=1)=>({id,name,type:'pass',direction,route,handoffTime:.65,throwTime:route==='vertical'?3.9:route==='out'?3.3:route==='curl'?3.5:3.0});
const run=(id,name,direction=1)=>({id,name,type:'run',direction,route:'vertical',handoffTime:.72,throwTime:0});
const passes=[
 pass('slant','Quick Slant','slant'),pass('out','Deep Out','out',-1),
 pass('cross','Crossing Routes','cross'),pass('vertical','Four Verticals','vertical',-1),
 pass('curl','Curl / Flat','curl'),pass('corner','Corner Routes','corner',-1),
 pass('post','Deep Post','post'),pass('mesh','Mesh Crossers','mesh',-1),
];
const runs=[
 run('inside-zone','Inside Zone',1),run('stretch-left','Stretch Left',-1),
 run('power-right','Power Right',1),run('inside-zone-left','Inside Zone Left',-1),
 run('counter-left','Counter Left',-1),run('draw-right','Draw Right',1),
];
// Counter and draw delay the exchange so the new run calls differ in timing.
runs[4].handoffTime=1.0;runs[5].handoffTime=1.35;
const defensiveSeries=[runs[0],passes[0],runs[1],passes[2],runs[2],passes[1],passes[3],runs[3],passes[4],runs[4],passes[5],runs[5],passes[6],passes[7]];
const playbook=role=>role==='RB'?runs:role==='LB'?defensiveSeries:passes;

/** Independent copies are safe for the pre-snap play selection UI to retain. */
export function offensivePlays(role='QB'){
 return playbook(role).map(p=>({...p}));
}
export function offensivePlay(sequence=0,role='QB'){
 if(!Number.isFinite(sequence))throw new TypeError('Play sequence must be finite');
 const book=playbook(role);
 const index=((Math.floor(sequence)%book.length)+book.length)%book.length;
 return {...book[index]};
}

/**
 * Routes have a stem, a break, and a terminal landmark. In the red zone the stem
 * shortens and each receiver sits in available end-zone space instead of running
 * through the back line or continuing to drift sideways along it.
 */
export function routePoint(play,receiverIndex,home,{spot=home?.z,time=0}={}){
 if(!home||!Number.isFinite(home.x)||!Number.isFinite(home.z)||!Number.isFinite(time)||!Number.isFinite(spot))throw new TypeError('Route coordinates and time must be finite');
 const slot=clamp(Math.floor(receiverIndex-6),0,4),inside=home.x<=0?1:-1;
 const route=slot===0?play.route:slot===1?(play.route==='vertical'?'out':'vertical'):slot===2?(play.route==='mesh'?'mesh':'cross'):'out';
 const redZone=spot>=80,depth=103+slot,space=Math.max(0,depth-home.z);
 const stemScale=redZone?clamp(space/24,.25,1):1;
 const finishTime=redZone?clamp(space/5+1.2,2.2,6):Infinity;
 const t=Math.min(Math.max(0,time),finishTime);
 let x=home.x,z=home.z;
 if(route==='vertical'){
  z+=Math.min(45,t*6);x+=inside*Math.min(2,Math.max(0,t-4)*.5);
 }else if(route==='slant'){
  const stem=1.05*stemScale;z+=Math.min(6*stemScale,t*5.7)+Math.min(34,Math.max(0,t-stem)*4.7);x+=inside*Math.min(15,Math.max(0,t-stem)*3.2);
 }else if(route==='cross'){
  const stem=.85*stemScale;z+=Math.min(5*stemScale,t*5.8)+Math.min(20,Math.max(0,t-stem)*2.1);x+=inside*Math.min(35,Math.max(0,t-stem)*5.1);
 }else if(route==='curl'){
  const stem=1.9*stemScale;
  z+=Math.min(11*stemScale,t*5.8)-Math.min(2*stemScale,Math.max(0,t-stem)*2);
  x+=inside*Math.min(1.5,Math.max(0,t-stem)*1.2);
 }else if(route==='corner'||route==='post'){
  const stem=1.7*stemScale;
  z+=Math.min(10*stemScale,t*5.8)+Math.min(32,Math.max(0,t-stem)*4.6);
  x+=(route==='post'?inside:-inside)*Math.min(15,Math.max(0,t-stem)*3.1);
 }else if(route==='mesh'){
  const stem=.5*stemScale;
  z+=Math.min(3*stemScale,t*5.8)+Math.min(8,Math.max(0,t-stem)*1.2);
  x+=inside*Math.min(36,Math.max(0,t-stem)*5.5);
 }else{
  const stem=(slot>=3?.45:1.45)*stemScale;
  z+=Math.min((slot>=3?2.6:8.5)*stemScale,t*5.8)+Math.min(9,Math.max(0,t-stem)*1.2);x-=inside*Math.min(12,Math.max(0,t-stem)*5.2);
 }
 return {x:clamp(x,-25.3,25.3),z:clamp(z,-8,redZone?depth:108)};
}

/** Lead the actual receiver velocity, including sideways/backward user movement. */
export function predictReceiver(position,velocity,duration,{controlled=false,throwing=65}={}){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z)||!Number.isFinite(duration))throw new TypeError('Pass position and duration must be finite');
 const vx=Number.isFinite(velocity?.x)?velocity.x:0,vz=Number.isFinite(velocity?.z)?velocity.z:0;
 const skill=clamp(Number.isFinite(throwing)?throwing:65,30,99);
 // A controlled WR may change direction. Avoid excessive leading rather than
 // assuming they keep running toward the opponent's end zone.
 const lead=clamp(duration,0,2)*(controlled ? .86+.12*(skill/99) : .9+.08*(skill/99));
 const maxLead=10;
 return {x:clamp(position.x+clamp(vx*lead,-maxLead,maxLead),-25.3,25.3),z:clamp(position.z+clamp(vz*lead,-maxLead,maxLead),-8,108)};
}
