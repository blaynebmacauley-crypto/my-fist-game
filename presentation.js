// Original procedural art for the browser prototype. No external textures/assets.
const caches=new WeakMap();
function assets(T){
 if(caches.has(T))return caches.get(T);
 const canvas=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 let seed=45619;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const cloth=canvas(128),cc=cloth.getContext('2d');cc.fillStyle='#808080';cc.fillRect(0,0,128,128);for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){cc.fillStyle=(x+y)%8?'#9b9b9b':'#666';cc.fillRect(x,y,2,3);}
 const fabric=new T.CanvasTexture(cloth);fabric.wrapS=fabric.wrapT=T.RepeatWrapping;fabric.repeat.set(6,5);
 const face=canvas(128),f=face.getContext('2d');f.clearRect(0,0,128,128);f.fillStyle='#251a16';f.fillRect(17,37,34,7);f.fillRect(77,37,34,7);f.fillStyle='#e7ddd1';f.fillRect(23,47,22,8);f.fillRect(83,47,22,8);f.fillStyle='#161c23';f.fillRect(32,46,7,10);f.fillRect(89,46,7,10);f.strokeStyle='#8c5845';f.lineWidth=4;f.beginPath();f.moveTo(64,57);f.lineTo(59,78);f.lineTo(69,79);f.stroke();f.strokeStyle='#5f342b';f.lineWidth=4;f.beginPath();f.moveTo(48,96);f.quadraticCurveTo(63,100,78,96);f.stroke();
 const faceTexture=new T.CanvasTexture(face);faceTexture.colorSpace=T.SRGBColorSpace;
 const glowCanvas=canvas(128),g=glowCanvas.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,248,211,.75)');gradient.addColorStop(.14,'rgba(255,233,180,.28)');gradient.addColorStop(1,'rgba(255,212,135,0)');g.fillStyle=gradient;g.fillRect(0,0,128,128);
 const glow=new T.CanvasTexture(glowCanvas);glow.colorSpace=T.SRGBColorSpace;
 const a={canvas,random,fabric,faceTexture,glow,sphere:new T.SphereGeometry(1,12,8),tubeMaterial:new T.MeshStandardMaterial({color:'#b8c2c8',roughness:.32,metalness:.65}),white:new T.MeshStandardMaterial({color:'#e9e5df',roughness:.7}),dark:new T.MeshStandardMaterial({color:'#16202b',roughness:.7}),neutral:new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.68})};
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
  const material=mesh.material;const fixedNeutral=!material.map&&!material.bumpMap&&!material.normalMap&&material.metalness<.05&&!['872039','e8e8df','e3ded0','1c354d'].includes(material.color?.getHexString());
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
  if(material===neutral){const colors=new Float32Array(count*3);let at=0;for(let i=0;i<meshes.length;i++){const color=meshes[i].material.color,n=parts[i].getAttribute('position').count;for(let j=0;j<n;j++){colors[at++]=color.r;colors[at++]=color.g;colors[at++]=color.b;}}geometry.setAttribute('color',new T.BufferAttribute(colors,3));}
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const merged=new T.Mesh(geometry,material);merged.name='Athlete material batch';merged.castShadow=meshes.some(m=>m.castShadow);merged.receiveShadow=meshes.some(m=>m.receiveShadow);
  for(const mesh of meshes)container.remove(mesh);container.add(merged);for(const part of parts)part.dispose();
 }
}
export function enhanceAthlete(T,player){
 const a=assets(T),{root,limbs}=player;
 root.traverse(m=>{
  if(!m.isMesh||!m.material?.color)return;
  const color=m.material.color.getHexString();
  if(m.geometry.type==='CylinderGeometry'&&['872039','e8e8df','e3ded0','1c354d'].includes(color)){
   m.material.bumpMap=a.fabric;m.material.bumpScale=.018;m.material.roughness=.86;m.material.needsUpdate=true;
  }
  if(m.material.metalness===.25){m.material.roughness=.2;m.material.metalness=.15;m.material.envMapIntensity=1.1;}
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
 const face=new T.Mesh(new T.PlaneGeometry(.24,.2),new T.MeshBasicMaterial({map:a.faceTexture,transparent:true,depthWrite:false}));face.position.set(0,1.73,.239);root.add(face);
 ellipsoid(T,root,a.sphere,a.white,[0,1.58,.14],[.08,.035,.06]);
 // Rounded kneepads, sock bands and cleat soles move with the original rig.
 for(const i of [1,3]){
  const leg=limbs[i];ellipsoid(T,leg,a.sphere,a.white,[0,-.35,.095],[.092,.105,.045]);
  ellipsoid(T,leg,a.sphere,a.dark,[0,-.809,.075],[.104,.019,.19]);
 }
 for(const i of [0,2]){
  const wrist=limbs[i];ellipsoid(T,wrist,a.sphere,a.dark,[0,-.46,.035],[.083,.027,.083]);
 }
 // Preserve all transparent faces/numbers/contact shadows. Each original limb
 // remains its own group; only rigid pieces inside that joint are combined.
 const before=[];root.traverse(m=>{if(m.isMesh)before.push(m);});
 batchOpaqueParts(T,root);for(const limb of limbs)batchOpaqueParts(T,limb);
 let after=0;root.traverse(m=>{if(m.isMesh)after++;});
 root.userData.presentationBatch={before:before.length,after};
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
function skyMaterial(T){return new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color('#507ba4')},horizon:{value:new T.Color('#c6cdd3')},bottom:{value:new T.Color('#b4b8ba')}},vertexShader:'varying vec3 vWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying vec3 vWorld;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec3 n=normalize(vWorld-vec3(0.,0.,50.));float h=n.y;vec3 c=mix(horizon,top,pow(clamp(h*1.7,0.,1.),.7));c=mix(bottom,c,smoothstep(-.12,.08,h));vec2 uv=n.xz/max(.15,h+.25)*3.;float cloud=noise(uv)*.6+noise(uv*2.1)*.27+noise(uv*4.2)*.13;float mask=smoothstep(.54,.73,cloud)*smoothstep(.03,.3,h)*.38;c=mix(c,vec3(.85,.87,.89),mask);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});}
export function enhanceStadium(T,{scene,renderer,sun,field}){
 const a=assets(T);renderer.toneMappingExposure=1.04;
 scene.fog=new T.Fog('#b4b3ac',140,360);const sky=new T.Mesh(new T.SphereGeometry(390,32,18),skyMaterial(T));sky.position.z=50;sky.renderOrder=-10;scene.add(sky);
 // A single baked sky environment provides glossy helmets without extra lights.
 const environmentScene=new T.Scene(),environmentSky=new T.Mesh(new T.SphereGeometry(100,24,12),skyMaterial(T));environmentScene.add(environmentSky);const pmrem=new T.PMREMGenerator(renderer);const environment=pmrem.fromScene(environmentScene,.08,.1,200);scene.environment=environment.texture;scene.userData.presentationEnvironment=environment;pmrem.dispose();environmentSky.geometry.dispose();environmentSky.material.dispose();
 sun.color.set('#ffe4ba');sun.intensity=3.3;sun.position.set(-48,48,-25);sun.shadow.normalBias=.025;
 for(const light of scene.children)if(light.isHemisphereLight){light.color.set('#c5d7ef');light.groundColor.set('#43513b');light.intensity=1.65;}
 const turf=fieldTexture(T,a);field.material.map=turf.map;field.material.bumpMap=turf.bump;field.material.bumpScale=.055;field.material.roughness=.96;field.material.needsUpdate=true;
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
