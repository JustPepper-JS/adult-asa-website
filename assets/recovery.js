'use strict';
(()=>{
  const form=document.getElementById('recovery-request-form');
  if(!form)return;
  const feedback=document.getElementById('recovery-feedback');
  const button=document.getElementById('recovery-submit');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(button.disabled)return;
    const get=id=>document.getElementById(id).value.trim();
    const description=get('description');
    if(!get('survivor-name')||!get('discord-contact')||description.length<15){
      feedback.textContent='Please add your survivor name, Discord contact and a few details about what happened.';
      return;
    }
    button.disabled=true;feedback.textContent='Sending your report…';
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      let response;
      try{
        response=await fetch('/control/api/recovery/requests/public',{
          method:'POST',credentials:'omit',cache:'no-store',redirect:'error',
          headers:{'Content-Type':'application/json',Accept:'application/json'},
          body:JSON.stringify({
            survivorName:get('survivor-name'),
            contact:get('discord-contact'),
            description,
            cluster:get('cluster-choice'),
            map:get('map-choice'),
            website:get('website')
          }),
          signal:controller.signal
        });
      }finally{clearTimeout(timer);}
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data.id){
        feedback.textContent='Request sent. Your ticket is '+data.id.slice(0,8)+'. Staff will review it and contact you on Discord.';
        form.reset();
      }else if(response.status===429){
        feedback.textContent='Too many requests from this connection. Please try later or contact staff in Discord.';
      }else{
        feedback.textContent='Could not send the request. Please try again or contact staff in Discord.';
      }
    }catch(_){
      feedback.textContent='Connection lost. We could not confirm your request. Please contact staff before submitting it again.';
    }finally{button.disabled=false;}
  });
})();
