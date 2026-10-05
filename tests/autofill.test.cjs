const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const assert=require('node:assert/strict');
const code=readFileSync(join(__dirname,'../app/src/main/assets/autofill.js'),'utf8');
function fixture(){
  let active=null, fareClicks=0, bookClicks=0, fareReady=false;
  const combo=()=>({textContent:'',expanded:false,getAttribute(n){return n==='aria-expanded'?String(this.expanded):null},click(){this.expanded=true;active=this;}});
  const entry=combo(),exit=combo();
  const type={options:[{textContent:'One Way',value:'one'},{textContent:'Round Trip',value:'round'}],value:'round',dispatchEvent(){}},count={options:[{textContent:'1',value:'1'},{textContent:'2',value:'2'}],value:'2',dispatchEvent(){}};
  const fare={textContent:'Get Fare',disabled:false,click(){fareClicks++;fareReady=true;}},book={textContent:'Book Ticket',click(){bookClicks++;}};
  const body={innerText:'Kochi Metro Rail Ltd'};
  const context={window:{},location:{protocol:'https:',hostname:'prutech.org',pathname:'/KMRL/'},Event:function(){},document:{body,getElementById(id){return {'mat-select-0':entry,'mat-select-2':exit,travelType:type,passengerCount:count}[id]},querySelectorAll(selector){if(selector==='button')return fareReady?[book]:[fare];if(selector==='mat-option')return ['Kadavanthra','S N Junction'].map(name=>({textContent:name,getAttribute(){return 'false'},click(){if(active){active.textContent=name;active.expanded=false;active=null;}}}));return []}}};
  return {context,entry,exit,type,count,body,run(){return runInNewContext(code,context)},counts(){return [fareClicks,bookClicks]}};
}
let f=fixture(),result;
for(let i=0;i<20;i++){result=f.run();if(result.state!=='wait')break;}
assert.equal(result.state,'ready');assert.equal(f.entry.textContent,'Kadavanthra');assert.equal(f.exit.textContent,'S N Junction');assert.equal(f.type.value,'one');assert.equal(f.count.value,'1');assert.deepEqual(f.counts(),[1,0]);
for(let i=0;i<5;i++)f.run();assert.deepEqual(f.counts(),[1,0]);
f=fixture();f.context.location.hostname='evil.org';assert.equal(f.run().state,'halt');assert.deepEqual(f.counts(),[0,0]);
f=fixture();f.body.innerText='Link Expired';assert.equal(f.run().state,'halt');
f=fixture();for(let i=0;i<6;i++)f.run();f.entry.textContent='Aluva';assert.equal(f.run().state,'halt');assert.deepEqual(f.counts(),[0,0]);
f=fixture();f.context.document.getElementById=()=>null;assert.equal(f.run().state,'wait');assert.deepEqual(f.counts(),[0,0]);
console.log('Form checks passed: correct route/options, single fare request, no Book Ticket click, foreign host/expired link/route mismatch rejected, unloaded form waits.');
