---
name: npm-publish
description: "Orchestrate the complete npm release workflow for the wjx-ai-kit monorepo. Use when the user wants to publish packages to npm, release a new version, bump versions, or says 'npm publish', 'release', '发版', '发布到 npm'. Handles version bumping (conventional commits), build, test, commit, push to GitHub, npm publish, and wjx-cli-use skill zip upload to OSS."
---

# npm-publish — wjx-ai-kit 发版工作流

完整发版流程：分析变更 → 版本号自增 → 构建测试 → 提交推送 → npm 发布 → Skill zip 上传 OSS。

## 包信息

| Package | Directory | Role |
|---------|-----------|------|
| wjx-api-sdk | `wjx-api-sdk/` | 零依赖 SDK（基础层，**必须先构建**） |
| wjx-mcp-server | `wjx-mcp-server/` | MCP Server（依赖 SDK） |
| wjx-cli | `wjx-cli/` | CLI 工具（依赖 SDK） |

构建顺序：**wjx-api-sdk 先**，然后 wjx-mcp-server 和 wjx-cli。

## 前置检查

```bash
npm whoami          # 必须已登录 npm
git status -s       # 工作区应干净
git branch --show-current  # 确认在正确分支
```

任一检查失败则停止，告知用户。

---

## Phase 1: 分析变更 & 确定版本号

### 1.1 找到每个包上次发版的提交

```bash
git log --oneline -1 -- wjx-api-sdk/package.json
git log --oneline -1 -- wjx-mcp-server/package.json
git log --oneline -1 -- wjx-cli/package.json
```

### 1.2 收集自上次发版以来的 commit

```bash
git log <last-bump-hash>..HEAD --oneline -- wjx-api-sdk/
git log <last-bump-hash>..HEAD --oneline -- wjx-mcp-server/
git log <last-bump-hash>..HEAD --oneline -- wjx-cli/
```

零 commit 的包 → 无变更，跳过。

### 1.3 确定 bump 类型

| 模式 | Bump |
|------|------|
| `BREAKING CHANGE` 或 `!:` | **major** |
| `feat:` / `feat(scope):` | **minor** |
| 其他（`fix:`, `docs:`, `chore:` 等） | **patch** |

取同一包所有 commit 中最高级别。默认 patch。用户可覆盖（如 "发 minor 版"）。

### 1.4 级联规则

如果 wjx-api-sdk 有变更，则 wjx-mcp-server 和 wjx-cli **也需要 bump**（至少 patch），即使它们自身无代码变更——因为它们依赖 SDK。

### 1.5 展示计划并等待确认

```
发版计划：
  wjx-api-sdk:     0.1.6 → 0.1.7 (patch, 3 commits)
  wjx-mcp-server:  0.1.5 → 0.1.6 (patch, SDK 级联)
  wjx-cli:         0.1.14 (无变更，跳过)

继续发版？
```

**必须等用户确认**。npm publish 不可逆。

### 1.6 Bump 版本号

修改每个变更包的 `package.json` 中的 `version` 字段。

---

## Phase 2: 构建 & 测试

### 2.1 构建（依赖顺序）

```bash
npm run build --workspace=wjx-api-sdk
npm run build --workspace=wjx-mcp-server
npm run build --workspace=wjx-cli
```

SDK 必须先成功。任一构建失败则停止。

### 2.2 测试

```bash
npm test --workspace=wjx-api-sdk
npm test --workspace=wjx-mcp-server
npm test --workspace=wjx-cli
```

任一测试失败则停止。

---

## Phase 3: 提交 & 推送

### 3.1 暂存文件

```bash
git add wjx-api-sdk/package.json wjx-api-sdk/dist/
git add wjx-mcp-server/package.json wjx-mcp-server/dist/
git add wjx-cli/package.json wjx-cli/dist/
git add package-lock.json
```

只 stage 有变更的包。

### 3.2 提交

```bash
git commit -m "chore(release): wjx-api-sdk@<ver>, wjx-mcp-server@<ver>, wjx-cli@<ver>"
```

只包含实际 bump 的包名。Pre-commit hook 会自动检测 wjx-docs/*.md 变更并重建 wjx-kit.html。

### 3.3 打 Tag

```bash
git tag wjx-api-sdk@<version>
git tag wjx-mcp-server@<version>
git tag wjx-cli@<version>
```

只给发布的包打 tag。

### 3.4 推送到 GitHub

调用 `/github-push` 推送 commits 和 tags 到 `github` remote：

```bash
git push github <branch> --tags
```

如果没有 `github` remote（只有 `origin`），push 到 `origin`。

---

## Phase 4: npm 发布

### 4.1 按依赖顺序发布

```bash
cd wjx-api-sdk && npm publish
```

等 SDK 发布成功后：

```bash
cd wjx-mcp-server && npm publish
cd wjx-cli && npm publish
```

每个包的 `prepublishOnly` 会自动 build（wjx-mcp-server 还会 test）。

### 4.2 验证

```bash
npm view wjx-api-sdk version
npm view wjx-mcp-server version
npm view wjx-cli version
```

---

## Phase 5: Skill zip 打包 & 上传 OSS

### 5.1 打包

```bash
bash wjx-skills/wjx-cli-use/pack_skill.sh
```

输出：`wjx-skills/wjx-cli-use-skill-<version>.zip`

### 5.2 上传到 OSS

调用 `/aliyun-oss-upload`，上传 zip 文件。如果 OSS 凭证未配置，跳过并提示用户。

---

## Phase 6: 发版摘要

```
发版完成！

已发布：
  wjx-api-sdk@0.1.7
  wjx-mcp-server@0.1.6

已跳过（无变更）：
  wjx-cli@0.1.14

Git:
  Commit: chore(release): wjx-api-sdk@0.1.7, wjx-mcp-server@0.1.6
  Tags: wjx-api-sdk@0.1.7, wjx-mcp-server@0.1.6
  Pushed to github/master

Skill zip:
  wjx-cli-use-skill-1.0.0.zip → OSS
```

---

## 特殊模式

### 部分发布

用户说 "只发 wjx-cli" → 只处理指定包，但仍按依赖顺序构建。

### 预览（dry-run）

用户说 "预览发版" 或 `--dry-run` → 只执行 Phase 1-2（分析 + 构建测试），展示计划但不提交/发布。

## 错误处理

- 任何阶段失败 → 立即停止，报告哪一步失败
- 构建/测试失败 → 不进入 npm publish
- npm publish 某包失败 → 不继续发布剩余包
- 始终报告已完成和未完成的步骤
