import React from 'react';
import {Settings} from './Settings.jsx';
import {App} from './App.jsx';
import css from './styles.css?raw';
export const name='dsh-obsidian-workspace';
export const inject=['slots'];
export function apply(ctx) {
 ctx.effect(()=>{const style=document.createElement('style');style.textContent=css.replace('body{margin:0;background:#f4f5f8}','');document.head.append(style);return ()=>style.remove();});
 ctx.inject(['sidebarRightTabs'], c=>{
  c.effect(()=>c.sidebarRightTabs.register({id:name,kind:name,title:()=> 'Obsidian 工作区',guide:[{order:30,title:()=> 'Obsidian 工作区',description:()=> '查看记忆与多 Agent 任务记录',icon:()=>React.createElement('span',null,'O')}]}));
  c.slots.inject('sidebar.right.pane.tab',()=>c.slots.register({name:'sidebar.right.pane.tab',key:name},props=>React.createElement(App,{embedded:true,sessionId:props.sessionId||'',key:props.sessionId||'no-session'})));
 });
 ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:name,order:65,label:()=> 'Obsidian 项目'},Settings));
}
