# 问卷星 Survey Platform

实时问卷数据可视化平台。

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: React 18 + Recharts + TypeScript
- **构建**: Vite (前端), tsc (后端)
- **测试**: Jest + React Testing Library

## 项目结构

```
├── backend/          # Express API 服务
│   └── src/
│       ├── index.ts        # 入口
│       ├── routes/         # API 路由
│       ├── services/       # 业务逻辑
│       └── types/          # TypeScript 类型定义
├── frontend/         # React 前端应用
│   └── src/
│       ├── components/     # React 组件
│       └── types/          # 共享类型
└── docs/             # API 文档
```

## 开发

```bash
# 安装依赖
npm install

# 启动后端
cd backend && npm run dev

# 启动前端
cd frontend && npm run dev
```
