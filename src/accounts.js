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
async function portal(user, action) {
  const response = await fetch(`/api/portal?action=${action}`, {
    headers: {Authorization: `Bearer ${await user.getIdToken()}`}, cache: 'no-store'
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not load your account.');
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
function showPlan(plan) {
  window.show(plan.name, '');
  const body = document.getElementById('dialogBody');
  body.dataset.clientPlan = 'true';
  body.append(card(`Version ${plan.version}`, [plan.goal, plan.startDate, plan.endDate, plan.coachNotes].filter(Boolean).join(' · ')));
  for (const day of plan.days || []) {
    const section = card(day.name || 'Workout day', '');
    for (const exercise of day.exercises || []) {
      section.append(card(exercise.name, [
        `${exercise.sets} sets`, `${exercise.reps} reps`, exercise.load,
        exercise.rest ? `${exercise.rest} sec rest` : '', exercise.notes
      ].filter(Boolean).join(' · ')));
    }
    body.append(section);
  }
}
async function renderAccount(user) {
  const current = ++generation;
  clearTimeout(timer);
  controls.replaceChildren(); assigned.replaceChildren(); account.replaceChildren(); sessions.replaceChildren();
  if (document.getElementById('dialogBody').dataset.clientPlan) {
    window.closeDialog(); delete document.getElementById('dialogBody').dataset.clientPlan;
  }
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
    const results = await Promise.allSettled([portal(user, 'workout-plans'), portal(user, 'sessions')]);
    if (current !== generation) return;
    if (results[0].status === 'fulfilled') {
      const plans = results[0].value.plans.sort((a,b) => Number(a.archived) - Number(b.archived) || b.version - a.version);
      assigned.replaceChildren(...plans.map(plan => {
        const item = card(plan.name, plan.archived ? 'Previous workout plan' : 'From your coach · available on the website too');
        action('View workout plan', () => showPlan(plan), item);
        return item;
      }));
      if (!plans.length) assigned.textContent = 'Your coach has not delivered a workout plan yet.';
    } else if (!staff) { assigned.textContent = results[0].reason.message; }
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
