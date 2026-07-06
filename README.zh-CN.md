# Telos Product

这是官方 Telos 托管产品的私有源码仓库，对应
[telos.ungetsu.net](https://telos.ungetsu.net/)。

Telos 现在采用 open-core 模式：

- **Telos Core / Community Edition** 使用 Apache-2.0，包含可复用的学习引擎、数据契约、reference server/CLI、示例和 skill 包。
- **Telos Product** 保留所有权利，包含官方 Web App、落地页、Cloudflare Worker/API 服务层、托管 AI 计量、计费、模板商店、品牌资产、官方 UI/UX 和增长页面。

不要公开本仓库，也不要把产品层代码复制到公开 core 仓。

## 生产部署

- 前端：Cloudflare Pages 项目 `telos`
  - 生产分支：`main`
  - 构建命令：`bash scripts/build-pages.sh`
  - 输出目录：`deploy`
  - 对外路径：`/` 是 landing，`/app/` 是产品 App
- API：Cloudflare Worker `telos-derive`
  - 对外路径：`https://telos-api.ungetsu.net`
  - 密钥只放 Wrangler/Cloudflare，不进 Git

## 本地开发

```bash
./start.sh
```

这会启动 `core/` 的本地 reference proxy 和 Next.js 产品 App。

## 仓库边界

见 [OPEN_CORE.md](OPEN_CORE.md)、[TRADEMARK.md](TRADEMARK.md) 和
[CONTRIBUTING.md](CONTRIBUTING.md)。
