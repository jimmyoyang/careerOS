# CareerOS 本地岗位采集扩展

这个扩展读取当前网页的岗位信息，支持浏览器本地预览、保存，并通过真实 CareerOS 后端接口同步岗位。

构建：

```sh
npm run browser:build
```

然后在 Chrome 打开 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，选择 `companions/browser-extension/dist`。

点击扩展的“读取当前页面”后，插件会读取当前标签页可见文本和常见 meta 标签。保存内容默认写入 `chrome.storage.local`，最多保留 20 条。

要同步到真实 CareerOS 后端：

1. 在 CareerOS「设置 → MCP 访问」创建一个带 `jobs:write` 权限的个人访问令牌，只复制保存一次完整令牌。
2. 在扩展的“CareerOS 后端”区域填写网站地址，例如 `http://localhost:3737`，再填写令牌。
3. 先点击“测试后端连接”，确认令牌具备 `jobs:write` 权限。
4. 点击“保存到本地”后，扩展会请求后端地址权限并调用 `/api/career/browser-captures`。岗位会经过现有的去重、公司/职位/地点解析和 Prisma 写入流程；重复采集同一 URL 会返回已有岗位编号。

令牌只保存在扩展的 `chrome.storage.local`，不要放进网页地址或提交到仓库。
