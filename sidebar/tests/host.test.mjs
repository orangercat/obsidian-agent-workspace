import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {makeHandler,projects,readProject,apply} from '../host/index.js';

test('configured roots only, read errors and request validation',async()=>{
 const config=[{id:'demo',name:'Demo',vaultProject:'/example/notes',repo:'/example/repo'}];
 let calls=0;
 const handler=makeHandler(async()=>config,async(p,session)=>{calls++;assert.equal(p,config[0]);return {session};});
 const request=(query,method='GET')=>new Request('http://localhost/api/obsidian-workspace'+query,{method});
 assert.deepEqual(await (await handler(request(''))).json(),{projects:[{id:'demo',name:'Demo'}]});
 assert.equal((await handler(request('?project=other'))).status,404);
 assert.equal((await handler(request('?project=demo&path=/etc/passwd'))).status,400);
 assert.equal((await handler(request('?project=demo&session=../bad'))).status,400);
 assert.equal((await handler(request('?project=demo','POST'))).status,405);
 assert.equal(calls,0);
 assert.equal((await handler(request('?project=demo&session=session-a'))).status,200);
 const failing=makeHandler(async()=>config,async()=>{throw Error('/private/details');});
 assert.equal((await failing(request('?project=demo'))).status,503);
 assert.doesNotMatch(await (await failing(request('?project=demo'))).text(),/private/);
 let route;apply({effect:fn=>fn(),connection:{fetch:{register:r=>{route=r;return ()=>{};}}}});
 assert.equal(route.path,'/api/obsidian-workspace');assert.deepEqual(route.methods,['GET']);
});

test('config and subprocess boundary',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'oaw-host-'));
 try {
  const filename=path.join(directory,'config.json');assert.deepEqual(await projects(filename),[]);
  await writeFile(filename,JSON.stringify({projects:[{name:'bad',vaultProject:'/notes'}]}));
  await assert.rejects(projects(filename));
  await writeFile(filename,JSON.stringify({projects:[{id:'demo',name:'Demo',vaultProject:'/notes'}]}));
  assert.equal((await projects(filename)).length,1);
  const result=await readProject({name:'Demo',vaultProject:'/notes with spaces',repo:'/repo'},'session-a',async(bin,args,options)=>{
   assert.equal(bin,'python3');assert.ok(args.includes('/notes with spaces'));assert.equal(options.shell,undefined);assert.equal(options.timeout,15000);return {stdout:'{"version":1}'};
  });assert.equal(result.version,1);
 } finally {await rm(directory,{recursive:true});}
});

test('settings validates directories, preserves config and rejects stale or cross-origin writes',async()=>{
 const {makeSettingsHandler}=await import('../host/index.js');
 const {readFile}=await import('node:fs/promises');
 const directory=await mkdtemp(path.join(tmpdir(),'oaw-settings-'));
 try {
  const filename=path.join(directory,'config.json');await writeFile(filename,JSON.stringify({other:true,projects:[]}));
  const handler=makeSettingsHandler(filename),url='http://dsh.internal/api/obsidian-workspace/settings';
  const get=()=>handler(new Request(url));
  const initial=await (await get()).json();
  const list=[{id:'demo',name:'Demo',vaultProject:directory}];
  const put=(projects,revision=initial.revision,origin='http://localhost')=>handler(new Request(url,{method:'PUT',headers:{host:'localhost',origin,'content-type':'application/json'},body:JSON.stringify({projects,revision})}));
  assert.equal((await put(list,initial.revision,'https://other.test')).status,403);
  assert.equal((await put([...list,...list])).status,400);
  assert.equal((await put([{...list[0],vaultProject:'relative'}])).status,400);
  assert.equal((await put([{...list[0],vaultProject:path.join(directory,'missing')}])).status,400);
  const saved=await (await put(list)).json();assert.equal(saved.projects.length,1);
  assert.equal(JSON.parse(await readFile(filename,'utf8')).other,true);
  assert.equal((await put([])).status,409);
  assert.equal((await put([],saved.revision)).status,200);
  assert.deepEqual((await (await get()).json()).projects,[]);
 } finally {await rm(directory,{recursive:true});}
});
