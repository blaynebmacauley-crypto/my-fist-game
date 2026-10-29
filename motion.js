// Procedural football motion on articulated joints; no external animation assets.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const TAU=Math.PI*2;

/** Split the original four limb chains at anatomical pivots without moving art. */
export function prepareAthleteRig(T,player){
 if(player.rig)return player;
 const rig={elbows:[],knees:[],ankles:[],basePositions:player.limbs.map(l=>l.position.clone())};
 for(let side=0;side<2;side++){
  const arm=player.limbs[side*2],leg=player.limbs[side*2+1];
  const elbow=new T.Group();elbow.name='Elbow';elbow.position.y=-.30;
  for(const mesh of [...arm.children])if(mesh.position.y<-.28){arm.remove(mesh);mesh.position.y+=.30;elbow.add(mesh);}
  arm.add(elbow);rig.elbows.push(elbow);
  const knee=new T.Group(),ankle=new T.Group();knee.name='Knee';ankle.name='Ankle';knee.position.y=-.40;ankle.position.y=-.32;
  for(const mesh of [...leg.children])if(mesh.position.y<-.42){
   leg.remove(mesh);
   if(mesh.position.y<-.72){mesh.position.y+=.72;ankle.add(mesh);}
   else{mesh.position.y+=.40;knee.add(mesh);}
  }
  knee.add(ankle);leg.add(knee);rig.knees.push(knee);rig.ankles.push(ankle);
 }
 player.rig=rig;player.motionState={phase:Number.isFinite(player.phase)?player.phase:0,blend:0};
 player.root.rotation.order='YXZ';
 return player;
}

/** Sagittal two-bone IK with separate planted and recovery portions of a stride. */
export function stridePose(speed,phase){
 speed=clamp(speed,0,8);phase=((Number.isFinite(phase)?phase:0)%TAU+TAU)%TAU;
 const intensity=clamp(speed/6,0,1),pelvisY=-.075*intensity,lean=.11*intensity;
 const stride=(.16+.035*speed)*intensity,cycle=phase/TAU,stance=cycle<.38;
 const u=stance?cycle/.38:(cycle-.38)/.62;
 const z=stance?mix(stride,-stride,u):mix(-stride,stride,smooth(u));
 const lift=stance?0:Math.sin(u*Math.PI)*(.11+.09*intensity);
 // Keeping the stance ankle at its original world height avoids bouncing feet.
 const desiredDown=.83-(.11-pelvisY+lift+Math.sin(lean)*z)/Math.cos(lean);
 const down=Math.min(desiredDown,Math.sqrt(Math.max(.04,.718*.718-z*z)));
 const l1=.40,l2=.32,r=Math.min(.718,Math.hypot(down,z));
 const knee=Math.acos(clamp((r*r-l1*l1-l2*l2)/(2*l1*l2),-1,1));
 const hip=Math.atan2(-z,down)-Math.atan2(l2*Math.sin(knee),l1+l2*Math.cos(knee));
 const ankle=-(hip+knee)-lean+(stance?0:-.13*Math.sin(u*Math.PI));
 return {hip,knee,ankle,pelvisY,lean,stance,footZ:z,footLift:lift};
}

export function resetAthletePose(player){
 const yaw=player.root.rotation.y;
 player.root.rotation.set(0,yaw,0,'YXZ');player.root.position.y=0;
 for(let i=0;i<player.limbs.length;i++){player.limbs[i].rotation.set(0,0,0);if(player.rig)player.limbs[i].position.copy(player.rig.basePositions[i]);}
 if(player.rig)for(const joint of [...player.rig.elbows,...player.rig.knees,...player.rig.ankles])joint.rotation.set(0,0,0);
 if(player.motionState)player.motionState.blend=0;
}

/** Speed-blended running, bent elbows, stance feet, knee recovery and ball tuck. */
export function animateAthlete(T,player,{dt=.016,time=0,speed=0,live=false,ballCarrier=false,blocking=false,settled=false,turn=0,stumble=0,handedness='right'}={}){
 if(!player.rig)prepareAthleteRig(T,player);
 dt=clamp(dt,0,.1);speed=live?clamp(speed,0,8):0;
 const state=player.motionState,desired=clamp(speed/2,0,1);
 state.blend=mix(state.blend,desired,1-Math.exp(-dt*12));
 if(speed>.05)state.phase=(state.phase+dt*TAU*(.9+speed*.24))%TAU;
 const left=stridePose(speed,state.phase),right=stridePose(speed,state.phase+Math.PI),blend=state.blend;
 const scaleY=player.root.scale?.y||1;
 player.root.position.y=left.pelvisY*blend*scaleY;
 player.root.rotation.x=.11*clamp(speed/6,0,1)*blend;
 player.root.rotation.z=clamp(turn,-1,1)*-.065*blend+Math.sin(state.phase)*.012*blend;
 for(let side=0;side<2;side++){
  const leg=player.limbs[side*2+1],arm=player.limbs[side*2],pose=side===0?left:right,sign=side===0?-1:1;
  leg.rotation.x=pose.hip*blend;leg.rotation.y=sign*.025*blend;leg.rotation.z=sign*.018*blend;
  player.rig.knees[side].rotation.x=pose.knee*blend;player.rig.ankles[side].rotation.x=pose.ankle*blend;
  arm.rotation.x=-pose.hip*.65*blend;arm.rotation.z=sign*.07;
  player.rig.elbows[side].rotation.x=mix(-.12,-1.0+Math.cos(state.phase+side*Math.PI)*.15,blend);
 }
 if(blocking){
  player.root.rotation.x=.16;player.root.position.y=-.055*scaleY;
  for(let side=0;side<2;side++){player.limbs[side*2].rotation.x=-.88;player.limbs[side*2].rotation.z=(side===0?-1:1)*.15;player.rig.elbows[side].rotation.x=-.7;}
 }else if(ballCarrier){
  // The selected hand pins the ball to the ribs; the free arm counter-swings.
  const side=handedness==='left'?0:1;player.limbs[side*2].rotation.x=-.28;player.limbs[side*2].rotation.z=side===0?-.16:.16;player.rig.elbows[side].rotation.x=-1.85;
 }else if(settled){
  for(let side=0;side<2;side++){player.limbs[side*2].rotation.x=-.25;player.rig.elbows[side].rotation.x=-.9;}
 }
 if(!live&&blend<.01){
  player.root.position.y=Math.sin((Number.isFinite(time)?time:0)*1.8+player.index)*.002;
 }
 if(stumble>0&&live){const wobble=Math.sin((1-stumble)*13)*Math.min(1,stumble*3);player.root.rotation.z+=wobble*.17;player.root.rotation.x+=.14*Math.min(1,stumble*3);}
 player.phase=state.phase;
 return player;
}

/** Multi-phase authored contact: wrap, drive, fall, then settle on the field. */
export function animateContact(T,{runner,defender,t=0,style='front',direction,runnerStart,defenderStart}){
 if(!runner.rig)prepareAthleteRig(T,runner);if(!defender.rig)prepareAthleteRig(T,defender);
 t=clamp(t,0,1);
 const start=runnerStart||runner.home||runner.root.position,otherStart=defenderStart||defender.home||defender.root.position;
 const dir=direction?.clone?direction.clone():new T.Vector3(0,0,1);dir.y=0;if(dir.lengthSq()<.001)dir.set(0,0,1);dir.normalize();
 const side=new T.Vector3(dir.z,0,-dir.x),sideSign=otherStart.clone().sub(start).dot(side)>=0?1:-1,yaw=Math.atan2(dir.x,dir.z);
 const wrap=smooth(t/.22),drive=smooth((t-.16)/.48),fall=smooth((t-.43)/.43),settle=smooth((t-.84)/.16);
 const travel=style==='trip'?.95:style==='side'?.78:.65;
 const runnerEnd=start.clone().addScaledVector(dir,travel).addScaledVector(side,style==='side'?sideSign*.38:sideSign*.08);
 runner.root.position.lerpVectors(start,runnerEnd,drive);
 const otherEnd=runnerEnd.clone().addScaledVector(dir,style==='front'?.35:-.55).addScaledVector(side,sideSign*(style==='side'?.42:.30));
 defender.root.position.lerpVectors(otherStart,otherEnd,smooth(t/.75));
 const runnerScale=runner.root.scale?.y||1,defenderScale=defender.root.scale?.y||1;
 runner.root.position.y=mix(-.10*wrap,.25,fall)*runnerScale;
 defender.root.position.y=mix(-.14*wrap,.24,fall)*defenderScale;
 const recoil=Math.sin(settle*Math.PI)*.025;
 const runnerPitch=(style==='front'?-1:1)*(.10*wrap+.28*drive+1.10*fall)+recoil;
 const defenderPitch=.30*wrap+(style==='front'?1.05:1.02)*fall;
 runner.root.rotation.set(runnerPitch,yaw,style==='side'?sideSign*.48*fall:sideSign*.10*fall,'YXZ');
 defender.root.rotation.set(defenderPitch,style==='front'?yaw+Math.PI:yaw+sideSign*.28,sideSign*.23*fall,'YXZ');
 for(let i=0;i<2;i++){
  // The tackler closes both arms around the waist before driving through contact.
  defender.limbs[i*2].rotation.x=-.90*wrap;
  defender.limbs[i*2].rotation.z=(i===0?1:-1)*.30*wrap;
  defender.rig.elbows[i].rotation.x=-1.2*wrap;
  defender.limbs[i*2+1].rotation.x=mix(-.22*wrap,-.08,fall)+(1-fall)*Math.sin(t*TAU*2+i*Math.PI)*.18*drive;
  defender.rig.knees[i].rotation.x=mix(.65*wrap,.22,fall);
  defender.rig.ankles[i].rotation.x=-defender.rig.knees[i].rotation.x*.5;
  runner.limbs[i*2+1].rotation.x=(i===0?-.10:.16)*wrap*(1-fall);
  runner.rig.knees[i].rotation.x=(i===0?.48:.72)*wrap*(1-fall)+.15*fall;
  runner.rig.ankles[i].rotation.x=-runner.rig.knees[i].rotation.x*.4;
  const carrySide=runner.carryHand==='left'?0:1;runner.limbs[i*2].rotation.x=i===carrySide?-.35*wrap:-.50*wrap;
  runner.rig.elbows[i].rotation.x=i===carrySide?-1.8*wrap:-.75*wrap;
 }
 runner.speed=0;defender.speed=0;
 return {phase:t<.22?'wrap':t<.55?'drive':t<.86?'fall':'ground',t};
}
