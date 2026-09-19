import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('manual default, toggle cleanup, visibility and overlapping reads',async()=>{
 const slots=[],effects=[],timers=new Map();let cursor=0,requests=0,pending,onProjectsChanged;
 let configured=[{id:'demo',name:'Demo'}];
 const changed=(a,b)=>!a||a.some((x,i)=>x!==b[i]);
 const scope={AbortController,URLSearchParams,document:{visibilityState:'visible'},validate:x=>x,window:{addEventListener(name,fn){onProjectsChanged=fn;},removeEventListener(){}},
  useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},
  useRef(initial){const i=cursor++;return slots[i]??=( {current:initial});},
  useCallback(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps))slots[i]={deps,fn};return slots[i].fn;},
  useEffect(fn,deps){const i=cursor++;if(changed(slots[i]?.deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
  setInterval(fn,ms){assert.equal(ms,60000);const id=Symbol();timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id),
  fetch:async url=>{if(!url.includes('?'))return {ok:true,json:async()=>({projects:configured})};requests++;await new Promise(resolve=>pending=resolve);return {ok:true,json:async()=>({project:'Demo'})};}
 };
 vm.createContext(scope);
 vm.runInContext((await readFile('src/useWorkspace.js','utf8')).replace(/^import .*;\n/gm,'').replace('export function','function')+'\nthis.hook=useWorkspace;',scope);
 const render=()=>{cursor=0;const result=scope.hook(true,'session');effects.splice(0).forEach(fn=>fn());return result;};
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 render();await flush();let view=render();assert.equal(requests,1);assert.equal(timers.size,0);assert.equal(view.autoRefresh,false);
 await view.refresh();assert.equal(requests,1);pending();await flush();view=render();
 view.setAutoRefresh(true);view=render();assert.equal(timers.size,1);assert.equal(requests,1);
 const tick=[...timers.values()][0];scope.document.visibilityState='hidden';tick();assert.equal(requests,1);
 scope.document.visibilityState='visible';tick();tick();assert.equal(requests,2);pending();await flush();
 view.setAutoRefresh(false);view=render();assert.equal(timers.size,0);assert.equal(view.data.project,'Demo');
 const manual=view.refresh();assert.equal(requests,3);pending();await manual;
 configured=[];onProjectsChanged();await flush();render();view=render();assert.equal(view.projectId,'');assert.equal(view.data,null);assert.equal(timers.size,0);
 slots.forEach(s=>s?.cleanup?.());
});
