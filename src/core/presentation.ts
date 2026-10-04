// #region product-presentation — docs: docs/design/product-presentation-kernel.md#kernel
export interface ProductBinding {key: string; origin: string; placement: 'local' | 'remote'}
export interface ProductPresentation {revision: 'dashboard-product-presentation/1'; products: readonly {id:string;label:string;primary:Readonly<ProductBinding>;internal:readonly Readonly<ProductBinding>[]}[]}
export interface PresentationOptions {isProxy?: (value: object) => boolean}
export interface PresentationSnapshot {key:string;state:string;descriptor:{id:string;instance:string;origin:string;placement?:'local'|'remote'}|null}
export type Validation = {ok:true;map:Readonly<ProductPresentation>|null;proxyScreened:boolean}|{ok:false;map:null;reason:'invalid_presentation';proxyScreened:boolean};
export type BindingIssue = 'missing'|'duplicate'|'invalid_descriptor'|'identity_mismatch'|'origin_mismatch'|'placement_mismatch'|'unsafe_state';
export interface ProductView<T> {id:string;label:string;primary:T|null;internal:readonly T[];issues:readonly {key:string;role:'primary'|'internal';reason:BindingIssue}[];primaryBound:boolean}
export interface PresentationView<T> {mode:'legacy'|'grouped';reason:null|'invalid_presentation';proxyScreened:boolean;products:readonly ProductView<T>[];technical:readonly T[];unassigned:readonly T[]}
export const PRESENTATION_LIMITS=Object.freeze({products:32,internal:32,bindings:128,ownKeys:4096,stringUnits:65536});
const ID=/^[a-z][a-z0-9-]{0,63}$/;
const KEY=/^[a-z][a-z0-9-]{1,62}\.[a-z][a-z0-9-]{0,31}$/;
const LOCAL=/^http:\/\/127\.0\.0\.1:([1-9][0-9]{2,4})$/;
const REMOTE=/^https:\/\/((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?::([1-9][0-9]{0,4}))?$/;
const RESERVED=/(?:^|\.)(?:localhost|local|internal|home\.arpa|lan|localdomain)$/;
const CONTROLS=/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
function originMatches(origin:string,placement:'local'|'remote'):boolean {
  if(placement==='local'){const m=LOCAL.exec(origin);return !!m&&Number(m[1])>=100&&Number(m[1])<=65535;}
  const m=REMOTE.exec(origin);return !!m&&!RESERVED.test(m[1]!)&&(m[2]===undefined||Number(m[2])<=65535);
}
/** Only the trusted main-context callback can reject proxies before introspection. */
export function validatePresentation(input:unknown,options:PresentationOptions={}):Validation {
  const detector=options.isProxy,proxyScreened=typeof detector==='function';
  let keysLeft:number=PRESENTATION_LIMITS.ownKeys,stringsLeft:number=PRESENTATION_LIMITS.stringUnits,bindingCount=0;
  const refuse=():never=>{throw new Error('invalid_presentation');};
  const checkProxy=(value:object)=>{if(detector&&detector(value))refuse();};
  function object(value:unknown,allowed:readonly string[]):Record<string,unknown>{
    if(!value||typeof value!=='object')return refuse();checkProxy(value);
    if(Array.isArray(value))return refuse();const proto=Object.getPrototypeOf(value);
    if(proto!==null&&proto!==Object.prototype)return refuse();
    // Reject oversized enumerable records before own-key list/descriptor snapshot allocation.
    let enumerated=0;for(const key in value){if(!Object.prototype.hasOwnProperty.call(value,key)||!allowed.includes(key)||++enumerated>allowed.length)return refuse();}
    const keys=Reflect.ownKeys(value);if(keys.length!==allowed.length||keys.length>keysLeft)return refuse();keysLeft-=keys.length;
    const result:Record<string,unknown>=Object.create(null);
    for(const key of keys){if(typeof key!=='string'||!allowed.includes(key))return refuse();const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d)||!d.enumerable)return refuse();result[key]=d.value;}
    return result;
  }
  function array(value:unknown,maximum:number):unknown[]{
    if(!value||typeof value!=='object')return refuse();checkProxy(value);
    if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return refuse();
    const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
    if(!lengthDescriptor||!('value'in lengthDescriptor)||!Number.isSafeInteger(lengthDescriptor.value)||lengthDescriptor.value<0||lengthDescriptor.value>maximum)return refuse();
    const length=lengthDescriptor.value as number;
    let enumerated=0;for(const key in value){if(!Object.prototype.hasOwnProperty.call(value,key)||! /^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=length||++enumerated>length)return refuse();}
    const keys=Reflect.ownKeys(value);if(keys.length!==length+1||keys.length>keysLeft)return refuse();keysLeft-=keys.length;
    const result:unknown[]=[];
    for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!('value'in d)||!d.enumerable)return refuse();result.push(d.value);}
    return result;
  }
  function text(value:unknown,maximum:number):string {
    if(typeof value!=='string'||!value.length||value.length>maximum||value.trim()!==value||CONTROLS.test(value)||value.length>stringsLeft)return refuse();stringsLeft-=value.length;return value;
  }
  const serviceKeys=new Set<string>();
  function binding(value:unknown):Readonly<ProductBinding>{
    if(++bindingCount>PRESENTATION_LIMITS.bindings)return refuse();
    const d=object(value,['key','origin','placement']);const key=text(d.key,96),origin=text(d.origin,280);
    if(!KEY.test(key)||serviceKeys.has(key)||(d.placement!=='local'&&d.placement!=='remote')||!originMatches(origin,d.placement))return refuse();
    serviceKeys.add(key);return Object.freeze({key,origin,placement:d.placement});
  }
  try {
    if(input===null||input===undefined)return {ok:true,map:null,proxyScreened};
    const d=object(input,['revision','products']);if(d.revision!=='dashboard-product-presentation/1')return refuse();
    const rawProducts=array(d.products,PRESENTATION_LIMITS.products),ids=new Set<string>();
    const products:ProductPresentation['products'][number][]=[];
    for(const rawProduct of rawProducts){
      const p=object(rawProduct,['id','label','primary','internal']);const id=text(p.id,64),label=text(p.label,80);
      if(!ID.test(id)||ids.has(id))return refuse();ids.add(id);
      const primary=binding(p.primary),rawInternal=array(p.internal,PRESENTATION_LIMITS.internal);
      // Sum before traversing/copying expanded internal records, even when objects are shared.
      if(bindingCount+rawInternal.length>PRESENTATION_LIMITS.bindings)return refuse();
      const internal:Readonly<ProductBinding>[]=[];for(const item of rawInternal)internal.push(binding(item));
      products.push(Object.freeze({id,label,primary,internal:Object.freeze(internal)}));
    }
    return {ok:true,map:products.length?Object.freeze({revision:'dashboard-product-presentation/1',products:Object.freeze(products)}):null,proxyScreened};
  }catch{return {ok:false,map:null,reason:'invalid_presentation',proxyScreened};}
}
/** Snapshots are trusted host outputs; references and complete technical inventory are preserved. */
export function derivePresentation<T extends PresentationSnapshot>(services:readonly T[],input:unknown,options:PresentationOptions={}):PresentationView<T> {
  const validation=validatePresentation(input,options);
  if(!validation.ok||!validation.map)return {mode:'legacy',reason:validation.ok?null:validation.reason,proxyScreened:validation.proxyScreened,products:[],technical:services,unassigned:services};
  const byKey=new Map<string,T[]>();for(const service of services){const entries=byKey.get(service.key);if(entries)entries.push(service);else byKey.set(service.key,[service]);}
  const assigned=new Set<T>();
  function resolve(b:Readonly<ProductBinding>):{service:T|null;reason:BindingIssue|null}{
    const found=byKey.get(b.key);if(!found)return {service:null,reason:'missing'};
    if(found.length!==1)return {service:null,reason:'duplicate'};
    const service=found[0]!,d=service.descriptor;
    if(!d)return {service:null,reason:'invalid_descriptor'};
    if(`${d.id}.${d.instance}`!==b.key)return {service:null,reason:'identity_mismatch'};
    if(d.origin!==b.origin)return {service:null,reason:'origin_mismatch'};
    if((d.placement??'local')!==b.placement)return {service:null,reason:'placement_mismatch'};
    if(!['ready','degraded','down','stopped','starting','stopping'].includes(service.state))return {service:null,reason:'unsafe_state'};
    assigned.add(service);return {service,reason:null};
  }
  const products:ProductView<T>[]=[];
  for(const p of validation.map.products){
    const issues:{key:string;role:'primary'|'internal';reason:BindingIssue}[]=[],primary=resolve(p.primary),internal:T[]=[];
    if(primary.reason)issues.push({key:p.primary.key,role:'primary',reason:primary.reason});
    for(const b of p.internal){const r=resolve(b);if(r.service)internal.push(r.service);if(r.reason)issues.push({key:b.key,role:'internal',reason:r.reason});}
    products.push({id:p.id,label:p.label,primary:primary.service,internal,issues,primaryBound:primary.service!==null});
  }
  return {mode:'grouped',reason:null,proxyScreened:validation.proxyScreened,products,technical:services,unassigned:services.filter(s=>!assigned.has(s))};
}
// #endregion product-presentation
