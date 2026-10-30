// Small defensive playbook for the single-player prototype. Coordinates are yards.
// The user's linebacker remains slot 16 in every personnel grouping.
export const defensiveFormations=[
 {id:'4-3',name:'4–3 Cover 2',description:'Four down linemen, three underneath linebackers and two deep safeties.'},
 {id:'3-4',name:'3–4 Edge Pressure',description:'Three down linemen, an outside-linebacker rush and four-linebacker personnel.'},
 {id:'nickel',name:'Nickel Match',description:'Four down linemen, two linebackers and five defensive backs to match spread receivers.'},
 {id:'goal-line',name:'Goal Line',description:'Five down linemen and shallow support to defend short-yardage runs.'}
];
const formationsById=new Map(defensiveFormations.map(f=>[f.id,f]));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function getFormation(idOrObject='4-3'){
 const id=typeof idOrObject==='string'?idOrObject:idOrObject?.id;
 const formation=formationsById.get(id);
 if(!formation)throw new RangeError('Unknown defensive formation');
 return {...formation};
}

/** Contextual CPU choice. A player can select any listed formation explicitly. */
export function defensiveFormation(sequence=0,{spot=25}={}){
 if(!Number.isFinite(sequence)||!Number.isFinite(spot))throw new TypeError('Defensive sequence and spot must be finite');
 if(spot>=85)return getFormation('goal-line');
 const book=['4-3','3-4','nickel'];
 const index=((Math.floor(sequence)%book.length)+book.length)%book.length;
 return getFormation(book[index]);
}

// Tuple: index, x, depth beyond scrimmage, assignment, optional covered receiver.
const alignments={
 '4-3':[
  [11,-4,1,'rush'],[12,-1.3,1,'rush'],[13,1.3,1,'rush'],[14,4,1,'rush'],
  [15,-7,4.8,'zone'],[16,0,4.8,'zone'],[17,7,4.8,'zone'],
  [18,-20,3.5,'man',6],[19,18,3.5,'man',7],
  [20,-9,13,'deep'],[21,9,13,'deep']
 ],
 '3-4':[
  [11,-3.7,1,'rush'],[12,0,1,'rush'],[13,3.7,1,'rush'],
  [14,-7,2.2,'blitz'],[15,7,3.6,'zone'],[16,-2.3,5,'zone'],[17,2.3,5,'zone'],
  [18,-20,4,'man',6],[19,18,4,'man',7],
  [20,-10,14,'deep'],[21,10,14,'deep']
 ],
 nickel:[
  [11,-4.5,1.1,'rush'],[12,-1.5,1.1,'rush'],[13,1.5,1.1,'rush'],[14,4.5,1.1,'rush'],
  [15,-4,5,'zone'],[16,4,5,'zone'],
  [17,-11,5,'man',8],[18,-20,4.5,'man',6],[19,18,4.5,'man',7],
  [20,-10,15,'deep'],[21,10,15,'deep']
 ],
 'goal-line':[
  [11,-6,.65,'rush'],[12,-3,.65,'rush'],[13,0,.65,'rush'],[14,3,.65,'rush'],[15,6,.65,'rush'],
  [16,0,2.2,'zone'],[17,-5.8,2.4,'blitz'],[18,5.8,2.4,'zone'],
  [19,-18,1.5,'man',6],[20,18,1.5,'man',7],[21,0,6,'deep']
 ]
};

/** World-space alignment and assignments. End-zone depth shrinks near the goal. */
export function defensiveAlignment(idOrObject='4-3',spot=25){
 if(!Number.isFinite(spot))throw new TypeError('Defensive field position must be finite');
 const {id}=getFormation(idOrObject),line=clamp(spot,0,100);
 return alignments[id].map(([index,x,depth,assignment,cover])=>{
  // Preserve relative depths within the remaining end-zone space rather than
  // putting every defender at the same hard-clamped back boundary.
  const depthScale=Math.min(1,(108-line)/15);
  const z=clamp(line+depth*depthScale,0,108);
  const player={index,x,z,assignment};
  if(cover!==undefined)player.cover=cover;
  if(assignment==='zone'||assignment==='deep'){player.zoneX=x;player.zoneZ=z;}
  return player;
 });
}

function defenderSlot(index){
 if(!Number.isInteger(index)||index<11||index>21)throw new RangeError('Defender index must be 11 through 21');
 return index-11;
}

/** Stagger the read step so the entire defense does not move on one frame. */
export function defensiveReaction(index,playNumber=0){
 const slot=defenderSlot(index);
 if(!Number.isFinite(playNumber))throw new TypeError('Play number must be finite');
 const variation=((slot*7+Math.floor(playNumber)*3)%11+11)%11/10;
 return clamp((index<15?.2:index<18?.29:.38)+variation*.2,.2,.65);
}

/** Chase present movement with limited anticipation and different pursuit lanes.
 * Returns a destination only: movement, collisions and speed remain in the game.
 */
export function pursuitTarget({index,runner,defender,spot=25,elapsed=0}){
 const slot=defenderSlot(index),vx=runner?.vx??0,vz=runner?.vz??0;
 for(const value of [runner?.x,runner?.z,defender?.x,defender?.z,vx,vz,spot,elapsed])if(!Number.isFinite(value))throw new TypeError('Pursuit coordinates and time must be finite');
 const distance=Math.hypot(runner.x-defender.x,runner.z-defender.z);
 // Near contact, everyone aims for the runner. Farther away, distinct lanes
 // leave cutback opportunities and keep the defense from forming one train.
 const spacing=clamp((distance-1.3)/7,0,1),read=clamp((elapsed-.12)/.55,0,1);
 const cap=index<15?.24:index<18?.42:.62;
 const lead=Math.min(cap,distance/16)*read;
 const lateral=clamp(vx,-8,8),forward=clamp(vz,-8,8);
 const side=defender.x===runner.x?(slot%2?-1:1):Math.sign(defender.x-runner.x);
 let leverage;
 if(index<15){
  // Front players protect their side of a developing run before turning upfield.
  leverage=side*(runner.z<spot+4?.55:.2);
 }else if(index<18){
  leverage=side*(.25+(slot%3)*.12);
 }else{
  // The secondary takes an inside angle and uses the boundary as support.
  leverage=-Math.sign(runner.x)*(.6+(slot%3)*.13);
 }
 return {
  x:clamp(runner.x+lateral*lead+leverage*spacing,-26,26),
  z:clamp(runner.z+forward*lead,-8,108)
 };
}
