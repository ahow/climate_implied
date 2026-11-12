import {contentHash} from "./analysisManifest";
type Q={n:bigint;d:bigint};
const Z=BigInt(0),O=BigInt(1);
function gcd(a:bigint,b:bigint):bigint {a=a<Z?-a:a;b=b<Z?-b:b;while(b!==Z){const r=a%b;a=b;b=r;}return a;}
function q(n:bigint,d=O):Q {if(d===Z)throw Error("Zero denominator");if(d<Z){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
function parse(s:string):Q {
 if(/^-?\d+\/[1-9]\d*$/.test(s)){const [n,d]=s.split("/");return q(BigInt(n),BigInt(d));}
 const scientific=/^(-?\d+(?:\.\d+)?)[eE]([+-]?\d+)$/.exec(s);
 if(scientific){
  const exponent=Number(scientific[2]);if(Math.abs(exponent)>400)throw Error("Exponent outside explicit arithmetic bound");
  let scale=O;for(let i=0;i<Math.abs(exponent);i++)scale*=BigInt(10);
  return mul(parse(scientific[1]),exponent>=0?q(scale):q(O,scale));
 }
 if(!/^-?\d+(?:\.\d+)?$/.test(s))throw Error("Exact finite decimal strings required, not binary estimates");
 const negative=s.startsWith("-"),parts=s.replace(/^-/,"").split(".");
 let scale=O;for(let i=0;i<(parts[1]?.length??0);i++)scale*=BigInt(10);
 return q(BigInt(parts.join(""))*(negative?-O:O),scale);
}
const add=(a:Q,b:Q)=>q(a.n*b.d+b.n*a.d,a.d*b.d);
const mul=(a:Q,b:Q)=>q(a.n*b.n,a.d*b.d);
const neg=(a:Q)=>q(-a.n,a.d);
const sub=(a:Q,b:Q)=>add(a,neg(b));
const cmp=(a:Q,b:Q)=>{const n=a.n*b.d-b.n*a.d;return n<Z?-1:n>Z?1:0;};
const zero=q(Z),half=q(O,BigInt(2));
const text=(a:Q)=>`${a.n}/${a.d}`;
const at=(p:Q[],x:Q)=>p.reduceRight((v,c)=>add(mul(v,x),c),zero);
const derivative=(p:Q[])=>p.slice(1).map((c,i)=>mul(c,q(BigInt(i+1))));
export function discountedCohortPolynomial(terms:{power:number;years:number;cashUsd:string}[],discountRate:string){
 const rate=add(q(O),parse(discountRate));
 if(cmp(rate,q(O))<=0)throw Error("Positive explicit discount rate required");
 const coefficients:Q[]=[zero];
 for(const t of terms){
  if(!Number.isInteger(t.power)||t.power<0||t.power>32||!Number.isInteger(t.years)||t.years<1||t.years>100)
   throw Error("Finite annual project polynomial domain required");
  let denominator=q(O);for(let i=0;i<t.years;i++)denominator=mul(denominator,rate);
  while(coefficients.length<=t.power)coefficients.push(zero);
  coefficients[t.power]=add(coefficients[t.power],mul(parse(t.cashUsd),q(denominator.d,denominator.n)));
 }return coefficients.map(text);
}
export function evaluateDeclaredPolynomial(coefficients:string[],parameter:string){
 const v=at(coefficients.map(parse),parse(parameter));
 const n=Number(v.n),d=Number(v.d),approximate=n/d;
 if(!Number.isFinite(n)||!Number.isFinite(d)||!Number.isFinite(approximate)||(v.n!==Z&&approximate===0))
  throw Error("Exact value exceeds supported numerical display range; no null/zero substitution");
 return {exact:text(v),approximate};
}
function bounds(p:Q[],lo:Q,hi:Q):[Q,Q]{
 let a=zero,b=zero;
 for(let i=p.length-1;i>=0;i--){
  const v=[mul(a,lo),mul(a,hi),mul(b,lo),mul(b,hi)].sort(cmp);
  a=add(v[0],p[i]);b=add(v[3],p[i]);
 }return[a,b];
}
export interface PolynomialDeclaration {
 coefficients:string[];lower:string;upper:string;absoluteParameterWidth:string;maxNodes:number;
 target:string;parameterMeaning:string;cashModelHash:string;
}
export function freezePolynomialDomain(input:PolynomialDeclaration){
 if(!input.coefficients.length||input.coefficients.length>33||
   !/^[a-f0-9]{64}$/.test(input.cashModelHash)||!input.parameterMeaning.trim()||
   !Number.isInteger(input.maxNodes)||input.maxNodes<1||input.maxNodes>100000)
  throw Error("Complete bounded declaration required");
 input.coefficients.forEach(parse);parse(input.target);
 if(cmp(parse(input.lower),parse(input.upper))>=0||cmp(parse(input.absoluteParameterWidth),zero)<=0)
  throw Error("Ordered domain and positive declared precision required");
 const material:PolynomialDeclaration=JSON.parse(JSON.stringify(input)),declaredAt=new Date().toISOString();
 return{material,declaredAt,hash:contentHash({material,declaredAt}),
  meaning:"Present-process mathematical declaration only; not owner confirmation or proof of economic model correspondence"};
}
/** Exact rational interval arithmetic, not point-grid uniqueness. This limited
 * polynomial class is continuous. Piecewise/clamped economics require a separate
 * complete regime proof; this routine cannot certify their omitted branches. */
export function certifyPolynomialDomain(freeze:ReturnType<typeof freezePolynomialDomain>){
 if(freeze.hash!==contentHash({material:freeze.material,declaredAt:freeze.declaredAt})||
   !Number.isFinite(Date.parse(freeze.declaredAt))||Date.parse(freeze.declaredAt)>Date.now())
  throw Error("Corrupt/future declaration");
 const m=freeze.material,p=m.coefficients.map(parse);p[0]=sub(p[0],parse(m.target));
 while(p.length>1&&p[p.length-1].n===Z)p.pop();
 const d=derivative(p),width=parse(m.absoluteParameterWidth);
 const pending:[Q,Q][]=[[parse(m.lower),parse(m.upper)]];
 const roots=new Map<string,{value:string;derivativeZero:boolean}>(),partitions:{
  lower:string;upper:string;status:string;reason:string}[]=[];
 let nodes=0;
 while(pending.length){
  const [lo,hi]=pending.pop()!;
  const record=(status:string,reason:string)=>partitions.push({lower:text(lo),upper:text(hi),status,reason});
  if(++nodes>m.maxNodes){record("unresolved","Declared node budget exhausted; interval retained");continue;}
  if(p.every(c=>c.n===Z)){record("nonidentified","Every point equals target");continue;}
  const l=at(p,lo),h=at(p,hi),[a,b]=bounds(p,lo,hi);
  for(const [x,v] of [[lo,l],[hi,h]] as [Q,Q][])if(v.n===Z)
   roots.set(text(x),{value:text(x),derivativeZero:at(d,x).n===Z});
  if(cmp(a,zero)>0||cmp(b,zero)<0){record("no-root","Exact interval image excludes zero");continue;}
  const [da,db]=bounds(d,lo,hi);
  // A nonconstant polynomial with derivative of one weak sign is strictly
  // monotone: isolated derivative zeros do not create a flat interval.
  const monotone=d.some(c=>c.n!==Z)&&(cmp(da,zero)>=0||cmp(db,zero)<=0);
  if(monotone&&cmp(l,zero)*cmp(h,zero)>=0){
   record("no-interior-root","Exact monotonicity; any endpoint root recorded separately");continue;
  }
  if(cmp(sub(hi,lo),width)<=0){
   record(monotone?"unique-root-bracket":"unresolved",
    monotone?"Exact derivative-sign proof and opposite endpoint signs":"Tangency/multiple-root possibility not resolved");
   continue;
  }
  const mid=mul(add(lo,hi),half);pending.push([mid,hi],[lo,mid]);
 }
 return{declarationHash:freeze.hash,roots:Array.from(roots.values()),partitions,
  complete:!partitions.some(p=>p.status==="unresolved"),
  marketIdentified:false,economicCorrespondenceVerified:false,
  scope:"Exact declared polynomial only; not certification of arbitrary cohort cash graph, discontinuities, owner thresholds or whole equity"};
}
