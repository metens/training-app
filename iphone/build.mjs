import {readFile, writeFile, cp, mkdir} from 'node:fs/promises';
import {build} from 'esbuild';

await cp('../src', 'www', {recursive:true});
let html = await readFile('www/index.html','utf8');
html = html.replace('Loading sign-in…','Preparing secure sign-in…');
html = html.replace('<html lang="en">','<html lang="en" class="signed-out">');
html = html.replace('width=device-width,initial-scale=1','width=device-width,initial-scale=1,viewport-fit=cover');
html = html.replace('</style>', '.app-header{padding-top:calc(25px + env(safe-area-inset-top,0px))!important}</style>');
html = html.replace('</style>', '.signed-out nav,.signed-out #messageNotice,.signed-out #account > .card:not(.cloud-account){display:none!important}.signed-out main section:not(#account){display:none!important}.signed-out #account{display:block!important}.signed-out .app{padding-bottom:20px}</style>');
// Keep optional storefront and sample content out of this client preview.
html = html.replace('<section id="shop">','<section id="shop" hidden>')
  .replace(/<button id="nav-shop"[^>]*>.*?<\/button>/,'')
  .replace('repeat(5,1fr)','repeat(4,1fr)')
  .replace('<div class="card"><h3>Pacific Performance</h3>','<div class="card" hidden><h3>Pacific Performance</h3>')
  .replace('<div id="assigned"></div>','<div id="assigned" hidden></div>')
  .replace("['home', 'workouts', 'progress', 'shop', 'account']","['home', 'workouts', 'progress', 'account']")
  .replace("tab('home');", "tab('account');");
html = html.replace('<script type="module" src="/accounts.js"></script>', '<script src="/accounts-bundle.js"></script>');
// Capacitor requires explicit head and body tags to inject its native bridge.
html = html.replace('<html lang="en" class="signed-out">','<html lang="en" class="signed-out"><head>')
  .replace('</style><div class="app">','</style></head><body><div class="app">') + '</body></html>';
await writeFile('www/index.html',html);
let accounts = await readFile('www/accounts.js','utf8');
accounts = accounts.replace(/https:\/\/www.gstatic.com\/firebasejs\/12.18.0\/firebase-(app|auth|firestore).js/g,(_,name)=>'firebase/'+name);
// Email/password auth needs persistence but no browser popup/redirect resolver.
accounts = accounts.replace('getAuth, signInWithEmailAndPassword', 'initializeAuth, browserLocalPersistence, signInWithEmailAndPassword').replace('const auth = getAuth(app);', 'const auth = initializeAuth(app, {persistence: browserLocalPersistence});');
accounts = "import {Capacitor, CapacitorHttp, registerPlugin} from '@capacitor/core';\nif (Capacitor.isNativePlatform()) { window.PPSessionDevice = registerPlugin('SessionDevice');\nwindow.PPSessionDevice.addListener('sessionNotification', () => { if (!document.documentElement.classList.contains('signed-out')) { window.closeDialog(); window.tab('account'); window.refreshAppointments?.(); } }); }\n" + accounts;
const start = accounts.indexOf('  const response = await fetch(`/api/portal');
const end = accounts.indexOf('  return result;',start);
if(start<0||end<0) throw Error('Portal implementation changed');
accounts = accounts.slice(0,start) + `  const response = await CapacitorHttp.request({
    url: 'https://pacificperformance.fit/api/portal?action=' + action,
    method: options.method || 'GET',
    headers: {Authorization: 'Bearer ' + await user.getIdToken(), ...options.headers},
    ...(options.body ? {data: JSON.parse(options.body)} : {}),
    responseType: 'json'
  });
  const result = response.data;
  if (!result || typeof result !== 'object' || response.status < 200 || response.status >= 300) {
    throw new Error(result?.error || 'Your account could not be refreshed. Please try again.');
  }
` + accounts.slice(end);
accounts = accounts.replace("  const current = ++generation;", `  document.documentElement.classList.toggle('signed-out', !user);
  window.tab(user ? 'home' : 'account');
  if (!user) {
    document.getElementById('title').textContent = 'Pacific Performance';
    document.querySelector('#account > h2').textContent = 'Sign in';
  } else document.querySelector('#account > h2').textContent = 'My Account';
  const current = ++generation;`);
accounts = accounts.replace('Use the same email and password as your Pacific Performance website account. App preview accounts are separate; ask your coach for website access if needed.','Sign in with your Pacific Performance email and password.');
await mkdir('build',{recursive:true});
await writeFile('www/accounts-native.js',accounts);
await build({entryPoints:['www/accounts-native.js'],bundle:true,outfile:'www/accounts-bundle.js',format:'iife',target:'safari16',minify:true});
console.log('Bundled Pacific Performance screens, sign-in, and native API connection.');
