# Changelog · dao-proxy-min

> 完整版本历史。详情页（README）保持精简，本文件单列于扩展的 Changelog 标签页。

v9.9.65 · 根治「装插件后官方免费模型报错·官方聊天回传主机错配」(用户旨意): 与 dao-proxy-pro v9.9.317 同根同源的修复。不装插件时语言服务器(LS)原生直连 server.codeium.com 一切正常；装插件(invert 拦截)后, 官方聊天 GetChatMessage/GetChatMessageV2/RawGetChatMessage 的回传主机未被钉到 api_server——v9.3.2 曾据 v9.2.1 捕获的 67 reqs「默认分流(chat→inference)通」而回归默认分流, 且 v9.9.64 又把 ApiServerService 移出 INFERENCE_SERVICES, 使官方聊天默认落到 inference/MGMT, 对本账号确定性返回「third-party model provider unavailable」→ Model provider unreachable。实证(直连 replay·同一请求同字节)推翻旧判断: GetChatMessage → server.codeium.com 得 HTTP 200 真实聊天流; → inference.codeium.com 得错误 JSON。修复: `UPSTREAM_CHAT` 默认值由 `""` 改为 `"server.codeium.com"`, 使既有的「方法名级 chat 分流」块默认生效, 官方聊天钉到 api_server(与 LS 原生 --api_server_url 一致); 非聊天的 inference RPC 仍按 INFERENCE_SERVICES 走 inference, 不受影响。`CHAT_UPSTREAM` env 仍可显式覆盖。

v9.9.64 · 道法自然 · 从 Pro 版吸取底层修复 · DevService/ApiServerService 退出 INFERENCE_SERVICES · 管理 RPC 归位 MGMT · 繁体经文(帛书老子 + 道藏阴符经)· 适配 Windsurf + Devin Desktop 双环境。
