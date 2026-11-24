export function validSession(item) {
  return item?.status === 'scheduled' && Number.isFinite(Date.parse(item.start)) &&
    Number.isFinite(Date.parse(item.end)) && Date.parse(item.end) > Date.parse(item.start);
}
export function sessionHeading(item, now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const start = new Date(item.start);
  const day = value => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(value).map(p=>[p.type,p.value]));
    return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day))/86400000;
  };
  const delta = day(start)-day(now);
  const weekday = new Intl.DateTimeFormat('en-US',{timeZone,weekday:'long'}).format(start);
  const prefix = delta === 0 ? 'Today' : delta === 1 ? 'Tomorrow' : delta > 1 && delta <= 7 ? 'Next '+weekday : weekday;
  const year = new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric'});
  const date = new Intl.DateTimeFormat('en-US',{timeZone,month:'short',day:'numeric',...(year.format(start)!==year.format(now)?{year:'numeric'}:{})}).format(start);
  const time = new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit'}).format(start);
  return `${prefix}, ${date} at ${time}`;
}
const escapeICS = value => String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarFile(item, now = new Date()) {
  if(!validSession(item)) throw Error('This appointment has no valid start and end time.');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pacific Performance//Training//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:'+escapeICS(item.id || item.start)+'@pacificperformance.fit','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(item.start),'DTEND:'+stamp(item.end),
    'SUMMARY:Pacific Performance training','LOCATION:'+escapeICS(item.location),'DESCRIPTION:Training session with Pacific Performance. Check the app for schedule changes.','END:VEVENT','END:VCALENDAR'];
  // Fold by UTF-8 bytes so long names and non-ASCII locations stay valid.
  return lines.map(line=>{let out='',part='';for(const char of line){if(new TextEncoder().encode(part+char).length>74){out+=part+'\r\n';part=' ';}part+=char;}return out+part;}).join('\r\n')+'\r\n';
}
export function sessionReminders(items, now = Date.now()) {
  return items.filter(validSession).filter(item=>Date.parse(item.start)-3600000>now)
    .sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,60)
    .map(item=>({id:String(item.id||item.start),at:Date.parse(item.start)-3600000,title:'Training in 1 hour',body:'Your Pacific Performance training session starts in one hour.'}));
}
