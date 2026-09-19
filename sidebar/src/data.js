export const labels = {planned:'待开始',active:'进行中',blocked:'阻塞',review:'待验收',done:'已完成',cancelled:'已取消',unknown:'未标记'};
export function validate(data) {
  if (!data || data.version !== 1 || typeof data.project !== 'string' || typeof data.exported_at !== 'string' || !Number.isFinite(Date.parse(data.exported_at)) || !Array.isArray(data.notes) || !Array.isArray(data.tasks)) throw Error('不是有效的工作区导出文件');
  for (const row of [...data.notes, ...data.tasks]) {
    if (!row || !['id','title','body','path'].every(k => typeof row[k] === 'string')) throw Error('笔记字段不完整');
  }
  if (data.tasks.some(t=>t.context && (!['unbound','current','stale','error'].includes(t.context.state) || (t.context.snapshot_sha!==undefined && (typeof t.context.snapshot_sha!=='string'||!/^[a-f0-9]{64}$/.test(t.context.snapshot_sha)))))) throw Error('上下文状态格式无效');
  if (data.tasks.some(t => !Object.hasOwn(labels,t.status) || typeof t.owner !== 'string')) throw Error('任务状态或负责人格式不正确');
  if (new Set(data.notes.map(n=>n.id)).size !== data.notes.length || new Set(data.tasks.map(n=>n.id)).size !== data.tasks.length) throw Error('存在重复 ID');
  return data;
}
export function progress(tasks) {
  const known = tasks.filter(t => !['cancelled','unknown'].includes(t.status));
  return {total:known.length, done:known.filter(t=>t.status==='done').length, unknown:tasks.filter(t=>t.status==='unknown').length};
}
const note = (id,title,body) => ({id,title,body,path:id+'.md'});
export const demo = {version:1,project:'Demo',exported_at:'2026-09-19T00:00:00Z',notes:[
 note('context','项目工作约定','# 项目工作约定\n\nObsidian 是记忆正本，人可以直接读写。\n\n一个任务只有一位协调者。执行者交付独立产物，交接前核对本会话已读 SHA。'),
 note('knowledge/api','接口约定','# 接口约定\n\n缺失必填输入时返回明确错误，不使用默认值掩盖问题。'),
 note('knowledge/errors','异常处理','# 异常处理\n\n记录复现步骤、输入和验证证据。'),
 note('knowledge/delivery','交付与验收','# 交付与验收\n\n产物必须附有可重复运行的验证。')],tasks:[
 {...note('api-check','API 校验','# API 校验\n\n## 目标\n验证输入与错误返回符合接口约定。\n\n## 阻塞原因\n等待协调者补充缺失输入样例。\n\n## 已完成与证据\n正常输入校验通过；证据：reports/api-check.md（演示路径）。\n\n## 下一步\n补充缺失输入后继续校验。\n\n## 验收条件\n正常输入、缺失输入、异常返回全部有测试。'),status:'blocked',owner:'Agent B'},
 {...note('docs','文档整理','# 文档整理\n\n## 目标\n补充快速开始与使用限制。\n\n## 下一步\n核对示例命令。'),status:'active',owner:'Agent A'},
 ...['项目结构','上下文协议','任务模板'].map((title,i)=>({...note('done-'+i,title,'# '+title+'\n\n已完成（虚构示例）。'),status:'done',owner:'Coordinator'}))]};
