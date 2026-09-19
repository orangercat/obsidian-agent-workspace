# dsh Obsidian Workspace · Alpha

基于 Obsidian 的可编辑记忆与多 Agent 协作侧栏。支持项目连接、记忆搜索、任务进度、原文查看、手动/自动刷新及会话版本状态。

## 安装发布包

需要 Python 3.10+（`python3` 在 PATH 中）、Node.js 22.12+、dsh Web。本版验证宿主为 dsh 0.1.5-rc.2；其他版本尚未验收。

下载 Release 附件后执行，替换为安装包的实际绝对路径：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-obsidian-workspace-0.3.0-alpha.1.tgz
```

重启 dsh，在设置 → Obsidian 项目添加项目。填写项目 ID、名称、已存在的 Obsidian 项目目录和可选代码仓库目录，在右侧栏打开「Obsidian 工作区」。配置保存在当前 dsh 主机的 `~/.dsh/obsidian-workspace.json`（或 DSH_HOME 对应目录），路径属于宿主机器。

默认手动刷新，可开启每 60 秒自动刷新；隐藏页面或上次读取未结束时跳过。设置页和侧栏均提供「删除项目」：设置页确认后需保存配置，侧栏确认后立即生效。仅移除连接，不删除文件。不要将本机配置、Vault 正文、导出 JSON 或 `.agent-context/` 公开提交。

## Agent 使用

安装包 `lib/` 内含 `obsidian_agent.py`、`session_context.py`、`export_workspace.py`。使用 `python3 /path/to/package/lib/obsidian_agent.py --help` 查看命令。完整接入协议、任务模板与示例请使用同一 Release 的源码包中的 README.md、docs/agent-instructions.md 和 examples/。

## 边界

只读展示 Markdown；设置只写连接配置。任务进度来自任务卡，不是 Agent 实时运行状态。不派发任务、不自动注入记忆。刷新展示不创建读取回执。Agent 必须显式读快照并在写回前检查自己读到的 SHA。

本版为 Alpha，单机使用，不提供分布式锁或跨文件事务。MIT，许可证随包附带。本项目不是 Obsidian、dsh 或 OpenViking 官方插件。
