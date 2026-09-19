import React, {useEffect, useState} from 'react';
const endpoint='/api/obsidian-workspace/settings';

export function Settings() {
 const [projects,setProjects]=useState([]),[revision,setRevision]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 async function load(signal) {
  setBusy(true);setMessage('');
  try {
   const response=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
   const value=await response.json();if(!response.ok)throw Error(value.error);
   setProjects(value.projects);setRevision(value.revision);setFailed(false);
  } catch(e){if(e.name!=='AbortError'){setMessage(e.name==='TimeoutError'?'请求超时，请重新加载配置确认保存结果后重试。':e.message);setFailed(true);}}
  finally{if(!signal?.aborted)setBusy(false);}
 }
 useEffect(()=>{const abort=new AbortController();load(abort.signal);return ()=>abort.abort();},[]);
 function edit(index,key,value){setProjects(rows=>rows.map((row,i)=>i===index?{...row,[key]:value}:row));setMessage('');}
 async function save(event) {
  event.preventDefault();setBusy(true);setMessage('');
  try {
   const response=await fetch(endpoint,{method:'PUT',signal:AbortSignal.timeout(15000),credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,projects:projects.map(p=>({...p,repo:p.repo?.trim()||undefined}))})});
   const value=await response.json();if(!response.ok)throw Error(value.error);
   setProjects(value.projects);setRevision(value.revision);setFailed(false);setMessage('已保存，侧栏项目连接已更新。');
   window.dispatchEvent(new Event('oaw-projects-changed'));
  } catch(e){setMessage(e.name==='TimeoutError'?'请求超时，请重新加载配置确认保存结果后重试。':e.message);setFailed(true);}
  finally{setBusy(false);}
 }
 return <section className="oaw-root oaw-settings" aria-label="Obsidian 项目路径管理">
  <h2>Obsidian 项目路径</h2><p>管理此 dsh 主机允许读取的项目。名称和目录可直接编辑，或点击「修改连接」定位到路径；修改后点击「保存项目配置」生效。</p>
  <p>删除项目只移除连接，不删除笔记、仓库或会话记录；点击保存项目配置后生效。</p>
  {message&&<p role={failed?'alert':'status'}>{message}</p>}
  <form onSubmit={save}><fieldset disabled={busy||revision===null}>
   {projects.map((p,i)=><div className="oaw-settings-project" key={i}>
    <div className="oaw-settings-row"><strong>项目 {i+1}</strong><div><button type="button" onClick={e=>e.currentTarget.closest('.oaw-settings-project').querySelector('input[name="vaultProject"]').focus()}>修改连接 {i+1}</button><button type="button" onClick={()=>{if(!window.confirm('删除项目「'+(p.name||p.id||'未命名项目')+'」？仅移除连接，不删除任何文件。保存配置后生效。'))return;setProjects(rows=>rows.filter((_,n)=>n!==i));setMessage('项目已从列表移除，请保存配置生效；重新加载可撤销。');}}>删除项目 {i+1}</button></div></div>
    <label>项目 ID<input required pattern={'[a-z0-9][a-z0-9_\\-]{0,79}'} maxLength={80} value={p.id} onChange={e=>edit(i,'id',e.target.value)} placeholder="my-project"/></label>
    <label>显示名称<input required maxLength={120} value={p.name} onChange={e=>edit(i,'name',e.target.value)} placeholder="项目名称"/></label>
    <label>Obsidian 项目目录<input name="vaultProject" required value={p.vaultProject} onChange={e=>edit(i,'vaultProject',e.target.value)} placeholder="/absolute/path/to/vault/Projects/my-project" spellCheck={false}/></label>
    <label>代码仓库目录（可选）<input value={p.repo||''} onChange={e=>edit(i,'repo',e.target.value)} placeholder="用于读取会话 SHA 回执" spellCheck={false}/></label>
   </div>)}
   {!projects.length&&<p>暂无连接，添加一个项目开始使用。</p>}
   <button type="button" disabled={projects.length>=50} onClick={()=>{setProjects(rows=>[...rows,{id:'',name:'',vaultProject:''}]);setMessage('');}}>添加项目</button>
   <button type="submit">{busy?'保存中…':'保存项目配置'}</button>
  </fieldset></form>
  <button type="button" disabled={busy} onClick={()=>load()}>重新加载（放弃未保存修改）</button>
 </section>;
}
