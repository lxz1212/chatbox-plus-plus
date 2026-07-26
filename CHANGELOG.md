# Chatbox++ 变更日志

所有版本变更记录。版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范。

## [1.3.0] - 2026-07-26

### 新增
- 初始版本发布
- 多模型管理：支持配置多个 OpenAI 兼容格式的模型
- 多会话管理：支持创建、重命名、删除多个对话
- 完整生成参数配置：temperature、top_p、n、presence_penalty、frequency_penalty、max_tokens
- 思考模式配置：仅思考 / 仅非思考 / 可在对话时选择，支持勾选思考强度等级（low/medium/high/xhigh/max）
- 对话界面模型选择下拉菜单
- 对话界面思考模式开关与强度选择（仅可选模型支持的范围）
- 流式输出与思考过程展示
- Markdown 渲染（支持 GFM）
- 浅色 / 深色 / 跟随系统主题
- 本地数据持久化
