import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../measurement.js',import.meta.url),'utf8');
function browser(choice,url='https://toucanlearn.co.uk/sen-tutoring?gclid=synthetic_click&utm_campaign=sen'){
 const local=new Map(choice?[['toucan-ad-measurement',JSON.stringify({choice,at:Date.now()})]]:[]),session=new Map(),events=new Map(),scripts=[];
 class Element{constructor(tag){this.tag=tag;this.children=[];this.events={};}setAttribute(){}append(...nodes){this.children.push(...nodes)}appendChild(node){this.children.push(node);return node}addEventListener(name,fn){this.events[name]=fn}remove(){this.removed=true}focus(){}querySelector(){return this.children[1].children[0]}}
 const body=new Element('body');const document={body,cookie:'',head:{appendChild:node=>scripts.push(node)},createElement:tag=>new Element(tag),addEventListener:(name,fn)=>events.set(name,fn),dispatchEvent:event=>events.get(event.type)?.(event)};
 const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,v)=>map.set(key,v),removeItem:key=>map.delete(key)});
 const window={};const ctx={window,document,location:new URL(url),URL,URLSearchParams,Date,Set,localStorage:storage(local),sessionStorage:storage(session),CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options)}},setTimeout,clearTimeout};vm.runInNewContext(source,ctx);
 return {window,document,scripts,local,session,banners:()=>body.children.length,openSettings(){events.get('click')({target:{closest:sel=>sel==='[data-measurement-settings]'?{}:null}})},clickChoice(index){body.children.at(-1).children[1].children[index].events.click()},events};
}
const fresh=browser();assert.equal(fresh.scripts.length,0);assert.equal(fresh.session.size,0);assert.equal(fresh.window.toucanMeasurement.fields()['Google click ID'],'');await fresh.window.toucanMeasurement.accepted('test');assert(!fresh.window.dataLayer);assert.equal(fresh.banners(),0,'no automatic pop-up (owner, 25 Nov)');fresh.openSettings();
fresh.clickChoice(1);assert.equal(fresh.scripts.length,0);assert.equal(fresh.window.toucanMeasurement.allowed(),false);
const yes=browser('granted');assert.equal(yes.scripts.length,1);assert.equal(yes.window.toucanMeasurement.fields()['Google click ID'],'synthetic_click');assert(yes.window.dataLayer.every(call=>call[1]!=='conversion'));
const pending=yes.window.toucanMeasurement.accepted('synthetic-enquiry-0001');const conversion=yes.window.dataLayer.find(call=>call[1]==='conversion');assert(conversion);assert.equal(conversion[2].transaction_id,'synthetic-enquiry-0001');assert.equal(conversion[2].send_to,'AW-18511909243/4SsoCPvTh68dEPuilftE');assert.deepEqual(Object.keys(conversion[2]).sort(),['event_callback','event_timeout','send_to','transaction_id']);conversion[2].event_callback();await pending;await yes.window.toucanMeasurement.accepted('synthetic-enquiry-0001');assert.equal(yes.window.dataLayer.filter(call=>call[1]==='conversion').length,1);
const decline=browser('denied');assert.equal(decline.scripts.length,0);assert.equal(decline.session.size,0);
const qa=browser('granted','https://toucanlearn.co.uk/contact?qa=1');await qa.window.toucanMeasurement.accepted('test');assert(!qa.window.dataLayer.some(call=>call[1]==='conversion'));
const allowLater=browser();allowLater.openSettings();allowLater.clickChoice(0);assert.equal(allowLater.scripts.length,1);assert.equal(allowLater.window.toucanMeasurement.fields()['Google click ID'],'synthetic_click');
console.log('PASS: no automatic pop-up; choice only from the privacy page; no Google script/storage/event before consent or after denial; consent loads tag and preserves click attribution; successful receipts deduplicate; conversion payload has no form contents; test enquiries excluded.');
