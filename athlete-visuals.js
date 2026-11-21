import {GLTFLoader} from './vendor/GLTFLoader.js';
import {normalizeProfile,skinTones} from './player-profile.js?v=broadcast12';

// Original project artwork, authored in Blender and delivered with the game.
// This glTF uses articulated object pivots, so hierarchy clones can safely share
// geometry and textures while each athlete keeps its own animation and colors.
const templates=new WeakMap();
const shared=new WeakMap();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const sourcePath=new URL('./assets/athlete.glb?v=broadcast12',import.meta.url).href;

function common(T){
 if(shared.has(T))return shared.get(T);
 const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=64;
 const contactContext=contactCanvas.getContext('2d'),gradient=contactContext.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.9)');gradient.addColorStop(.45,'rgba(255,255,255,.38)');gradient.addColorStop(1,'rgba(255,255,255,0)');contactContext.fillStyle=gradient;contactContext.fillRect(0,0,64,64);
 const contactTexture=new T.CanvasTexture(contactCanvas);
 const value={
  contactMaterial:new T.MeshBasicMaterial({color:'#000000',map:contactTexture,transparent:true,opacity:.22,depthWrite:false,toneMapped:false}),
  numberGeometry:new T.PlaneGeometry(.282,.238),
  visorGeometry:new T.CylinderGeometry(.126,.126,.072,24,1,true,-.92,1.84),
 };
 shared.set(T,value);return value;
}

/** A rejected load is retryable; callers decide how to present the error. */
export async function loadAthleteTemplate(T){
 if(templates.has(T))return templates.get(T);
 const promise=new GLTFLoader().loadAsync(sourcePath).then(gltf=>{
  let meshes=0,triangles=0,skinned=false;
  gltf.scene.traverse(node=>{
   if(!node.isMesh)return;
   meshes++;skinned||=!!node.isSkinnedMesh;
   const geometry=node.geometry;
   triangles+=(geometry.index?.count||geometry.getAttribute('position')?.count||0)/3;
  });
  if(skinned)throw new Error('Athlete asset unexpectedly requires skeleton cloning.');
  // The authoring export omits constant channels in the carry clip. Restore
  // its authored tucked-arm pose before deriving the mirrored left-hand clip.
  const animations=gltf.animations.map(clip=>clip.clone());
  const carry=animations.find(clip=>clip.name==='carry');
  if(carry){
   const basis=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);
   const upper=new T.Quaternion().setFromEuler(new T.Euler(-.25,-.16,-.06,'XYZ')).premultiply(basis).multiply(basis.clone().invert());
   for(const [node,quaternion]of [['upper_arm_R',upper],['forearm_R',new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-1.9)],['hand_R',new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.12)]]){
    const name=node+'.quaternion';if(!carry.tracks.some(track=>track.name===name))carry.tracks.push(new T.QuaternionKeyframeTrack(name,[0,carry.duration],[...quaternion.toArray(),...quaternion.toArray()]));
   }
  }
  const clips=animations.map(clip=>clip.name);
  for(const required of ['idle','run','carry','throw','catch','tackle']){
   if(!clips.includes(required))throw new Error('Athlete animation is missing: '+required);
  }
  if(!gltf.scene.getObjectByName('hand_R')||!gltf.scene.getObjectByName('hand_L'))throw new Error('Athlete hand anchors are missing.');
  return {
   scene:gltf.scene,animations,
   metadata:{loaded:true,path:'assets/athlete.glb',meshes,triangles:Math.round(triangles),clips,skinned:false,originalArt:true},
  };
 }).catch(error=>{templates.delete(T);throw error;});
 templates.set(T,promise);return promise;
}

// Reflect selected articulated rotations across the body's sagittal plane.
// This puts the carrying and throwing action on the actual selected hand.
function leftHandClip(clip,name){
 const result=clip.clone();result.name=name;
 for(const track of result.tracks){
  const split=track.name.lastIndexOf('.');
  const node=track.name.slice(0,split),property=track.name.slice(split+1);
  const isArm=/^(upper_arm|forearm|hand)_[LR]$/.test(node);
  if(isArm)track.name=node.replace(/_([LR])$/,(_,side)=>side==='L'?'_R':'_L')+'.'+property;
  if(property==='quaternion'&&(isArm||node==='spine')){
   for(let i=0;i<track.values.length;i+=4){track.values[i+1]*=-1;track.values[i+2]*=-1;}
  }
 }
 return result;
}

function roleFor(mesh,material){
 const kind=String(material.name||'').toLowerCase(),name=mesh.name.toLowerCase().replace(/\s+/g,'_');
 if(kind==='skin'&&/^upper_arm_[lr]$/.test(name))return 'upperArm';
 if(kind==='skin'&&/^forearm_[lr]$/.test(name))return 'forearm';
 return kind||'detail';
}

/** Replace only the old artwork. Existing collision/movement/rig groups remain. */
export function attachAthleteVisual(T,player,template,rawProfile,options={}){
 if(player.importedVisual){applyAthleteVisualLook(T,player,rawProfile,options);return player;}
 if(!player.root||!template?.scene)throw new Error('Cannot attach athlete artwork without a player and loaded template.');
 player.root.traverse(node=>{
  if(!node.isMesh)return;
  // Keep a soft ground contact shadow, never old helmets, hands, faces or pads.
  const shadow=node.geometry?.type==='CircleGeometry'&&node.material?.transparent;
  node.visible=!!shadow;if(shadow)node.material=common(T).contactMaterial;
 });
 const model=template.scene.clone(true);model.name='ImportedAthlete';
 const materials=new Map();
 model.traverse(node=>{
  if(!node.isMesh)return;
  node.castShadow=true;node.receiveShadow=true;
  const convert=source=>{
   const role=roleFor(node,source);
   if(!materials.has(role)){
    const material=source.clone();
    material.userData={...material.userData,athleteRole:role};
    materials.set(role,material);
   }
   return materials.get(role);
  };
  node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);
  if(node.name==='DefaultNumberFront'||node.name==='DefaultNumberBack')node.visible=false;
 });
 const mixer=new T.AnimationMixer(model),actions={};
 const legClip=template.animations.find(c=>c.name==='run').clone();legClip.name='legs';legClip.tracks=legClip.tracks.filter(track=>/^(thigh|shin|ankle)_[LR]\./.test(track.name)||track.name==='spine.position');
 const clips=[...template.animations,leftHandClip(template.animations.find(c=>c.name==='carry'),'carry_left'),leftHandClip(template.animations.find(c=>c.name==='throw'),'throw_left'),legClip];
 for(const clip of clips){
  const action=mixer.clipAction(clip);
  if(['throw','throw_left','catch','tackle'].includes(clip.name)){
   action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;
  }
  actions[clip.name]=action;
 }
 const numberCanvas=document.createElement('canvas');numberCanvas.width=numberCanvas.height=128;
 const numberTexture=new T.CanvasTexture(numberCanvas);numberTexture.colorSpace=T.SRGBColorSpace;
 const numberMaterial=new T.MeshBasicMaterial({map:numberTexture,transparent:true,alphaTest:.15,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
 const numberMeshes=[];
 for(const [anchorName,fallback] of [['jersey_front',[0,1.26,.177]],['jersey_back',[0,1.26,-.156]]]){
  const mesh=new T.Mesh(common(T).numberGeometry,numberMaterial);mesh.name='Jersey number '+anchorName;
  const anchor=model.getObjectByName(anchorName);
  if(anchor){anchor.add(mesh);mesh.position.z=.002;}
  else{model.add(mesh);mesh.position.set(...fallback);if(anchorName==='jersey_back')mesh.rotation.y=Math.PI;}
  numberMeshes.push(mesh);
 }
 const visor=new T.Mesh(common(T).visorGeometry,new T.MeshPhysicalMaterial({color:'#8597a8',transparent:true,opacity:.16,metalness:.05,roughness:.12,side:T.DoubleSide,depthWrite:false}));
 visor.name='Imported helmet visor';visor.position.set(0,.155,.018);
 (model.getObjectByName('head')||model).add(visor);
 player.root.add(model);
 let meshCount=0;model.traverse(node=>{if(node.isMesh)meshCount++;});
 player.importedVisual={
  model,mixer,actions,materials,meshCount,sourceMeshCount:template.metadata.meshes,
  clips:template.metadata.clips.slice(),availableAnimations:clips.map(clip=>clip.name),
  currentAnimation:'',lastAnimation:'',currentAction:'',handedness:'right',lastProfile:null,
  hands:{left:model.getObjectByName('hand_L'),right:model.getObjectByName('hand_R')},
  visor,numberCanvas,numberTexture,numberMeshes,numberKey:'',
  remaining:0,contact:false,phase:((Number(player.index)||0)*.371)%1,
  lastRequestedAction:null,metadata:{...template.metadata},blocking:false,
  poseNodes:['spine','upper_arm_L','upper_arm_R','forearm_L','forearm_R'].map(name=>model.getObjectByName(name)).filter(Boolean),
 };
 player.importedVisual.poseDefaults=player.importedVisual.poseNodes.map(node=>node.quaternion.clone());
 applyAthleteVisualLook(T,player,rawProfile,options);
 updateAthleteVisual(T,player,{dt:0,reset:true});
 return player;
}

/** Cosmetic updates reuse per-athlete materials/textures and never recolor teammates. */
export function applyAthleteVisualLook(T,player,rawProfile,{teamColor='#872039'}={}){
 const visual=player.importedVisual;if(!visual)return player;
 const profile=normalizeProfile(rawProfile),team=new T.Color(teamColor),skin=new T.Color(skinTones.find(t=>t.id===profile.skinTone)?.color||'#925a3d');
 const luminosity=team.r*.2126+team.g*.7152+team.b*.0722;
 const pants=new T.Color(luminosity>.55?'#20364c':'#ddd9c8');
 const gloves=profile.gloves==='team'?team:new T.Color(profile.gloves==='black'?'#111e29':'#eeeee6');
 for(const [role,material] of visual.materials){
  if(!material.color)continue;
  switch(role){
   case 'jersey':material.color.copy(team);material.roughness=.86;break;
   case 'pants':material.color.copy(pants);material.roughness=.87;break;
   case 'helmet':material.color.copy(team);material.roughness=profile.helmetFinish==='matte'?.74:.2;material.metalness=profile.helmetFinish==='matte'?.02:.14;material.envMapIntensity=profile.helmetFinish==='matte'?.4:1.15;break;
   case 'skin':material.color.copy(skin);material.roughness=.65;break;
   case 'upperArm':material.color.copy(profile.sleeves==='none'?skin:team);material.roughness=.8;break;
   case 'forearm':material.color.copy(profile.sleeves==='long'?team:skin);material.roughness=.8;break;
   case 'lip':material.color.copy(skin).multiplyScalar(.56);break;
   case 'gloves':material.color.copy(gloves);break;
   case 'seam':material.color.copy(team).multiplyScalar(.55);break;
  }
 }
 visual.visor.visible=profile.visor!=='none';visual.visor.material.color.set(profile.visor==='smoke'?'#10212d':'#a8c0cf');visual.visor.material.opacity=profile.visor==='smoke'?.68:.13;
 const numberKey=profile.jersey+':'+(luminosity>.55?'dark':'light');
 if(visual.numberKey!==numberKey){
  const context=visual.numberCanvas.getContext('2d');context.clearRect(0,0,128,128);
  context.textAlign='center';context.textBaseline='middle';context.font='900 112px Arial';
  context.lineWidth=3;context.strokeStyle=luminosity>.55?'#e9eee9':'#24313c';context.fillStyle=luminosity>.55?'#172a3a':'#fff9e9';
  context.strokeText(String(profile.jersey),64,70,120);context.fillText(String(profile.jersey),64,70,120);
  visual.numberTexture.needsUpdate=true;visual.numberKey=numberKey;
 }
 visual.handedness=profile.dominantHand;visual.lastProfile={...profile};visual.teamColor=teamColor;
 player.number=profile.jersey;player.carryHand=profile.dominantHand;
 return player;
}

function selectAnimation(T,visual,name,{reset=false,immediate=false}={}){
 const action=visual.actions[name]||visual.actions.idle;
 if(!action)return null;
 if(!reset&&visual.currentAnimation===name&&action.isRunning())return action;
 const previous=visual.actions[visual.currentAnimation];
 if(previous&&previous!==action){if(immediate)previous.stop();else previous.fadeOut(.12);}
 action.enabled=true;action.paused=false;action.setEffectiveWeight(1);action.setEffectiveTimeScale(1);action.reset();
 action.play();if(!immediate)action.fadeIn(.12);
 if(['run','carry','carry_left','idle'].includes(name))action.time=visual.phase*action.getClip().duration;
 visual.currentAnimation=name;visual.lastAnimation=name;
 return action;
}

/** Advance exactly once with the game's frame. Supplying contactT samples the
 * authored tackle; caller keeps the actor's world root upright during contact
 * because this imported animation already includes the full body fall. */
export function updateAthleteVisual(T,player,{dt=0,speed=0,live=false,ballCarrier=false,handedness,paused=false,contactT,contactPhase,contactStyle,action,reset=false,blocking=false}={}){
 const visual=player.importedVisual;if(!visual)return player;
 dt=Number.isFinite(dt)?clamp(dt,0,.1):0;
 if(handedness==='left'||handedness==='right')visual.handedness=handedness;
 if(reset){
  visual.mixer.stopAllAction();visual.poseNodes.forEach((node,index)=>node.quaternion.copy(visual.poseDefaults[index]));visual.blocking=false;visual.currentAnimation='';visual.currentAction='';visual.remaining=0;visual.contact=false;visual.lastRequestedAction=null;
  selectAnimation(T,visual,'idle',{reset:true,immediate:true});visual.actions.idle.time=0;visual.mixer.update(0);
  return player;
 }
 if(paused)return player;
 if(visual.blocking&&!blocking){visual.poseNodes.forEach((node,index)=>node.quaternion.copy(visual.poseDefaults[index]));visual.blocking=false;}
 if(Number.isFinite(contactT)){
  if(!visual.contact){visual.mixer.stopAllAction();visual.currentAnimation='';selectAnimation(T,visual,'tackle',{reset:true,immediate:true});}
  visual.contact=true;visual.currentAction='tackle';visual.contactPhase=contactPhase||'';visual.contactStyle=contactStyle||'front';
  const clipAction=visual.actions.tackle;clipAction.enabled=true;clipAction.paused=true;clipAction.time=clamp(contactT,0,.99999)*clipAction.getClip().duration;
  visual.mixer.update(0);return player;
 }
 if(visual.contact){
  visual.mixer.stopAllAction();visual.currentAnimation='';visual.currentAction='';visual.contact=false;
 }
 const requested=action==='throw'&&visual.handedness==='left'?'throw_left':action;
 if(requested&&requested!=='tackle'&&visual.actions[requested]&&visual.lastRequestedAction!==requested){
  visual.mixer.stopAllAction();visual.currentAnimation='';
  const clipAction=selectAnimation(T,visual,requested,{reset:true,immediate:true});clipAction.time=0;
  visual.currentAction=requested;visual.remaining=clipAction.getClip().duration;
 }
 visual.lastRequestedAction=requested||null;
 if(visual.remaining>0){
  const legs=visual.actions.legs;
  if(live&&speed>.18){if(!legs.isRunning()){legs.reset().play();legs.time=visual.phase*legs.getClip().duration;}legs.setEffectiveWeight(1);legs.setEffectiveTimeScale(clamp(speed/5.7,.55,1.5));}
  else legs.stop();
  visual.mixer.update(dt);visual.remaining=Math.max(0,visual.remaining-dt);
  if(visual.remaining<=0)visual.currentAction='';
  return player;
 }
 visual.actions.legs.stop();
 let name='idle';
 if(live&&speed>.18)name=ballCarrier?(visual.handedness==='left'?'carry_left':'carry'):'run';
 const clipAction=selectAnimation(T,visual,name);
 if(clipAction)clipAction.setEffectiveTimeScale(name==='idle'?1:clamp(speed/5.7,.55,1.5));
 visual.mixer.update(dt);
 if(blocking&&live){for(const node of visual.poseNodes){if(node.name==='spine')node.rotation.x=.14;else if(node.name.startsWith('upper_arm')){node.rotation.x=-.95;node.rotation.z=node.name.endsWith('_L')?-.1:.1;}else node.rotation.x=-.7;}visual.blocking=true;}
 return player;
}

/** Real animated wrist position, in world coordinates; returned vector is new. */
export function getAthleteHand(T,player,handedness){
 const visual=player.importedVisual;if(!visual)return null;
 const side=handedness||visual.handedness;
 const anchor=side==='left'?visual.hands.left:visual.hands.right;
 if(!anchor)return null;
 player.root.updateWorldMatrix(true,true);
 return anchor.localToWorld(new T.Vector3(0,-.025,.055));
}
