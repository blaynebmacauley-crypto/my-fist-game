// Peer-to-peer data transport for the two-player game. The public PeerJS broker
// exchanges connection offers; actual match data travels over a WebRTC channel.
// Public broker/STUN/TURN availability depends on each player's network.
const APP='saturday-lights';
const VERSION=13;
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX='sl13-';
const MAX_BYTES=64*1024;
const CONNECT_TIMEOUT=15000;
const HEARTBEAT_INTERVAL=3000;
const HEARTBEAT_TIMEOUT=20000;
let peerLibraryPromise=null;

function issue(code,message){const error=new Error(message);error.code=code;return error;}
function notify(callback,...args){if(typeof callback!=='function')return;try{callback(...args);}catch(error){setTimeout(()=>{throw error;},0);}}
function randomCode(){
 const bytes=new Uint8Array(10);globalThis.crypto.getRandomValues(bytes);
 return Array.from(bytes,value=>CODE_ALPHABET[value&31]).join('');
}
function nonce(){const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
function plain(value){if(value===null||typeof value!=='object'||Array.isArray(value))return false;const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null;}
function safeJSON(value){
 let nodes=0;
 function visit(item,depth){
  if(++nodes>4096||depth>12)return false;
  if(item===null||typeof item==='boolean')return true;
  if(typeof item==='string')return item.length<=MAX_BYTES;
  if(typeof item==='number')return Number.isFinite(item);
  if(Array.isArray(item))return item.length<=256&&item.every(entry=>visit(entry,depth+1));
  if(!plain(item))return false;
  const keys=Object.keys(item);return keys.length<=128&&keys.every(key=>!['__proto__','prototype','constructor'].includes(key)&&visit(item[key],depth+1));
 }
 try{return plain(value)&&visit(value,0)&&new TextEncoder().encode(JSON.stringify(value)).byteLength<=MAX_BYTES;}catch{return false;}
}

/** Accept a displayed 5-5 code, raw code, or the room link shared by the host. */
export function normalizeRoomCode(value){
 if(typeof value!=='string')throw issue('INVALID_CODE','Enter the 10-character room code.');
 let input=value.trim();
 if(/^https?:\/\//i.test(input)){try{input=new URL(input).searchParams.get('room')||'';}catch{input='';}}
 const code=input.replace(/[\s-]/g,'').toUpperCase();
 if(code.length!==10||Array.from(code).some(letter=>!CODE_ALPHABET.includes(letter)))throw issue('INVALID_CODE','Enter the 10-character room code from your friend.');
 return code;
}
function roomLink(code){const url=new URL(globalThis.location.href);url.searchParams.set('room',code);url.hash='';return url.href;}
function loadPeerLibrary(){
 if(typeof globalThis.Peer==='function')return Promise.resolve(globalThis.Peer);
 if(peerLibraryPromise)return peerLibraryPromise;
 peerLibraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=new URL('./vendor/peerjs.min.js',import.meta.url).href;script.async=true;
  const timeout=setTimeout(()=>finish(issue('LIBRARY_TIMEOUT','The connection library did not load. Check your connection and try again.')),CONNECT_TIMEOUT);
  function finish(error){clearTimeout(timeout);script.onload=null;script.onerror=null;if(error){script.remove();peerLibraryPromise=null;reject(error);}else resolve(globalThis.Peer);}
  script.onload=()=>finish(typeof globalThis.Peer==='function'?null:issue('LIBRARY_FAILED','The multiplayer connection library could not start.'));
  script.onerror=()=>finish(issue('LIBRARY_FAILED','The multiplayer connection library could not be downloaded. Try again.'));
  document.head.appendChild(script);
 });
 return peerLibraryPromise;
}
function peerError(error){
 switch(error?.type){
  case 'peer-unavailable':return issue('ROOM_NOT_FOUND','That room is unavailable. Check the code and make sure your friend keeps the room open.');
  case 'unavailable-id':return issue('ROOM_IN_USE','That room code is in use. Create a new room.');
  case 'browser-incompatible':return issue('UNSUPPORTED_BROWSER','This browser does not support the connection needed for multiplayer. Try a current Chrome, Edge, Firefox or Safari.');
  case 'network':case 'server-error':case 'socket-error':case 'socket-closed':return issue('BROKER_UNAVAILABLE','The room service could not be reached. Check your connection, or try again later.');
  case 'ssl-unavailable':return issue('SECURE_CONNECTION_REQUIRED','Open the game through its secure HTTPS website to play online.');
  default:return issue('CONNECTION_FAILED','The connection could not be established. Both players can leave and try a new room.');
 }
}

export function createMultiplayerTransport({onStatus,onMessage,onPeer,onClose,peerOptions={}}={}){
 let state={seat:null,code:'',status:'idle',connected:false,error:null,errorCode:null,rttMs:null};
 let peer=null,connection=null,session='',generation=0,pending=null,lastPacket=0,heartbeat=null,signalingRetry=null;
 const timers=new Set();
 const snapshot=()=>({...state});
 function status(patch){state={...state,...patch};notify(onStatus,snapshot());}
 function later(callback,delay){const timer=setTimeout(()=>{timers.delete(timer);callback();},delay);timers.add(timer);return timer;}
 function cancelTimer(timer){if(timer){clearTimeout(timer);timers.delete(timer);}}
 function settle(error,value){const operation=pending;if(!operation)return;pending=null;cancelTimer(operation.timeout);if(error)operation.reject(error);else operation.resolve(value);}
 function destroyResources(){
  for(const timer of timers)clearTimeout(timer);timers.clear();
  if(heartbeat)clearInterval(heartbeat);heartbeat=null;
  if(signalingRetry)clearTimeout(signalingRetry);signalingRetry=null;
  const oldConnection=connection,oldPeer=peer;connection=null;peer=null;session='';
  if(oldConnection){oldConnection.removeAllListeners?.();try{oldConnection.close();}catch{}}
  if(oldPeer){oldPeer.removeAllListeners?.();try{oldPeer.destroy();}catch{}}
 }
 function begin(seat,code){
  generation++;settle(issue('CANCELLED','The previous connection was cancelled.'));destroyResources();
  status({seat,code,status:'connecting',connected:false,error:null,errorCode:null,rttMs:null});return generation;
 }
 function fail(error,token=generation){
  if(token!==generation)return;
  const previous=snapshot();generation++;settle(error);destroyResources();
  status({status:'error',connected:false,error:error.message,errorCode:error.code||'CONNECTION_FAILED'});
  notify(onClose,{reason:error.code||'CONNECTION_FAILED',message:error.message,seat:previous.seat,code:previous.code,wasConnected:previous.connected});
 }
 function operation(token){
  return new Promise((resolve,reject)=>{
   const timeout=later(()=>fail(issue('CONNECTION_TIMEOUT','The connection timed out. Both players should check their connection and try again.'),token),CONNECT_TIMEOUT);
   pending={resolve,reject,timeout};
  });
 }
 function sendWire(wire,conn=connection){
  if(!conn?.open)return false;
  try{
   if((conn.dataChannel?.bufferedAmount||0)>256*1024||(conn.bufferSize||0)>32)return false;
   conn.send(wire);return true;
  }catch{return false;}
 }
 function startHeartbeat(token){
  if(heartbeat)clearInterval(heartbeat);lastPacket=performance.now();
  heartbeat=setInterval(()=>{
   if(token!==generation||!state.connected)return;
   if(performance.now()-lastPacket>HEARTBEAT_TIMEOUT){lostConnection('CONNECTION_LOST','The other player stopped responding.');return;}
   sendWire({v:VERSION,t:'ping',s:session,at:performance.now()});
  },HEARTBEAT_INTERVAL);
 }
 function opened(conn,token){
  if(token!==generation||conn!==connection||state.connected)return;
  status({status:'open',connected:true,error:null,errorCode:null});lastPacket=performance.now();startHeartbeat(token);
  settle(null,{code:state.code,link:roomLink(state.code)});
  notify(onPeer,{seat:state.seat,code:state.code,peerId:conn.peer,protocol:VERSION});
 }
 function lostConnection(reason,message){
  const previous=snapshot(),conn=connection;
  if(conn){conn.removeAllListeners?.();try{conn.close();}catch{}}
  connection=null;session='';if(heartbeat)clearInterval(heartbeat);heartbeat=null;
  if(previous.seat==='host'&&peer&&!peer.destroyed&&!peer.disconnected){
   status({status:'hosting',connected:false,error:null,errorCode:null,rttMs:null});
   notify(onClose,{reason,message,seat:previous.seat,code:previous.code,wasConnected:previous.connected});
  }else fail(issue(reason,message));
 }
 function rejectConnection(conn,reason,message){
  const reject=()=>{sendWire({v:VERSION,t:'reject',reason,message},conn);later(()=>{conn.removeAllListeners?.();try{conn.close();}catch{}},150);};
  conn.on('error',()=>{});if(conn.open)reject();else conn.once('open',reject);
  later(()=>{if(!conn.open){conn.removeAllListeners?.();try{conn.close();}catch{}}},CONNECT_TIMEOUT);
 }
 function bindConnection(conn,token,isHost){
  connection=conn;
  let admitted=false;
  const joinTimeout=later(()=>{
   if(token!==generation||connection!==conn||admitted)return;
   if(isHost)lostConnection('CONNECTION_TIMEOUT','The other player could not finish connecting.');
   else fail(issue('CONNECTION_TIMEOUT','The room did not answer. Ask your friend to create a new room.'),token);
  },CONNECT_TIMEOUT);
  conn.on('open',()=>{
   if(token!==generation||connection!==conn)return;
   if(!isHost)sendWire({v:VERSION,t:'join',app:APP,room:state.code},conn);
  });
  conn.on('data',wire=>{
   if(token!==generation||connection!==conn||!safeJSON(wire)||wire.v!==VERSION)return;
   if(!admitted){
    if(wire.t==='reject'&&!isHost){fail(issue(wire.reason==='ROOM_FULL'?'ROOM_FULL':'INCOMPATIBLE_ROOM',wire.reason==='ROOM_FULL'?'This room already has two players. Ask your friend for a new room.':'This room uses a different game version. Both players should refresh the game.'),token);return;}
    if(isHost&&wire.t==='join'&&wire.app===APP&&wire.room===state.code){
     if(!session)session=nonce();sendWire({v:VERSION,t:'welcome',s:session,room:state.code},conn);return;
    }
    if(!isHost&&wire.t==='welcome'&&wire.room===state.code&&typeof wire.s==='string'&&/^[a-f0-9]{32}$/.test(wire.s)){
     session=wire.s;admitted=true;cancelTimer(joinTimeout);sendWire({v:VERSION,t:'ready',s:session},conn);opened(conn,token);return;
    }
    if(isHost&&wire.t==='ready'&&session&&wire.s===session){admitted=true;cancelTimer(joinTimeout);opened(conn,token);}
    return;
   }
   if(wire.s!==session)return;
   lastPacket=performance.now();
   if(wire.t==='ping'&&Number.isFinite(wire.at)){sendWire({v:VERSION,t:'pong',s:session,at:wire.at});return;}
   if(wire.t==='pong'&&Number.isFinite(wire.at)){state.rttMs=Math.max(0,Math.round(performance.now()-wire.at));return;}
   if(wire.t==='data'&&state.connected&&safeJSON(wire.payload))notify(onMessage,wire.payload,{seat:isHost?'guest':'host',code:state.code,peerId:conn.peer,receivedAt:performance.now()});
  });
  conn.on('close',()=>{
   cancelTimer(joinTimeout);if(token!==generation||connection!==conn)return;
   lostConnection('PEER_LEFT','Your friend left the room.');
  });
  conn.on('error',()=>{
   cancelTimer(joinTimeout);if(token!==generation||connection!==conn)return;
   if(isHost)lostConnection('CONNECTION_FAILED','The other player could not stay connected.');else fail(issue('CONNECTION_FAILED','The connection to your friend failed. Both players can try a new room.'),token);
  });
 }
 async function makePeer(seat,code,token){
  if(typeof globalThis.RTCPeerConnection!=='function')throw issue('UNSUPPORTED_BROWSER','This browser does not support online multiplayer. Try a current Chrome, Edge, Firefox or Safari.');
  const Peer=await loadPeerLibrary();if(token!==generation)throw issue('CANCELLED','The connection was cancelled.');
  const id=seat==='host'?PREFIX+code.toLowerCase():PREFIX+'guest-'+randomCode().toLowerCase()+'-'+randomCode().toLowerCase();
  // The library supplies its public STUN/TURN configuration by default. Tests
  // or a separately hosted PeerServer can supply an explicit broker/config.
  // These are the public relay settings shipped by PeerJS, with TCP URLs
  // added for networks that cannot carry direct UDP. No account secret is used.
  const config={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478','turn:eu-0.turn.peerjs.com:3478?transport=tcp','turn:us-0.turn.peerjs.com:3478?transport=tcp'],username:'peerjs',credential:'peerjsp'}]};
  peer=new Peer(id,{debug:0,host:'0.peerjs.com',port:443,path:'/',secure:true,config,...peerOptions});
  const instance=peer;
  instance.on('error',error=>{if(token===generation&&instance===peer)fail(peerError(error),token);});
  instance.on('close',()=>{if(token===generation&&instance===peer)lostConnection('CONNECTION_LOST','The multiplayer connection closed.');});
  instance.on('disconnected',()=>{
   if(token!==generation||instance!==peer)return;
   if(!state.connected){fail(issue('BROKER_UNAVAILABLE','The room service disconnected. Check your connection and try again.'),token);return;}
   // An established RTC channel can keep playing if signaling briefly drops.
   signalingRetry=setTimeout(()=>{signalingRetry=null;if(token===generation&&instance===peer&&!instance.destroyed&&instance.disconnected)try{instance.reconnect();}catch{}},1000);
  });
  instance.on('connection',conn=>{
   if(token!==generation||instance!==peer){try{conn.close();}catch{}return;}
   if(seat!=='host'){rejectConnection(conn,'NOT_HOST','This player is not hosting a room.');return;}
   if(connection){rejectConnection(conn,'ROOM_FULL','This room already has two players.');return;}
   if(conn.metadata?.app!==APP||conn.metadata?.version!==VERSION){rejectConnection(conn,'INCOMPATIBLE_ROOM','Both players must use the same game version.');return;}
   bindConnection(conn,token,true);
  });
  return instance;
 }
 async function createRoom(){
  const code=randomCode(),token=begin('host',code);
  try{
   const wait=operation(token);wait.catch(()=>{});const instance=await makePeer('host',code,token);
   instance.once('open',()=>{if(token!==generation||instance!==peer)return;status({status:'hosting',connected:false});settle(null,{code,link:roomLink(code)});});
   return await wait;
  }catch(error){if(token===generation)fail(error.code?error:peerError(error),token);throw error;}
 }
 async function joinRoom(value){
  const code=normalizeRoomCode(value),token=begin('guest',code);
  try{
   const wait=operation(token);wait.catch(()=>{});const instance=await makePeer('guest',code,token);
   instance.once('open',()=>{
    if(token!==generation||instance!==peer)return;
    status({status:'joining',connected:false});
    const conn=instance.connect(PREFIX+code.toLowerCase(),{label:APP,serialization:'json',reliable:true,metadata:{app:APP,version:VERSION}});
    bindConnection(conn,token,false);
   });
   return await wait;
  }catch(error){if(token===generation)fail(error.code?error:peerError(error),token);throw error;}
 }
 function send(message){
  if(!state.connected||!session||!safeJSON(message))return false;
  const wire={v:VERSION,t:'data',s:session,payload:message};
  // Include framing overhead in the wire limit, rather than passing a barely
  // valid payload that becomes a much larger channel message after framing.
  if(!safeJSON(wire))return false;
  return sendWire(wire);
 }
 function close(){
  if(state.status==='closed'&&!peer&&!connection&&!pending)return;
  const previous=snapshot();generation++;settle(issue('CANCELLED','The connection was closed.'));destroyResources();
  status({seat:null,code:'',status:'closed',connected:false,error:null,errorCode:null,rttMs:null});
  notify(onClose,{reason:'LOCAL_CLOSE',message:'You left the room.',seat:previous.seat,code:previous.code,wasConnected:previous.connected});
 }
 return {createRoom,joinRoom,send,close,getstate:snapshot};
}
