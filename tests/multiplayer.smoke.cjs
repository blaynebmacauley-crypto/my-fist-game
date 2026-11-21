const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const URL=process.env.GAME_URL||'http://127.0.0.1:8091';
const peerOptions={host:'127.0.0.1',port:8092,path:'/signal',secure:false,config:process.env.TEST_TURN_URL?{iceTransportPolicy:'relay',iceServers:[{urls:process.env.TEST_TURN_URL,username:process.env.TEST_TURN_USER||'localqa',credential:process.env.TEST_TURN_PASSWORD||'localqatest'}]}:{iceServers:[]}};
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[];let host,guest;
 async function endpoint(name){const context=await browser.newContext({viewport:{width:1280,height:800}});const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(config=>{requestAnimationFrame=()=>0;window.__SATURDAY_MULTIPLAYER_PEER_OPTIONS__=config},peerOptions);await page.goto(URL+'/?v=online13');await page.waitForFunction(()=>window.football?.state.assets.status==='ready',{},{polling:100});const saved=await page.evaluate(async()=>{const {createCareer,complete}=await import('./career.js?v=online13');const c=createCareer('Solo Save','WR');complete(c,{yards:100,td:1,comp:2,home:7,away:0});const data=JSON.stringify(c);localStorage.setItem('saturday-career-v1',data);return data;});page.beforeCareer=saved;await page.click('#onlineStart');await page.fill('#onlineName',name);return page;}
 const state=p=>p.evaluate(()=>football.state);
 const tick=(p,n=1)=>p.evaluate(async n=>{const {step}=await import(document.querySelector('script[type=module]').src);for(let i=0;i<n;i++)step(.04,false);return football.state;},n);
 async function pump(n=1){for(let i=0;i<n;i++){await tick(guest);await new Promise(r=>setTimeout(r,8));await tick(host);await new Promise(r=>setTimeout(r,8));}}
 async function waitState(page,fn){await page.waitForFunction(fn,{},{polling:50,timeout:15000});}
 async function park(){await host.evaluate(async()=>{const {players}=await import(document.querySelector('script[type=module]').src);for(const p of players.slice(11)){if(p.index===16)continue;p.root.position.set(45,0,85);p.velocity.set(0,0,0);p.speed=0;}});}
 try{
  host=await endpoint('Captain');guest=await endpoint('Rival');
  await host.click('#onlineCreate');await waitState(host,()=>document.querySelector('#onlineRoomCode').textContent.length===10);const code=await host.locator('#onlineRoomCode').innerText();
  await guest.click('#onlineJoinTab');await guest.fill('#onlineJoinCode',code);await guest.click('#onlineJoin');await waitState(host,()=>football.state.multiplayer.connected);await waitState(guest,()=>football.state.multiplayer.connected);
  assert.equal(await host.locator('#onlineStartMatch').isEnabled(),true);assert.equal(await guest.locator('#onlineStartMatch').isVisible(),false);
  await host.screenshot({path:'/tmp/saturday-online-room.png'});console.log('PASS real room creation/join, two-player handshake and host-only start');
  await host.click('#onlineStartMatch');await waitState(guest,()=>football.state.multiplayer.active);await pump(3);
  let h=await state(host),g=await state(guest);assert.equal(h.role,'QB');assert.equal(g.role,'LB');assert.equal(h.controlled,0);assert.equal(g.controlled,16);assert.ok(g.cameraDirection[2]<0);assert.equal(h.homeScore,g.homeScore);assert.ok(g.multiplayer.snapshotsReceived>0);
  await guest.keyboard.press('Space');await pump(2);assert.equal((await state(host)).playState,'ready','defense cannot snap');
  await host.keyboard.press('Space');await park();await pump(3);assert.equal((await state(guest)).playState,'live');
  h=await state(host);const initial=h.positions[16].z,qb=h.positions[0].z;
  await guest.keyboard.down('w');await pump(10);await guest.keyboard.up('w');await pump(4);h=await state(host);g=await state(guest);
  assert.ok(h.positions[16].z<initial-.7,'remote linebacker moves in authoritative host simulation');assert.ok(Math.abs(h.positions[0].z-qb)<.1,'AI does not move a human quarterback');assert.ok(Math.abs(h.positions[16].z-g.positions[16].z)<1,'guest interpolates same physical player');assert.ok(h.multiplayer.inputsReceived>0);assert.ok(Math.abs(h.time-g.time)<.3,'clock shared');
  await guest.keyboard.press('2');await pump(2);assert.equal((await state(host)).attempts,0,'defender cannot launch forward pass');
  await host.keyboard.press('1');await pump(3);h=await state(host);g=await state(guest);assert.equal(h.flight,true);assert.equal(g.flight,true);assert.equal(h.homeScore,g.homeScore);
  console.log('PASS human movement, role camera, shared live clock/ball and offensive passing');
  await pump(60);while((await state(host)).playState!=='ready')await pump(10);
  await host.keyboard.press('Space');await park();await pump(2);
  await host.evaluate(async()=>{const {players}=await import(document.querySelector('script[type=module]').src);players[16].root.position.copy(players[0].root.position);players[16].root.position.z+=.5;players[0].velocity.set(0,0,0);players[0].speed=0;});
  await guest.keyboard.press('e');await pump(5);assert.equal((await state(host)).playState,'tackle');assert.equal((await state(guest)).playState,'tackle');await pump(40);h=await state(host);g=await state(guest);assert.equal(h.down,g.down);assert.equal(h.homeScore,g.homeScore);assert.match(await guest.locator('#stats').innerText(),/1 TKL/);
  console.log('PASS remote human tackle, shared contact animation, downs and defensive stats');
  while((await state(host)).playState!=='ready')await pump(10);
  await host.keyboard.press('Space');await park();await pump(2);await host.evaluate(async()=>{const {players}=await import(document.querySelector('script[type=module]').src);players[0].root.position.z=100.1;players[0].velocity.set(0,0,0);});await pump(3);
  h=await state(host);g=await state(guest);assert.equal(h.homeScore,7);assert.equal(g.homeScore,7);assert.equal(g.awayScore,0);
  await pump(65);h=await state(host);g=await state(guest);assert.equal(h.role,'LB');assert.equal(g.role,'QB');assert.equal(h.controlled,16);assert.equal(g.controlled,0);assert.equal(h.multiplayer.offense,'guest');assert.equal(g.multiplayer.offense,'guest');assert.equal(h.playState,'ready');assert.equal(g.playState,'ready');assert.equal(h.possessions.length,0,'no simulated offense replaces human opponent');
  console.log('PASS shared touchdown score and genuine offense/defense possession swap');
  await guest.selectOption('#offensePlay','out');await pump(3);assert.equal((await state(host)).play.id,'out');
  await guest.keyboard.press('Space');await park();await pump(3);assert.equal((await state(host)).playState,'live');const guestQB=(await state(host)).positions[0].z;await pump(4);assert.ok(Math.abs((await state(host)).positions[0].z-guestQB)<.1,'guest QB is not also AI-controlled');
  await guest.keyboard.press('1');await pump(3);assert.equal((await state(host)).flight,true);assert.equal((await state(guest)).flight,true);assert.match(await guest.locator('#stats').innerText(),/0\/1 PASS/);
  await guest.keyboard.press('p');await pump(3);h=await state(host);assert.equal(h.paused,true);assert.equal((await state(guest)).paused,true);const clock=h.time;await pump(10);assert.equal((await state(host)).time,clock);await host.keyboard.press('p');await pump(3);assert.equal((await state(guest)).paused,false);
  console.log('PASS remote offensive play calls/pass, input authority and synchronized pause');
  // Complete the shared match through actual sacks, downs and possession changes.
  for(let play=0;play<80&&(await state(host)).mode!=='summary';play++){
   let current=await state(host);
   if(current.playState==='ready'){await (current.multiplayer.offense==='host'?host:guest).keyboard.press('Space');await pump(2);}
   await host.evaluate(async()=>{const {step}=await import(document.querySelector('script[type=module]').src);for(let i=0;i<240;i++){if(football.state.mode==='summary'||football.state.playState==='ready')break;step(.04,false);}});
   await tick(host,2);await new Promise(r=>setTimeout(r,20));await tick(guest,2);
  }
  assert.equal((await state(host)).mode,'summary','match reaches its final whistle');await waitState(guest,()=>football.state.mode==='summary');assert.equal(await host.locator('#summary').isVisible(),true);assert.equal(await guest.locator('#summary').isVisible(),true);
  assert.equal(await host.evaluate(()=>localStorage.getItem('saturday-career-v1')),host.beforeCareer);assert.equal(await guest.evaluate(()=>localStorage.getItem('saturday-career-v1')),guest.beforeCareer);
  await guest.click('#next');await pump(3);assert.equal((await state(guest)).mode,'online','completed snapshots do not reopen result after returning to room');await host.click('#next');await pump(3);assert.equal(await host.locator('#onlineStartMatch').isEnabled(),true);const oldMatch=(await state(host)).multiplayer.matchId;await host.click('#onlineStartMatch');await waitState(guest,()=>football.state.mode==='play');await pump(3);h=await state(host);g=await state(guest);assert.notEqual(h.multiplayer.matchId,oldMatch);assert.equal(h.homeScore,0);assert.equal(g.homeScore,0);assert.equal(g.awayScore,0);assert.equal(h.role,'QB');assert.equal(g.role,'LB');
  console.log('PASS full head-to-head final whistle, preserved solo saves and synchronized clean rematch');
  await guest.setViewportSize({width:390,height:844});await pump(2);const badge=await guest.locator('#onlineMatchBadge').boundingBox(),score=await guest.locator('#scoreboard').boundingBox();assert.ok(badge.x>=score.x&&badge.x+badge.width<=score.x+score.width+1);assert.ok(badge.y>=score.y&&badge.y+badge.height<=score.y+score.height+1);
  await guest.click('#onlineMatchLeave');await waitState(host,()=>!football.state.multiplayer.active);assert.equal(await host.locator('#onlineLobby').isVisible(),true);assert.match(await host.locator('#onlineError').innerText(),/left|disconnected/i);assert.equal((await state(guest)).mode,'intro');
  console.log('PASS phone online status, explicit leave and stopped disconnected match');
  assert.deepEqual(errors,[]);console.log('PASS multiplayer football integration with real WebRTC/TCP relay; no browser runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
