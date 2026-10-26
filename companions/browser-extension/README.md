# CareerOS 本地岗位采集扩展

这个扩展只做浏览器端本地预览和保存，不连接 CareerOS、招聘网站后端、手机 Bridge 或任何外部接口。它适合在真实接口尚未确定时先验收采集字段和交互。

构建：

```sh
npm run browser:build
```

然后在 Chrome 打开 `chrome://extensions`，开启“开发者模式”，选择“加载已解压的扩展程序”，选择 `companions/browser-extension/dist`。

点击扩展的“读取当前页面”后，插件会读取当前标签页可见文本和常见 meta 标签。保存内容只写入 `chrome.storage.local`，最多保留 20 条，后续接入 CareerOS API 时可替换保存函数。
