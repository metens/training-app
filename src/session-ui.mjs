import {gymLocation,gymMapsURL,sessionLocation,validSession,sessionHeading,calendarFile,sessionReminders} from './session-tools.mjs';
let currentUser=null,request=null,appointments=[],generation=0,remoteToken=null;
const device=()=>window.PPSessionDevice;
const enabledKey=uid=>'pp_session_reminders_'+uid;
let queue=Promise.resolve();
function serial(work){queue=queue.catch(()=>{}).then(work);return queue;}
function status(text){const el=document.getElementById('sessionNotificationStatus');if(el)el.textContent=text;}
export function configureSessions(user,portal){
  currentUser=user;request=portal;appointments=[];remoteToken=null;generation++;
  const version=generation;
  if(device())serial(async()=>{if(version===generation)await device().setOwner({owner:user?.uid||''});}).catch(()=>status('Reminders could not be updated. Reopen the app to try again.'));
  let controls=document.getElementById('sessionNotificationControls');
  if(!controls){controls=document.createElement('div');controls.id='sessionNotificationControls';document.getElementById('clientSessions').before(controls);}
  controls.replaceChildren();
  if(!user||!device())return;
  const button=document.createElement('button');button.className='light';button.id='sessionNotifications';
  const feedback=document.createElement('p');feedback.id='sessionNotificationStatus';feedback.className='muted';feedback.setAttribute('role','status');
  const refresh=()=>button.textContent=localStorage.getItem(enabledKey(user.uid))==='yes'?'Turn off session reminders':'Enable session notifications';refresh();controls.append(button,feedback);
  button.onclick=async()=>{
    button.disabled=true;
    try{
      if(localStorage.getItem(enabledKey(user.uid))==='yes'){
        if(remoteToken)await portal(user,'notification-device',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(remoteToken)});
        await serial(()=>device().disable());localStorage.removeItem(enabledKey(user.uid));status('Session reminders are off.');
      }else{
        const permission=await device().requestPermission();
        if(!permission.granted){status('Notifications are off. You can allow them in iPhone Settings → Notifications → Pacific Performance.');return;}
        if(currentUser!==user)return;
        localStorage.setItem(enabledKey(user.uid),'yes');await syncReminders();await connectPush(user,portal);
      }
    }catch{status('Notifications could not be updated. Please try again.');}finally{refresh();button.disabled=false;}
  };
  if(localStorage.getItem(enabledKey(user.uid))==='yes')connectPush(user,portal);
}
async function connectPush(user,portal){
  try{
    await queue;
    if(currentUser!==user)return;
    const available=await device().remoteStatus();
    if(currentUser!==user)return;
    if(!available.enabled){status('One-hour reminders are enabled. Open the app after schedule changes to update them. Session-change alerts are not available in this build yet.');return;}
    const config=await portal(user,'notification-config');
    if(!config.enabled){status('One-hour reminders are enabled. Session-change alerts are not available yet.');return;}
    const token=await device().registerRemote();
    if(currentUser!==user)return;
    await portal(user,'notification-device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(token)});
    remoteToken=token;status('Session-change alerts and one-hour reminders are enabled.');
  }catch{if(currentUser===user)status('One-hour reminders are enabled. Session-change alerts could not connect; reopen the app to retry.');}
}
async function syncReminders(){
  const user=currentUser,version=generation;
  if(!device()||!user||localStorage.getItem(enabledKey(user.uid))!=='yes')return;
  const reminders=sessionReminders(appointments);
  await serial(async()=>{if(version===generation)await device().syncReminders({owner:user.uid,reminders});});
}
export async function releaseSessions(user,portal){
  if(remoteToken){try{await portal(user,'notification-device',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(remoteToken)});}catch{/* Native unregister also stops delivery on this device. */}}
  generation++;currentUser=null;appointments=[];
  if(device())await serial(()=>device().setOwner({owner:''}));
}
export function renderSessions(items){
  appointments=items.filter(validSession).filter(item=>Date.parse(item.start)>=Date.now()).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const container=document.getElementById('clientSessions');
  const cards=appointments.map(item=>{
    const card=document.createElement('div');card.className='card appointment-card';
    const heading=document.createElement('h3');heading.textContent=sessionHeading(item).replace(' at ', ' · ');heading.title=sessionHeading(item);
    const detail=document.createElement('p');detail.textContent='50 minute session · '+sessionLocation(item);
    const button=document.createElement('button');button.className='light';button.textContent='Add to calendar';
    const feedback=document.createElement('p');feedback.className='muted';feedback.setAttribute('role','status');
    button.onclick=async()=>{
      button.disabled=true;
      try{
        if(device()){
          const result=await device().addToCalendar({title:'Pacific Performance training',start:item.start,end:item.end,location:sessionLocation(item),notes:'Check Pacific Performance for schedule changes. Calendar copies do not update automatically.'});
          feedback.textContent=result.saved?'Added to your calendar. Update this calendar copy if your session changes.':'';
        }else{
          const url=URL.createObjectURL(new Blob([calendarFile(item)],{type:'text/calendar;charset=utf-8'}));
          const a=document.createElement('a');a.href=url;a.download='pacific-performance-session.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
          feedback.textContent='Open the calendar file to add your session. This copy does not update automatically.';
        }
      }catch{feedback.textContent='The calendar could not be opened. Please try again.';}finally{button.disabled=false;}
    };
    card.append(heading,detail);const map=document.createElement('a');map.href=sessionLocation(item)===gymLocation?gymMapsURL:'https://maps.apple.com/?q='+encodeURIComponent(sessionLocation(item));map.textContent='Apple Maps';map.target='_blank';map.rel='noopener';map.className='light appointment-map';const actions=document.createElement('div');actions.className='appointment-actions';actions.append(map,button);card.append(actions,feedback);return card;
  });
  container.replaceChildren(...cards);
  if(!cards.length)container.textContent='No upcoming sessions scheduled.';

  syncReminders().catch(()=>status('Your appointments loaded, but reminders could not be updated. Reopen the app to retry.'));
}
