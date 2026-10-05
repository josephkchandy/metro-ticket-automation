(function () {
  if (location.protocol !== 'https:' || location.hostname !== 'prutech.org' || location.pathname !== '/KMRL/') return {state:'halt', message:'Automation stopped outside the booking page.'};
  const visibleText = document.body ? document.body.innerText : '';
  if (/Link Expired|Permission Denied/i.test(visibleText)) return {state:'halt',message:'This link has expired or is unavailable. Request a fresh link.'};
  const s = window.__metroSN || (window.__metroSN={phase:0,started:Date.now()});
  if (Date.now()-s.started>60000) return {state:'halt',message:'The form did not respond. You can finish manually below.'};
  const clean = x => (x || '').replace(/\s+/g,' ').trim();
  const entry = document.getElementById('mat-select-0');
  const exit = document.getElementById('mat-select-2');
  if (!entry || !exit) return {state:'wait',message:'Waiting for the station form…'};
  function selected(el, name) {return clean(el.textContent)===name;}
  function choose(el, name) {
    if (selected(el,name)) return true;
    if (el.getAttribute('aria-expanded')!=='true') {el.click();return false;}
    const option=Array.from(document.querySelectorAll('mat-option')).find(o=>clean(o.textContent)===name && o.getAttribute('aria-disabled')!=='true');
    if(option) option.click();
    return false;
  }
  if(s.phase===0) {if(choose(entry,'Kadavanthra'))s.phase=1;return {state:'wait',message:'Selecting Kadavanthra…'};}
  if(s.phase===1) {if(choose(exit,'S N Junction'))s.phase=2;return {state:'wait',message:'Selecting S N Junction…'};}
  if(s.phase===2) {
    if(!selected(entry,'Kadavanthra')||!selected(exit,'S N Junction'))return {state:'halt',message:'Station selection changed. Please review manually.'};
    const type=document.getElementById('travelType'), count=document.getElementById('passengerCount');
    if(!type||!count)return {state:'wait',message:'Waiting for journey options…'};
    for(const pair of [[type,'One Way'],[count,'1']]) {
      const option=Array.from(pair[0].options||[]).find(o=>clean(o.textContent)===pair[1]);
      if(!option)return {state:'halt',message:'Journey options changed. Please review manually.'};
      if(pair[0].value!==option.value){pair[0].value=option.value;pair[0].dispatchEvent(new Event('change',{bubbles:true}));return {state:'wait',message:'Setting one passenger, one way…'};}
    }
    const button=Array.from(document.querySelectorAll('button')).find(b=>clean(b.textContent)==='Get Fare');
    if(!button||button.disabled)return {state:'wait',message:'Waiting for fare lookup…'};
    s.phase=3;button.click();return {state:'wait',message:'Getting current fare…'};
  }
  const book=Array.from(document.querySelectorAll('button')).find(b=>clean(b.textContent)==='Book Ticket');
  if(book) {
    if(!selected(entry,'Kadavanthra')||!selected(exit,'S N Junction'))return {state:'halt',message:'Route mismatch. Check the form before booking.'};
    s.phase=4;
    return {state:'ready',message:'Route filled. Review the fare, then tap Book Ticket and approve payment yourself.'};
  }
  return {state:'wait',message:'Waiting for fare…'};
})();
