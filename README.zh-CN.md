# Telos

逆向设计学习引擎。告诉 Telos 你想掌握什么，它会倒推出前置依赖图谱，诊断你现在在哪，只教缺口，并安排复习。

[在线体验](https://telos.ungetsu.net/) · [打开应用](https://telos.ungetsu.net/app/) · [English README](README.md)

![Telos landing page](docs/assets/readme/landing.png)

![Telos app workspace](docs/assets/readme/app.png)

## 为什么是 Telos

多数学习工具从内容开始。Telos 从结果开始。

- 目标到图谱：把一个结果拆成带前置依赖的知识点。
- 先诊断：教学前先定位学习者真实起点。
- 只教缺口：解释、出题、修补、验证每一个未掌握节点。
- 复习闭环：用类似 FSRS 的调度保持已掌握节点不过期。
- 本地优先 Community Edition：产品应用和参考 runtime 都能在你自己的机器上跑。

需要云同步、托管工作流和官方部署时，使用 [telos.ungetsu.net](https://telos.ungetsu.net/)。

## 快速开始

```bash
git clone https://github.com/YunyueLi/telos.git
cd telos
./start.sh
```

然后打开 [http://localhost:3000](http://localhost:3000)。网页会自动连接本地 runtime：`127.0.0.1:8787`。

AI 倒推需要一个 OpenAI 兼容 key。复制 `core/.env.example` 为 `core/.env` 后填写：

```bash
TELOS_LLM_API_KEY=your-api-key
TELOS_LLM_BASE_URL=https://api.deepseek.com
TELOS_LLM_MODEL=deepseek-v4-pro
```

运行引擎测试：

```bash
make test
```

用 Docker 运行：

```bash
docker compose up --build
```

## 你可以用它做什么

- 给任何技术或学术目标生成个人掌握地图。
- 做先诊断后教学的课程生成器。
- 把 Telos Core 作为学习 agent 的规划和复习引擎。
- 自托管本地优先的学习产品，模型访问走 BYOK。
- 做知识追踪、前置图谱、间隔复习相关研究原型。

## 架构

![Telos core pipeline](docs/assets/readme/core-pipeline.svg)

| 区域 | 内容 |
| --- | --- |
| `landing/` | 静态营销页，服务于 `/`。 |
| `web/` | Next.js 应用，服务于 `/app/`，包含地图、诊断、复习、书斋、设置和本地优先项目状态。 |
| `core/` | 零依赖 Python 学习引擎和本地 reference runtime。 |
| `skill/` | 给外部 agent 工作流使用的 Telos skill 包。 |
| `scripts/` | 静态导出和本地构建脚本。 |
| `docs/` | 产品设计、路线图和部署文档。 |

Community Edition 不是空壳：产品 UI、本地图谱流程、reference server、示例、测试和文档都保留在这个 canonical public repo。

## 社区

Issues 和 Pull Requests 面向 Community Edition 开放。适合贡献的方向包括：

- 学习引擎正确性和测试
- 图谱/数据契约
- 本地 runtime 可靠性
- Web App 体验
- 示例、文档和自托管路径

较大的改动请先看 [CONTRIBUTING.md](CONTRIBUTING.md)、[DEPLOYMENT.md](DEPLOYMENT.md)、[BRAND.md](BRAND.md)。

## License

Telos Community Edition 使用 AGPL-3.0。独立的 `core/` 包额外以 Apache-2.0 提供，方便 SDK/协议层复用。边界见 [NOTICE](NOTICE)。
