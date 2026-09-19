# 贡献

提交问题时附上系统、Python/Node/dsh 版本、最小复现步骤与预期结果。请使用 examples/ 的 Demo 或脱敏临时笔记，不附私人 Vault、连接配置、令牌或会话记录。

修改前阅读 AGENTS.md 和 docs/workflow.md。Python 保持标准库实现；界面是可选的 dsh 插件。修改行为时补充能复现问题的最小检查。

```sh
python3 -m unittest discover -s tests -v
cd sidebar
npm ci
npm run build
npm run build:plugin
npm test
npm run test:sites
```

自动测试不能替代真实宿主验收。涉及设置或侧栏交互时，在 dsh 中复现并记录结果、版本与未验证范围。

贡献按本仓库 MIT 许可证提供。不要直接修改或提交 dist/、node_modules/、真实项目快照或本机配置。
