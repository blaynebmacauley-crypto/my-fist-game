const FIELD_HALF_WIDTH = 26.67;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function finite(value, name) {
 if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
 return value;
}

/** Live runner boundary checks. Entering the own end zone alone is not a safety. */
export function liveBoundary({x, z, hasBall = true}) {
 finite(x, 'Runner x'); finite(z, 'Runner z');
 if (!hasBall) return null;
 if (z >= 100) return 'TOUCHDOWN';
 const outsideSide = Math.abs(x) > FIELD_HALF_WIDTH;
 if (z <= -10 || (z < 0 && outsideSide)) return 'SAFETY_OUT';
 if (outsideSide) return 'OUT_OF_BOUNDS';
 return null;
}

/** Horizontal hand-point catch tolerance, in world yards. */
export function catchWindow(rating) {
 const normalized = clamp(finite(rating, 'Catch rating'), 0, 100) / 100;
 return .65 + .4 * normalized ** 1.5;
}

/** Receiver must meet the ball, rather than collect it several yards away. */
export function catchEligible(receiver, ball, rating) {
 return Math.hypot(receiver.x-ball.x,receiver.z-ball.z) <= catchWindow(rating);
}

/** Moving runners can shed oblique contact; a square hit still wraps them up. */
export function tackleBreaks({speed,leverage,power=65,tackling=65,roll}) {
 for(const [name,value] of Object.entries({speed,leverage,power,tackling,roll})) finite(value,name);
 if(speed<2.5 || leverage>.4) return false;
 const chance=clamp(.18+(1-Math.abs(leverage))*.18+(power-tackling)*.003,.08,.55);
 return roll<chance;
}

/** Shared controlled-athlete speed before and after possession, yards/second. */
export function movementSpeed(rating, {sprint = false, stamina = 1} = {}) {
 const value = clamp(finite(rating, 'Movement rating'), 0, 100);
 finite(stamina, 'Stamina');
 if (sprint && stamina > .05) return clamp(6.1 + (value - 65) * .025, 5.2, 6.65);
 return clamp(5.5 + (value - 65) * .02, 4.8, 6.2);
}

/** Contact with an off-ball player cannot kill a play. Ground contact is required. */
export function ballCarrierDown(carrier, downed, {grounded = false} = {}) {
 return Number.isInteger(carrier) && carrier >= 0 && Number.isInteger(downed)
  && carrier === downed && grounded === true;
}

export class Drive {
 constructor(){this.score=0;this.reset();}
 reset(){this.spot=25;this.down=1;this.line=35;}
 // Call only once the play is dead. A live runner may retreat into the end zone.
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
