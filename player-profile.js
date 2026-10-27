// Cosmetic player-creator data only. Apply physique to visual meshes, never to
// collision radii, speed, tackle reach, ratings, or other gameplay rules.
export const skinTones = Object.freeze([
  {id:'fair', label:'Fair', color:'#e3b79a'},
  {id:'light', label:'Light', color:'#d39c78'},
  {id:'tan', label:'Tan', color:'#b97c55'},
  {id:'brown', label:'Brown', color:'#925a3d'},
  {id:'deep', label:'Deep brown', color:'#70432e'},
  {id:'dark', label:'Dark', color:'#4d2e23'},
].map(Object.freeze));
export const builds = Object.freeze([
  {id:'lean', label:'Lean'},
  {id:'balanced', label:'Balanced'},
  {id:'power', label:'Power'},
].map(Object.freeze));

const stateCodes = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI'.split(' '));
const choices = {
  skinTone: skinTones.map(tone=>tone.id),
  build: builds.map(build=>build.id),
  helmetFinish:['gloss','matte'],
  visor:['clear','smoke','none'],
  gloves:['white','black','team'],
  sleeves:['none','short','long'],
  dominantHand:['right','left'],
};

export function defaultProfile(){
  return {
    hometown:'Riverton', state:'GA', jersey:7, heightInches:74,
    weightLbs:210, skinTone:'brown', build:'balanced',
    helmetFinish:'gloss', visor:'clear', gloves:'white', sleeves:'short',
    dominantHand:'right',
  };
}

function own(source,key){return Object.hasOwn(source,key)?source[key]:undefined;}
function integer(value, fallback, minimum, maximum){
  const number=typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;
  return Number.isFinite(number)?Math.max(minimum,Math.min(maximum,Math.round(number))):fallback;
}

/** Fill older saves and form values using only the documented cosmetic fields. */
export function normalizeProfile(raw){
  const result=defaultProfile();
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const hometown=own(source,'hometown');
  if(typeof hometown==='string'){
    const text=hometown.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim().slice(0,32).trim();
    if(text)result.hometown=text;
  }
  const state=own(source,'state');
  if(typeof state==='string'&&stateCodes.has(state.trim().toUpperCase()))result.state=state.trim().toUpperCase();
  result.jersey=integer(own(source,'jersey'),result.jersey,1,99);
  result.heightInches=integer(own(source,'heightInches'),result.heightInches,66,80);
  result.weightLbs=integer(own(source,'weightLbs'),result.weightLbs,165,285);
  for(const [key,values] of Object.entries(choices)){
    const value=own(source,key);
    if(typeof value==='string'&&values.includes(value))result[key]=value;
  }
  return result;
}

/** Validate a complete, canonical saved profile. Normalize partial form data first. */
export function validateProfile(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const normalized=normalizeProfile(raw),keys=Object.keys(normalized);
  return Object.keys(raw).length===keys.length&&keys.every(key=>Object.hasOwn(raw,key)&&raw[key]===normalized[key]);
}

/** Conservative visual proportions; they do not alter collision or gameplay. */
export function physique(raw){
  const profile=normalizeProfile(raw);
  const width=profile.build==='lean'?.96:profile.build==='power'?1.06:1;
  const depth=profile.build==='lean'?.98:profile.build==='power'?1.04:1;
  const cap=value=>Math.round(Math.max(.88,Math.min(1.16,value))*10000)/10000;
  return {
    x:cap(Math.sqrt(profile.weightLbs/210)*width),
    y:Math.round(profile.heightInches/74*10000)/10000,
    z:cap(Math.pow(profile.weightLbs/210,.28)*depth),
  };
}

/** Plain display text. Render as textContent rather than HTML. */
export function profileSummary(raw){
  const profile=normalizeProfile(raw);
  const feet=Math.floor(profile.heightInches/12),inches=profile.heightInches%12;
  return '#'+profile.jersey+' · '+feet+'′'+inches+'″ · '+profile.weightLbs+' lb · '+builds.find(build=>build.id===profile.build).label+' · '+profile.hometown+', '+profile.state;
}
