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
      buttons.className = 'row';
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

async function renderAccount(user) {
  const current = ++generation;
  clearTimeout(timer);
  activeAccount = user;
  plans = [];
  syncStatus.hidden = true;
  window.selectWorkoutAccount(user?.uid || null);
  controls.replaceChildren(); assigned.replaceChildren(); account.replaceChildren(); sessions.replaceChildren();
  report(''); window.setAccountName?.(null);
  if (!user) { sessions.textContent = 'Sign in to see your upcoming sessions.'; return showSignIn(); }
  action('Sign out', () => signOut(auth));
  const identity = document.createElement('p'); identity.textContent = user.email; account.prepend(identity);
  window.setAccountName?.(user.displayName || user.email.split('@')[0]);
  let staff = null;
  try { staff = (await getDoc(doc(db, 'staffUsers', user.uid))).data(); } catch { /* Client accounts cannot read staff records. */ }
  if (current !== generation) return;
  if (staff?.active === true && staff.role === 'admin') await renderCoach(current, user, staff);
  if (current !== generation) return;
  const refresh = async () => {
    syncWorkouts(user);
    const results = await Promise.allSettled([portal(user, 'workout-plans'), portal(user, 'sessions')]);
    if (current !== generation) return;
    if (results[0].status === 'fulfilled') {
      plans = results[0].value.plans.sort((a,b) => Number(a.archived) - Number(b.archived) || b.version - a.version);
      renderAssignments();
    }
    if (results[1].status === 'fulfilled') {
      const upcoming = results[1].value.appointments
        .filter(item => item.status === 'scheduled')
        .sort((a,b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
      const dateTime = new Intl.DateTimeFormat('en-US', {dateStyle:'medium', timeStyle:'short'});
      sessions.replaceChildren(...upcoming.filter(item => new Date(item.start).getTime() >= Date.now()).map(item =>
        card(dateTime.format(new Date(item.start)), `${new Intl.DateTimeFormat('en-US', {timeStyle:'short'}).format(new Date(item.end))} end · ${item.durationMinutes} minutes · ${item.location || 'See your coach'}`)));
      if (!sessions.children.length) sessions.textContent = 'No upcoming sessions scheduled.';
    } else { sessions.textContent = staff ? 'Manage client sessions on the website Calendar.' : results[1].reason.message; }
    timer = setTimeout(refresh, 30000);
  };
  await refresh();
}
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

