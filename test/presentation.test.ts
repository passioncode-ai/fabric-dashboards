import assert from 'node:assert/strict';
import test from 'node:test';
import {types} from 'node:util';
import {validatePresentation,derivePresentation,type ProductBinding,type PresentationSnapshot} from '../src/core/presentation';

const options={isProxy:types.isProxy};
const binding=(key='example-data.default',origin='https://data.example.com',placement:'local'|'remote'='remote'):ProductBinding=>({key,origin,placement});
const snapshot=(b:ProductBinding,state='ready'):PresentationSnapshot=>({key:b.key,state,descriptor:{id:b.key.split('.')[0]!,instance:b.key.split('.')[1]!,origin:b.origin,placement:b.placement}});
const profile=()=>({revision:'dashboard-product-presentation/1',products:[{id:'data',label:'Data',primary:binding(),internal:[] as ProductBinding[]}]});

for(const input of [null,undefined,{revision:'dashboard-product-presentation/1',products:[]}])test('legacy empty '+String(input),()=>{
 const s=[snapshot(binding())];const v=validatePresentation(input,options);assert.equal(v.ok,true);assert.equal(v.map,null);
 const result=derivePresentation(s,input,options);assert.equal(result.mode,'legacy');assert.equal(result.reason,null);assert.strictEqual(result.technical,s);assert.strictEqual(result.unassigned,s);
});
test('five exact neutral services map to two products and complete technical identity',()=>{
 const primary=binding();const reader=binding('example-data.reader','https://read.example.com');
 const bridge=binding('example-data.projection','http://127.0.0.1:47100','local');const old=binding('example-metrics.projection','http://127.0.0.1:47101','local');
 const analysis=binding('example-analysis.default','https://analysis.example.com');
 const p=profile();p.products[0]!.internal=[reader,bridge,old];p.products.push({id:'analysis',label:'Analysis',primary:analysis,internal:[]});
 const s=[primary,reader,bridge,old,analysis].map(b=>snapshot(b));const r=derivePresentation(s,p,options);
 assert.equal(r.mode,'grouped');assert.equal(r.products.length,2);assert.equal(r.unassigned.length,0);assert.strictEqual(r.technical,s);
 assert.strictEqual(r.products[0]!.primary,s[0]);assert.deepEqual(r.products[0]!.internal,s.slice(1,4));assert.ok(r.products.every(x=>x.primaryBound));
 assert.deepEqual(s.map(x=>x.key),[primary,reader,bridge,old,analysis].map(x=>x.key));
});
test('normalized map is immutable copied data without input alias',()=>{
 const p=profile();const r=validatePresentation(p,options);assert.ok(r.ok&&r.map);assert.equal(r.proxyScreened,true);
 p.products[0]!.label='Changed';p.products[0]!.primary.origin='https://other.example.com';p.products.push({...p.products[0]!});
 assert.equal(r.map.products.length,1);assert.equal(r.map.products[0]!.label,'Data');assert.equal(r.map.products[0]!.primary.origin,'https://data.example.com');
 assert.ok(Object.isFrozen(r.map));assert.ok(Object.isFrozen(r.map.products));assert.ok(Object.isFrozen(r.map.products[0]));assert.ok(Object.isFrozen(r.map.products[0]!.primary));assert.ok(Object.isFrozen(r.map.products[0]!.internal));
});
test('browser-only own data validation is explicitly not proxy-screened',()=>{const r=validatePresentation(profile());assert.ok(r.ok);assert.equal(r.proxyScreened,false);});
test('transparent browser Proxy may validate but never obtains screened trust',()=>{const r=validatePresentation(new Proxy(profile(),{}));assert.equal(r.ok,true);assert.equal(r.proxyScreened,false);});
test('product bind flag does not imply operational dashboard readiness',()=>{const s=snapshot(binding(),'down');const r=derivePresentation([s],profile(),options);assert.equal(r.products[0]!.primaryBound,true);assert.equal(r.products[0]!.primary!.state,'down');});
test('main detector rejects a proxy before any trap',()=>{
 let traps=0;const proxy=new Proxy(profile(),{getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();}});
 const r=validatePresentation(proxy,options);assert.equal(r.ok,false);assert.equal(r.proxyScreened,true);assert.equal(traps,0);
});
test('throwing/revoked browser proxies fail without propagating errors; no trap-free guarantee',()=>{
 const rev=Proxy.revocable(profile(),{});rev.revoke();assert.equal(validatePresentation(rev.proxy).ok,false);
 let calls=0;const p=new Proxy(profile(),{getPrototypeOf(){calls++;throw Error();}});assert.equal(validatePresentation(p).ok,false);assert.equal(calls,1);
});
test('nested main proxy rejected before traps',()=>{let n=0;const p=profile();p.products[0]!.primary=new Proxy(binding(),{ownKeys(){n++;throw Error();}});assert.equal(validatePresentation(p,options).ok,false);assert.equal(n,0);});
test('accessors refused without getter calls',()=>{let n=0;const p=profile();Object.defineProperty(p.products[0]!,'label',{get(){n++;return 'X';},enumerable:true});assert.equal(validatePresentation(p,options).ok,false);assert.equal(n,0);});
test('array index accessor rejected without getter',()=>{let n=0;const p=profile();Object.defineProperty(p.products,'0',{get(){n++;return profile().products[0];},enumerable:true});assert.equal(validatePresentation(p,options).ok,false);assert.equal(n,0);});
test('detector failure is a static map refusal',()=>{assert.equal(validatePresentation(profile(),{isProxy(){throw Error('private failure');}}).ok,false);});
test('nonenumerable surplus keys and symbols are rejected',()=>{const p=profile();Object.defineProperty(p,'hidden',{value:true});assert.equal(validatePresentation(p,options).ok,false);const a=profile();Object.defineProperty(a.products,Symbol(),{value:true});assert.equal(validatePresentation(a,options).ok,false);});

const malformed:[string,(p:ReturnType<typeof profile>)=>unknown][]=[
 ['unknown revision',p=>({...p,revision:'new'})],['root extra',p=>({...p,hidden:true})],['root nonplain',p=>Object.assign(Object.create({}),p)],
 ['missing products',()=>({revision:'dashboard-product-presentation/1'})],['product extra',p=>{Object.assign(p.products[0]!,{authority:'operator'});return p;}],
 ['binding extra',p=>{Object.assign(p.products[0]!.primary,{token:'fixture'});return p;}],['bad product id',p=>{p.products[0]!.id='UPPER';return p;}],
 ['empty label',p=>{p.products[0]!.label='';return p;}],['long label',p=>{p.products[0]!.label='x'.repeat(81);return p;}],
 ['label newline',p=>{p.products[0]!.label='A\nB';return p;}],['label bidi',p=>{p.products[0]!.label='A\u202eB';return p;}],['label whitespace',p=>{p.products[0]!.label=' Data';return p;}],
 ['bad service key',p=>{p.products[0]!.primary.key='example-data';return p;}],['uppercase key',p=>{p.products[0]!.primary.key='Example-data.default';return p;}],
 ['local IP remote',p=>{p.products[0]!.primary.origin='https://127.0.0.1';return p;}],['remote path',p=>{p.products[0]!.primary.origin='https://data.example.com/path';return p;}],
 ['remote query',p=>{p.products[0]!.primary.origin='https://data.example.com?x=1';return p;}],['remote userinfo',p=>{p.products[0]!.primary.origin='https://user@data.example.com';return p;}],
 ['remote reserved',p=>{p.products[0]!.primary.origin='https://data.internal';return p;}],['remote high port',p=>{p.products[0]!.primary.origin='https://data.example.com:65536';return p;}],
 ['wrong scheme',p=>{p.products[0]!.primary.origin='http://data.example.com';return p;}],['unknown placement',p=>{Object.assign(p.products[0]!.primary,{placement:'cloud'});return p;}],
 ['local wrong address',p=>{p.products[0]!.primary=binding('example-data.default','http://localhost:47100','local');return p;}],
 ['local low port',p=>{p.products[0]!.primary=binding('example-data.default','http://127.0.0.1:99','local');return p;}],
 ['duplicate product',p=>{p.products.push({...p.products[0]!,primary:binding('example-other.default','https://other.example.com')});return p;}],
 ['duplicate binding',p=>{p.products[0]!.internal=[binding()];return p;}],['binding shared across products',p=>{p.products.push({...p.products[0]!,id:'other'});return p;}],
 ['too many products',p=>{p.products=Array.from({length:33},()=>p.products[0]!);return p;}],['too many internal',p=>{p.products[0]!.internal=Array.from({length:33},()=>binding());return p;}],
 ['sparse products',p=>{p.products=new Array(2);return p;}],['array property',p=>{Object.assign(p.products,{note:'x'});return p;}],
 ['symbol root',p=>{Object.assign(p,{[Symbol()]:1});return p;}],['inherited array',p=>{Object.setPrototypeOf(p.products,Object.create(Array.prototype));return p;}],
];
for(const [name,mutate]of malformed)test('invalid map '+name,()=>{
 const p=mutate(profile());const v=validatePresentation(p,options);assert.equal(v.ok,false);if(!v.ok)assert.equal(v.reason,'invalid_presentation');
 const services=[snapshot(binding())];const r=derivePresentation(services,p,options);assert.equal(r.mode,'legacy');assert.equal(r.reason,'invalid_presentation');assert.strictEqual(r.technical,services);assert.strictEqual(r.unassigned,services);
});
test('cumulative bindings limit applies before expanded copying',()=>{
 const products=Array.from({length:5},(_,i)=>({id:'product-'+i,label:'Product',primary:binding(`example-${i}.default`,`https://p${i}.example.com`),internal:Array.from({length:25},(_,j)=>binding(`example-${i}-x${j}.default`,`https://x${j}.example.com`))}));
 assert.equal(validatePresentation({revision:'dashboard-product-presentation/1',products},options).ok,false);
});
test('enormous sparse array is rejected before indexed descriptors',()=>{const p=profile();p.products.length=2**31;assert.equal(validatePresentation(p,options).ok,false);});
test('cheap expanded DAG is rejected before copying huge own-data record',()=>{
 const big=Object.fromEntries(Array.from({length:4096},(_,i)=>['x'+i,'z'.repeat(64)]));const p=profile();p.products[0]!.primary=big as unknown as ProductBinding;
 assert.equal(validatePresentation(p,options).ok,false);
});
test('max valid profile 128 bindings accepted; one extra binding rejected',()=>{
 const p={revision:'dashboard-product-presentation/1',products:Array.from({length:4},(_,i)=>({id:'product-'+i,label:'Product '+i,primary:binding(`example-${i}.default`,`https://p${i}.example.com`),internal:Array.from({length:31},(_,j)=>binding(`example-${i}-x${j}.default`,`https://x${j}.example.com`))}))};
 assert.equal(validatePresentation(p,options).ok,true);p.products[0]!.internal.push(binding('example-extra.default','https://extra.example.com'));assert.equal(validatePresentation(p,options).ok,false);
});

for(const [state,expected] of [['ready',true],['degraded',true],['down',true],['stopped',true],['starting',true],['stopping',true],['invalid',false],['foreign',false],['conflict',false],['duplicate',false],['unexpected',false]] as const)test('primary state '+state,()=>{
 const s=snapshot(binding(),state);const r=derivePresentation([s],profile(),options);assert.equal(r.products[0]!.primaryBound,expected);assert.equal(r.products[0]!.primary,expected?s:null);if(!expected)assert.equal(r.unassigned.length,1);
});
for(const [name,change,reason]of [
 ['descriptor absent',(s:PresentationSnapshot)=>{s.descriptor=null;},'invalid_descriptor'],
 ['id changed',(s:PresentationSnapshot)=>{s.descriptor!.id='example-other';},'identity_mismatch'],
 ['origin changed',(s:PresentationSnapshot)=>{s.descriptor!.origin='https://other.example.com';},'origin_mismatch'],
 ['placement changed',(s:PresentationSnapshot)=>{s.descriptor!.placement='local';},'placement_mismatch'],
] as const)test('primary mismatch '+name,()=>{const s=snapshot(binding());change(s);const r=derivePresentation([s],profile(),options);assert.equal(r.products[0]!.primaryBound,false);assert.equal(r.products[0]!.primary,null);assert.equal(r.products[0]!.issues[0]!.reason,reason);assert.strictEqual(r.unassigned[0],s);});
test('missing primary never promotes internal reader',()=>{const reader=binding('example-data.reader','https://read.example.com');const p=profile();p.products[0]!.internal=[reader];const s=snapshot(reader);const r=derivePresentation([s],p,options);assert.equal(r.products[0]!.primary,null);assert.equal(r.products[0]!.primaryBound,false);assert.strictEqual(r.products[0]!.internal[0],s);assert.equal(r.products[0]!.issues[0]!.reason,'missing');assert.strictEqual(r.technical[0],s);});
test('duplicate snapshot even identical object suppresses binding',()=>{const s=snapshot(binding());const r=derivePresentation([s,s],profile(),options);assert.equal(r.products[0]!.primary,null);assert.equal(r.products[0]!.issues[0]!.reason,'duplicate');assert.deepEqual(r.unassigned,[s,s]);});
test('unknown service visible; same display name never a heuristic',()=>{const unknown=snapshot(binding('example-other.default','https://other.example.com'));const r=derivePresentation([snapshot(binding()),unknown],profile(),options);assert.strictEqual(r.unassigned[0],unknown);});
test('internal failure retained as issue, primary identity conserved',()=>{const p=profile();const child=binding('example-data.reader','https://read.example.com');p.products[0]!.internal=[child];const primary=snapshot(binding());const bad=snapshot(child,'foreign');const r=derivePresentation([primary,bad],p,options);assert.strictEqual(r.products[0]!.primary,primary);assert.equal(r.products[0]!.primaryBound,true);assert.equal(r.products[0]!.issues[0]!.role,'internal');assert.strictEqual(r.unassigned[0],bad);assert.strictEqual(r.technical[1],bad);});
test('trusted snapshots are not traversed for auth/event/lifecycle and are not frozen',()=>{const s=snapshot(binding());Object.defineProperty(s,'auth',{get(){throw Error('must not inspect');}});const r=derivePresentation([s],profile(),options);assert.strictEqual(r.products[0]!.primary,s);assert.equal(Object.isFrozen(s),false);});
test('missing descriptor placement means local, not remote',()=>{const b=binding('example-local.default','http://127.0.0.1:47100','local');const p=profile();p.products[0]!.primary=b;const s=snapshot(b);delete s.descriptor!.placement;assert.strictEqual(derivePresentation([s],p,options).products[0]!.primary,s);});
test('32 distinct products at maximum product bound are accepted',()=>{const products=Array.from({length:32},(_,i)=>({id:'product-'+i,label:'Product',primary:binding(`example-${i}.default`,`https://p${i}.example.com`),internal:[]}));assert.equal(validatePresentation({revision:'dashboard-product-presentation/1',products},options).ok,true);});
test('HTML label stays literal data with no evaluation or alias',()=>{const p=profile();p.products[0]!.label='<script>example</script>';const r=derivePresentation([snapshot(binding())],p,options);assert.equal(r.products[0]!.label,p.products[0]!.label);assert.equal(r.products[0]!.primary!.key,'example-data.default');});
test('shared nested object is never mistaken for two service permissions',()=>{const p=profile();const shared=binding('example-data.reader','https://read.example.com');p.products[0]!.internal=[shared,shared];assert.equal(validatePresentation(p,options).ok,false);});
test('same origin and same product label do not collapse distinct exact keys',()=>{const p=profile();const other=binding('example-other.default');p.products.push({id:'other',label:'Data',primary:other,internal:[]});const s=[snapshot(binding()),snapshot(other)];const r=derivePresentation(s,p,options);assert.equal(r.products.length,2);assert.strictEqual(r.products[0]!.primary,s[0]);assert.strictEqual(r.products[1]!.primary,s[1]);});
test('exact origin comparison never normalizes a changed hostname case',()=>{const s=snapshot(binding());s.descriptor!.origin='https://DATA.example.com';const r=derivePresentation([s],profile(),options);assert.equal(r.products[0]!.primary,null);assert.equal(r.products[0]!.issues[0]!.reason,'origin_mismatch');assert.strictEqual(r.unassigned[0],s);});
for(const [name,hide]of [
 ['root revision',(p:ReturnType<typeof profile>)=>Object.defineProperty(p,'revision',{enumerable:false})],
 ['product label',(p:ReturnType<typeof profile>)=>Object.defineProperty(p.products[0]!,'label',{enumerable:false})],
 ['binding origin',(p:ReturnType<typeof profile>)=>Object.defineProperty(p.products[0]!.primary,'origin',{enumerable:false})],
 ['array index',(p:ReturnType<typeof profile>)=>Object.defineProperty(p.products,'0',{enumerable:false})],
] as const)test('nonenumerable JSON field rejected '+name,()=>{const p=profile();hide(p);assert.equal(validatePresentation(p,options).ok,false);});
