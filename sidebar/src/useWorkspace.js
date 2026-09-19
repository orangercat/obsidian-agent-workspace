import {useCallback, useEffect, useRef, useState} from 'react';
import {validate} from './data.js';
const endpoint='/api/obsidian-workspace';
async function get(url,signal) {
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal});
  const value=await response.json();
  if(!response.ok) throw Error(typeof value.error==='string'?value.error:'读取失败');
  return value;
}
export function useWorkspace(enabled,sessionId) {
  const [projects,setProjects]=useState([]),[projectId,setProjectId]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const active=useRef(null);
  const [configVersion,setConfigVersion]=useState(0);
  const [autoRefresh,setAutoRefresh]=useState(false);
  useEffect(()=>{
    if(!enabled)return;
    let abort;
    const load=()=>{
      abort?.abort();abort=new AbortController();
      const signal=abort.signal;
      get(endpoint,signal).then(value=>{
        if(signal.aborted)return;
        if(!Array.isArray(value.projects)||value.projects.some(p=>typeof p.id!=='string'||typeof p.name!=='string'))throw Error('项目列表无效');
        setProjects(value.projects);setProjectId(previous=>value.projects.some(p=>p.id===previous)?previous:value.projects[0]?.id||'');
        active.current?.abort();active.current=null;
        setConfigVersion(version=>version+1);
        if(!value.projects.length)setError('尚未配置本地项目，请在 dsh 设置 → Obsidian 项目中添加');
      }).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    };
    load();window.addEventListener('oaw-projects-changed',load);
    return ()=>{abort?.abort();window.removeEventListener('oaw-projects-changed',load);};
  },[enabled]);
  const refresh=useCallback(async()=>{
    if(!enabled||!projectId||active.current)return;
    const abort=new AbortController();active.current=abort;setLoading(true);
    try {
      const value=validate(await get(endpoint+'?'+new URLSearchParams({project:projectId,session:sessionId}),abort.signal));
      if(!abort.signal.aborted){setData(value);setError('');}
    } catch(e) {if(!abort.signal.aborted)setError(e.message);}
    finally {if(active.current===abort){active.current=null;setLoading(false);}}
  },[enabled,projectId,sessionId,configVersion]);
  useEffect(()=>{
    setData(null);setError('');setLoading(false);
    if(!projectId)return;
    refresh();
    return ()=>{active.current?.abort();active.current=null;};
  },[refresh,projectId]);
  useEffect(()=>{
    if(!autoRefresh||!enabled||!projectId)return;
    const interval=setInterval(()=>{if(document.visibilityState==='visible')refresh();},60000);
    return ()=>clearInterval(interval);
  },[autoRefresh,enabled,projectId,refresh]);
  return {projects,projectId,setProjectId,data,error,loading,refresh,autoRefresh,setAutoRefresh};
}
