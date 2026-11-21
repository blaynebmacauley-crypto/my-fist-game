const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const ORIGIN=process.env.GAME_URL||'http://127.0.0.1:8091';
const VERSION='broadcast12';

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;});
 async function state(p=page){return p.evaluate(()=>football.state);}
 async function ready(p=page){await p.waitForFunction(()=>window.football&&football.state.assets?.status==='ready',{},{polling:100,timeout:30000});}
 async function load(role='QB',p=page){await p.goto(ORIGIN+'/?v='+VERSION);await ready(p);await p.selectOption('#position',role);await p.click('#start');await sim(0,p);}
 async function sim(n,p=page,draw=false){return p.evaluate(async({n,draw,version})=>{const {step}=await import(document.querySelector('script[type=module]').src);for(let i=0;i<n;i++)step(.04,false);if(draw)step(0,true);return football.state;},{n,draw,version:VERSION});}
 async function park(p=page){await p.evaluate(async version=>{const {players}=await import(document.querySelector('script[type=module]').src);for(const actor of players.slice(11)){actor.root.position.set(45,0,85);actor.velocity.set(0,0,0);actor.speed=0;}},VERSION);}
 async function seedQB(z,p=page){await p.evaluate(async({z,version})=>{const {players}=await import(document.querySelector('script[type=module]').src);players[0].root.position.z=z;players[0].velocity.set(0,0,0);players[0].speed=0;},{z,version:VERSION});}
 async function assertInside(selector,p=page){const box=await p.locator(selector).boundingBox();assert.ok(box,selector+' is visible');const size=p.viewportSize();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,selector+' stays in the viewport: '+JSON.stringify(box));return box;}
 function overlaps(a,b){return a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1;}
 async function imported(p=page){return p.evaluate(async version=>{const {players}=await import(document.querySelector('script[type=module]').src);return players.map(actor=>{const visual=actor.importedVisual;return {loaded:!!visual?.model,meshes:visual?.meshCount,clips:visual?.clips||[],animation:visual?.currentAnimation,hand:!!visual?.hands?.right,visible:visual?.model?.visible,profile:visual?.lastProfile};});},VERSION);}
 try{
  await page.goto(ORIGIN+'/?v='+VERSION);await ready();let s=await state();
  assert.equal(s.players,22);let models=await imported();assert.equal(models.length,22);
  for(const model of models){assert.equal(model.loaded,true);assert.ok(model.meshes>=20,'human asset contains articulated mesh detail');assert.equal(model.clips.length,6);assert.equal(model.hand,true);assert.notEqual(model.visible,false);}
  assert.match(await page.locator('#intro').innerText(),/V12/);await assertInside('#start');await assertInside('#careerStart');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log('PASS browser home and all 22 detailed imported athletes, original animation clips and hand anchors');

  await page.click('#start');await sim(0);const score=await assertInside('#scoreboard');assert.ok(score.y>page.viewportSize().height*.70,'broadcast score strip stays below play');
  await page.keyboard.press('Space');await park();let before=(await state()).positions[0].z;await page.keyboard.down('w');s=await sim(8);await page.keyboard.up('w');assert.ok(s.positions[0].z>before,'W follows offensive camera forward');
  const handBefore=await page.evaluate(async version=>{const {players}=await import(document.querySelector('script[type=module]').src);const T=await import('./vendor/three.module.js');const {getAthleteHand}=await import('./athlete-visuals.js?v='+version);return getAthleteHand(T,players[0],'right').toArray();},VERSION);
  await page.keyboard.press('1');s=await state();assert.equal(s.flight,true);assert.equal(s.attempts,1);await sim(5);
  const handAfter=await page.evaluate(async version=>{const {players}=await import(document.querySelector('script[type=module]').src);const T=await import('./vendor/three.module.js');const {getAthleteHand}=await import('./athlete-visuals.js?v='+version);return getAthleteHand(T,players[0],'right').toArray();},VERSION);
  assert.ok(Math.hypot(...handAfter.map((v,i)=>v-handBefore[i]))>.025,'actual imported throwing hand moves');
  s=await sim(50);assert.equal(s.flight,false);
  console.log('PASS camera-relative movement, legal forward pass and imported throwing-hand animation');

  await load();await page.keyboard.press('Space');await park();s=await state();await seedQB(s.spot+.1);await sim(1);
  for(const key of ['1','2','3'])await page.keyboard.press(key);
  s=await state();assert.equal(s.crossedScrimmage,true);assert.equal(s.canPass,false);assert.equal(s.flight,false);assert.equal(s.attempts,0);assert.match(await page.locator('#target').innerText(),/RUN ONLY/);
  await seedQB(s.spot-2);await sim(1);await page.keyboard.press('1');assert.equal((await state()).flight,false,'retreat cannot restore forward passing');
  await page.evaluate(async version=>{const {formation}=await import(document.querySelector('script[type=module]').src);formation();},VERSION);await page.keyboard.press('Space');assert.equal((await state()).canPass,true);
  console.log('PASS scrimmage crossing locks passes, retreat remains locked, and a new down resets eligibility');

  await park();await sim(1);s=await state();const stamina=s.stamina,pos=s.positions[0];await page.keyboard.press('q');s=await state();assert.equal(s.skill.active,true);assert.ok(Math.abs(s.stamina-(stamina-.18))<1e-8);const spent=s.stamina;
  await page.keyboard.press('e');assert.equal((await state()).stamina,spent,'skill spam does not spend stamina twice');s=await sim(5);assert.ok(Math.hypot(s.positions[0].x-pos.x,s.positions[0].z-pos.z)>.2,'juke changes actual position');
  await page.keyboard.press('p');const frozen=await state();await sim(10);s=await state();assert.equal(s.time,frozen.time);assert.deepEqual(s.positions,frozen.positions);assert.deepEqual(s.skill,frozen.skill);await page.keyboard.press('p');
  await sim(65);assert.equal((await state()).skill.cooldown,0);
  console.log('PASS lateral skills, stamina cost, spam guard, recovery and paused movement');

  await load();await page.evaluate(async version=>{const {drive,formation}=await import(document.querySelector('script[type=module]').src);drive.spot=2;drive.line=12;formation();},VERSION);await page.keyboard.press('Space');await park();s=await sim(3);assert.equal(s.playState,'live');assert.equal(s.awayScore,0,'own end zone is live before grounding');
  const contact=await page.evaluate(async version=>{const {players,beginTackle}=await import(document.querySelector('script[type=module]').src);players[11].root.position.copy(players[0].root.position);players[11].root.position.z+=.5;return {began:beginTackle(11,0,1),spot:players[0].root.position.z};},VERSION);assert.equal(contact.began,true);
  s=await sim(10);assert.equal(s.playState,'tackle');assert.equal(s.awayScore,0);models=await imported();assert.match(models[0].animation||'',/tackle/i);
  s=await sim(30);assert.equal(s.playState,'dead');assert.equal(s.awayScore,2);assert.equal(s.tackle.phase,'ground');
  console.log('PASS imported tackle pose precedes grounded own-end-zone safety; touching the goal plane alone stays live');

  await load('WR');await page.keyboard.press('Space');await park();await sim(25);await page.click('#callBall');s=await state();assert.equal(s.attempts,1);assert.equal(s.flight,true);await sim(40);assert.ok((await state()).comp>=1,'aligned called pass can be caught');
  await load('RB');await page.keyboard.press('Space');await park();s=await sim(22);assert.equal(s.carrier,10);
  await load('LB');s=await state();assert.equal(s.controlled,16);assert.ok(s.cameraDirection[2]<0,'LB faces the opponent offense');await page.keyboard.press('Space');const lbStart=s.positions[16].z;await page.keyboard.down('w');s=await sim(7);await page.keyboard.up('w');assert.ok(s.positions[16].z<lbStart,'LB forward follows defensive camera');
  await page.evaluate(async version=>{const {players}=await import(document.querySelector('script[type=module]').src);players[16].root.position.copy(players[0].root.position);players[16].root.position.z+=.5;players[0].velocity.set(0,0,0);players[0].speed=0;},VERSION);await page.keyboard.press('e');assert.equal((await state()).playState,'tackle');
  console.log('PASS WR calling/catching, RB exchange, and LB camera/movement/tackle mapping');

  await load();await sim(65,page,true);await page.screenshot({path:'/tmp/glory-v12-desktop.png',animations:'disabled'});
  await page.goto(ORIGIN+'/?v='+VERSION);await ready();await page.click('#careerStart');s=await state();assert.equal(s.mode,'creator');assert.equal(s.creator.step,0);
  await page.fill('#createName','Avery Rivers');await page.fill('#create_hometown','Oakland');await page.fill('#create_state','CA');await page.fill('#create_jersey','28');await page.selectOption('#create_dominantHand','left');await page.click('#creatorNext');
  await page.selectOption('#createPosition','WR');await page.selectOption('#createArchetype','deep-threat');await page.fill('#create_heightInches','78');await page.fill('#create_weightLbs','215');await page.click('#creatorNext');
  await page.selectOption('#create_skinTone','dark');await page.selectOption('#create_helmetFinish','matte');await page.selectOption('#create_visor','smoke');await page.selectOption('#create_gloves','black');await page.selectOption('#create_sleeves','long');
  s=await state();assert.equal(s.creator.step,2);assert.equal(s.creator.preview.number,28);const angle=s.creator.angle;await page.click('#rotateLeft');assert.notEqual((await state()).creator.angle,angle);await sim(0,page,true);await page.screenshot({path:'/tmp/glory-v12-creator.png',animations:'disabled'});
  await page.click('#creatorNext');assert.equal((await state()).creator.step,3);assert.match(await page.locator('#creatorReview').innerText(),/Avery Rivers/);await page.click('#creatorNext');assert.equal((await state()).mode,'career');
  await page.reload();await ready();await page.click('#careerContinue');await page.click('#careerPlay');s=await state();assert.equal(s.role,'WR');assert.equal(s.profile.jersey,28);assert.equal(s.profile.skinTone,'dark');models=await imported();assert.equal(models[6].profile.skinTone,'dark');assert.equal(models[6].profile.jersey,28);assert.equal(models[6].profile.dominantHand,'left');
  const visualChecks=await page.evaluate(async()=>{const {players}=await import(document.querySelector('script[type=module]').src),T=await import('./vendor/three.module.js'),{updateAthleteVisual,getAthleteHand}=await import('./athlete-visuals.js?v=broadcast12');const actor=players[6],v=actor.importedVisual,look={jersey:v.materials.get('jersey').color.getHexString(),skin:v.materials.get('skin').color.getHexString(),upper:v.materials.get('upperArm')?.color.getHexString(),forearm:v.materials.get('forearm')?.color.getHexString(),gloves:v.materials.get('gloves').color.getHexString(),teammateForearm:players[7].importedVisual.materials.get('forearm')?.color.getHexString()},hands={};for(const side of ['right','left']){updateAthleteVisual(T,actor,{dt:0,reset:true});for(let i=0;i<15;i++)updateAthleteVisual(T,actor,{dt:.04,speed:6,live:true,ballCarrier:true,handedness:side});hands[side]=actor.root.worldToLocal(getAthleteHand(T,actor,side)).toArray();}updateAthleteVisual(T,actor,{dt:0,reset:true,handedness:'left'});return {look,hands};});
  assert.equal(visualChecks.look.upper,visualChecks.look.jersey,'long sleeves recolor actual upper-arm materials');assert.equal(visualChecks.look.forearm,visualChecks.look.jersey,'long sleeves reach actual forearms');assert.equal(visualChecks.look.skin,'4d2e23');assert.equal(visualChecks.look.gloves,'111e29');assert.notEqual(visualChecks.look.teammateForearm,visualChecks.look.jersey,'cosmetics do not recolor teammates');
  assert.ok(visualChecks.hands.right[0]>.15&&visualChecks.hands.left[0]<-.15,'carrying hand follows the chosen body side');for(const point of Object.values(visualChecks.hands))assert.ok(point[1]>.9&&point[1]<1.6,'football stays near the actual torso while carrying');assert.ok(Math.abs(visualChecks.hands.right[1]-visualChecks.hands.left[1])<.03,'mirrored carry has consistent anatomy');
  console.log('PASS four-step creator, rotating imported preview, look/gear save and detailed athlete appearance after reload');

  await page.setViewportSize({width:390,height:844});await sim(0,page,true);const mobileScore=await assertInside('#scoreboard');await assertInside('#skillButton');await assertInside('#callBall');
  for(const selector of ['#touch [data-key]','#touch [data-action]'])for(const control of await page.locator(selector).all()){
   if(!await control.isVisible())continue;const box=await control.boundingBox();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=391&&box.y+box.height<=845,'phone touch control remains on screen');assert.equal(overlaps(box,mobileScore),false,'touch control does not cover score strip');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/glory-v12-mobile.png',animations:'disabled'});
  console.log('PASS phone score strip, call/skill buttons and touch controls stay in view without covering the score');

  const recruitment=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const recruitPage=await recruitment.newPage();recruitPage.setDefaultTimeout(20000);recruitPage.on('pageerror',e=>errors.push(e.message));await recruitPage.addInitScript(()=>requestAnimationFrame=()=>0);
  await recruitPage.goto(ORIGIN+'/?v='+VERSION);await ready(recruitPage);await recruitPage.evaluate(async version=>{const {createCareer,complete}=await import('./career.js?v='+version);const career=createCareer('Recruiting Test','QB');for(let i=0;i<3;i++)complete(career,{yards:400,td:5,comp:10,home:35,away:0});localStorage.setItem('saturday-career-v1',JSON.stringify(career));},VERSION);
  await recruitPage.reload();await ready(recruitPage);await recruitPage.click('#careerContinue');assert.equal(await recruitPage.locator('#panelRecruitment').isVisible(),true);assert.equal(await recruitPage.locator('.offer').count(),12);
  const panel=await recruitPage.locator('#panelRecruitment').boundingBox(),nav=await assertInside('#careerTabs',recruitPage);assert.ok(panel.y+panel.height<=nav.y+1,'recruitment scroll area ends above navigation');const dims=await recruitPage.locator('#panelRecruitment').evaluate(e=>({height:e.clientHeight,total:e.scrollHeight}));assert.ok(dims.total>dims.height);
  const cdp=await recruitment.newCDPSession(recruitPage);const x=Math.round(panel.x+panel.width*.65),from=Math.round(panel.y+panel.height*.85),to=Math.round(panel.y+panel.height*.2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:Math.round(from+(to-from)*i/8)}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await recruitPage.waitForTimeout(150);
  assert.ok(await recruitPage.locator('#panelRecruitment').evaluate(e=>e.scrollTop)>0,'real phone swipe scrolls offers');assert.equal((await recruitPage.locator('#careerTabs').boundingBox()).y,nav.y);
  const last=recruitPage.locator('.offer').filter({hasText:'Penn State'});await last.scrollIntoViewIfNeeded();const button=last.locator('button');const commitBox=await button.boundingBox();assert.ok(commitBox.y+commitBox.height<=nav.y+1,'last commitment stays clear of tabs');await button.click();assert.match(await recruitPage.locator('#careerStage').innerText(),/Penn State/);await recruitment.close();
  console.log('PASS all scholarship offers scroll on touch and last school can be committed without navigation overlap');

  const failures=await browser.newContext({viewport:{width:1100,height:800}}),failurePage=await failures.newPage();failurePage.setDefaultTimeout(20000);await failurePage.addInitScript(()=>requestAnimationFrame=()=>0);await failurePage.route('**/athlete.glb*',route=>route.abort());await failurePage.goto(ORIGIN+'/?v='+VERSION);
  await failurePage.waitForFunction(()=>window.football&&['error','failed'].includes(football.state.assets?.status),{},{polling:100,timeout:30000});assert.equal(await failurePage.locator('#start').isDisabled(),true);assert.equal(await failurePage.locator('#assetRetry').isVisible(),true);await failurePage.unroute('**/athlete.glb*');await failurePage.click('#assetRetry');await ready(failurePage);assert.equal(await failurePage.locator('#start').isEnabled(),true);await failures.close();
  console.log('PASS missing athlete asset is reported, play is gated, and retry restores the real model');
  await page.setViewportSize({width:1440,height:900});await load('QB');
  for(let game=1;game<=3;game++){
   s=await page.evaluate(async()=>{const {step}=await import(document.querySelector('script[type=module]').src);for(let i=0;i<10000;i++){if(football.state.mode==='summary')break;if(football.state.playState==='ready')document.querySelector('[data-action="snap"]').dispatchEvent(new Event('pointerdown'));step(.04,false);}return football.state;});
   assert.equal(s.mode,'summary','complete quick-play game reaches its actual final whistle');assert.equal(await page.locator('#summary').isVisible(),true);assert.equal(await page.locator('#scoreboard').isVisible(),false,'result layout hides match controls');if(game<3)await page.click('#next');
  }
  assert.match(await page.locator('#resultTitle').innerText(),/RECRUITING/);await page.click('#next');assert.equal((await state()).game,1);
  console.log('PASS three complete browser games, recruiting result layout and play-again reset');
  assert.deepEqual(errors,[]);console.log('PASS broadcast graphics/layout integration; no browser runtime errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
