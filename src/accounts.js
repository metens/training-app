import {configureSessions,renderSessions,releaseSessions} from './session-ui.mjs';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore, collection, doc, getDoc, getDocs, runTransaction, serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import config from './firebase-config.js';
import {planFromWorkout} from './plan-format.mjs';
import {deliverWorkout} from './plan-delivery.mjs';

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const account = document.getElementById('cloudAccount');
const status = document.getElementById('cloudStatus');
const controls = document.getElementById('coachControls');
const assigned = document.getElementById('clientAssignments');
const sessions = document.getElementById('clientSessions');
let generation = 0;
let timer;
const report = message => { status.textContent = message; };
function card(title, detail) {
  const element = document.createElement('div');
  element.className = 'card';
  const heading = document.createElement('h3'); heading.textContent = title;
  const body = document.createElement('p'); body.textContent = detail;
  element.append(heading, body);
  return element;
}
function action(label, handler, target = account) {
  const button = document.createElement('button');
  button.className = 'light'; button.type = 'button'; button.textContent = label;
  button.onclick = async () => {
    button.disabled = true;
    try { await handler(); } catch (error) { report(error.message || 'Please try again.'); }
    finally { button.disabled = false; }
  };
  target.append(button);
}
async function portal(user, action, options = {}) {
  const response = await fetch(`/api/portal?action=${action}`, {
    ...options, headers: {Authorization: `Bearer ${await user.getIdToken()}`, ...options.headers}, cache: 'no-store'
  });
  const result = await response.json().catch(() => null);
  if (!result || !response.ok) {
    throw new Error(result?.error || 'Your account could not be refreshed. We’ll retry automatically. If this continues, contact your coach.');
  }
  return result;
}
function showSignIn() {
  account.innerHTML = '<p>Use the same email and password as your Pacific Performance website account. App preview accounts are separate; ask your coach for website access if needed.</p><form>' +
    '<label>Email <input type="email" name="email" autocomplete="email" required></label>' +
    '<label>Password <input type="password" name="password" autocomplete="current-password" required></label><button>Sign in</button></form>';
  const form = account.querySelector('form');
  form.onsubmit = async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { await signInWithEmailAndPassword(auth, form.elements.email.value, form.elements.password.value); }
    catch { report('Could not sign in. Use your website account email and password.'); }
    finally { button.disabled = false; }
  };
  action('Reset password', async () => {
    if (!form.elements.email.reportValidity()) return;
    await sendPasswordResetEmail(auth, form.elements.email.value);
    report('If the account exists, check your inbox for a reset link.');
  });
}
let activeAccount;
let plans = [];
let syncTask;
let syncRevision = 0;
const syncStatus = document.getElementById('workoutSyncStatus');
const outboxKey = uid => 'pp_vercel_demo_workout_outbox_' + uid;
const outbox = uid => JSON.parse(localStorage.getItem(outboxKey(uid)) || '{}');
const persistOutbox = (uid, entries) => localStorage.setItem(outboxKey(uid), JSON.stringify(entries));

function renderAssignments() {
  assigned.replaceChildren(...plans.map(plan => {
    const days = (plan.days || []).map((day, index) => ({day, index})).filter(({day}) => day?.exercises?.length);
    const completed = new Set(window.completedCoachDays(plan.id));
    const done = days.length > 0 && days.every(({index}) => completed.has(index));
    const item = card(plan.name, done ? 'Completed · Coach assigned' :
      plan.archived ? 'Previous coach workout' : 'Coach assigned');
    item.classList.toggle('coach-completed', done);
    if (plan.coachNotes) {
      const notes = document.createElement('p');
      notes.textContent = plan.coachNotes;
      item.append(notes);
    }
    for (const {day, index} of days) {
      const dayName = days.length === 1 ? 'workout' : day.name || 'Day ' + (index + 1);
      const buttons = document.createElement('div');
      buttons.className = 'row workout-day-actions';
      action((completed.has(index) ? 'Repeat ' : 'Start ') + dayName, () => window.startCoachDay(plan, index), buttons);
      action('View', () => window.viewCoachDay(plan, index), buttons);
      item.append(buttons);
    }
    return item;
  }));
}
window.renderCoachAssignments = renderAssignments;

window.queueWorkoutSync = (uid, session, deleting) => {
  if (activeAccount?.uid !== uid) return;
  const entries = outbox(uid);
  entries[session.id] = {session, deleting: Boolean(deleting), revision: crypto.randomUUID()};
  persistOutbox(uid, entries);
  syncRevision++;
  renderAssignments();
  syncWorkouts(activeAccount);
};

function syncWorkouts(user) {
  if (activeAccount !== user) return;
  if (syncTask?.user === user) return syncTask.promise;
  const task = {user};
  syncTask = task;
  task.promise = (async () => {
    const {uid} = user;
    while (activeAccount === user) {
      const pending = Object.values(outbox(uid));
      if (!pending.length) break;
      const {session, deleting, revision} = pending[0];
      try {
        await portal(user, deleting ? 'workout-history&id=' + encodeURIComponent(session.id) : 'workout-history',
          deleting ? {method:'DELETE'} :
            {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(session)});
      } catch {
        if (activeAccount === user) {
          syncStatus.hidden = false;
          syncStatus.textContent = 'Workout saved on this device. Website sync is pending.';
        }
        return;
      }
      const latest = outbox(uid);
      if (latest[session.id]?.revision === revision) delete latest[session.id];
      persistOutbox(uid, latest);
    }
    if (activeAccount !== user) return;
    syncStatus.hidden = true;
    const before = syncRevision;
    try {
      const {workouts} = await portal(user, 'workout-history');
      if (activeAccount === user && before === syncRevision) {
        window.mergeWorkoutHistory(workouts, new Set(Object.keys(outbox(uid))));
        renderAssignments();
      }
    } catch { /* An account without a client profile can still use on-device training. */ }
  })().finally(() => {
    if (syncTask === task) syncTask = null;
    if (activeAccount === user && !syncStatus.hidden) return;
    if (activeAccount === user && Object.keys(outbox(user.uid)).length) syncWorkouts(user);
  });
  return task.promise;
}
window.addEventListener('online', () => { if (activeAccount) syncWorkouts(activeAccount); });

const messageCard = document.getElementById('clientMessageCard');
const messageNotice = document.getElementById('messageNotice');
let messageState = {messages:[],thread:{}};
let messageTimer;
let messageRequest = false;
let messageUser = null;
let draftMessage = null;

function renderMessageNotice() {
  const unread = (messageState.thread.lastStaffAt || 0) > (messageState.thread.clientReadAt || 0);
  messageNotice.hidden = !messageUser || !unread;
  messageNotice.textContent = unread ? 'Your coach replied · View message' : '';
}
function messageBubble(message) {
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble' + (message.sender === 'staff' ? ' coach-reply' : '');
  const label = document.createElement('strong');
  label.textContent = message.sender === 'staff' ? 'Coach' : 'You';
  const text = document.createElement('p');
  text.style.whiteSpace = 'pre-wrap';
  text.textContent = message.text;
  const date = document.createElement('small');
  date.textContent = new Date(message.sentAt).toLocaleString();
  bubble.append(label,text,date);
  if (message.sender === 'staff') addMessageReaction(bubble,message);
  return bubble;
}
function addMessageReaction(bubble,message) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'reaction-trigger';
  trigger.textContent = message.thumbsUp ? '👍 1' : '';
  trigger.hidden = !message.thumbsUp;
  bubble.tabIndex = 0;
  bubble.setAttribute('aria-label', 'Coach message. Hold or press Enter to react.');
  trigger.setAttribute('aria-label',message.thumbsUp ? 'Change thumbs-up reaction' : 'React to coach message');
  trigger.setAttribute('aria-expanded','false');
  const options = document.createElement('div');
  options.className = 'reaction-options';
  options.hidden = true;
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.textContent = message.thumbsUp ? 'Remove 👍' : '👍 Thumbs up';
  thumb.setAttribute('aria-pressed',String(Boolean(message.thumbsUp)));
  const feedback = document.createElement('span');
  feedback.setAttribute('role','status');
  feedback.className = 'muted';
  options.append(thumb,feedback);
  bubble.append(trigger,options);
  const reveal = () => {
    options.hidden = false;
    trigger.setAttribute('aria-expanded','true');
  };
  bubble.addEventListener('keydown', event => {
    if (event.target === bubble && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); reveal(); thumb.focus();
    }
    if (event.key === 'Escape') {options.hidden = true; trigger.setAttribute('aria-expanded','false');}
  });
  trigger.onclick = () => {
    options.hidden = !options.hidden;
    trigger.setAttribute('aria-expanded',String(!options.hidden));
  };
  let hold;
  let origin;
  const cancel = () => { clearTimeout(hold); origin = null; };
  bubble.addEventListener('pointerdown',event => {
    if (event.target.closest('button') || !event.isPrimary || event.button !== 0) return;
    origin = {x:event.clientX,y:event.clientY};
    hold = setTimeout(() => { reveal(); navigator.vibrate?.(15); },500);
  });
  bubble.addEventListener('pointermove',event => {
    if (origin && Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>10) cancel();
  });
  for (const name of ['pointerup','pointercancel','pointerleave']) bubble.addEventListener(name,cancel);
  bubble.addEventListener('contextmenu',event => {event.preventDefault(); reveal();});
  thumb.onclick = async () => {
    const user = messageUser;
    if (!user) return;
    thumb.disabled = true;
    feedback.textContent = '';
    const thumbsUp = !message.thumbsUp;
    try {
      await portal(user,'messages',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'react',id:message.id,thumbsUp})});
      if (messageUser !== user) return;
      message.thumbsUp = thumbsUp;
      trigger.textContent = thumbsUp ? '👍 1' : '';
      trigger.hidden = !thumbsUp;
      trigger.setAttribute('aria-label',thumbsUp ? 'Change thumbs-up reaction' : 'React to coach message');
      thumb.textContent = thumbsUp ? 'Remove 👍' : '👍 Thumbs up';
      thumb.setAttribute('aria-pressed',String(thumbsUp));
      options.hidden = true;
      trigger.setAttribute('aria-expanded','false');
    } catch { feedback.textContent = 'Reaction could not be saved. Try again.'; }
    finally { thumb.disabled = false; }
  };
}
async function acknowledgeMessages(user) {
  const latest = messageState.messages.filter(message => message.sender === 'staff').at(-1);
  if (!latest || latest.sentAt <= (messageState.thread.clientReadAt || 0)) return;
  await portal(user,'messages',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'read',id:latest.id})});
  if (user !== messageUser) return;
  messageState.thread.clientReadAt = latest.sentAt;
  renderMessageNotice();
}
async function refreshMessages() {
  const user = messageUser;
  if (!user || messageRequest) return;
  messageRequest = true;
  try {
    const result = await portal(user,'messages');
    if (messageUser !== user) return;
    messageState = result;
    renderMessageNotice();
    const list = document.getElementById('clientThread');
    if (list && document.getElementById('dialog').classList.contains('on')) {
      list.replaceChildren(...result.messages.map(messageBubble));
      if (!result.messages.length) list.textContent = 'Send a message to your coach.';
      await acknowledgeMessages(user);
    }
  } catch {
    const feedback = document.getElementById('messageFeedback');
    if (user === messageUser && feedback) feedback.textContent = 'Messages could not be refreshed. Try again shortly.';
  } finally { messageRequest = false; }
}

function resetMessages(user) {
  clearInterval(messageTimer);
  messageUser = user;
  messageState = {messages:[],thread:{}};
  draftMessage = null;
  messageCard.hidden = !user;
  messageNotice.hidden = true;
  if (document.getElementById('clientThread')) window.closeDialog();
  if (user) {
    refreshMessages();
    messageTimer = setInterval(refreshMessages,15000);
  }
}
async function openMessages() {
  const user = messageUser;
  if (!user) return;
  window.show('Messages with your coach',
    '<div id="clientThread" class="message-thread"></div><form id="clientMessageForm">' +
    '<label for="clientMessageText">Message</label><textarea id="clientMessageText" maxlength="4000" required rows="4"></textarea>' +
    '<button type="submit">Send message</button><p id="messageFeedback" class="muted" role="status"></p></form>');
  const list = document.getElementById('clientThread');
  list.replaceChildren(...messageState.messages.map(messageBubble));
  const form = document.getElementById('clientMessageForm');
  form.onsubmit = async event => {
    event.preventDefault();
    if (user !== messageUser || !form.reportValidity()) return;
    const input = form.querySelector('textarea');
    const text = input.value.trim();
    if (!text) return;
    if (draftMessage?.text !== text) draftMessage = {id:crypto.randomUUID(),text};
    const button = form.querySelector('button');
    const feedback = form.querySelector('[role=status]');
    button.disabled = true;
    feedback.textContent = 'Sending…';
    try {
      await portal(user,'messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draftMessage)});
      if (user !== messageUser) return;
      input.value = '';
      draftMessage = null;
      feedback.textContent = 'Message sent.';
      await refreshMessages();
    } catch (error) { if (user === messageUser) feedback.textContent = error.message; }
    finally { button.disabled = false; }
  };
  await refreshMessages();
}
document.getElementById('openClientMessages').onclick = openMessages;
messageNotice.onclick = openMessages;

async function renderAccount(user) {
  const current = ++generation;
  clearTimeout(timer);
  activeAccount = user;
  configureSessions(user,portal);
  resetMessages(user);
  plans = [];
  syncStatus.hidden = true;
  window.selectWorkoutAccount(user?.uid || null);
  controls.replaceChildren(); assigned.replaceChildren(); account.replaceChildren(); sessions.replaceChildren();
  report(''); window.setAccountName?.(null);
  if (!user) { sessions.textContent = 'Sign in to see your upcoming sessions.'; return showSignIn(); }
  action('Sign out', async () => {await releaseSessions(user,portal);await signOut(auth);});
  const identity = document.createElement('p'); identity.textContent = user.email; account.prepend(identity);
  window.setAccountName?.(user.displayName || user.email.split('@')[0]);
  let staff = null;
  try { staff = (await getDoc(doc(db, 'staffUsers', user.uid))).data(); } catch { /* Client accounts cannot read staff records. */ }
  if (current !== generation) return;
  if (staff?.active === true && staff.role === 'admin') await renderCoach(current, user, staff);
  if (current !== generation) return;
  const refresh = async () => {
    clearTimeout(timer);
    if (current !== generation) return;
    syncWorkouts(user);
    const results = await Promise.allSettled([portal(user, 'workout-plans'), portal(user, 'sessions')]);
    if (current !== generation) return;
    if (results[0].status === 'fulfilled') {
      plans = results[0].value.plans.sort((a,b) => Number(a.archived) - Number(b.archived) || b.version - a.version);
      renderAssignments();
    }
    if (results[1].status === 'fulfilled') {
      renderSessions(results[1].value.appointments);
    } else { sessions.textContent = staff ? 'Manage client sessions on the website Calendar.' : results[1].reason.message; }
    timer = setTimeout(refresh, 30000);
  };
  window.refreshAppointments = refresh;
  await refresh();
}
window.addEventListener('focus',()=>window.refreshAppointments?.());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.refreshAppointments?.();});
async function renderCoach(current, user, staff) {
  const clients = await getDocs(collection(db, 'clients'));
  if (current !== generation) return;
  controls.innerHTML = '<h3>Send a workout to a client</h3><p>Delivered plans appear in both the app and website. The previous plan stays in their history.</p><form>' +
    '<label>Client <select name="client" required></select></label>' +
    '<label>Saved workout <select name="workout" required></select></label>' +
    '<label>Start date <input name="startDate" type="date" required></label><button>Send to client</button></form>';
  const form = controls.querySelector('form');
  const {client, workout, startDate} = form.elements;
  client.append(new Option('Choose a client', ''));
  clients.docs.filter(item => item.data().authUid).forEach(item => client.append(new Option(item.data().name || item.data().email, item.id)));
  let templates = [];
  const refreshWorkouts = () => {
    const previous = workout.value;
    templates = structuredClone(window.cloudWorkoutTemplates());
    workout.replaceChildren(new Option('Choose a saved workout', ''));
    templates.forEach((item, index) => workout.append(new Option(item.name, String(index))));
    if ([...workout.options].some(option => option.value === previous)) workout.value = previous;
  };
  refreshWorkouts(); workout.addEventListener('focus', refreshWorkouts);
  startDate.value = new Intl.DateTimeFormat('en-CA').format(new Date());
  form.onsubmit = async event => {
    event.preventDefault();
    if (!form.reportValidity() || current !== generation) return;
    const template = templates[Number(workout.value)];
    if (!template) return;
    const targetId = client.value;
    const plan = planFromWorkout(template, startDate.value);
    const button = form.querySelector('button'); button.disabled = true;
    const clientRef = doc(db, 'clients', targetId);
    const planRef = doc(collection(clientRef, 'workoutPlans'));
    try {
      const history = await getDocs(collection(clientRef, 'workoutPlans'));
      if (current !== generation) return;
      await deliverWorkout({db, user, staff, targetId, plan, history, clientRef, planRef}, {runTransaction, doc, serverTimestamp});
      if (current === generation) report('Workout delivered to the client’s app and website.');
    } catch (error) { if (current === generation) report(error.message || 'Could not send the workout. Try again.'); }
    finally { button.disabled = false; }
  };
}
onAuthStateChanged(auth, user => renderAccount(user).catch(() => report('Could not load the account. Reload to try again.')));

