import React, {useEffect, useRef, useState} from 'react';
// ponytail: reuse the original mock asset for its logo crop; extract a dedicated asset before a bandwidth-sensitive release.
import designAsset from '../../docs/assets/dsh-sidebar-ui-v1.png?inline';
import {demo, labels, progress, validate} from './data.js';
import {useWorkspace} from './useWorkspace.js';
export function App({embedded=false,sessionId=''}) {
 const [offlineData,setData]=useState(embedded?null:demo), [tab,setTab]=useState('memory'), [query,setQuery]=useState(''), [filter,setFilter]=useState('all'), [detail,setDetail]=useState(null), [error,setError]=useState(''), [sample,setSample]=useState(!embedded);
 const [deleting,setDeleting]=useState(false);
 const live=useWorkspace(embedded,sessionId);
 const data=live.projectId?live.data:offlineData;
 const stateNames={unbound:'会话未读取',current:'已读版本一致',stale:'已读上下文过期',error:'上下文检查失败'};
 useEffect(()=>{setDetail(previous=>previous?[...(data?.notes||[]),...(data?.tasks||[])].find(row=>row.id===previous.id&&Boolean(row.status)===Boolean(previous.status))||null:null);},[data]);
 const input=useRef(null);
 const stats=progress(data?.tasks||[]);
 async function importFile(event) {
  const file=event.target.files[0]; if(!file)return;
  try {if(file.size>10*1024*1024)throw Error('文件超过 10 MB'); const next=validate(JSON.parse(await file.text())); live.setProjectId('');setData(next);setSample(false);setDetail(null);setQuery('');setError('');} catch(e){setError(e.message);} finally{event.target.value='';}
 }
 async function deleteCurrentProject() {
  const project=live.projects.find(p=>p.id===live.projectId);
  if(!project||deleting||!window.confirm('删除项目「'+project.name+'」？仅移除连接，不删除 Obsidian 笔记、代码仓库或会话记录。'))return;
  setDeleting(true);setError('');
  try {
   const endpoint='/api/obsidian-workspace/settings';
   const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
   const config=await response.json();if(!response.ok)throw Error(config.error);
   const saved=await fetch(endpoint,{method:'PUT',credentials:'same-origin',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:config.revision,projects:config.projects.filter(p=>p.id!==project.id)})});
   const result=await saved.json();if(!saved.ok)throw Error(result.error);
   setDetail(null);setQuery('');
   window.dispatchEvent(new Event('oaw-projects-changed'));
  } catch(e){setError(e.name==='TimeoutError'?'请求超时，请在设置中重新加载，确认项目是否已删除。':e.message);}
  finally{setDeleting(false);}
 }
 const match=row=>(row.title+' '+row.body+' '+(row.owner||'')).toLowerCase().includes(query.toLowerCase());
 const cards=data?.tasks.filter(t=>match(t)&&(filter==='all'||t.status===filter))||[];
 const panel=<aside className="oaw-panel" aria-label="Obsidian 工作区">
 <header><div className="oaw-brand"><span className="oaw-mark" aria-hidden="true"><img src={designAsset} alt=""/></span><div><strong>Obsidian Workspace</strong><small>记忆 · 协作 · 可追溯</small></div></div><div className="oaw-project"><strong>{data?.project||'尚未导入项目'}</strong><span>{live.projectId?(live.error?'读取失败 · 旧数据':live.loading?'正在读取':'本地直连'):sample?'演示数据':data?'离线导入':'未连接'}</span></div>{embedded&&<div className="oaw-connect-row"><label className="oaw-connect">本地项目<select disabled={deleting} aria-label="本地项目" value={live.projectId} onChange={e=>{live.setProjectId(e.target.value);setDetail(null);setQuery('');}}><option value="">离线导入 / 演示</option>{live.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{live.projectId&&<button className="oaw-delete-project" disabled={deleting} onClick={deleteCurrentProject}>{deleting?'正在删除…':'删除项目'}</button>}</div>}</header>
 <nav aria-label="工作区视图">{[['memory','记忆'],['tasks','任务']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setDetail(null);setQuery('');}}>{label}</button>)}</nav>
 <div className="oaw-content">
 {(error||live.error)&&<p role="alert" className="oaw-warning">{error||live.error}</p>}
 {!data&&live.projectId?<div className="oaw-empty"><p>{live.loading?"正在读取本地笔记…":"未能读取项目，请检查连接配置"}</p><button onClick={live.refresh} disabled={live.loading}>重试读取</button></div>:!data?<div className="oaw-empty"><h2>让记忆回到工作现场</h2><p>导入项目导出的 JSON，查看 Obsidian 笔记和任务进展。</p><button className="oaw-primary" onClick={()=>input.current.click()}>导入项目数据</button><button onClick={()=>{live.setProjectId('');setData(demo);setSample(true);}}>查看演示</button></div>:detail?<>
 <button className="oaw-back" onClick={()=>setDetail(null)}>← 返回{tab==='tasks'?'任务':'记忆'}</button><h2>{detail.title}</h2>{detail.status&&<div className="oaw-meta"><span className={'oaw-badge '+detail.status}>{labels[detail.status]}</span><span>{detail.owner||'未分配'}</span></div>}<p className="oaw-path">{detail.path}</p>{detail.context&&<p className="oaw-warning">{stateNames[detail.context.state]}{detail.context.snapshot_sha&&<small className="oaw-digest">本会话 SHA：{detail.context.snapshot_sha}</small>}<small>刷新展示不会创建或更新会话已读记录。</small></p>}<article className="oaw-document">{detail.body.split('\n').map((line,i)=>line.startsWith('## ')?<h3 key={i}>{line.slice(3)}</h3>:<div key={i}>{line||'\u00a0'}</div>)}</article><p className="oaw-hint">{live.projectId?'原文只读。在 Obsidian 修改后点击手动刷新，或开启自动刷新。':'原文只读。请在 Obsidian 修改，再导出并重新导入。'}</p>
 </>:<>
 {tab==='memory'?<div className="oaw-warning"><strong>{live.projectId?'记忆已连接 · 会话按任务单独核对':'会话上下文尚未绑定'}</strong><p>这里只展示记忆，不代表 Agent 已重新读取。</p></div>:<div className="oaw-progress"><div><strong>{stats.done} / {stats.total}</strong><span>任务已完成</span><b>{stats.total?Math.round(stats.done/stats.total*100):0}%</b></div><progress aria-label="按任务卡统计的完成进度" max={stats.total||1} value={stats.done}/>{stats.unknown>0&&<small>{stats.unknown} 个任务未标记状态，未计入进度</small>}</div>}
 <input className="oaw-search" aria-label="搜索" placeholder={tab==='memory'?'搜索记忆、约定和原文…':'搜索任务、负责人和原文…'} value={query} onChange={e=>setQuery(e.target.value)}/>
 {tab==='memory'?<><h3>当前约定与项目知识 <span>{data.notes.length}</span></h3>{data.notes.filter(match).map(n=><button className={'oaw-card '+(n.id==='context'?'featured':'')} key={n.id} onClick={()=>setDetail(n)}><div><strong>{n.title}</strong><span>↗</span></div><small>{n.path}</small><p>{n.body.replace(/^---[\s\S]*?---\s*/,'').replace(/[#*]/g,'').trim().slice(0,70)}</p></button>)}{!data.notes.filter(match).length&&<p className="oaw-empty">没有匹配的记忆</p>}</>:<>
 <div className="oaw-filters" aria-label="任务状态筛选">{[['all','全部'],['blocked','阻塞'],['review','待验收'],['active','进行中'],['planned','待开始'],['done','已完成'],['unknown','未标记'],['cancelled','已取消']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
 {cards.map(t=><button key={t.id} className="oaw-card" onClick={()=>setDetail(t)}><div><strong>{t.title}</strong><span className={'oaw-badge '+t.status}>{labels[t.status]}</span></div><small>{t.owner||'未分配'} · {t.path}</small>{t.context&&<small className={'oaw-context-state '+t.context.state}>{stateNames[t.context.state]}</small>}<p>{t.status==='blocked'?'需要处理阻塞，查看任务原文 →':'查看目标、交接与验证证据 →'}</p></button>)}{!cards.length&&<p className="oaw-empty">没有匹配的任务</p>}</>}
 </>}
 </div><footer><span>{live.projectId?(data?'读取时间：'+new Date(data.exported_at).toLocaleTimeString()+(live.autoRefresh?' · 每 60 秒刷新':' · 手动刷新模式'):'本地连接中'):sample?'虚构项目 · 交互演示':data?'导出时间：'+new Date(data.exported_at).toLocaleString():'数据仅保留在当前页面内存'}<br/>任务卡记录 · Agent 运行状态未接入</span><div className="oaw-refresh-controls">{live.projectId&&<label><input type="checkbox" checked={live.autoRefresh} onChange={e=>live.setAutoRefresh(e.target.checked)}/>自动刷新（60 秒）</label>}<button disabled={live.loading} onClick={()=>live.projectId?live.refresh():input.current.click()}>{live.projectId?(live.loading?'读取中':'手动刷新'):data?'重新导入':'导入数据'}</button></div><input ref={input} type="file" accept="application/json,.json" aria-label="导入工作区 JSON" hidden onChange={importFile}/></footer>
 </aside>;
 return embedded?<div className="oaw-root oaw-embedded">{panel}</div>:<main className="oaw-root oaw-shell"><section className="oaw-host"><div className="oaw-hostbar"><b>dsh</b><span>WORKSPACE / DEMO</span><span>插件交互原型</span></div><div className="oaw-intro"><span className="oaw-eyebrow">OBSIDIAN AGENT WORKSPACE</span><h1>让记忆与进展，<br/>始终在手边。</h1><p>继续你的工作。项目约定、任务交接与执行证据，都在右侧。</p><div className="oaw-message"><small>工作上下文</small><h2>接下来，先处理 API 校验的阻塞。</h2><p>在右侧切换「任务」，查看负责人、下一步和验收条件。</p><span>笔记仍由你在 Obsidian 中维护</span></div><div className="oaw-caption">01 读记忆　 /　 02 看进展　 /　 03 查原文</div></div><div className="oaw-composer">宿主区域示意 · 此处不发送消息<span>↵</span></div></section>{panel}</main>;
}
