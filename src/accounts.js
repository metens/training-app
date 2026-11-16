import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, serverTimestamp,
  onSnapshot} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import config from './firebase-config.js';

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const account = document.getElementById('cloudAccount');
const status = document.getElementById('cloudStatus');
const controls = document.getElementById('coachControls');
const assigned = document.getElementById('clientAssignments');
let subscriptions = [];
let generation = 0;

function report(message) { status.textContent = message; }

function card(title, detail) {
  const element = document.createElement('div');
  element.className = 'card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const body = document.createElement('p');
  body.textContent = detail;
  element.append(heading, body);
  return element;
}

function action(label, handler, target = account) {
  const button = document.createElement('button');
  button.className = 'light';
  button.type = 'button';
  button.textContent = label;
  button.onclick = async () => {
    button.disabled = true;
    try { await handler(); }
    catch { report('Could not complete that action. Please try again.'); }
    finally { button.disabled = false; }
  };
  target.append(button);
}

function showSignIn() {
  account.innerHTML = '<form><label>Username <input name="username" maxlength="80" autocomplete="nickname"></label>' +
    '<label>Email <input type="email" name="email" autocomplete="email" required></label>' +
    '<label>Password <input type="password" name="password" autocomplete="current-password" required></label>' +
    '<button name="mode" value="signin">Sign in</button> <button name="mode" value="register">Create account</button></form>';
  const form = account.querySelector('form');
  form.onsubmit = async event => {
    event.preventDefault();
    const {email, password, username} = Object.fromEntries(new FormData(form));
    const register = event.submitter?.value === 'register';
    if (register && (!username.trim() || password.length < 8)) {
      report('Enter a username and a password of at least eight characters.');
      return;
    }
    const buttons = [...form.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      if (register) {
        const {user} = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, {displayName: username.trim()});
        await sendEmailVerification(user);
        report('Check your inbox for the verification email.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        form.reset();
      }
    } catch {
      report(register ? 'Could not finish creating the account. Try signing in if you already registered.' :
        'Could not sign in. Check your email and password.');
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  };
  action('Reset password', async () => {
    if (!form.elements.email.reportValidity()) return;
    await sendPasswordResetEmail(auth, form.elements.email.value);
    report('If the account exists, check your inbox for a reset link.');
  });
}

async function renderAccount(user) {
  const current = ++generation;
  subscriptions.forEach(stop => stop());
  subscriptions = [];
  controls.replaceChildren();
  assigned.replaceChildren();
  account.replaceChildren();
  if (document.getElementById('saveAssignedWorkout')) window.closeDialog();
  report('');
  window.setAccountName?.(null);
  if (!user) return showSignIn();

  action('Sign out', () => signOut(auth));
  if (!user.emailVerified) {
    report('Verify your email to open your client account.');
    action('Resend verification email', async () => {
      await sendEmailVerification(user);
      report('Verification email sent.');
    });
    action('I verified my email', async () => {
      await user.reload();
      await user.getIdToken(true);
      await renderAccount(user);
    });
    return;
  }

  const identity = document.createElement('p');
  identity.textContent = user.email;
  account.prepend(identity);
  const profile = doc(db, 'clients', user.uid);
  const snapshot = await getDoc(profile);
  if (current !== generation) return;
  if (!snapshot.exists() || snapshot.data().email !== user.email) {
    await setDoc(profile, {username: user.displayName || user.email.split('@')[0], email: user.email});
  }
  if (current !== generation) return;
  window.setAccountName?.(user.displayName || user.email.split('@')[0]);
  const purchases = document.createElement('div');
  account.append(purchases);
  subscriptions.push(onSnapshot(collection(profile, 'purchases'), list => {
    purchases.replaceChildren(...list.docs.map(item => {
      const data = item.data();
      return card(data.name || item.id, data.status || 'Recorded');
    }));
  }, () => report('Could not load purchases.')));
  subscriptions.push(onSnapshot(collection(profile, 'assignments'), list => {
    assigned.replaceChildren(...list.docs
      .sort((a,b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0))
      .map(item => {
        const {name, exercises} = item.data();
        const workout = card(name, 'Coach assigned');
        action('View assigned workout', () => window.openCloudWorkout(name, exercises), workout);
        return workout;
      }));
  }, () => report('Could not load assigned workouts.')));
  if ((await getDoc(doc(db,'coaches',user.uid))).exists() && current === generation) {
    await renderCoach(current);
  }
}

async function renderCoach(current) {
  const clients = await getDocs(collection(db,'clients'));
  if (current !== generation) return;
  controls.innerHTML = '<h3>Coach tools</h3><form><label>Client <select name="client" required></select></label>' +
    '<label>Active online training <input type="checkbox" name="active"></label>' +
    '<button type="button" name="saveTraining">Save training access</button>' +
    '<label>Purchase name <input name="purchase" maxlength="100"></label>' +
    '<button type="button" name="savePurchase">Record purchase</button>' +
    '<label>Saved workout <select name="workout" required></select></label><button>Send workout</button></form>';
  const form = controls.querySelector('form');
  const {client, workout, active, purchase, saveTraining, savePurchase} = form.elements;
  client.append(new Option('Choose a client', ''));
  clients.forEach(item => client.append(new Option(item.data().username + ' · ' + item.data().email,item.id)));
  workout.append(new Option('Choose a saved workout',''));
  window.cloudWorkoutTemplates().forEach((item,index) => workout.append(new Option(item.name,index)));
  const trainingRecord = () => doc(db,'clients',client.value,'purchases','online-training');
  client.onchange = async () => {
    const selected = client.value;
    active.checked = false;
    if (!selected) return;
    try {
      const record = await getDoc(trainingRecord());
      if (client.value === selected) active.checked = record.data()?.status === 'active';
    } catch { report('Could not load training access.'); }
  };
  saveTraining.onclick = async () => {
    if (!client.reportValidity()) return;
    try {
      await setDoc(trainingRecord(), {name:'Online personal training',status:active.checked ? 'active' : 'inactive',updatedAt:serverTimestamp()});
      report('Training access saved.');
    } catch { report('Could not save training access.'); }
  };
  savePurchase.onclick = async () => {
    if (!client.reportValidity() || !purchase.value.trim()) return;
    savePurchase.disabled = true;
    try {
      await addDoc(collection(db,'clients',client.value,'purchases'), {name:purchase.value.trim(),status:'Recorded',createdAt:serverTimestamp()});
      purchase.value = '';
      report('Purchase recorded.');
    } catch { report('Could not record the purchase.'); }
    finally { savePurchase.disabled = false; }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const template = window.cloudWorkoutTemplates()[Number(workout.value)];
    if (!template) return;
    event.submitter.disabled = true;
    try {
      await addDoc(collection(db,'clients',client.value,'assignments'), {
        name:template.name, exercises:template.exercises, createdAt:serverTimestamp()
      });
      report('Workout sent to the client.');
    } catch { report('Could not send the workout. Check the client’s training access and workout size.'); }
    finally { event.submitter.disabled = false; }
  };
}

onAuthStateChanged(auth, user => renderAccount(user).catch(() => report('Could not load the account. Reload to try again.')));
