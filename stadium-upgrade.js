// Original stadium art for Saturday Lights. No external textures or services.
// All spectators, architecture and field artwork are generated once and batched.
const TAU=Math.PI*2;
function seeded(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
function canvas(width,height=width){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
function oval(T,angle,rx,rz,y){const c=Math.cos(angle),s=Math.sin(angle);return new T.Vector3(Math.sign(c)*Math.abs(c)**.66*rx,y,50+Math.sign(s)*Math.abs(s)**.66*rz);}
function triangle(out,a,b,c){out.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);}
function geometry(T,positions){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}
function textMap(T,text,{color='#e6dfcb',background=null,width=1024,height=128,font=64}={}){const c=canvas(width,height),ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${font}px Arial`;ctx.fillText(text,width/2,height*.53,width*.94);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return map;}
function turf(T,renderer,random){
 const c=canvas(1024,2048),ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);
 for(let y=0;y<c.height;y++){
  const z=-10+y/c.height*120,stripe=Math.floor(Math.max(0,z)/5)%2?1.026:.974;
  for(let x=0;x<c.width;x++){
   const i=(y*c.width+x)*4,grain=(random()-.5)*5.6,blade=Math.sin(x*.91+y*.32)*.65;
   pixels.data[i]=(59+grain*.65+blade)*stripe;pixels.data[i+1]=(91+grain+blade)*stripe;pixels.data[i+2]=(46+grain*.52)*stripe;pixels.data[i+3]=255;
  }
 }
 ctx.putImageData(pixels,0,0);
 // Subtle wear around the hashes adds scale without large bright noise patches.
 ctx.strokeStyle='rgba(116,127,75,.055)';ctx.lineWidth=.45;
 for(let i=0;i<1200;i++){const x=320+random()*390,y=random()*2048;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*3,y+2+random()*5);ctx.stroke();}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||4);
 const n=canvas(128),nc=n.getContext('2d'),noise=nc.createImageData(128,128);
 for(let i=0;i<noise.data.length;i+=4){const value=112+random()*30;noise.data[i]=noise.data[i+1]=noise.data[i+2]=value;noise.data[i+3]=255;}nc.putImageData(noise,0,0);
 const bump=new T.CanvasTexture(n);bump.wrapS=bump.wrapT=T.RepeatWrapping;bump.repeat.set(95,210);bump.anisotropy=4;
 return {map,bump};
}

/** Upgrade the original field scene before athletes are added. Idempotent. */
export function upgradeStadium(T,{scene,renderer,sun,field}){
 if(scene.userData.broadcastStadium)return scene.userData.broadcastStadium;
 const group=new T.Group();group.name='Broadcast stadium bowl';
 const ownedGeometries=new Set(),ownedMaterials=new Set(),ownedTextures=new Set();
 const keepGeometry=g=>(ownedGeometries.add(g),g),keepTexture=t=>(ownedTextures.add(t),t);
 const mat=(color,roughness=.85,metalness=0)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness});ownedMaterials.add(m);return m;};
 const random=seeded(872612),boxGeometry=keepGeometry(new T.BoxGeometry(1,1,1)),dummy=new T.Object3D(),instanceColor=new T.Color();
 const boxes=new Map();
 function box(material,p,s,rotation=[0,0,0]){if(!boxes.has(material))boxes.set(material,[]);boxes.get(material).push({p,s,rotation});}
 function mesh(g,m,name){const result=new T.Mesh(keepGeometry(g),m);result.name=name;result.receiveShadow=true;group.add(result);return result;}
 const originalEndzoneText=[];
 let originalScreen=null,originalScreenFrame=null;
 // The original dynamic screen remains the same object, so game score updates
 // continue to work. Replace only the obsolete architecture surrounding it.
 for(const object of [...scene.children]){
  if(object===field||object===sun||object.isLight)continue;
  if(object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.geometry.parameters.radius>100)continue;
  if(object.isMesh&&object.geometry?.type==='PlaneGeometry'&&Math.abs(object.position.x)<.01&&Math.abs(object.position.y-15)<.1&&Math.abs(object.position.z-125.4)<.2){originalScreen=object;continue;}
  if(object.isMesh&&object.geometry?.type==='BoxGeometry'&&Math.abs(object.position.x)<.01&&object.position.y===15&&object.position.z===126){originalScreenFrame=object;continue;}
  if(object.isInstancedMesh||object.isSprite){scene.remove(object);continue;}
  if(!object.isMesh)continue;
  if(object.material?.map&&object.geometry?.type==='PlaneGeometry'&&object.position.y<.06)object.material.map.anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||4);
  if(object.geometry?.type==='PlaneGeometry'&&Math.abs(object.position.y-.025)<.01&&Math.abs(object.position.x)<.01&&[-5,105].includes(object.position.z))originalEndzoneText.push(object);
  const color=object.material?.color?.getHexString();
  const oldGoal=color==='efb546'&&object.position.y>0&&[-10,110].includes(object.position.z);
  const oldCrest=object.geometry?.type==='PlaneGeometry'&&object.position.z===50&&object.position.y>.02&&Math.abs(object.geometry.parameters.width-17)<.1;
  if(oldGoal||oldCrest||Math.abs(object.position.x)>29||object.position.z<-11||object.position.z>112){scene.remove(object);}
 }
 if(originalScreen){originalScreen.position.set(0,22.2,137.4);originalScreen.name='Live stadium scoreboard';}
 if(originalScreenFrame){originalScreenFrame.position.set(0,22.2,138);originalScreenFrame.scale.set(27,8.5,1);}
 scene.add(group);

 let lampMaterial,orangeMaterial;
 const concrete=mat('#58636a'),riser=mat('#394852'),dark=mat('#172b3a',.72,.12),steel=mat('#a8b1ac',.45,.35),roof=mat('#46565f',.68,.14),glass=mat('#35586b',.23,.35);
 const tiers=[{rx:35.2,rz:74.9,y:.6,rows:22},{rx:48.5,rz:88.2,y:10.4,rows:20},{rx:62,rz:101.7,y:21.0,rows:16}];
 const surfaces=[],walls=[],ledWalls=[];
 function ringSurface(rx,rz,width,y,out=surfaces){for(let i=0;i<96;i++){const a=TAU*i/96,b=TAU*(i+1)/96,p=[oval(T,a,rx,rz,y),oval(T,b,rx,rz,y),oval(T,b,rx+width,rz+width,y),oval(T,a,rx+width,rz+width,y)];triangle(out,p[0],p[1],p[2]);triangle(out,p[0],p[2],p[3]);}}
 function ringWall(rx,rz,y,height,out=walls){for(let i=0;i<96;i++){const a=TAU*i/96,b=TAU*(i+1)/96,p=[oval(T,a,rx,rz,y),oval(T,b,rx,rz,y),oval(T,b,rx,rz,y+height),oval(T,a,rx,rz,y+height)];triangle(out,p[0],p[1],p[2]);triangle(out,p[0],p[2],p[3]);}}
 ringWall(33.8,73.5,0,1.7);
 for(const tier of tiers){
  for(let row=0;row<tier.rows;row++){
   const rx=tier.rx+row*.49,rz=tier.rz+row*.49,y=tier.y+row*.39;
   ringSurface(rx,rz,.5,y);ringWall(rx+.49,rz+.49,y,.39);
  }
  ringSurface(tier.rx+tier.rows*.49,tier.rz+tier.rows*.49,1.8,tier.y+tier.rows*.39);
  ringWall(tier.rx,tier.rz,tier.y-.32,.72);
  ringWall(tier.rx+tier.rows*.49+1.8,tier.rz+tier.rows*.49+1.8,tier.y+tier.rows*.39,1.05);
 }
 for(const led of [{rx:47.2,rz:86.9,y:9.55},{rx:60.6,rz:100.3,y:19.8}])ringWall(led.rx,led.rz,led.y,.7,ledWalls);
 mesh(geometry(T,surfaces),concrete,'Continuous seating terraces');mesh(geometry(T,walls),riser,'Bowl walls and tier rails');
 const ledMaterial=mat('#702b3c',.7);ledMaterial.emissive.set('#401621');ledMaterial.emissiveIntensity=.32;mesh(geometry(T,ledWalls),ledMaterial,'Stadium ribbon fascia');
 // Slim rail rings catch sunlight along concourse edges rather than huge walls.
 const railPositions=[];
 for(const tier of tiers)ringWall(tier.rx-.04,tier.rz-.04,tier.y+.46,.055,railPositions);
 mesh(geometry(T,railPositions),steel,'Concourse handrails');

 // A single instanced crowd covers all four sides. Aisles are stable radial
 // gaps; seated rows use small scale/color variation instead of random blocks.
 const spectators=[],headInstances=[],armInstances=[];
 const palette=['#7e283c','#963348','#b34254','#c7c4b3','#d2cfbd','#18334b','#35586e','#69727a'];
 const skin=['#b98965','#87583f','#d3ab86','#5e4030'];
 tiers.forEach((tier,tierIndex)=>{
  for(let row=0;row<tier.rows;row++){
   const count=284+tierIndex*44+row*2;
   for(let seat=0;seat<count;seat++){
    if(seat%39<3||random()<.028)continue;
    const angle=TAU*(seat+.5)/count,rx=tier.rx+row*.49+.22,rz=tier.rz+row*.49+.22;
    const place=oval(T,angle,rx,rz,tier.y+row*.39),height=.9+random()*.18,width=.86+random()*.2,yaw=Math.atan2(-place.x,50-place.z);
    const cloth=place.x>0&&random()<.6?palette[Math.floor(random()*3)]:palette[Math.floor(random()*palette.length)];
    spectators.push({p:[place.x,place.y+.53*height,place.z],s:[width,height,1],yaw,color:cloth});
    headInstances.push({p:[place.x,place.y+.91*height,place.z],s:[1,1,1],yaw,color:skin[Math.floor(random()*skin.length)]});
    if(seat%13===0)for(const side of [-1,1]){
     const offset=new T.Vector3(side*.2,.91,0).applyAxisAngle(T.Object3D.DEFAULT_UP,yaw);
     armInstances.push({p:[place.x+offset.x,place.y+offset.y,place.z+offset.z],s:[1,1,1],yaw,roll:side*.42,color:cloth});
    }
   }
  }
 });
 const crowdMaterial=mat('#ffffff',.98),headMaterial=mat('#ffffff',.92);
 function instances(g,m,data,name){const result=new T.InstancedMesh(keepGeometry(g),m,data.length);result.name=name;result.castShadow=false;result.receiveShadow=false;
  data.forEach((item,i)=>{dummy.position.set(...item.p);dummy.scale.set(...item.s);dummy.rotation.set(0,item.yaw||0,item.roll||0);dummy.updateMatrix();result.setMatrixAt(i,dummy.matrix);instanceColor.set(item.color||'#ffffff');result.setColorAt(i,instanceColor);});
  result.instanceMatrix.needsUpdate=true;if(result.instanceColor)result.instanceColor.needsUpdate=true;result.computeBoundingSphere();group.add(result);return result;
 }
 instances(new T.CylinderGeometry(.16,.2,.53,5,1,false),crowdMaterial,spectators,'Home and visiting spectators');
 instances(new T.IcosahedronGeometry(.11,0),headMaterial,headInstances,'Spectator heads');
 instances(new T.CylinderGeometry(.035,.046,.35,4),crowdMaterial,armInstances,'Cheering crowd arms');

 // Upper roofs leave the playing field open to sunlight. Architectural pieces
 // share instanced batches by material, including beams and press-box glazing.
 for(const side of [-1,1]){
  box(roof,[side*64.2,31.2,50],[34.5,.45,164],[0,0,side*.055]);
  box(steel,[side*47.1,30.5,50],[.3,.7,164]);
  box(dark,[side*76,24.1,50],[8,6.2,48]);
  for(let z=28;z<=72;z+=4){box(glass,[side*71.9,24.5,z],[.1,4.55,3.65]);box(steel,[side*71.8,24.5,z-1.9],[.12,4.8,.1]);}
  for(const z of [-18,10,38,66,94,122]){box(roof,[side*80,15.25,z],[.35,30.5,.35]);box(steel,[side*69,29.9,z],[21,.15,.15]);}
 }
 // A glazed hospitality bridge above the far end completes the skyline.
 box(dark,[0,28.5,166],[67,4.8,7]);
 for(let x=-30;x<=30;x+=5){box(glass,[x,28.7,162.4],[4.7,3.45,.12]);box(steel,[x-2.45,28.7,162.3],[.13,3.8,.12]);}
 for(const side of [-1,1])for(const z of [-12,36,82,116]){
  box(roof,[side*47,20,z],[.22,40,.22]);box(roof,[side*47,40,z],[7.1,.9,.7]);
  for(let k=-2;k<=2;k++)box(matLamp(),[side*47+k*1.25,40,z-.43],[.9,.6,.1]);
 }
 function matLamp(){if(!lampMaterial){lampMaterial=mat('#ece9d9',.35);lampMaterial.emissive.set('#fff2cf');lampMaterial.emissiveIntensity=.35;}return lampMaterial;}

 // A quieter original ribbon texture adds readable scale at the end stands.
 const ribbon=keepTexture(textMap(T,'SATURDAY LIGHTS  /  THIS IS YOUR SATURDAY',{background:'#172d3b',font:42}));
 const ribbonMaterial=new T.MeshStandardMaterial({map:ribbon,roughness:.9,side:T.DoubleSide});ownedMaterials.add(ribbonMaterial);
 for(const sign of [-1,1]){
  const banner=mesh(new T.PlaneGeometry(40,1.4),ribbonMaterial,'End-zone stadium ribbon');banner.position.set(0,9.9,50+sign*87.0);banner.rotation.y=sign>0?Math.PI:0;
 }

 // Replace the oversized old midfield word rectangle with an original painted
 // shield. Existing yard lines, numbers, end zones and chain lines are retained.
 const crestCanvas=canvas(1024),crest=crestCanvas.getContext('2d');
 crest.translate(512,512);crest.beginPath();crest.moveTo(-340,-340);crest.lineTo(340,-340);crest.lineTo(310,220);crest.lineTo(0,380);crest.lineTo(-310,220);crest.closePath();crest.fillStyle='#72283e';crest.fill();crest.strokeStyle='#cbbc98';crest.lineWidth=14;crest.stroke();
 crest.fillStyle='#ede5cf';crest.font='italic 900 320px Arial';crest.textAlign='center';crest.textBaseline='middle';crest.fillText('SL',0,-5,590);crest.font='700 34px Arial';crest.fillText('SATURDAY LIGHTS',0,205,480);
 const crestMap=keepTexture(new T.CanvasTexture(crestCanvas));crestMap.colorSpace=T.SRGBColorSpace;crestMap.anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||4);
 const crestMaterial=new T.MeshStandardMaterial({map:crestMap,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1});ownedMaterials.add(crestMaterial);
 const crestMesh=mesh(new T.PlaneGeometry(13,13),crestMaterial,'Original midfield shield');crestMesh.rotation.set(-Math.PI/2,0,Math.PI);crestMesh.position.set(0,.031,50);

 // Curved regulation-style goal posts and padded bases.
 const goalMaterial=mat('#e7bd45',.4,.32),paddingMaterial=mat('#203648',.92);
 for(const sign of [-1,1]){
  const end=sign<0?-10.5:110.5,back=end+sign*1.8;
  const curve=new T.CatmullRomCurve3([new T.Vector3(0,.15,back),new T.Vector3(0,3.6,back),new T.Vector3(0,4.7,back-sign*.5),new T.Vector3(0,5.4,end)]);
  mesh(new T.TubeGeometry(curve,18,.075,8,false),goalMaterial,'Curved goal-post support');
  const bar=mesh(new T.CylinderGeometry(.065,.065,6.2,8),goalMaterial,'Goal crossbar');bar.position.set(0,5.4,end);bar.rotation.z=Math.PI/2;
  for(const x of [-3.05,3.05]){const post=mesh(new T.CylinderGeometry(.06,.06,4.1,8),goalMaterial,'Goal upright');post.position.set(x,7.45,end);}
  const pad=mesh(new T.CylinderGeometry(.19,.19,1.65,10),paddingMaterial,'Goal-post safety padding');pad.position.set(0,.825,back);
 }

 // Sideline reserves and staff are low-detail instanced art, leaving the full
 // animated meshes and draw budget for the 22 players on the field.
 const reserveBodies=[],reserveHeads=[],reserveLegs=[],staffBodies=[],staffHeads=[];
 for(const side of [-1,1]){
  for(let i=0;i<29;i++){
   const z=9+i*2.75,x=side*(29.8+random()*.7),yaw=-side*Math.PI/2;
   reserveBodies.push({p:[x,1.16,z],s:[1,1,1],yaw,color:side<0?'#7d293e':'#d5d5c8'});
   reserveHeads.push({p:[x,1.7,z],s:[1,1,1],yaw,color:side<0?'#722237':'#19354e'});
   for(const legSide of [-1,1])reserveLegs.push({p:[x,.49,z+legSide*.13],s:[1,1,1],yaw,color:side<0?'#c9c8bb':'#20384c'});
  }
  for(let i=0;i<8;i++){
   const z=16+i*9.5,x=side*28.5;
   staffBodies.push({p:[x,1.15,z],s:[1,1,1],yaw:-side*Math.PI/2,color:i%3?'#182d3e':'#c7c4b7'});
   staffHeads.push({p:[x,1.7,z],s:[1,1,1],yaw:0,color:skin[i%skin.length]});
  }
  for(const z of [18,50,82]){
   box(steel,[side*31.5,.5,z],[1.1,.16,5.8]);box(steel,[side*32.05,1.0,z],[.12,.85,5.8]);
   for(const dz of [-2,2])box(dark,[side*31.5,.25,z+dz],[.75,.5,.16]);
   box(dark,[side*32.4,1.05,z+4],[1.6,2.1,1.5]);box(matOrange(),[side*32.4,1.95,z+4],[1.25,.55,1.25]);
  }
 }
 function matOrange(){if(!orangeMaterial)orangeMaterial=mat('#bd6c38',.9);return orangeMaterial;}
 instances(new T.CylinderGeometry(.25,.2,.61,6),crowdMaterial,reserveBodies,'Sideline reserve uniforms');
 instances(new T.SphereGeometry(.165,8,5),headMaterial,reserveHeads,'Sideline reserve helmets');
 instances(new T.CylinderGeometry(.075,.065,.75,5),crowdMaterial,reserveLegs,'Sideline reserve legs');
 instances(new T.CylinderGeometry(.22,.18,.66,6),crowdMaterial,staffBodies,'Coaches and sideline staff');
 instances(new T.IcosahedronGeometry(.12,1),headMaterial,staffHeads,'Sideline staff heads');

 // Flush all architectural boxes in a handful of material batches.
 for(const [material,items] of boxes){
  const batch=new T.InstancedMesh(boxGeometry,material,items.length);batch.name='Batched stadium architecture';batch.receiveShadow=true;batch.castShadow=false;
  items.forEach((item,i)=>{dummy.position.set(...item.p);dummy.scale.set(...item.s);dummy.rotation.set(...item.rotation);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();group.add(batch);
 }
 const grass=turf(T,renderer,random);keepTexture(grass.map);keepTexture(grass.bump);field.material.map=grass.map;field.material.bumpMap=grass.bump;field.material.bumpScale=.018;field.material.roughness=.98;field.material.needsUpdate=true;
 scene.fog=new T.Fog('#a2b3bd',220,520);
 if(renderer){renderer.toneMappingExposure=1.08;}
 if(sun){
  sun.color.set('#fff0d8');sun.intensity=2.55;sun.position.set(-48,76,-16);sun.target.position.set(0,0,50);if(!sun.target.parent)scene.add(sun.target);
  sun.shadow.normalBias=.018;sun.shadow.bias=-.00012;sun.shadow.camera.left=-78;sun.shadow.camera.right=78;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-85;sun.shadow.camera.far=220;sun.shadow.camera.updateProjectionMatrix();
 }
 for(const light of scene.children)if(light.isHemisphereLight){light.color.set('#c3d5e5');light.groundColor.set('#526044');light.intensity=1.65;}
 const fill=new T.DirectionalLight('#c6dbf0',.42);fill.position.set(38,32,112);fill.target.position.set(0,1,40);scene.add(fill,fill.target);

 const newTurf=turf(T,renderer,random);keepTexture(newTurf.map);keepTexture(newTurf.bump);field.material.map=newTurf.map;field.material.bumpMap=newTurf.bump;field.material.bumpScale=.014;field.material.roughness=.96;field.material.needsUpdate=true;
 if(renderer)renderer.toneMappingExposure=1.07;
 const endzoneMaps=[];
 for(const text of originalEndzoneText){const map=keepTexture(textMap(T,text.position.z<0?'STATE':'VALLEY',{font:94}));text.material=text.material.clone();ownedMaterials.add(text.material);text.material.map=map;text.material.needsUpdate=true;endzoneMaps.push({text,map});}
 function updateTeams(home='STATE',away='VALLEY'){
  for(const {text,map} of endzoneMaps){const ctx=map.image.getContext('2d');ctx.clearRect(0,0,map.image.width,map.image.height);ctx.fillStyle='#e6dfcb';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 94px Arial';ctx.fillText(String(text.position.z<0?home:away).toUpperCase(),512,68,940);map.needsUpdate=true;}
 }
 const stats={spectators:spectators.length,crowdDraws:3,architectureBatches:boxes.size,meshDraws:group.children.length,tiers:tiers.length,originalArt:true};
 const api={group,stats,updateTeams,dispose(){scene.remove(group,fill,fill.target);for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();delete scene.userData.broadcastStadium;}};
 scene.userData.broadcastStadium=api;
 return api;
}
