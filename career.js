// Real school names; recruiting thresholds, coaches, rosters and uniforms are fictional prototype data.
export const schools=[
 ['Georgia',4,'#b01f36'],['Alabama',4,'#9e1b32'],['Ohio State',4,'#bb2438'],['Michigan',4,'#163957'],['Texas',3,'#bf6532'],['Oregon',3,'#146c48'],['LSU',3,'#58378c'],['Clemson',2,'#e65e26'],['Florida',2,'#2659ac'],['Tennessee',2,'#ef8b23'],['Auburn',1,'#243d60'],['Penn State',3,'#233954']
].map(([name,need,color])=>({name,need,color,coach:'Coach '+({Georgia:'Rivera',Alabama:'Ellis','Ohio State':'Brooks'}[name]||'Morgan')+' (fictional)',style:'Prototype scholarship · '+need+'-star threshold'}));
export const positions=['QB','RB','WR','LB'];
export function createCareer(name,position='QB'){return {version:1,position:positions.includes(position)?position:'QB',tackles:0,name:name.trim().slice(0,18)||'Jordan Hayes',games:0,trust:45,xp:0,points:0,school:null,practiced:-1,wins:0,log:[]};}
export function stars(c){return Math.min(5,Math.max(1,1+Math.floor(c.points/35)));}
export function offers(c){return schools.filter(s=>stars(c)>=s.need);}
export function practice(c){if(c.practiced===c.games||c.games>=15)return false;c.practiced=c.games;c.trust=Math.min(100,c.trust+5);c.xp+=20;return true;}
export function complete(c,result){if(c.games>=15||(c.games>=3&&!c.school))throw Error('Career game not available');const win=result.home>result.away;c.tackles=(c.tackles||0)+(result.tackles||0);c.games++;c.wins+=Number(win);c.points+=Math.max(0,result.yards)*.12+result.td*12+result.comp*2+(win?20:0)+(result.tackles||0)*4;c.xp+=Math.max(10,Math.round(Math.max(0,result.yards)+result.td*50+(result.tackles||0)*15));c.trust=Math.max(0,Math.min(100,c.trust+(win?6:2)+(result.comp>=3?3:0)));c.log.push({yards:Math.round(result.yards),td:result.td,home:result.home,away:result.away});}
export function commit(c,name){if(c.games!==3||c.school||!offers(c).some(s=>s.name===name))return false;c.school=name;return true;}
export function validCareer(c){return !!c&&c.version===1&&typeof c.name==='string'&&(c.position===undefined||positions.includes(c.position))&&Number.isInteger(c.games)&&c.games>=0&&c.games<=15&&['trust','xp','points','wins','practiced'].every(k=>Number.isFinite(c[k]))&&Array.isArray(c.log)&&c.log.length===c.games&&(c.school===null||schools.some(s=>s.name===c.school))&&(c.games<=3||c.school!==null);}
