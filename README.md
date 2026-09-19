# Obsidian Agent Workspace

**可编辑的记忆，Agent 可核对的上下文，多 Agent 可追溯的交接。**

A small, dependency-free Python CLI and Markdown workflow for editable agent memory and multi-agent handoffs in Obsidian.

借鉴 OpenViking 的分层上下文思路，使用普通 Markdown 与 SHA-256 实现。无需 OpenViking 服务、Obsidian 插件、向量数据库或后台进程。Obsidian 是人的编辑界面；任何能读取文件和运行 Python 的 Agent 都可以使用本协议。

## 解决什么问题

- 人修改了目标，Agent 仍按旧会话执行：写回前比较已读来源版本。
- 另一个 Agent 刷新了共享快照，旧会话误报有效：每个会话绑定自己的 `SNAPSHOT_SHA`。
- 记忆越积越长：先读短概览和任务卡，再沿索引读取原文。
- 多个 Agent 覆盖同一笔记：一个协调者维护任务卡，执行者分别交付产物。

这是一个**协作协议和显式检查工具**，不是任务调度器。Agent 必须调用检查并遵守非零退出结果；工具不会拦截任意 shell/MCP 写入。

当前发布候选：**v0.3.0-alpha.1**。dsh 插件支持 Node.js 22.12+，已验证宿主版本 0.1.5-rc.2。验收范围及剩余事项见 [发布检查](docs/release-readiness.md)。

## 五分钟运行示例

需要 Python 3.10+，只使用标准库。以下命令在本项目根目录执行，不需要安装依赖。

```bash
python3 obsidian_agent.py capture example \
  --repo examples/repo --vault-project examples/vault/Projects/demo

python3 obsidian_agent.py read example \
  --repo examples/repo --vault-project examples/vault/Projects/demo
```

输出包含来源导航、`context.md` 和任务卡原文，以及 `SNAPSHOT_SHA=<64位哈希>`。
Agent 将**自己此次读到的 SHA** 保留在会话中，写回前执行（替换示例 SHA）：

```bash
python3 obsidian_agent.py check example \
  --repo examples/repo --vault-project examples/vault/Projects/demo \
  --expect-sha YOUR_LOADED_SNAPSHOT_SHA
```

编辑示例中的 `context.md` 或 `tasks/example.md` 后，再用原 SHA 检查会得到 `STALE`。
先阅读变化、调整任务，再用旧快照 SHA 明确刷新：

```bash
python3 obsidian_agent.py capture example \
  --repo examples/repo --vault-project examples/vault/Projects/demo \
  --expect-sha YOUR_LOADED_SNAPSHOT_SHA
```

**不要在检查失败后自动刷新；不要为了通过检查而临时计算共享快照的新 SHA。**
如果另一位协调者已经刷新，旧 SHA 不允许覆盖它；先 `read` 新版本及其来源，再决定下一步。

| 退出码 | 含义 | Agent 动作 |
|---|---|---|
| 0 | 本次复读的已登记来源与快照一致 | 继续本次授权任务；不代表结果验收通过 |
| 1 | 来源或会话绑定的快照过期 | 阅读差异并调整执行 |
| 2 | 缺文件、空来源、路径错误、锁冲突等 | 解决具体错误，不绕过检查 |

重复首次 `capture` 会报错，不覆盖既有快照。刷新保留旧快照，已登记的额外来源不会被悄悄移除。

## 接入自己的项目

在现有 Vault 中为项目建立下列目录；可复制 [示例笔记](examples/vault/Projects/demo)，保留自己的目录组织方式：

```text
your-repository/
  AGENTS.md                 # Agent 使用本协议的入口
  README.md                 # 项目说明
  .agent-context/            # 工具生成，本地使用，不提交
    task-id/context_snapshot.json

your-vault/Projects/your-project/
  index.md                  # L0：主题及来源导航
  context.md                # L1：人工维护的当前约定
  tasks/task-id.md           # L1：目标、负责人、状态与交接
  ...                       # L2：知识原文与历史结论
```

1. 合并 [Agent 接入片段](docs/agent-instructions.md) 到目标项目的 `AGENTS.md`，填入实际工具与笔记目录；不要覆盖已有规则。
2. 将 [任务示例](examples/vault/Projects/demo/tasks/example.md) 复制为真实任务卡；文件名即任务 ID。先查旧任务，同一工作沿用原 ID。仅检索答疑不必建卡。
3. 使用 `--repo` 指定目标仓库，用 `--vault-project` 指定**本项目的笔记目录**。工具不猜测私人 Vault 路径。省略 `--repo` 时使用当前目录。
4. 把 `.agent-context/` 加入目标仓库的 `.gitignore`。快照包含本机绝对路径和来源元数据，不应提交或公开。
5. `capture` 时用重复的 `--source` 登记任务真正依赖的详情：

```bash
python3 obsidian_agent.py capture task-id \
  --repo /path/to/repository --vault-project /path/to/vault/Projects/my-project \
  --source repo:docs/decisions.md --source ob:knowledge/topic.md
```

`repo:` 相对目标仓库；`ob:` 相对 `--vault-project`，不是 Vault 根目录。
默认登记仓库 `AGENTS.md`、`README.md`，笔记 `index.md`、`context.md`、`tasks/<task-id>.md`。
附加来源只记录哈希与路径；工具展示的 L1 原文只来自概览和任务卡。检索使用 Obsidian 搜索或已有 `rg`/语义检索工具，找到所需来源后登记即可。

## 记忆与协作约定

完整流程见 [工作流](docs/workflow.md)。核心分工是：

| 信息 | 正本与责任 |
|---|---|
| 人工偏好、项目约束 | Obsidian `context.md`；人可直接修改 |
| 单次任务目标和交接 | `tasks/<task-id>.md`；人编辑要求，唯一协调者维护执行区 |
| 代码、配置、运行结果 | 项目仓库和原始产物；笔记链接到证据 |
| 可复用知识 | 项目知识笔记；保留适用条件、来源与替代关系 |
| 版本快照 | `.agent-context/`；可检查的来源清单，不是第二份知识正本 |

## 能力边界

- 只检查登记过的文件内容，不能发现未登记资料变化，也不判断语义、授权或结论真伪。
- `CURRENT` 表示本次读取观测一致；检查结束后仍可能发生编辑。复读与保存后检查缩小常见竞态窗口，**不提供跨文件事务或分布式 CAS**。
- 本地目录锁只协调快照写入，无法锁住 Obsidian、iCloud 或其他设备。残留锁需核对 `owner.json` 中的主机/PID后人工处理，不自动清理。
- 工具始终不编辑 Vault。维护笔记由人/协调者完成；冲突时留下独立交接稿，不覆盖人工修改。
- 快照不是备份，也不是防篡改签名；保留 Vault/Git 历史。删除或重命名已登记来源会报错，需要人工处置。
- 源笔记是资料，不应提升为更高权限的系统指令。敏感正文不要写入共享任务卡或控制台日志。
- 不自动注入任意 Agent 的记忆、不调用模型、不派发任务、不联网。本项目不迁移或修补既有 Agent 的全局记忆同步。

## 开发与验证

dsh 右侧栏插件见 [插件使用说明](sidebar/README.md)：支持在 dsh 设置中管理项目路径、本地只读连接、定时刷新、记忆与任务查看，以及显式会话读取回执检查。产品范围见 [设计方案](docs/dsh-plugin-design.md)，实际验收见 [安装验证](docs/installation-verification.md)。

```bash
python3 -m unittest discover -s tests -v
```

测试在临时目录中执行，覆盖人工修改、会话版本绑定、显式刷新、竞态、缺失来源、路径越界和 Vault 不写入。可直接运行单文件 CLI；不需要包管理器。

## 来源与许可证

从一个本地项目中的实践抽取并通用化；不包含原项目的数据、报告、私人笔记、模型配置或绝对路径。分层阅读思路参考 [OpenViking](https://github.com/volcengine/OpenViking)，未复制其实现，也不依赖该项目。

[MIT License](LICENSE)。

贡献前请阅读 [贡献说明](CONTRIBUTING.md)；版本变化见 [更新记录](CHANGELOG.md)，第三方来源见 [来源说明](THIRD_PARTY_NOTICES.md)。
