# dsh Obsidian Workspace · v0.3.0-alpha.1

只读右侧栏：本地项目连接、记忆搜索、任务筛选、原文、负责人、完成进度及当前会话的已读版本检查。Markdown 仍是正本。

## 构建与安装

需要 Node.js 22.12+、Python 3.10+ 和带 sidebarRightTabs / Connection 接口的 dsh Web；本机验证版本为 0.1.5-rc.2。

以下命令从源码仓库根目录开始：

```sh
cd sidebar
npm ci
npm run build
npm run build:plugin
cd dist/plugin
npm pack
dsh plugin --profile web add link:/absolute/path/to/sidebar/dist/plugin
```

安装后重启 dsh，在右侧栏选择「Obsidian 工作区」。link 安装依赖 dist/plugin，请勿删除。更新前端后需重载页面；更新宿主代码需重启 dsh。独立预览使用 `npm run dev -- --host 127.0.0.1`。

## 本地项目连接

优先打开 **dsh 设置 → Obsidian 项目**，新增、编辑或删除项目，点击「保存项目配置」。每个项目保留「修改连接」和「删除项目」入口；名称、笔记目录和仓库目录都可直接修改。侧栏删除按钮与项目选择框位于同一行。填写唯一项目 ID、显示名称、Obsidian 项目目录及可选的代码仓库目录。目录必须已存在。设置页点击「删除项目」并确认后，再保存配置生效；未保存时可重新加载撤销。侧栏也可点击「删除项目」，确认后立即移除当前连接。两处都只解除连接，不删除笔记、仓库或会话记录。保存后同一页面侧栏更新，其他页面重新打开侧栏；关闭设置前请保存。配置有并发变化时会拒绝覆盖，可重新加载后编辑。

也可在本机 `~/.dsh/obsidian-workspace.json`（设置 DSH_HOME 时位于该目录）配置允许读取的项目。路径必须是绝对路径；不要把本机配置提交到仓库。

```json
{"projects":[{"id":"demo","name":"Demo","vaultProject":"/absolute/path/to/examples/vault/Projects/demo","repo":"/absolute/path/to/examples/repo"}]}
```

首次打开选择配置中的第一个项目；通过设置页保存会立即更新同一页面的侧栏；手工编辑配置后重新打开侧栏。只读取所选项目内非隐藏 Markdown，不扫描整个 Vault。repo 可省略，省略时不检查会话回执。界面可手动切换项目或回到离线导入。

请求复用 dsh Connection 的认证与 Host/Origin 检查；笔记读取接口只接受已配置的项目 ID 和当前会话 ID；设置接口允许登录用户管理项目路径。笔记接口为只读 GET `/api/obsidian-workspace`；连接管理使用认证后的 GET/PUT `/api/obsidian-workspace/settings`，写入需同源 JSON 请求。只写本机连接配置，不写笔记或快照。默认关闭自动刷新；首次选择项目读取一次，之后点击「手动刷新」。勾选「自动刷新（60 秒）」后仅在页面可见时每 60 秒读取；正在读取时跳过重复请求。开关仅保留在当前侧栏，重开默认关闭。失败保留上次成功数据并标明错误。每篇文件上限 1 MB，原文合计 8 MB、最多 2000 篇、JSON 上限 9 MB；读取超时 15 秒。

## 会话已读版本

Agent 在宿主提供的真实会话中，使用该会话 ID 显式读取已有任务快照：

```sh
python3 session_context.py read example --session ACTUAL_DSH_SESSION_ID \
  --repo examples/repo --vault-project examples/vault/Projects/demo
```

此命令在仓库根目录执行，输出上下文原文和 SHA，并写入 `.agent-context/sessions/<session>/<task>.json`。首次任务先用 obsidian_agent.py capture 建立快照；过期时先处理变化，显式刷新后再读。禁止猜测会话 ID、替其它会话登记、用最新共享 SHA 冒充已读。写回前仍须以自己已读 SHA 执行 check。

侧栏按实际会话检查每个任务：未读取、版本一致、过期或检查失败。仅支持直接位于 tasks/ 下的任务卡回执。刷新展示不创建回执、不刷新快照。回执只记录工具读取，不证明模型理解或身份；本机用户可修改它。

## 离线导入与任务格式

```sh
python3 export_workspace.py --vault-project examples/vault/Projects/demo --name Demo > workspace-export.json
```

在仓库根目录导出，界面点击「导入数据」。JSON 包含项目正文，仅保留在页面内存；本地导入不上传。修改后需重新导出导入。

任务卡 frontmatter 使用 `status` 与 `owner`。状态支持 planned/active/blocked/review/done/cancelled；缺失为 unknown。仅支持单行纯文本或 JSON 双引号字符串，不是完整 YAML。完成率排除 cancelled 和 unknown；未知任务单列。正文不重复维护状态。

## 验证与边界

`python3 -m unittest discover -s tests -v` 在仓库根目录执行；sidebar 中运行 `npm test`、`npm run test:sites`。真实宿主验收记录见 [安装验证](../docs/installation-verification.md)。

不自动注入模型、不编辑 Vault、不派发任务，不把任务卡状态当作 Agent 运行事件。仅连接明确配置的项目；本机连接范围由本机配置控制。

标记 `type: project-task-template` 的文件作为参考笔记展示，不计入任务。旧任务文件名不符合快照 ID 规则时仍可读，其会话检查显示失败；不会因此阻断整个项目导入。旧任务缺少 status/owner 时保留未标记/未分配，不从正文推断。
