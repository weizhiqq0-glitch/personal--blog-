import { api } from './api';
const jobs=[],pending=new Map();let running=0;
function pump(){while(running<2&&jobs.length){const {text,resolve,reject}=jobs.shift();running++;api('/github-translate',{method:'POST',body:JSON.stringify({text})}).then(resolve,reject).finally(()=>{running--;pending.delete(text);pump();});}}
export function translateDescription(text){if(pending.has(text))return pending.get(text);const promise=new Promise((resolve,reject)=>{jobs.push({text,resolve,reject});});pending.set(text,promise);pump();return promise;}
