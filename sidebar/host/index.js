import {readFile, mkdir, writeFile, rename, unlink, stat} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

export const name = 'dsh-obsidian-workspace';
export const inject = ['connection'];
const run = promisify(execFile);
const configPath = path.join(process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'obsidian-workspace.json');
const exporter = fileURLToPath(new URL('./export_workspace.py', import.meta.url));
const idPattern = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export async function projects(filename = configPath) {
  let config;
  try { config = JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw Error('项目连接配置无法读取'); }
  return validateProjects(config);
}

function validateProjects(config) {
  if (!config || !Array.isArray(config.projects) || config.projects.length > 50) throw Error('项目连接配置格式无效');
  const ids = new Set();
  for (const p of config.projects) {
    if (!p || typeof p.id !== 'string' || !idPattern.test(p.id) || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120 ||
        typeof p.vaultProject !== 'string' || !path.isAbsolute(p.vaultProject) ||
        (p.repo !== undefined && (typeof p.repo !== 'string' || !path.isAbsolute(p.repo)))) throw Error('项目连接配置格式无效');
    ids.add(p.id);
  }
  return config.projects;
}

export async function readProject(project, session, execute = run) {
  if (session && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(session)) throw Error('无效会话标识');
  const args = [exporter, '--vault-project', project.vaultProject, '--name', project.name];
  if (project.repo && session) args.push('--repo', project.repo, '--session', session);
  const {stdout} = await execute('python3', args, {timeout:15000, maxBuffer:10*1024*1024, env:{...process.env, PYTHONDONTWRITEBYTECODE:'1'}});
  return JSON.parse(stdout);
}

export function makeHandler(load = projects, read = readProject) {
  // ponytail: one read at a time; polling is small and bounded, no daemon or cache database.
  let busy = false;
  return async request => {
    const json = (value, status=200) => Response.json(value, {status, headers:{'Cache-Control':'no-store'}});
    if (request.method !== 'GET') return json({error:'只支持读取'},405);
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(k=>!['project','session'].includes(k))) return json({error:'参数不支持'},400);
    const id = url.searchParams.get('project');
    try {
      const configured = await load();
      if (!id) return json({projects:configured.map(({id,name})=>({id,name}))});
      const project = configured.find(p=>p.id===id);
      if (!project) return json({error:'项目未配置'},404);
      const session = url.searchParams.get('session') || '';
      if (session && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(session)) return json({error:'无效会话标识'},400);
      if (busy) return json({error:'正在读取，请稍后刷新'},429);
      busy = true;
      try { return json(await read(project, session)); }
      finally { busy = false; }
    } catch { return json({error:'读取失败，请检查本机项目配置、Python 和笔记格式；旧数据未更新'},503); }
  };
}


// Settings change only this local connection file, never project notes or snapshots.
export function makeSettingsHandler(filename = configPath) {
  let saving = false;
  const revision = raw => createHash('sha256').update(raw).digest('hex');
  const read = async () => {
    try { return await readFile(filename, 'utf8'); }
    catch (e) { if (e.code === 'ENOENT') return ''; throw e; }
  };
  return async request => {
    const json = (value, code=200) => Response.json(value,{status:code,headers:{'Cache-Control':'no-store'}});
    if (!['GET','PUT'].includes(request.method)) return json({error:'不支持此操作'},405);
    let sameOrigin = false;
    try {
      const origin = new URL(request.headers.get('origin'));
      sameOrigin = ['http:','https:'].includes(origin.protocol) && origin.host === request.headers.get('host');
    } catch {}
    if (request.method === 'PUT' && (!sameOrigin ||
        request.headers.get('content-type')?.split(';')[0] !== 'application/json')) return json({error:'请在本机 dsh 设置中保存'},403);
    if (saving) return json({error:'正在保存，请稍后重试'},409);
    let temporary;
    try {
      if (request.method === 'GET') {
        const raw = await read();
        return json({projects:raw ? validateProjects(JSON.parse(raw)) : [],revision:revision(raw)});
      }
      saving = true;
      const raw = await read();
      const body = await request.text();
      if (Buffer.byteLength(body) > 65536) return json({error:'连接配置超过 64 KB'},413);
      let incoming, next;
      try {
        incoming = JSON.parse(body);
        next = validateProjects(incoming);
      } catch { return json({error:'请检查项目 ID、名称和绝对路径；ID 必须唯一'},400); }
      if (incoming.revision !== revision(raw)) return json({error:'配置已被修改，请重新加载后再编辑'},409);
      for (const project of next) {
        for (const key of ['vaultProject','repo']) {
          if (project[key] === undefined) continue;
          try { if (!(await stat(project[key])).isDirectory()) throw Error(); }
          catch { return json({error:project.name+'：'+(key==='repo'?'代码仓库':'笔记项目')+'目录不存在或不可读取'},400); }
        }
      }
      // Preserve unrelated top-level settings; project fields are explicitly selected.
      const config = raw ? JSON.parse(raw) : {};
      config.projects = next.map(({id,name,vaultProject,repo})=>({id,name,vaultProject,...(repo ? {repo} : {})}));
      const output = JSON.stringify(config,null,2)+'\n';
      await mkdir(path.dirname(filename),{recursive:true});
      temporary = filename+'.'+randomUUID()+'.tmp';
      await writeFile(temporary,output,{mode:0o600,flag:'wx'});
      if (await read() !== raw) return json({error:'配置已被修改，请重新加载后再编辑'},409);
      await rename(temporary,filename);
      return json({projects:config.projects,revision:revision(output)});
    } catch { return json({error:'连接配置无法读取或保存，请检查本机配置文件'},503); }
    finally {
      if (request.method === 'PUT') saving = false;
      if (temporary) await unlink(temporary).catch(()=>{});
    }
  };
}

export function apply(ctx) {
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/obsidian-workspace/settings', methods:['GET','PUT'], requestBody:'buffered', fetch:makeSettingsHandler()}));
  // Connection applies the host/origin fence AND persistent browser authentication before dispatch.
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/obsidian-workspace', methods:['GET'], requestBody:'buffered', fetch:makeHandler()}));
}
