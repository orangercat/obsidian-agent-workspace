import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
test('dsh module loader registers right sidebar and cleans up',async()=>{
 let plugin; const cleanups=[]; const registrations=[]; const views=[]; let removed=false;
 const c={effect(fn){cleanups.push(fn());},sidebarRightTabs:{register(r){registrations.push(r);return ()=>{};}},slots:{inject(name,fn){return fn();},register(r,view){assert.equal(typeof view,'function');views.push(view);registrations.push(r);return ()=>{};}},inject(keys,fn){fn(c);}};
 vm.runInNewContext(await readFile('dist/plugin/lib/client.js','utf8'),{window:{__ModuleLoader__:{load({id,factory}){assert.equal(id,'dsh-obsidian-workspace');plugin=factory(id=>{assert.equal(id,'react');return React;});}}},document:{createElement(){return {remove(){removed=true;}};},head:{append(){}}}});
 plugin.apply(c);assert.equal(registrations[0].kind,'dsh-obsidian-workspace');assert.equal(registrations[1].name,'sidebar.right.pane.tab');
 assert.match(renderToStaticMarkup(views[0]({sessionId:'session-test'})),/尚未导入项目/);
 assert.equal(registrations[2].name,'settings.section');assert.equal(registrations[2].label(),'Obsidian 项目');
 assert.match(renderToStaticMarkup(React.createElement(views[1])),/保存项目配置/);
 // HTML pattern uses Unicode sets (v), where a literal hyphen must be escaped.
 const settings=await readFile('src/Settings.jsx','utf8');
 const pattern=JSON.parse('"'+settings.match(/pattern=\{'([^']+)'\}/)[1]+'"');
 const validId=new RegExp('^(?:'+pattern+')$','v');
 assert.equal(validId.test('release-ui-check'),true);
 assert.equal(validId.test('invalid/id'),false);
 assert.equal(validId.test('Uppercase'),false);
 cleanups.forEach(fn=>fn?.());assert.equal(removed,true);
});
