import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionHeading,calendarFile,sessionReminders,validSession} from '../src/session-tools.mjs';
const session=(start='2026-11-25T20:00:00Z')=>({id:'session-1',status:'scheduled',start,end:new Date(Date.parse(start)+3000000).toISOString(),location:'Beaverton'});
test('appointment labels distinguish today, tomorrow and the next weekday in local time',()=>{
 const now=new Date('2026-11-24T20:00:00Z');
 assert.equal(sessionHeading(session(),now,'America/Los_Angeles'),'Tomorrow, Nov 25 at 12:00 PM');
 assert.equal(sessionHeading(session('2026-11-24T20:00:00Z'),now,'America/Los_Angeles'),'Today, Nov 24 at 12:00 PM');
 assert.equal(sessionHeading(session('2026-12-01T00:00:00Z'),now,'America/Los_Angeles'),'Next Monday, Nov 30 at 4:00 PM');
});
test('calendar-day labels handle DST and year changes',()=>{
 assert.match(sessionHeading(session('2026-11-01T20:00:00Z'),new Date('2026-10-31T20:00:00Z'),'America/Los_Angeles'),/^Tomorrow/);
 assert.match(sessionHeading(session('2027-01-01T20:00:00Z'),new Date('2026-12-31T20:00:00Z'),'America/Los_Angeles'),/^Tomorrow, Jan 1, 2027/);
});
test('calendar exports preserve exact UTC times and escape injected lines',()=>{
 const item={...session(),location:'Gym, room;1\nBEGIN:VEVENT'};const file=calendarFile(item);
 assert.match(file,/DTSTART:20261125T200000Z\r\nDTEND:20261125T205000Z/);
 assert.match(file,/Gym\\, room\\;1\\nBEGIN:VEVENT/);
 assert.equal(file.split('\r\nBEGIN:VEVENT').length,2);
 assert.ok(calendarFile({...session(),location:'é'.repeat(150)}).split('\r\n').every(line=>Buffer.byteLength(line)<=75));
});
test('reminders skip cancellations, invalid and elapsed times, and cap nearest 60',()=>{
 const now=Date.parse('2026-11-25T18:00:00Z');const item=session();
 assert.equal(sessionReminders([item],now)[0].at,Date.parse(item.start)-3600000);
 assert.equal(sessionReminders([{...item,status:'cancelled'},{...item,end:'bad'},session('2026-11-25T18:30:00Z')],now).length,0);
 assert.equal(validSession({...item,end:item.start}),false);
 assert.equal(sessionReminders(Array.from({length:80},(_,i)=>({...item,id:String(i),start:new Date(now+(i+2)*3600000).toISOString(),end:new Date(now+(i+3)*3600000).toISOString()})),now).length,60);
});
