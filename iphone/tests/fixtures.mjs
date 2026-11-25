// Test-only adapters. Never included in the shipped bundle.
export const initializeApp = () => ({});
export const browserLocalPersistence = {};
const auth = {currentUser:null}; let listener;
export const initializeAuth = () => auth;
export const onAuthStateChanged = (_, fn) => { listener=fn; queueMicrotask(()=>fn(auth.currentUser)); };
export async function signInWithEmailAndPassword(_,email,password) {
 if(password==='wrong') throw Error('Invalid credentials');
 auth.currentUser={uid:email.split('@')[0],email,getIdToken:async()=> 'test-token'};
 await listener(auth.currentUser);
}
export async function signOut(){auth.currentUser=null;await listener(null);}
export const sendPasswordResetEmail=async()=>{};
export const getFirestore=()=>({});
export const doc=(...args)=>args;
export const collection=(...args)=>args;
export const getDoc=async()=>({data:()=>null});
export const getDocs=async()=>({docs:[]});
export const runTransaction=async()=>{throw Error('Not part of client tests');};
export const serverTimestamp=()=>0;
export const CapacitorHttp={request:async request=>{
 window.__requests??=[]; window.__requests.push(request);
 const action=new URL(request.url).searchParams.get('action');
 if(window.__fail?.includes(action)) throw Error('Test offline');
 const data=window.__data||{};
 return {status:200,data:action==='workout-plans'?{plans:data.plans||[]}:action==='sessions'?{appointments:data.appointments||[]}:action==='messages'?{messages:data.messages||[],thread:{}}:{workouts:[]}};
}};

export const Capacitor={isNativePlatform:()=>false};
export const registerPlugin=()=>({});
