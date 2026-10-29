import {normalizeProfile,skinTones} from './player-profile.js?v=playfix9';
// Original procedural art for the browser prototype. No external textures/assets.
const caches=new WeakMap();
function assets(T){
 if(caches.has(T))return caches.get(T);
 const canvas=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 let seed=45619;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const cloth=canvas(128),cc=cloth.getContext('2d');cc.fillStyle='#808080';cc.fillRect(0,0,128,128);for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){cc.fillStyle=(x+y)%8?'#9b9b9b':'#666';cc.fillRect(x,y,2,3);}
 const fabric=new T.CanvasTexture(cloth);fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(6,5);
 const seams=canvas(128),pc=seams.getContext('2d');pc.fillStyle='#fff';pc.fillRect(0,0,128,128);pc.fillStyle='#e1e0dc';pc.fillRect(23,0,5,128);pc.fillRect(100,0,5,128);pc.fillStyle='#bfc0bc';for(let y=0;y<128;y+=8){pc.fillRect(23,y,1,4);pc.fillRect(104,y,1,4);}const pantsSeams=new T.CanvasTexture(seams);pantsSeams.colorSpace=T.SRGBColorSpace;
 const glowCanvas=canvas(128),g=glowCanvas.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,248,211,.75)');gradient.addColorStop(.14,'rgba(255,233,180,.28)');gradient.addColorStop(1,'rgba(255,212,135,0)');g.fillStyle=gradient;g.fillRect(0,0,128,128);
 const glow=new T.CanvasTexture(glowCanvas);glow.colorSpace=T.SRGBColorSpace;
 const a={canvas,random,fabric,pantsSeams,glow,sphere:new T.SphereGeometry(1,12,8),tubeMaterial:new T.MeshStandardMaterial({color:'#b8c2c8',roughness:.32,metalness:.65}),white:new T.MeshStandardMaterial({color:'#e9e5df',roughness:.7}),dark:new T.MeshStandardMaterial({color:'#16202b',roughness:.7}),neutral:new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.68}),eyeWhite:new T.MeshStandardMaterial({color:'#c9c0b6',roughness:.6}),eyeDark:new T.MeshStandardMaterial({color:'#29231e',roughness:.55}),brow:new T.MeshStandardMaterial({color:'#392b24',roughness:.9}),lip:new T.MeshStandardMaterial({color:'#644537',roughness:.85})};
 caches.set(T,a);return a;
}
function ellipsoid(T,parent,geometry,material,p,s){const m=new T.Mesh(geometry,material);m.position.set(...p);m.scale.set(...s);m.castShadow=true;parent.add(m);return m;}
function curved(T,parent,points,radius,material){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const mesh=new T.Mesh(new T.TubeGeometry(curve,12,radius,5,false),material);mesh.castShadow=true;parent.add(mesh);return mesh;}
// Batch opaque pieces without crossing an articulated joint. Materials stay
// shared with the game so team recoloring and jersey textures still work.
function batchOpaqueParts(T,container){
 const neutral=assets(T).neutral,groups=new Map();
 for(const mesh of [...container.children]){
  if(!mesh.isMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.opacity<1||mesh.morphTargetInfluences)continue;
  const material=mesh.material;const fixedNeutral=!['jersey','pants','helmet'].includes(mesh.userData.lookRole)&&!material.map&&!material.bumpMap&&!material.normalMap&&material.metalness<.05&&!['872039','e8e8df','e3ded0','1c354d'].includes(material.color?.getHexString());
  const key=fixedNeutral?neutral:material;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 }
 for(const [material,meshes]of groups){
  if(meshes.length<2)continue;
  const parts=meshes.map(mesh=>{mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();return geometry;});
  const count=parts.reduce((n,g)=>n+g.getAttribute('position').count,0),geometry=new T.BufferGeometry();
  for(const [name,size]of [['position',3],['normal',3],['uv',2]]){
   const joined=new Float32Array(count*size);let offset=0;
   for(const part of parts){const attr=part.getAttribute(name),length=part.getAttribute('position').count;
    if(attr)for(let i=0;i<length;i++){joined[offset+i*size]=attr.getX(i);joined[offset+i*size+1]=attr.getY(i);if(size===3)joined[offset+i*size+2]=attr.getZ(i);}
    offset+=length*size;
   }
   geometry.setAttribute(name,new T.BufferAttribute(joined,size));
  }
  if(material===neutral){const colors=new Float32Array(count*3);let at=0;const ranges=[];for(let i=0;i<meshes.length;i++){const color=meshes[i].material.color,n=parts[i].getAttribute('position').count;ranges.push({start:at/3,count:n,role:meshes[i].userData.lookRole||null,color:[color.r,color.g,color.b]});for(let j=0;j<n;j++){colors[at++]=color.r;colors[at++]=color.g;colors[at++]=color.b;}}geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.userData.lookRanges=ranges;}
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const merged=new T.Mesh(geometry,material);merged.name='Athlete material batch';merged.userData.lookRole=meshes.every(m=>m.userData.lookRole===meshes[0].userData.lookRole)?meshes[0].userData.lookRole:null;merged.castShadow=meshes.some(m=>m.castShadow);merged.receiveShadow=meshes.some(m=>m.receiveShadow);
  for(const mesh of meshes)container.remove(mesh);container.add(merged);for(const part of parts)part.dispose();
 }
}
// Subtract the face aperture by clipping triangles to exact boundary planes.
// Keeping the outside partitions produces continuous brow/side/chin edges,
// rather than the stepped teeth from dropping whole intersecting triangles.
function helmetShellGeometry(T){
 const sphere=new T.SphereGeometry(1,32,24),source=sphere.toNonIndexed();sphere.dispose();
 const position=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv');
 const positions=[],normals=[],uvs=[],planes=[v=>v.p[2]-.48,v=>.4-v.p[1],v=>v.p[1]+.79];
 const lerp=(a,b,t)=>({p:a.p.map((v,i)=>v+(b.p[i]-v)*t),n:a.n.map((v,i)=>v+(b.n[i]-v)*t),uv:a.uv.map((v,i)=>v+(b.uv[i]-v)*t)});
 function split(polygon,plane){
  const inside=[],outside=[];let previous=polygon[polygon.length-1],d0=plane(previous),wasInside=d0>=0;
  for(const current of polygon){const d1=plane(current),isInside=d1>=0;
   if(isInside!==wasInside){const intersection=lerp(previous,current,d0/(d0-d1));inside.push(intersection);outside.push(intersection);}
   (isInside?inside:outside).push(current);previous=current;d0=d1;wasInside=isInside;
  }
  return [inside,outside];
 }
 function append(polygon){for(let i=1;i+1<polygon.length;i++)for(const v of [polygon[0],polygon[i],polygon[i+1]]){positions.push(...v.p);const length=Math.hypot(...v.n)||1;normals.push(v.n[0]/length,v.n[1]/length,v.n[2]/length);uvs.push(...v.uv);}}
 for(let i=0;i<position.count;i+=3){let remaining=[];for(let j=0;j<3;j++){const k=i+j;remaining.push({p:[position.getX(k),position.getY(k),position.getZ(k)],n:[normal.getX(k),normal.getY(k),normal.getZ(k)],uv:[uv.getX(k),uv.getY(k)]});}
  for(const plane of planes){if(remaining.length<3)break;const [inside,outside]=split(remaining,plane);append(outside);remaining=inside;}
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));result.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));result.computeBoundingBox();result.computeBoundingSphere();source.dispose();return result;
}
export function enhanceAthlete(T,player){
 const a=assets(T),{root,limbs}=player;
 root.traverse(m=>{
  if(!m.isMesh||!m.material?.color)return;
  const color=String(m.userData.baseColor||m.material.color.getHexString()).replace(/^#/,'');
  if(m.geometry.type==='CylinderGeometry'&&['872039','e8e8df','e3ded0','1c354d'].includes(color)){
   m.material.bumpMap=a.fabric;m.material.bumpScale=.009;m.material.roughness=.86;m.material.needsUpdate=true;
  }
  if(['e3ded0','1c354d'].includes(color)&&m.material.bumpMap===a.fabric){m.material.map=a.pantsSeams;m.material.needsUpdate=true;}
  if(['8a1d37','1e3b57'].includes(color)&&m.material.metalness>.1){
   m.material.roughness=.2;m.material.metalness=.15;m.material.envMapIntensity=1.1;
   if(!a.helmetShell)a.helmetShell=helmetShellGeometry(T);
   m.geometry=a.helmetShell;
  }
  if(m.geometry.type==='CylinderGeometry'&&Math.abs(m.position.x)>.25&&m.position.y>1.3&&m.position.y<1.45){if(!a.shoulderPad){a.shoulderPad=new T.CapsuleGeometry(.1,.16,4,10);a.shoulderPad.rotateZ(Math.PI/2);}m.geometry=a.shoulderPad;m.scale.set(1,1,1.6);}
  if(color==='e7e9df'){m.scale.x*=.78;m.scale.y*=.9;m.scale.z*=.85;}
 });
 // Replace straight cage bars with rounded steel tubes; keep the existing head.
 for(const m of [...root.children]){
  if(!m.isMesh||m.geometry.type!=='BoxGeometry')continue;
  const color=m.material?.color?.getHexString();
  if(color==='c6c6bc'||(color==='131a20'&&m.position.y>1.7)||(color==='eee7db'&&m.position.y>1.9))root.remove(m);
 }
 curved(T,root,[[-.17,1.74,.14],[-.18,1.68,.27],[0,1.65,.29],[.18,1.68,.27],[.17,1.74,.14]],.012,a.tubeMaterial);
 curved(T,root,[[-.16,1.7,.18],[-.17,1.6,.26],[0,1.58,.28],[.17,1.6,.26],[.16,1.7,.18]],.011,a.tubeMaterial);
 for(const x of [-.1,.1])curved(T,root,[[x,1.74,.245],[x,1.67,.29],[x*.9,1.59,.28]],.009,a.tubeMaterial);
 curved(T,root,[[0,1.63,-.17],[0,1.87,-.18],[0,2.005,.015],[0,1.91,.2]],.018,a.white);
 // Small opaque features follow the curved skin surface. There is no flat
 // facial decal or floating rectangle in front of the helmet opening.
 const skinSurface=root.children.find(m=>m.isMesh&&Math.abs(m.position.y-1.71)<.01&&Math.abs(m.position.z-.12)<.01);
 const faceSkin=skinSurface?.material||new T.MeshStandardMaterial({color:'#925a3d',roughness:.7});
 const faceZ=(x,y)=>.12+.11*Math.sqrt(Math.max(.03,1-(x/.13)**2-((y-1.71)/.13)**2));
 for(const side of [-1,1]){
  const x=side*.043,y=1.752,z=faceZ(x,y);
  ellipsoid(T,root,a.sphere,a.eyeWhite,[x,y,z+.001],[.014,.006,.0035]);
  ellipsoid(T,root,a.sphere,a.eyeDark,[x,y,z+.004],[.0048,.0049,.0017]);
  const browPoints=[[-.016,.001],[0,.004],[.016,.001]].map(([dx,dy])=>[x+dx,1.768+dy,faceZ(x+dx,1.768+dy)+.0015]);
  curved(T,root,browPoints,.0019,a.brow);
  ellipsoid(T,root,a.sphere,faceSkin,[side*.123,1.704,.103],[.013,.023,.013]);
 }
 ellipsoid(T,root,a.sphere,faceSkin,[0,1.725,.229],[.011,.022,.013]);
 ellipsoid(T,root,a.sphere,faceSkin,[0,1.704,.24],[.014,.009,.012]);
 for(const x of [-.007,.007])ellipsoid(T,root,a.sphere,a.brow,[x,1.699,.248],[.0025,.0015,.001]);
 const mouth=new T.CatmullRomCurve3([new T.Vector3(-.021,1.671,faceZ(-.021,1.671)+.001),new T.Vector3(0,1.669,faceZ(0,1.669)+.001),new T.Vector3(.021,1.671,faceZ(.021,1.671)+.001)]);
 const lip=new T.Mesh(new T.TubeGeometry(mouth,8,.0016,4,false),a.lip);lip.userData.lookRole='lip';root.add(lip);
 ellipsoid(T,root,a.sphere,a.white,[0,1.58,.14],[.08,.035,.06]);
 // Rounded kneepads, sock bands and cleat soles move with the original rig.
 for(const i of [1,3]){
  const side=i===1?0:1,knee=player.rig?.knees?.[side]||limbs[i],ankle=player.rig?.ankles?.[side]||limbs[i];ellipsoid(T,knee,a.sphere,a.white,[0,player.rig?.knees?.[side]?.isGroup ? .05 : -.35,.095],[.092,.105,.045]);
  ellipsoid(T,ankle,a.sphere,a.dark,[0,player.rig?.ankles?.[side]?.isGroup?-.089:-.809,.075],[.104,.019,.19]);
 }
 for(const i of [0,2]){
  const side=i===0?0:1,wrist=player.rig?.elbows?.[side]||limbs[i];ellipsoid(T,wrist,a.sphere,a.dark,[0,player.rig?.elbows?.[side]?.isGroup?-.16:-.46,.035],[.083,.027,.083]);
 }
 // Mark editable surfaces before neutral batching; all other athletes retain
 // their shared default materials. Numbers stay transparent; faces are opaque.
 const skinPalette=new Set(['925a3d','c68c66','603b2c','d3a582']);
 const numbers=[];
 root.traverse(m=>{
  if(!m.isMesh||!m.material?.color)return;const color=String(m.userData.baseColor||m.material.color.getHexString()).replace(/^#/,'');
  if(skinPalette.has(color)){
   m.userData.lookRole='skin';
   for(const i of [0,2]){let parent=m.parent;while(parent&&parent!==root){if(parent===limbs[i]){m.userData.lookRole=m.parent===limbs[i]?'upperArm':'lowerArm';break;}parent=parent.parent;}}
  }
  if(color==='e7e9df')m.userData.lookRole='gloves';
  if(m.material.bumpMap===a.fabric&&['872039','e8e8df'].includes(color))m.userData.lookRole='jersey';
  if(m.material.bumpMap===a.fabric&&['e3ded0','1c354d'].includes(color))m.userData.lookRole='pants';
  if(['8a1d37','1e3b57'].includes(color)&&m.material.metalness>.1)m.userData.lookRole='helmet';
  if(m.material.transparent&&m.material.map&&m.geometry.parameters?.width===.36){m.userData.lookRole='number';numbers.push(m);}
 });
 const visor=new T.Mesh(new T.CylinderGeometry(.212,.212,.105,14,1,true,-.77,1.54),new T.MeshPhysicalMaterial({color:'#8ba1b0',transparent:true,opacity:.16,roughness:.1,metalness:.05,side:T.DoubleSide,depthWrite:false}));visor.position.set(0,1.77,.025);visor.visible=false;visor.name='Optional helmet visor';root.add(visor);
 root.userData.playerLook={numbers,visor,clonedMaterials:new Map(),numberCanvas:null,numberTexture:null};
 const before=[];root.traverse(m=>{if(m.isMesh)before.push(m);});
 const joints=[];root.traverse(o=>{if(o.isGroup)joints.push(o);});
 for(const joint of joints)batchOpaqueParts(T,joint);
 let after=0;root.traverse(m=>{if(m.isMesh)after++;});
 root.userData.presentationBatch={before:before.length,after};
 return player;
}
// Update only this athlete's appearance. Reuses color buffers/material clones,
// a single number canvas, and the original equipment meshes on repeated edits.
export function applyPlayerLook(T,player,rawProfile,{teamColor='#872039'}={}){
 const profile=normalizeProfile(rawProfile),a=assets(T),look=player.root.userData.playerLook;
 if(!look)return player;
 const skin=new T.Color(skinTones.find(t=>t.id===profile.skinTone)?.color||'#925a3d'),team=new T.Color(teamColor),glove=new T.Color(profile.gloves==='black'?'#18212b':profile.gloves==='team'?teamColor:'#efeee8');
 const lip=skin.clone().multiplyScalar(.58);
 const colorFor=role=>role==='skin'?skin:role==='lip'?lip:role==='gloves'?glove:role==='upperArm'?(profile.sleeves==='none'?skin:team):role==='lowerArm'?(profile.sleeves==='long'?team:skin):null;
 player.root.traverse(m=>{
  if(!m.isMesh||!m.material)return;
  const ranges=m.geometry.userData.lookRanges,colors=m.geometry.getAttribute('color');
  if(ranges&&colors){let changed=false;for(const range of ranges){const color=colorFor(range.role);if(!color)continue;for(let i=range.start;i<range.start+range.count;i++)colors.setXYZ(i,color.r,color.g,color.b);changed=true;}if(changed)colors.needsUpdate=true;}
  const role=m.userData.lookRole;
  if(role==='number'||!role||ranges)return;
  let target=colorFor(role);if(role==='jersey'||role==='helmet')target=team;
  if(role==='pants')return;
  if(!target)return;
  let material=look.clonedMaterials.get(m.material);
  if(!material){material=m.material.clone();look.clonedMaterials.set(m.material,material);look.clonedMaterials.set(material,material);}m.material=material;material.color.copy(target);
  if(role==='helmet'){material.roughness=profile.helmetFinish==='matte'?.78:.18;material.metalness=profile.helmetFinish==='matte'?.02:.15;material.envMapIntensity=profile.helmetFinish==='matte'?.3:1.1;}
 });
 look.teamColor=teamColor;setJerseyNumber(T,player,profile.jersey);
 look.visor.visible=profile.visor!=='none';look.visor.material.opacity=profile.visor==='smoke'?.74:.16;look.visor.material.color.set(profile.visor==='smoke'?'#172735':'#9bb2bf');
 player.number=profile.jersey;player.root.userData.appliedProfile={...profile};
 return player;
}
export function setJerseyNumber(T,player,number){
 const look=player.root.userData.playerLook;if(!look)return player;
 const a=assets(T),jersey=Math.max(1,Math.min(99,Math.round(Number(number)||7)));
 if(!look.numberCanvas){look.numberCanvas=a.canvas(128);look.numberTexture=new T.CanvasTexture(look.numberCanvas);look.numberTexture.colorSpace=T.SRGBColorSpace;for(const mesh of look.numbers){mesh.material=mesh.material.clone();mesh.material.map=look.numberTexture;mesh.material.needsUpdate=true;}}
 let color=look.teamColor;
 if(!color)player.root.traverse(m=>{if(!color&&m.isMesh&&m.userData.lookRole==='jersey')color=m.material.color.getStyle();});
 const team=new T.Color(color||'#872039'),ctx=look.numberCanvas.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle=team.r*.21+team.g*.72+team.b*.07>.6?'#172634':'#fff9ed';ctx.font='900 92px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(jersey),64,68,122);look.numberTexture.needsUpdate=true;player.number=jersey;
 return player;
}
function crowd(T,scene,mesh,a){
 const count=mesh.count,body=new T.InstancedMesh(new T.CylinderGeometry(.23,.17,.65,6),new T.MeshStandardMaterial({color:'#ffffff',roughness:.95}),count),heads=new T.InstancedMesh(new T.IcosahedronGeometry(.14,0),new T.MeshStandardMaterial({color:'#ffffff',roughness:.9}),count);
 const original=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),dummy=new T.Object3D(),color=new T.Color();
 const base=mesh.material.color.getHexString()==='9d3243'?['#872039','#aa334b','#d9c9ba','#b2b1a9','#273443']:['#18344f','#325778','#b9c7d0','#d2cab8','#e0e1db'];
 for(let i=0;i<count;i++){
  mesh.getMatrixAt(i,original);original.decompose(p,q,s);
  dummy.position.copy(p);dummy.position.y+=.01;dummy.scale.set(s.x,s.y,s.z);dummy.rotation.set(0,a.random()*6.28,0);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);color.set(base[Math.floor(a.random()*base.length)]);body.setColorAt(i,color);
  dummy.position.y+=.46*s.y;dummy.scale.setScalar(.85+a.random()*.25);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);color.set(['#bd8a69','#83563f','#d7ac89','#623d2f'][i%4]);heads.setColorAt(i,color);
 }
 body.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;scene.remove(mesh);scene.add(body,heads);
}
function fieldTexture(T,a){
 const c=a.canvas(1024,2048),ctx=c.getContext('2d');
 for(let y=0;y<2048;y++){const world=-10+y/2048*120,stripe=Math.floor(Math.max(0,world)/5)%2;ctx.fillStyle=stripe?'#2d603d':'#326c43';ctx.fillRect(0,y,1024,1);}
 for(let i=0;i<190000;i++){const x=a.random()*1024,y=a.random()*2048;ctx.fillStyle=a.random()>.5?'rgba(115,145,60,.17)':'rgba(5,42,25,.16)';ctx.fillRect(x,y,.7,1+a.random()*2);}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
 const noise=a.canvas(128),n=noise.getContext('2d'),im=n.createImageData(128,128);
 for(let i=0;i<im.data.length;i+=4){const v=100+a.random()*65;im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=255;}n.putImageData(im,0,0);
 const bump=new T.CanvasTexture(noise);bump.wrapS=bump.wrapT=T.RepeatWrapping;bump.repeat.set(70,150);bump.anisotropy=4;
 return {map,bump};
}
function skyMaterial(T){return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#426a91')},horizon:{value:new T.Color('#bdcbd6')},bottom:{value:new T.Color('#96a9b7')}},vertexShader:'varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying vec3 vWorld;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec3 n=normalize(vWorld-vec3(0.,0.,50.));float h=n.y;vec3 c=mix(horizon,top,pow(clamp(h*1.7,0.,1.),.7));c=mix(bottom,c,smoothstep(-.12,.08,h));vec2 uv=n.xz/max(.15,h+.25)*3.;float cloud=noise(uv)*.6+noise(uv*2.1)*.27+noise(uv*4.2)*.13;float mask=smoothstep(.54,.73,cloud)*smoothstep(.03,.3,h)*.38;c=mix(c,vec3(.85,.87,.89),mask);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});}
export function enhanceStadium(T,{scene,renderer,sun,field}){
 const a=assets(T);renderer.toneMappingExposure=1.04;
 scene.fog=new T.Fog('#a7b7c3',165,395);const sky=new T.Mesh(new T.SphereGeometry(390,32,18),skyMaterial(T));sky.position.z=50;sky.renderOrder=-10;scene.add(sky);
 // A single baked sky environment provides glossy helmets without extra lights.
 const environmentScene=new T.Scene(),environmentSky=new T.Mesh(new T.SphereGeometry(100,24,12),skyMaterial(T));environmentScene.add(environmentSky);const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromScene(environmentScene,.08,.1,200);scene.environment=environment.texture;scene.userData.presentationEnvironment=environment;pmrem.dispose();environmentSky.geometry.dispose();environmentSky.material.dispose();
 sun.color.set('#ffebd1');sun.intensity=3.15;sun.position.set(-48,48,-25);sun.shadow.normalBias=.025;
 for(const light of scene.children)if(light.isHemisphereLight){light.color.set('#c5d7ef');light.groundColor.set('#43513b');light.intensity=1.35;}
 const turf=fieldTexture(T,a);field.material.map=turf.map;field.material.bumpMap=turf.bump;field.material.bumpScale=.035;field.material.roughness=.96;field.material.needsUpdate=true;
 for(const m of [...scene.children]){
  if(m.isInstancedMesh&&m.geometry.parameters?.width===.48&&m.geometry.parameters?.height===.8){crowd(T,scene,m,a);continue;}
  if(m.isMesh&&m.geometry.type==='BoxGeometry'&&m.material?.color?.getHexString()==='2b613c')scene.remove(m);
 }
 // Covered grandstands and a glazed press box anchor the skyline.
 const structure=new T.MeshStandardMaterial({color:'#495b69',roughness:.65,metalness:.18}),trim=new T.MeshStandardMaterial({color:'#c8b79a',roughness:.7});
 const columnGeometry=new T.CylinderGeometry(.19,.24,17,8),columns=new T.InstancedMesh(columnGeometry,structure,12),dummy=new T.Object3D();let column=0;
 for(const side of [-1,1]){
  const roof=new T.Mesh(new T.BoxGeometry(30,.38,156),structure);roof.position.set(side*48,17,50);roof.rotation.z=side*.13;roof.receiveShadow=true;scene.add(roof);
  const fascia=new T.Mesh(new T.BoxGeometry(.28,.6,156),trim);fascia.position.set(side*33.1,15.1,50);scene.add(fascia);
  for(const z of [-15,11,37,63,89,115]){dummy.position.set(side*61,8.5,z);dummy.updateMatrix();columns.setMatrixAt(column++,dummy.matrix);}
  const press=new T.Mesh(new T.BoxGeometry(7,4.5,35),structure);press.position.set(side*61,14,50);scene.add(press);
  const window=a.canvas(512,128),wc=window.getContext('2d');wc.fillStyle='#718a9b';wc.fillRect(0,0,512,128);for(let x=0;x<512;x+=64){wc.fillStyle='#203442';wc.fillRect(x+3,6,58,116);wc.fillStyle='#7591a0';wc.fillRect(x+5,8,54,50);wc.strokeStyle='#b8c6cf';wc.beginPath();wc.moveTo(x+12,47);wc.lineTo(x+42,12);wc.stroke();}const map=new T.CanvasTexture(window);map.colorSpace=T.SRGBColorSpace;
  const windows=new T.Mesh(new T.PlaneGeometry(34,3.5),new T.MeshStandardMaterial({map,roughness:.28,metalness:.18,side:T.DoubleSide}));windows.position.set(side*57.4,14,50);windows.rotation.y=side===-1?Math.PI/2:-Math.PI/2;scene.add(windows);
 }
 scene.add(columns);
 // Standard orange pylons and useful sideline distance markers.
 const orange=new T.MeshStandardMaterial({color:'#ee762b',roughness:.85}),pylonGeo=new T.CylinderGeometry(.085,.085,.55,6);
 for(const x of [-26.6,26.6])for(const z of [-10,0,100,110]){const m=new T.Mesh(pylonGeo,orange);m.position.set(x,.275,z);m.castShadow=true;scene.add(m);}
 const markerGeo=new T.PlaneGeometry(1.1,.9);for(const z of [10,20,30,40,50,60,70,80,90]){
  const c=a.canvas(128),ctx=c.getContext('2d');ctx.fillStyle='#e57b2d';ctx.fillRect(0,0,128,128);ctx.fillStyle='#16232c';ctx.font='bold 76px Arial';ctx.textAlign='center';ctx.fillText(String(Math.min(z,100-z)),64,92);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const material=new T.MeshStandardMaterial({map,side:T.DoubleSide,roughness:1});
  for(const side of [-1,1]){const m=new T.Mesh(markerGeo,material);m.position.set(side*28.25,.5,z);m.rotation.y=side*Math.PI/2;m.rotation.x=-.1;scene.add(m);}
 }
 // Low-cost luminous lamp halos, one per tower, without expensive local shadows.
 const lampMat=new T.SpriteMaterial({map:a.glow,color:'#fff1cf',transparent:true,blending:T.AdditiveBlending,depthWrite:false});
 for(const side of [-1,1])for(const z of [-12,35,80,115]){const glow=new T.Sprite(lampMat);glow.position.set(side*32,26,z);glow.scale.set(9,6,1);scene.add(glow);}
 // Perimeter advertising boards give the bowl a coherent broadcast appearance.
 const bannerCanvas=a.canvas(1024,128),bc=bannerCanvas.getContext('2d');bc.fillStyle='#152a37';bc.fillRect(0,0,1024,128);bc.fillStyle='#ecd8b0';bc.font='bold 40px Arial';bc.textAlign='center';bc.fillText('SATURDAY LIGHTS  •  UNDER THE LIGHTS',512,82);const bannerMap=new T.CanvasTexture(bannerCanvas);bannerMap.colorSpace=T.SRGBColorSpace;
 const bannerMat=new T.MeshStandardMaterial({map:bannerMap,roughness:.9,side:T.DoubleSide});for(const side of [-1,1])for(const z of [5,35,65,95]){const m=new T.Mesh(new T.PlaneGeometry(25,2),bannerMat);m.position.set(side*33.6,1.6,z);m.rotation.y=-side*Math.PI/2;scene.add(m);}
 return {environment,sky};
}
