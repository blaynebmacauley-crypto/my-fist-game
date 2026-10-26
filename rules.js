export class Drive {
 constructor(){this.score=0;this.reset();}
 reset(){this.spot=25;this.down=1;this.line=35;}
 finish(yards,incomplete=false){
  if(!Number.isFinite(yards))throw new Error('Invalid ball position');
  const old=this.spot;this.spot=incomplete?old:Math.max(0,Math.min(100,yards));
  if(this.spot>=100){this.score+=7;this.reset();return 'TOUCHDOWN';}
  if(this.spot<=0){this.reset();return 'SAFETY';}
  if(this.spot>=this.line){this.down=1;this.line=Math.min(100,this.spot+10);return 'FIRST DOWN';}
  if(++this.down>4){this.reset();return 'TURNOVER ON DOWNS';}
  return incomplete?'INCOMPLETE':'PLAY OVER';
 }
}
