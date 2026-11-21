// Room and connection presentation only. The transport and match own authority.
const CODE_PATTERN=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;
const PHASES=new Set(['idle','connecting','waiting','connected','playing','error','disconnected']);
const copyText=async(value,field,notice)=>{
 try{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);notice.textContent='Copied. Send it to your friend.';return;}
 }catch{}
 field.value=value;field.focus();field.select();field.setSelectionRange(0,value.length);
 let copied=false;try{copied=document.execCommand('copy');}catch{}
 notice.textContent=copied?'Copied. Send it to your friend.':'Selected for copying. Press Ctrl+C, or use your phone’s Copy command.';
};

function nameValue(value){return String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,18)||'Player';}
function codeValue(value){
 let input=String(value||'').trim();
 try{if(/^https?:\/\//i.test(input))input=new URL(input).searchParams.get('room')||'';}catch{return '';}
 const code=input.replace(/[\s-]/g,'').toUpperCase();
 return CODE_PATTERN.test(code)?code:'';
}
function element(tag,options={}){
 const node=document.createElement(tag);
 if(options.id)node.id=options.id;
 if(options.className)node.className=options.className;
 if(options.text!==undefined)node.textContent=options.text;
 for(const [name,value]of Object.entries(options.attrs||{}))node.setAttribute(name,String(value));
 return node;
}
function button(text,id,kind,handler){const node=element('button',{id,className:'sl-online-button '+(kind||''),text,attrs:{type:'button'}});node.addEventListener('click',handler);return node;}
function append(parent,...children){for(const child of children)parent.append(child);return parent;}
function field(labelText,input){const label=element('label',{className:'sl-online-field',text:labelText});label.append(input);return label;}
function inviteLink(code){
 if(!code)return '';
 const link=new URL(location.href);link.searchParams.set('v','online13');link.searchParams.set('room',code);link.hash='';return link.href;
}

const CSS=`
.sl-online-overlay{position:fixed;inset:0;z-index:30;overflow-y:auto;overscroll-behavior:contain;padding:30px 24px 40px;background:linear-gradient(115deg,#04121bf8,#071c2df3 60%,#102c3cdd);color:#eef4f6;font-family:Barlow,"Segoe UI",sans-serif}
.sl-online-overlay[hidden],.sl-online-overlay [hidden],.sl-online-match[hidden]{display:none!important}
.sl-online-shell{width:min(1040px,100%);margin:0 auto;min-height:100%;display:flex;flex-direction:column;justify-content:center}
.sl-online-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 30px}.sl-online-brand{color:#ffc575;font-family:"Barlow Condensed",Barlow,sans-serif;font-size:20px;font-weight:700;letter-spacing:2px}.sl-online-back{border:1px solid #557283;background:#102a3b;color:#d7e8f0;padding:11px 15px;font:700 11px Barlow,sans-serif;letter-spacing:1px;border-radius:5px;cursor:pointer}
.sl-online-content{display:grid;grid-template-columns:minmax(0,.85fr) minmax(340px,1.15fr);gap:50px;align-items:start}.sl-online-eyebrow{color:#ffc575;font-size:11px;letter-spacing:2px;font-weight:700;margin:0 0 16px}.sl-online-title{margin:0 0 18px;font-family:"Barlow Condensed",Barlow,sans-serif;font-size:clamp(42px,5vw,66px);font-weight:700;line-height:.98;letter-spacing:-1px}.sl-online-copy{margin:0 0 22px;color:#b8cbd6;font-size:14px;line-height:1.75;max-width:390px}.sl-online-facts{list-style:none;padding:0;margin:24px 0;display:grid;gap:12px;color:#cfdee6;font-size:12px;line-height:1.6}.sl-online-facts li{border-left:2px solid #6cd8ce;padding-left:14px}.sl-online-controls{color:#92acbc;font-size:11px;line-height:1.8;margin:24px 0 0}.sl-online-controls b{color:#deebf1}.sl-online-footnote{font-size:11px;line-height:1.7;color:#8fa9b9;margin-top:24concatpx}
.sl-online-panel{min-width:0;border:1px solid #4e7185;border-top:3px solid #ffc575;background:linear-gradient(150deg,#143044,#0b202eea);padding:27px;border-radius:7px;box-shadow:0 18px 50px #0004}.sl-online-panel h3{font-family:"Barlow Condensed",Barlow,sans-serif;font-size:27px;letter-spacing:.5px;margin:0 0 13px}.sl-online-panel p{font-size:13px;line-height:1.7;color:#b4cbd8;margin:10px 0 18px}.sl-online-field{display:block;font-size:10px;font-weight:700;letter-spacing:1.3px;color:#bdd2df;margin:0 0 20px}.sl-online-input{display:block;width:100%;min-width:0;margin-top:9px;padding:13px 12px;border:1px solid #4a6b80;background:#0a1f2e;color:#f1f7fa;border-radius:5px;font:16px Barlow,"Segoe UI",sans-serif;letter-spacing:0;line-height:1.25;min-height:47px}.sl-online-code-input{text-transform:uppercase;letter-spacing:1px}.sl-online-tabs{display:flex;gap:5px;padding:4px;background:#061927;border:1px solid #365368;border-radius:5px;margin:0 0 22px}.sl-online-tab{flex:1;min-width:0;padding:12px 7px;background:transparent;border:0;border-radius:3px;color:#9db7c7;font:700 10px Barlow,sans-serif;letter-spacing:1px;cursor:pointer}.sl-online-tab[aria-selected=true]{background:#234355;color:#e8f4f8}.sl-online-button{display:flex;align-items:center;justify-content:center;width:100%;min-height:47px;padding:13px 15px;border:1px solid #55778d;background:#17384c;color:#e2f0f6;border-radius:5px;font:700 11px Barlow,"Segoe UI",sans-serif;letter-spacing:.8px;line-height:1.35;cursor:pointer}.sl-online-button.sl-online-primary{background:#ffc575;border-color:#ffc575;color:#0b1d28}.sl-online-button:disabled{opacity:.42;cursor:default}.sl-online-button:not(:disabled):hover,.sl-online-back:hover{filter:brightness(1.1)}.sl-online-overlay button:focus-visible,.sl-online-overlay input:focus-visible,.sl-online-match button:focus-visible{outline:2px solid #8be6dc;outline-offset:4px}.sl-online-overlay button,.sl-online-overlay input{box-sizing:border-box}
.sl-online-room-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}.sl-online-room-head h3{margin:0;font-size:23px}.sl-online-count{font-size:11px;letter-spacing:1px;font-weight:700;color:#8ee4db;white-space:nowrap}.sl-online-code-label{display:block;color:#9cb6c7;font-size:9px;letter-spacing:2px;text-align:center;margin:17px 0 8px}.sl-online-room-code{display:block;text-align:center;border:1px solid #416378;background:#081e2d;color:#ffe0ad;border-radius:5px;padding:14px 5px;font:700 34px "Barlow Condensed",Barlow,sans-serif;letter-spacing:3px;user-select:all;overflow-wrap:anywhere}.sl-online-share-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:10px 0 16px}.sl-online-share-row button{font-size:9px;min-height:40px;padding:10px 8px}.sl-online-link-field{font-size:8px;margin-bottom:18px}.sl-online-link-field input{font-size:11px;min-height:37px;padding:9px}.sl-online-copy-notice{min-height:20px;font-size:11px!important;color:#8de1d7!important;margin:9px 0!important}.sl-online-roster{display:grid;gap:9px;margin:17px 0 20px}.sl-online-player{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:13px;border:1px solid #38596f;border-left:3px solid #bd637e;border-radius:4px;background:#0d2535}.sl-online-player.sl-online-opponent{border-left-color:#81b5d4}.sl-online-player-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;color:#edf5f8}.sl-online-player-name small{display:block;margin-top:4px;color:#8eacbf;font-size:8px;letter-spacing:1px}.sl-online-player-state{color:#9fe3dc;font-size:9px;letter-spacing:.7px;white-space:nowrap}.sl-online-player-state.sl-online-missing{color:#8fa9ba}.sl-online-room-status{min-height:21px;font-size:12px!important;color:#b9d0dd!important;margin:15px 0!important}.sl-online-leave-room{background:transparent;margin-top:10px;border-color:#35576d;color:#a9c2d2;min-height:39px;font-size:9px}.sl-online-error{background:#44242ad9;border:1px solid #b96b70;border-left-width:3px;color:#ffdbd5;border-radius:4px;padding:13px 14px;margin-bottom:18px;font-size:12px;line-height:1.7;overflow-wrap:anywhere}.sl-online-connecting{padding:15px 0 8px;color:#bed4df;font-size:13px;line-height:1.7}.sl-online-pulse{display:inline-block;width:6px;height:6px;border-radius:50%;background:#85e1d8;margin-right:8px}.sl-online-disclaimer{border-top:1px solid #345569;margin-top:21px;padding-top:14px;font-size:10px!important;line-height:1.7!important;color:#93adbd!important}
.sl-online-match{display:inline-flex;align-items:center;gap:6px;min-width:0;flex-shrink:0;pointer-events:auto;color:#9ae6dc;font:700 8px Barlow,"Segoe UI",sans-serif;letter-spacing:.5px;white-space:nowrap}.sl-online-match-text{display:block;max-width:150px;overflow:hidden;text-overflow:ellipsis}.sl-online-match button{padding:3px 6px;min-height:18px;line-height:1;border:1px solid #477589;background:#102f40;color:#b9dce7;border-radius:3px;font:700 7px Barlow,sans-serif;letter-spacing:.5px;cursor:pointer}.sl-online-match.sl-online-floating{position:fixed;z-index:7;left:26px;bottom:126px;padding:9px 11px;background:#0b2536e8;border:1px solid #47677a;border-radius:4px;font-size:9px}
@media(max-width:800px){.sl-online-content{grid-template-columns:1fr;gap:22px;max-width:580px;margin:0 auto}.sl-online-intro .sl-online-copy,.sl-online-facts,.sl-online-controls{display:none}.sl-online-title{font-size:40px;line-height:1;max-width:none;margin-bottom:0}.sl-online-eyebrow{font-size:9px;margin-bottom:10px}.sl-online-overlay{padding:22px 18px 30px}.sl-online-shell{justify-content:flex-start}.sl-online-top{margin-bottom:23px}.sl-online-footnote{margin-top:13px}.sl-online-panel{padding:22px}}
@media(max-width:480px){.sl-online-overlay{padding:18px 12px 24px}.sl-online-brand{font-size:16px;letter-spacing:1.5px}.sl-online-back{font-size:9px;padding:10px 11px}.sl-online-top{gap:8px;margin-bottom:21px}.sl-online-title{font-size:35px}.sl-online-content{gap:19px}.sl-online-panel{padding:19px 16px}.sl-online-panel h3{font-size:24px}.sl-online-panel p{font-size:12px}.sl-online-field{font-size:9px;margin-bottom:18px}.sl-online-tabs{margin-bottom:18px}.sl-online-tab{font-size:9px;padding:11px 6px}.sl-online-room-head h3{font-size:21px}.sl-online-room-code{font-size:32px;letter-spacing:2px}.sl-online-player{padding:11px}.sl-online-player-name{font-size:13px}.sl-online-player-state{font-size:8px}.sl-online-button{font-size:10px}.sl-online-match{font-size:7px;gap:4px;letter-spacing:.2px}.sl-online-match-text{max-width:92px}.sl-online-match button{font-size:6px;padding:3px 4px}.sl-online-match.sl-online-floating{left:12px;bottom:288px}.sl-online-disclaimer{font-size:9px!important}}
@media(max-height:520px) and (min-width:650px){.sl-online-overlay{padding-top:16px}.sl-online-top{margin-bottom:20px}.sl-online-content{grid-template-columns:minmax(0,.75fr) minmax(320px,1.25fr);gap:25px;max-width:none}.sl-online-title{font-size:39px}.sl-online-panel{padding:20px}.sl-online-intro .sl-online-copy{display:block;font-size:12px}.sl-online-controls,.sl-online-facts{display:none}}
`;

/** The caller owns connections; changing a UI state never creates a peer. */
export function createMultiplayerUI({onCreate,onJoin,onStart,onLeave,onBack,onRetry}={}){
 let opened=false,tab='create',lastFocus=null;
 let state={phase:'idle',seat:null,code:'',localName:'Player',remoteName:'',link:'',hostReady:false,canStart:false,error:'',localRole:''};
 const style=element('style');style.textContent=CSS.replace('24concatpx','24px');document.head.append(style);
 const overlay=element('section',{id:'onlineLobby',className:'sl-online-overlay',attrs:{role:'dialog','aria-modal':'true','aria-labelledby':'onlineLobbyTitle'}});overlay.hidden=true;
 const shell=element('div',{className:'sl-online-shell'}),top=element('div',{className:'sl-online-top'});
 const back=button('BACK TO HOME','onlineBack','',()=>onBack?.());back.className='sl-online-back';
 append(top,element('span',{className:'sl-online-brand',text:'SATURDAY LIGHTS / ONLINE'}),back);
 const content=element('div',{className:'sl-online-content'}),intro=element('div',{className:'sl-online-intro'});
 append(intro,element('div',{className:'sl-online-eyebrow',text:'TWO PLAYERS · HEAD-TO-HEAD'}),element('h2',{id:'onlineLobbyTitle',className:'sl-online-title',text:'YOUR FRIEND.\nTHE OTHER SIDE.'}),element('p',{className:'sl-online-copy',text:'Create a room, send your friend an invite and take the field together. One player attacks while the other controls the defense.'}));
 const facts=element('ul',{className:'sl-online-facts'});
 for(const line of ['Attack as the quarterback and ball carrier.','Defend as the linebacker.','Your controls switch when possession changes.'])facts.append(element('li',{text:line}));
 const controls=element('p',{className:'sl-online-controls'});append(controls,element('b',{text:'ON OFFENSE'}),document.createTextNode('  1 / 2 / 3 to pass.\n'),element('b',{text:'ON DEFENSE'}),document.createTextNode('  E to tackle.\nWASD moves. Shift sprints. Q / E makes a cut.'));
 append(intro,facts,controls);
 const panel=element('div',{className:'sl-online-panel'}),error=element('div',{id:'onlineError',className:'sl-online-error',attrs:{role:'alert'}});error.hidden=true;
 const idle=element('div',{id:'onlineSetup'}),name=element('input',{id:'onlineName',className:'sl-online-input',attrs:{maxlength:'18',autocomplete:'nickname',placeholder:'Your display name'}});name.value='Player';
 idle.append(field('YOUR DISPLAY NAME',name));
 const tabs=element('div',{className:'sl-online-tabs',attrs:{role:'tablist','aria-label':'Room action'}});
 const createTab=button('CREATE A ROOM','onlineCreateTab','',()=>selectTab('create'));createTab.className='sl-online-tab';createTab.setAttribute('role','tab');
 const joinTab=button('JOIN A FRIEND','onlineJoinTab','',()=>selectTab('join'));joinTab.className='sl-online-tab';joinTab.setAttribute('role','tab');
 append(tabs,createTab,joinTab);idle.append(tabs);
 const createPanel=element('div',{id:'onlineCreatePanel'}),joinPanel=element('form',{id:'onlineJoinPanel'});
 append(createPanel,element('h3',{text:'HOST THE MATCH'}),element('p',{text:'Create a private room and share its code or invite link. Keep this tab open while you play.'}),button('CREATE HEAD-TO-HEAD ROOM','onlineCreate','sl-online-primary',()=>{clearLocalError();state.localName=nameValue(name.value);name.value=state.localName;onCreate?.({name:state.localName});}));
 const code=element('input',{id:'onlineJoinCode',className:'sl-online-input sl-online-code-input',attrs:{autocomplete:'off',spellcheck:'false',autocapitalize:'characters',placeholder:'10-character code or invite link',maxlength:'512'}});
 code.addEventListener('paste',event=>{const normalized=codeValue(event.clipboardData?.getData('text'));if(normalized){event.preventDefault();code.value=normalized;}});
 const join=button('JOIN HEAD-TO-HEAD ROOM','onlineJoin','sl-online-primary',submitJoin);join.type='submit';join.removeEventListener('click',submitJoin);
 joinPanel.addEventListener('submit',event=>{event.preventDefault();submitJoin();});
 append(joinPanel,element('h3',{text:'TAKE THE OTHER SIDE'}),element('p',{text:'Ask your friend to create a room, then enter their game code or paste the full invite link.'}),field('GAME CODE OR INVITE LINK',code),join);
 append(idle,createPanel,joinPanel);
 const connecting=element('div',{id:'onlineConnecting',className:'sl-online-connecting',attrs:{role:'status'}});append(connecting,element('span',{className:'sl-online-pulse'}),document.createTextNode('Opening your connection…'));
 const room=element('div',{id:'onlineRoom'}),roomHead=element('div',{className:'sl-online-room-head'}),count=element('span',{id:'onlinePlayerCount',className:'sl-online-count'});
 append(roomHead,element('h3',{text:'YOUR MATCH ROOM'}),count);room.append(roomHead);
 const roomCode=element('output',{id:'onlineRoomCode',className:'sl-online-room-code',attrs:{'aria-label':'Game room code'}}),link=element('input',{id:'onlineInviteLink',className:'sl-online-input',attrs:{readonly:'readonly','aria-label':'Invite link'}});
 const codeBackup=element('input',{className:'sl-online-input',attrs:{readonly:'readonly','aria-label':'Room code for copying'}});codeBackup.hidden=true;
 const notice=element('p',{id:'onlineCopyNotice',className:'sl-online-copy-notice',attrs:{role:'status','aria-live':'polite'}});
 const shareRow=element('div',{className:'sl-online-share-row'});
 append(shareRow,button('COPY GAME CODE','onlineCopyCode','',()=>{codeBackup.hidden=false;copyText(state.code,codeBackup,notice).finally(()=>{if(document.activeElement!==codeBackup)codeBackup.hidden=true;});}),button('COPY INVITE LINK','onlineCopyInvite','',()=>copyText(link.value,link,notice)));
 const roster=element('div',{className:'sl-online-roster'}),local=playerRow(false),remote=playerRow(true);
 append(roster,local.row,remote.row);
 const roomStatus=element('p',{id:'onlineRoomStatus',className:'sl-online-room-status',attrs:{role:'status','aria-live':'polite'}});
 const start=button('START HEAD-TO-HEAD','onlineStartMatch','sl-online-primary',()=>{if(state.seat==='host'&&state.phase==='connected'&&state.canStart)onStart?.();});
 const leave=button('LEAVE ROOM','onlineLeaveRoom','sl-online-leave-room',()=>onLeave?.());
 append(room,element('span',{className:'sl-online-code-label',text:'SHARE THIS GAME CODE'}),roomCode,shareRow,field('INVITE LINK',link),codeBackup,notice,roster,roomStatus,start,leave);
 const retry=button('TRY AGAIN','onlineRetry','',()=>onRetry?.());
 append(panel,error,idle,connecting,room,retry,element('p',{className:'sl-online-disclaimer',text:'Friendly matches are separate from your saved career. Keep the host’s tab open for the whole game.'}));
 append(content,intro,panel);append(shell,top,content);overlay.append(shell);document.body.append(overlay);
 const match=element('div',{id:'onlineMatchBadge',className:'sl-online-match'});match.hidden=true;
 const matchText=element('span',{id:'onlineMatchStatus',className:'sl-online-match-text'}),matchLeave=button('LEAVE','onlineMatchLeave','',()=>onLeave?.());matchLeave.className='';append(match,matchText,matchLeave);document.body.append(match);
 let originalBadge=null,originalBadgeHidden=false;

 function playerRow(opponent){const row=element('div',{className:'sl-online-player'+(opponent?' sl-online-opponent':'')}),label=element('div',{className:'sl-online-player-name'}),title=element('span'),detail=element('small'),connection=element('span',{className:'sl-online-player-state'});append(label,title,detail);append(row,label,connection);return {row,title,detail,connection};}
 function clearLocalError(){state.error='';error.hidden=true;}
 function submitJoin(){
  if(state.phase==='connecting')return;
  const normalized=codeValue(code.value);
  if(!normalized){state.error='Enter the 10-character game code, or paste your friend’s full invite link. Codes do not use I, O, 0 or 1.';error.textContent=state.error;error.hidden=false;code.focus();return;}
  clearLocalError();code.value=normalized;state.localName=nameValue(name.value);name.value=state.localName;onJoin?.({name:state.localName,code:normalized});
 }
 function selectTab(value){tab=value;clearLocalError();createTab.setAttribute('aria-selected',String(tab==='create'));joinTab.setAttribute('aria-selected',String(tab==='join'));createPanel.hidden=tab!=='create';joinPanel.hidden=tab!=='join';}
 function mountBadge(){
  const ticker=document.querySelector('.scorebug-ticker');
  if(ticker&&match.parentElement!==ticker){ticker.prepend(match);match.classList.remove('sl-online-floating');}
  if(!ticker)match.classList.add('sl-online-floating');
  const previous=document.querySelector('.scorebug-ticker > .broadcast-badge');
  if(previous&&previous!==originalBadge){originalBadge=previous;originalBadgeHidden=previous.hidden;}
  if(originalBadge)originalBadge.hidden=opened&&state.phase==='playing'?true:originalBadgeHidden;
 }
 function render(){
  const playing=state.phase==='playing',connected=state.phase==='connected'||playing,busy=state.phase==='connecting',hasRoom=!!state.code;
  overlay.hidden=!opened||playing;overlay.dataset.phase=state.phase;match.hidden=!opened||!playing;mountBadge();
  error.hidden=!state.error;if(state.error)error.textContent=state.error;
  idle.hidden=hasRoom||busy;connecting.hidden=!busy||hasRoom;room.hidden=!hasRoom;retry.hidden=!(state.phase==='error'||state.phase==='disconnected')||typeof onRetry!=='function';
  createTab.disabled=joinTab.disabled=busy;name.disabled=busy;code.disabled=busy;join.disabled=busy;
  if(hasRoom){
   roomCode.textContent=state.code;link.value=state.link||inviteLink(state.code);count.textContent=(connected?'2':'1')+' / 2 PLAYERS';
   local.title.textContent=nameValue(state.localName)+' · YOU';local.detail.textContent=state.seat==='guest'?'DEFENSE FIRST':'OFFENSE FIRST';local.connection.textContent=state.phase==='error'?'CHECK CONNECTION':'READY';
   remote.title.textContent=state.remoteName?nameValue(state.remoteName):'Waiting for your friend';remote.detail.textContent=state.seat==='guest'?'HOST · OFFENSE FIRST':'GUEST · DEFENSE FIRST';remote.connection.textContent=connected?'CONNECTED':'NOT CONNECTED';remote.connection.classList.toggle('sl-online-missing',!connected);
   start.hidden=state.seat!=='host';start.disabled=!(state.phase==='connected'&&state.canStart);
   roomStatus.textContent=state.phase==='disconnected'?'Your friend disconnected. The match is stopped.':state.phase==='error'?'The connection could not be completed. Try again, or leave the room.':busy?'Connecting to your friend…':connected?(state.seat==='host'?(state.canStart?'Both players are connected. Start when you are ready.':'Your friend is loading the field. The match will be ready shortly.'):'You are connected. Waiting for the host to start.'):'Send the invite link or game code to your friend.';
  }
  const role=state.localRole|| (state.seat==='guest'?'LB':'QB');matchText.textContent='ONLINE · YOU: '+role;match.title=state.remoteName?'Playing against '+nameValue(state.remoteName):'Online head-to-head';
 }
 function focusTrap(event){
  if(overlay.hidden)return;
  if(event.key==='Escape'){event.preventDefault();onBack?.();}
  if(event.key==='Tab'){
   const visible=[...overlay.querySelectorAll('button,input,a[href]')].filter(node=>!node.disabled&&!node.hidden&&node.getClientRects().length);
   if(visible.length){const first=visible[0],last=visible[visible.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  }
  event.stopPropagation();
 }
 overlay.addEventListener('keydown',focusTrap);match.addEventListener('keydown',event=>event.stopPropagation());
 selectTab('create');render();
 const api={
  show(patch={}){lastFocus=document.activeElement;opened=true;api.update(patch);if(state.phase==='idle'){if(codeValue(patch.code)){tab='join';code.value=codeValue(patch.code);selectTab('join');}requestAnimationFrame(()=>name.focus());}else requestAnimationFrame(()=>back.focus());return api;},
  hide(){opened=false;render();if(lastFocus?.isConnected)lastFocus.focus();return api;},
  update(patch={}){state={...state,...patch};if(!PHASES.has(state.phase))state.phase='idle';if(state.code)state.code=codeValue(state.code);if(patch.localName!==undefined){state.localName=nameValue(patch.localName);if(document.activeElement!==name)name.value=state.localName;}if(patch.code&&state.phase==='idle'){code.value=codeValue(patch.code)||String(patch.code);selectTab('join');state.code='';}render();return api;},
  showError(message){opened=true;state.phase='error';state.error=String(message||'The connection could not be completed.');render();return api;},
  destroy(){if(originalBadge)originalBadge.hidden=originalBadgeHidden;overlay.remove();match.remove();style.remove();},
  get state(){return {...state,tab,visible:!overlay.hidden,badgeVisible:!match.hidden};},
 };
 return api;
}
