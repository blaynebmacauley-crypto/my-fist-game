// Real school names; recruiting thresholds, coaches, rosters and uniforms are fictional prototype data.
export const schools=[
 ['Georgia',4,'#b01f36'],['Alabama',4,'#9e1b32'],['Ohio State',4,'#bb2438'],['Michigan',4,'#163957'],['Texas',3,'#bf6532'],['Oregon',3,'#146c48'],['LSU',3,'#58378c'],['Clemson',2,'#e65e26'],['Florida',2,'#2659ac'],['Tennessee',2,'#ef8b23'],['Auburn',1,'#243d60'],['Penn State',3,'#233954']
].map(([name,need,color])=>({name,need,color,coach:'Coach '+({Georgia:'Rivera',Alabama:'Ellis','Ohio State':'Brooks'}[name]||'Morgan')+' (fictional)',style:'Prototype scholarship · '+need+'-star threshold'}));
export const positions=['QB','RB','WR','LB'];
export function createCareer(name,position='QB',archetype){const c={version:1,highSchool:'STATE',position:positions.includes(position)?position:'QB',archetype,tackles:0,name:name.trim().slice(0,18)||'Jordan Hayes',games:0,trust:45,xp:0,points:0,school:null,practiced:-1,wins:0,log:[]};return ensureDevelopment(c);}
export function stars(c){return Math.min(5,Math.max(1,1+Math.floor(c.points/35)));}
export function offers(c){return schools.filter(s=>stars(c)>=s.need);}
export function practice(c){if(c.practiced===c.games||c.games>=15)return false;c.practiced=c.games;c.trust=Math.min(100,c.trust+5);c.xp+=20;return true;}
export function complete(c,result){if(c.games>=15||(c.games>=3&&!c.school))throw Error('Career game not available');const win=result.home>result.away;c.tackles=(c.tackles||0)+(result.tackles||0);c.games++;c.wins+=Number(win);c.points+=Math.max(0,result.yards)*.12+result.td*12+result.comp*2+(win?20:0)+(result.tackles||0)*4;c.xp+=Math.max(10,Math.round(Math.max(0,result.yards)+result.td*50+(result.tackles||0)*15));c.trust=Math.max(0,Math.min(100,c.trust+(win?6:2)+(result.comp>=3?3:0)));c.log.push({yards:Math.round(result.yards),td:result.td,home:result.home,away:result.away});}
export function commit(c,name){if(c.games!==3||c.school||!offers(c).some(s=>s.name===name))return false;c.school=name;return true;}
export function validCareer(c){
 if(!c||c.version!==1||typeof c.name!=='string'||!(c.position===undefined||positions.includes(c.position))||!Number.isInteger(c.games)||c.games<0||c.games>15||!['trust','xp','points','wins','practiced'].every(k=>Number.isFinite(c[k]))||c.trust<0||c.trust>100||c.xp<0||c.points<0||!Number.isInteger(c.wins)||c.wins<0||c.wins>c.games||!Number.isInteger(c.practiced)||c.practiced< -1||c.practiced>c.games||!Array.isArray(c.log)||c.log.length!==c.games||!(c.school===null||schools.some(s=>s.name===c.school))||(c.games>3&&c.school===null))return false;
 const role=c.position||'QB';
 if(c.archetype!==undefined&&!archetypes[role].some(a=>a.id===c.archetype))return false;
 if(c.upgrades!==undefined){
  if(!c.upgrades||typeof c.upgrades!=='object'||Array.isArray(c.upgrades))return false;
  for(const [key,value] of Object.entries(c.upgrades)){const d=upgradeDefinitions.find(d=>d.key===key);if(!d||!Number.isInteger(value)||value<0||value>d.maxLevel||(value>0&&!d.positions.includes(role)))return false;}
 }
 const required=developmentCost(c.upgrades||{});
 return required<=c.xp&&(c.xpSpent===undefined||(Number.isFinite(c.xpSpent)&&c.xpSpent===required));
}

// Archetype advantages modify the same ratings that between-game upgrades use.
export const archetypes={
 QB:[
  {id:'pocket-passer',name:'Pocket Passer',description:'More precise passing; trades some mobility.',bonuses:{throwing:10,stamina:2,speed:-3}},
  {id:'dual-threat',name:'Dual Threat',description:'A quicker scrambler with a balanced arm.',bonuses:{speed:7,throwing:4}},
  {id:'field-general',name:'Field General',description:'Sustained pocket play and dependable throws.',bonuses:{stamina:8,throwing:6}}
 ],
 RB:[
  {id:'power-back',name:'Power Back',description:'Stronger lead-block support and tough inside runs.',bonuses:{blocking:10,stamina:6,speed:-2}},
  {id:'elusive-back',name:'Elusive Back',description:'Quick burst through the running lane.',bonuses:{speed:8,stamina:4}},
  {id:'workhorse',name:'Workhorse',description:'Longer stamina reserve and steady blocking support.',bonuses:{stamina:12,blocking:4}}
 ],
 WR:[
  {id:'route-runner',name:'Route Runner',description:'Reliable catches and sustained route stamina.',bonuses:{catching:8,stamina:6}},
  {id:'deep-threat',name:'Deep Threat',description:'More speed to separate downfield.',bonuses:{speed:9,catching:3}},
  {id:'possession',name:'Possession Receiver',description:'A wider catch window with less top speed.',bonuses:{catching:12,blocking:3,speed:-2}}
 ],
 LB:[
  {id:'run-stopper',name:'Run Stopper',description:'A stronger tackle window against the run.',bonuses:{tackling:10,blocking:5}},
  {id:'coverage',name:'Coverage Linebacker',description:'More range and stamina underneath routes.',bonuses:{speed:6,stamina:6}},
  {id:'pass-rusher',name:'Pass Rusher',description:'Burst and tackling for the blitz.',bonuses:{tackling:7,speed:5}}
 ]
};
export const upgradeDefinitions=[
 {key:'speed',name:'Speed',description:'Improve movement and sprint burst.',positions:['QB','RB','WR','LB'],baseCost:35,gain:4,maxLevel:3},
 {key:'stamina',name:'Stamina',description:'Sprint longer before tiring.',positions:['QB','RB','WR','LB'],baseCost:25,gain:4,maxLevel:3},
 {key:'throwing',name:'Passing',description:'Improve throw precision and ball speed.',positions:['QB'],baseCost:30,gain:4,maxLevel:3},
 {key:'catching',name:'Catching',description:'Increase your playable catch window.',positions:['WR'],baseCost:30,gain:4,maxLevel:3},
 {key:'tackling',name:'Tackling',description:'Increase your user tackle reach.',positions:['LB'],baseCost:30,gain:4,maxLevel:3},
 {key:'blocking',name:'Run Support',description:'Stronger lead-block engagement for your carries.',positions:['RB'],baseCost:30,gain:4,maxLevel:3}
];
const baseline={speed:65,stamina:65,throwing:65,catching:65,tackling:65,blocking:65};
function developmentCost(upgrades){return upgradeDefinitions.reduce((sum,d)=>{const level=upgrades[d.key]||0;return sum+d.baseCost*level*(level+1)/2;},0);}
export function ensureDevelopment(c){
 c.position=positions.includes(c.position)?c.position:'QB';
 if(!archetypes[c.position].some(a=>a.id===c.archetype))c.archetype=archetypes[c.position][0].id;
 const raw=c.upgrades&&typeof c.upgrades==='object'?c.upgrades:{};
 c.upgrades=Object.fromEntries(upgradeDefinitions.map(d=>[d.key,d.positions.includes(c.position)&&Number.isInteger(raw[d.key])?Math.max(0,Math.min(d.maxLevel,raw[d.key])):0]));
 const spent=developmentCost(c.upgrades),earned=Number.isFinite(c.xp)?Math.max(0,c.xp):0;
 // Corrupt/overspent upgrade state cannot grant free attributes. Lifetime earned XP is preserved.
 if(spent>earned){for(const key of Object.keys(c.upgrades))c.upgrades[key]=0;c.xpSpent=0;}
 else c.xpSpent=spent;
 return c;
}
export function availableXP(c){ensureDevelopment(c);return Math.max(0,(Number.isFinite(c.xp)?c.xp:0)-c.xpSpent);}
export function upgradeCost(c,key){const d=upgradeDefinitions.find(d=>d.key===key&&d.positions.includes(c.position||'QB'));if(!d)return Infinity;const level=c.upgrades?.[key]||0;return level>=d.maxLevel?Infinity:d.baseCost*(level+1);}
export function purchaseUpgrade(c,key){
 if(!validCareer(c)||c.games<1||c.games>=15)return false;ensureDevelopment(c);
 const cost=upgradeCost(c,key);if(!Number.isFinite(cost)||availableXP(c)<cost)return false;
 c.upgrades[key]++;c.xpSpent+=cost;return true;
}
export function playerAttributes(c){
 ensureDevelopment(c);const a=archetypes[c.position].find(a=>a.id===c.archetype),ratings={...baseline};
 for(const key of Object.keys(ratings)){const d=upgradeDefinitions.find(d=>d.key===key);ratings[key]=Math.max(0,Math.min(100,ratings[key]+(a.bonuses[key]||0)+(c.upgrades[key]||0)*d.gain));}
 return ratings;
}
