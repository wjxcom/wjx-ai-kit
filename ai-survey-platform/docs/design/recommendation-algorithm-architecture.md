# AI 智能问卷推荐引擎 — 算法架构设计

> CMP-6 | 问卷星 AI 推荐引擎核心算法
> 版本: v1.0 | 日期: 2026-03-20

---

## 目录

1. [概述](#1-概述)
2. [系统输入与输出](#2-系统输入与输出)
3. [策略一：基于内容的推荐](#3-策略一基于内容的推荐)
4. [策略二：协同过滤推荐](#4-策略二协同过滤推荐)
5. [策略三：语义匹配推荐](#5-策略三语义匹配推荐)
6. [融合排序机制](#6-融合排序机制)
7. [冷启动解决方案](#7-冷启动解决方案)
8. [数据流图](#8-数据流图)
9. [附录：关键数据结构定义](#9-附录关键数据结构定义)

---

## 1. 概述

本文档描述问卷星 AI 智能推荐引擎的核心算法架构。系统接收用户的行业信息、历史行为数据和自然语言需求描述，通过三种互补的推荐策略（基于内容、协同过滤、语义匹配）生成候选模板集合，再经融合排序输出 Top-5 推荐结果及推荐理由。

### 设计原则

- **精准性**：推荐结果与用户实际需求高度匹配
- **多样性**：避免推荐结果高度同质化
- **可解释性**：每条推荐附带人类可读的理由
- **鲁棒性**：在数据稀疏或新用户场景下仍能给出合理推荐

---

## 2. 系统输入与输出

### 输入

| 输入项 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `user_industry` | string | 用户所属行业 | `"教育"`, `"医疗"`, `"零售"` |
| `user_history` | object | 历史使用数据 | 创建过的问卷类型列表、填写频率、最近活跃时间 |
| `user_query` | string | 自然语言需求描述 | `"我想做一份员工满意度调查"` |
| `template_pool` | list | 现有问卷模板库 | 包含模板元数据和内容 |

### 输出

| 输出项 | 类型 | 说明 |
|--------|------|------|
| `recommendations` | list[5] | Top-5 推荐模板，按综合得分降序 |
| `recommendations[i].template_id` | string | 模板 ID |
| `recommendations[i].score` | float | 综合推荐分 ∈ [0, 1] |
| `recommendations[i].reason` | string | 推荐理由（自然语言） |
| `recommendations[i].strategy_scores` | object | 各策略的单独得分 |

---

## 3. 策略一：基于内容的推荐

### 3.1 核心思路

根据用户的历史偏好和模板本身的内容特征，找到与用户兴趣画像最相似的模板。

### 3.2 模板特征提取

每个问卷模板提取以下特征维度，构建特征向量：

```
TemplateFeature = {
    category:       one-hot(问卷类别),        # 如：满意度调查、市场调研、考试测评...
    industry_tags:  multi-hot(行业标签),      # 如：教育、医疗、零售...
    question_types: normalized_count(题型分布), # 单选/多选/填空/矩阵/评分 的比例
    question_count: normalized(题目数量),      # 归一化到 [0,1]
    complexity:     float(复杂度评分),         # 基于题型多样性和逻辑跳转数
    target_audience: one-hot(目标受众),        # 员工/客户/学生/公众...
    purpose:        one-hot(用途),            # 调研/反馈/评估/考试/报名...
}
```

**特征向量构建**：

```python
def build_template_vector(template):
    """将模板元数据转换为固定维度的特征向量"""
    v_category = one_hot_encode(template.category, CATEGORY_VOCAB)         # dim: ~15
    v_industry = multi_hot_encode(template.industry_tags, INDUSTRY_VOCAB)  # dim: ~30
    v_qtypes = normalize_distribution(template.question_type_counts)       # dim: ~8
    v_qcount = [min(template.question_count / 100.0, 1.0)]                # dim: 1
    v_complexity = [template.complexity_score]                              # dim: 1
    v_audience = one_hot_encode(template.target_audience, AUDIENCE_VOCAB)  # dim: ~6
    v_purpose = one_hot_encode(template.purpose, PURPOSE_VOCAB)            # dim: ~8

    return concat(v_category, v_industry, v_qtypes, v_qcount,
                  v_complexity, v_audience, v_purpose)
    # 总维度 ≈ 69
```

### 3.3 用户兴趣画像构建

```python
def build_user_profile(user):
    """
    基于用户历史使用记录，加权聚合模板特征，
    构建用户兴趣画像向量。
    近期行为权重更高（时间衰减）。
    """
    profile = zeros(FEATURE_DIM)
    total_weight = 0.0

    for record in user.history:
        template_vec = build_template_vector(record.template)
        # 时间衰减：半衰期 30 天
        days_ago = (now() - record.created_at).days
        time_weight = 0.5 ** (days_ago / 30.0)
        # 交互权重：创建 > 编辑 > 浏览
        action_weight = {"create": 1.0, "edit": 0.6, "view": 0.2}[record.action]

        weight = time_weight * action_weight
        profile += weight * template_vec
        total_weight += weight

    if total_weight > 0:
        profile /= total_weight

    return profile
```

### 3.4 相似度计算与排序

```python
def content_based_recommend(user, template_pool, top_k=20):
    """基于内容的推荐：计算用户画像与模板的余弦相似度"""
    user_profile = build_user_profile(user)

    scores = []
    for template in template_pool:
        template_vec = build_template_vector(template)
        sim = cosine_similarity(user_profile, template_vec)

        # 行业匹配加成
        if user.industry in template.industry_tags:
            sim = sim * 1.2  # 行业匹配 +20% 加成

        # 去重惩罚：用户已使用过的模板降权
        if template.id in user.used_template_ids:
            sim *= 0.3

        scores.append((template.id, clip(sim, 0, 1)))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]
```

---

## 4. 策略二：协同过滤推荐

### 4.1 核心思路

利用"相似用户倾向于使用相似模板"的假设，通过用户-模板交互矩阵发现同类用户的使用模式，预测当前用户可能感兴趣的模板。

### 4.2 用户-模板交互矩阵

```
交互矩阵 R ∈ ℝ^(M×N)

M = 用户数量
N = 模板数量

R[u][t] = 交互强度，计算方式：
  - 使用模板创建问卷: +3.0
  - 收藏/点赞模板:     +2.0
  - 编辑/预览模板:     +1.0
  - 搜索后点击模板:    +0.5
  - 无交互:            0.0
```

### 4.3 相似用户发现

采用基于物品的协同过滤（Item-based CF），因为模板数量通常远少于用户数量，计算效率更高。

```python
def compute_item_similarity_matrix(R):
    """
    计算模板-模板相似度矩阵。
    使用调整余弦相似度，消除用户评分尺度差异。
    """
    # R: shape (M, N), M=users, N=templates
    # 减去每个用户的均值
    user_means = R.mean(axis=1, keepdims=True)
    R_adjusted = R - user_means
    # 仅在非零项上计算
    R_adjusted[R == 0] = 0

    S = zeros(N, N)
    for i in range(N):
        for j in range(i+1, N):
            # 找到同时对 i 和 j 有交互的用户
            common_users = nonzero(R[:, i]) & nonzero(R[:, j])
            if len(common_users) < 3:  # 最少共现用户数阈值
                continue
            vec_i = R_adjusted[common_users, i]
            vec_j = R_adjusted[common_users, j]
            sim = cosine_similarity(vec_i, vec_j)
            S[i][j] = S[j][i] = sim

    return S
```

### 4.4 评分预测

```python
def collaborative_filtering_recommend(user, template_pool, S, R, top_k=20):
    """
    基于物品的协同过滤推荐。
    对用户未交互过的模板，预测其可能的交互评分。
    """
    user_interactions = R[user.id]  # 该用户对所有模板的交互向量
    interacted_items = nonzero(user_interactions)

    scores = []
    for t_idx, template in enumerate(template_pool):
        if t_idx in interacted_items:
            continue  # 跳过已交互模板

        # 加权求和：用已交互模板的相似度加权
        numerator = 0.0
        denominator = 0.0
        # 取与目标模板最相似的 K 个已交互模板
        neighbors = top_k_similar(S[t_idx], interacted_items, k=10)

        for neighbor_idx, sim in neighbors:
            if sim <= 0:
                continue
            numerator += sim * user_interactions[neighbor_idx]
            denominator += abs(sim)

        predicted_score = numerator / denominator if denominator > 0 else 0
        # 归一化到 [0, 1]
        normalized = min(predicted_score / 3.0, 1.0)
        scores.append((template.id, normalized))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_k]
```

### 4.5 稀疏性优化

当交互矩阵过于稀疏时（活跃用户 < 1000 或平均交互 < 3），采用**矩阵分解**降维：

```python
def matrix_factorization_fallback(R, k=32, epochs=100, lr=0.01, reg=0.02):
    """
    ALS / SGD 矩阵分解，将 R ≈ P × Q^T
    P: 用户隐因子矩阵 (M × k)
    Q: 模板隐因子矩阵 (N × k)
    """
    M, N = R.shape
    P = random_normal(M, k, std=0.1)
    Q = random_normal(N, k, std=0.1)

    for epoch in range(epochs):
        for u, t in nonzero_entries(R):
            error = R[u][t] - dot(P[u], Q[t])
            P[u] += lr * (error * Q[t] - reg * P[u])
            Q[t] += lr * (error * P[u] - reg * Q[t])

    return P, Q

def mf_predict(user_id, template_ids, P, Q):
    scores = [(tid, dot(P[user_id], Q[tid])) for tid in template_ids]
    return sorted(scores, key=lambda x: x[1], reverse=True)
```

---

## 5. 策略三：语义匹配推荐

### 5.1 核心思路

将用户的自然语言需求描述和模板的文本内容映射到同一语义空间，通过向量相似度排序找到最匹配的模板。

### 5.2 NLP 处理流水线

```python
def preprocess_query(raw_query):
    """用户输入预处理"""
    # Step 1: 文本清洗
    query = remove_noise(raw_query)  # 去除特殊字符、多余空格

    # Step 2: 意图识别（分类器或规则）
    intent = classify_intent(query)
    # intent ∈ {create_survey, find_template, analyze_data, other}

    # Step 3: 关键实体提取
    entities = extract_entities(query)
    # entities: {
    #   survey_type: "满意度调查",
    #   target: "员工",
    #   industry: "互联网",
    #   purpose: "年度评估"
    # }

    # Step 4: 查询扩展（同义词/上下位词）
    expanded_terms = expand_query(entities)
    # "满意度调查" → ["满意度调查", "满意度问卷", "满意度评估", "NPS调查"]

    return {
        "cleaned_query": query,
        "intent": intent,
        "entities": entities,
        "expanded_terms": expanded_terms
    }
```

### 5.3 Embedding 模型选型

| 模型 | 维度 | 中文支持 | 推理延迟 | 推荐场景 |
|------|------|----------|----------|----------|
| **text2vec-base-chinese** | 768 | 原生 | ~15ms | 默认首选，中文效果好 |
| M3E-base | 768 | 原生 | ~15ms | 备选，通用性强 |
| BGE-large-zh | 1024 | 原生 | ~25ms | 精度优先场景 |
| OpenAI text-embedding-3-small | 1536 | 良好 | ~50ms (API) | 多语言场景 |

**推荐方案**：默认使用 `text2vec-base-chinese`，本地部署，延迟可控。对于精度敏感的场景可切换为 `BGE-large-zh`。

### 5.4 模板文本表示构建

```python
def build_template_text(template):
    """
    构建模板的文本表示，用于 Embedding。
    将模板的结构化信息拼接为自然语言描述。
    """
    parts = []
    parts.append(f"问卷标题：{template.title}")
    parts.append(f"问卷类别：{template.category}")
    parts.append(f"适用行业：{'、'.join(template.industry_tags)}")
    parts.append(f"目标受众：{template.target_audience}")
    parts.append(f"用途：{template.purpose}")
    if template.description:
        parts.append(f"描述：{template.description}")
    # 取前 5 个题目作为内容摘要
    for i, q in enumerate(template.questions[:5]):
        parts.append(f"题目{i+1}：{q.text}")

    return " ".join(parts)
```

### 5.5 语义相似度计算

```python
# 预计算：离线构建模板 Embedding 索引
def build_template_index(template_pool, model):
    """离线构建模板向量索引（使用 FAISS 或 Annoy）"""
    texts = [build_template_text(t) for t in template_pool]
    embeddings = model.encode(texts, batch_size=64)

    # 使用 FAISS 建立近似最近邻索引
    index = faiss.IndexFlatIP(embeddings.shape[1])  # 内积 = 余弦（已 L2 归一化）
    faiss.normalize_L2(embeddings)
    index.add(embeddings)

    return index, embeddings

# 在线推荐
def semantic_recommend(user_query, template_pool, model, index, top_k=20):
    """语义匹配推荐：将用户查询与模板在语义空间中匹配"""
    processed = preprocess_query(user_query)

    # 编码用户查询
    query_embedding = model.encode([processed["cleaned_query"]])
    faiss.normalize_L2(query_embedding)

    # FAISS 检索 Top-K
    scores, indices = index.search(query_embedding, top_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        template = template_pool[idx]

        # 实体匹配加成
        entity_bonus = compute_entity_bonus(processed["entities"], template)

        final_score = clip(score * 0.8 + entity_bonus * 0.2, 0, 1)
        results.append((template.id, final_score))

    return results

def compute_entity_bonus(entities, template):
    """基于提取的实体与模板元数据的精确匹配加成"""
    bonus = 0.0
    matches = 0
    total = 0

    if entities.get("survey_type"):
        total += 1
        if entities["survey_type"] in template.category:
            matches += 1
    if entities.get("target"):
        total += 1
        if entities["target"] == template.target_audience:
            matches += 1
    if entities.get("industry"):
        total += 1
        if entities["industry"] in template.industry_tags:
            matches += 1

    return matches / total if total > 0 else 0
```

---

## 6. 融合排序机制

### 6.1 加权融合方案

三种策略的输出统一为 `(template_id, score)` 格式，score ∈ [0, 1]。融合公式：

```
FinalScore(t) = w_cb × S_content(t) + w_cf × S_collab(t) + w_sm × S_semantic(t)
```

**动态权重分配**：

```python
def compute_fusion_weights(user, query):
    """
    根据可用信息动态调整各策略权重。
    核心逻辑：哪个策略有更充分的数据，就给更高的权重。
    """
    has_history = len(user.history) >= 5
    has_query = query is not None and len(query.strip()) > 3
    has_community = user.similar_user_count >= 10

    if has_history and has_query and has_community:
        # 全信息场景：三者均衡，语义略优先
        return {"content": 0.30, "collab": 0.30, "semantic": 0.40}

    elif has_query and not has_history:
        # 新用户有需求描述：语义为主
        return {"content": 0.10, "collab": 0.15, "semantic": 0.75}

    elif has_history and not has_query:
        # 老用户无明确需求：历史为主
        return {"content": 0.50, "collab": 0.35, "semantic": 0.15}

    elif has_history and has_query and not has_community:
        # 社区数据不足：协同过滤降权
        return {"content": 0.35, "collab": 0.10, "semantic": 0.55}

    else:
        # 兜底：语义为主（至少有查询或默认推荐）
        return {"content": 0.15, "collab": 0.10, "semantic": 0.75}
```

### 6.2 融合排序与去重

```python
def fusion_rank(content_scores, collab_scores, semantic_scores, weights, top_k=5):
    """
    融合三种策略的评分，输出 Top-K 推荐列表。
    """
    # 汇总所有候选模板
    all_templates = set()
    score_maps = {
        "content": dict(content_scores),
        "collab": dict(collab_scores),
        "semantic": dict(semantic_scores),
    }
    for scores in [content_scores, collab_scores, semantic_scores]:
        for tid, _ in scores:
            all_templates.add(tid)

    # 计算融合分数
    fused = []
    for tid in all_templates:
        s_cb = score_maps["content"].get(tid, 0.0)
        s_cf = score_maps["collab"].get(tid, 0.0)
        s_sm = score_maps["semantic"].get(tid, 0.0)

        final = (weights["content"] * s_cb +
                 weights["collab"] * s_cf +
                 weights["semantic"] * s_sm)

        fused.append({
            "template_id": tid,
            "score": round(final, 4),
            "strategy_scores": {
                "content": round(s_cb, 4),
                "collab": round(s_cf, 4),
                "semantic": round(s_sm, 4)
            }
        })

    # 按融合分数排序
    fused.sort(key=lambda x: x["score"], reverse=True)

    # 多样性后处理：类别去重
    result = []
    seen_categories = set()
    for item in fused:
        template = get_template(item["template_id"])
        cat = template.category
        # 同类别最多出现 2 个
        if seen_categories.get(cat, 0) >= 2:
            continue
        seen_categories[cat] = seen_categories.get(cat, 0) + 1
        result.append(item)
        if len(result) >= top_k:
            break

    return result
```

### 6.3 推荐理由生成

```python
def generate_reason(recommendation, user, query):
    """
    根据策略得分和模板元数据，生成人类可读的推荐理由。
    """
    tid = recommendation["template_id"]
    scores = recommendation["strategy_scores"]
    template = get_template(tid)

    # 找到贡献最大的策略
    dominant = max(scores, key=scores.get)

    reasons = []

    if dominant == "semantic" and query:
        reasons.append(f"与您的需求「{query[:20]}…」高度匹配")

    if dominant == "content":
        reasons.append("基于您的历史使用偏好推荐")

    if dominant == "collab":
        reasons.append("与您同行业的用户也在使用")

    if user.industry in template.industry_tags:
        reasons.append(f"专为{user.industry}行业设计")

    if template.usage_count > 1000:
        reasons.append(f"已被 {template.usage_count}+ 用户使用")

    return "；".join(reasons[:3])
```

---

## 7. 冷启动解决方案

### 7.1 新用户冷启动（无历史数据）

**场景**：用户首次注册或历史交互不足 5 条。

```python
def cold_start_new_user(user, query=None):
    """
    新用户冷启动策略，逐级降级：
    1. 语义匹配（如果有需求描述）
    2. 行业默认推荐
    3. 全局热门推荐
    """
    candidates = []

    # Level 1: 有需求描述 → 语义匹配为主
    if query and len(query.strip()) > 3:
        semantic_results = semantic_recommend(query, template_pool, model, index, top_k=10)
        candidates.extend(semantic_results)

    # Level 2: 有行业信息 → 行业热门模板
    if user.industry:
        industry_hot = get_industry_hot_templates(user.industry, top_k=10)
        for t in industry_hot:
            if t.id not in [c[0] for c in candidates]:
                # 行业热门基础分 0.5，按热度递减
                candidates.append((t.id, 0.5 * t.popularity_score))

    # Level 3: 兜底 → 全局热门模板
    if len(candidates) < 5:
        global_hot = get_global_hot_templates(top_k=10)
        for t in global_hot:
            if t.id not in [c[0] for c in candidates]:
                candidates.append((t.id, 0.3 * t.popularity_score))

    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[:5]
```

**行业默认推荐配置表**：

| 行业 | 默认推荐类别 | 示例模板 |
|------|-------------|---------|
| 教育 | 课程评价、学生满意度、考试测评 | 教学质量评估表、学生课程反馈 |
| 医疗 | 患者满意度、健康调查、医疗评价 | 门诊满意度调查、患者体验问卷 |
| 零售 | 客户满意度、市场调研、NPS | 购物体验调查、品牌认知问卷 |
| 餐饮 | 菜品评价、服务满意度、订餐调查 | 餐厅满意度调查、外卖体验反馈 |
| IT/互联网 | 产品反馈、用户体验、需求调研 | 产品满意度调查、功能需求收集 |
| 政府/公共 | 民意调查、公共服务评价、政策反馈 | 公共服务满意度、社区需求调查 |
| 通用 | 满意度调查、活动报名、投票 | 通用满意度模板、活动反馈表 |

### 7.2 新模板冷启动（无使用记录）

**场景**：新上架的模板尚无用户交互数据，协同过滤无法计算其相似度。

```python
def cold_start_new_template(new_template, template_pool):
    """
    新模板冷启动策略：
    1. 基于内容特征找到相似的成熟模板，继承其协同过滤得分
    2. 语义匹配正常参与
    3. 初始曝光加成（Exploration Bonus）
    """
    # Step 1: 找到内容特征最相似的已有模板
    new_vec = build_template_vector(new_template)
    similarities = []
    for t in template_pool:
        if t.usage_count >= 10:  # 只看有一定使用量的模板
            t_vec = build_template_vector(t)
            sim = cosine_similarity(new_vec, t_vec)
            similarities.append((t.id, sim))

    similarities.sort(key=lambda x: x[1], reverse=True)
    proxy_templates = similarities[:5]  # 取最相似的 5 个作为代理

    # Step 2: 继承代理模板的协同过滤信号
    inherited_score = 0.0
    if proxy_templates:
        proxy_scores = [get_cf_avg_score(pid) * sim for pid, sim in proxy_templates]
        inherited_score = sum(proxy_scores) / len(proxy_scores)

    # Step 3: 探索加成（前 7 天新模板额外加分）
    days_since_publish = (now() - new_template.published_at).days
    exploration_bonus = max(0, 0.15 * (1 - days_since_publish / 7.0))

    return {
        "inherited_cf_score": inherited_score,
        "exploration_bonus": exploration_bonus
    }
```

### 7.3 兜底策略总结

```
决策树：
├── 有需求描述？
│   ├── 是 → 语义匹配（权重 0.75）+ 行业默认（权重 0.25）
│   └── 否 → 继续 ↓
├── 有行业信息？
│   ├── 是 → 行业热门 Top-5
│   └── 否 → 继续 ↓
└── 全局热门 Top-5（按最近 30 天使用量排序）
```

---

## 8. 数据流图

### 8.1 总体架构数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          用户请求入口                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ 行业信息  │  │ 历史使用数据  │  │ 需求描述文本  │                      │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘                      │
└───────┼───────────────┼─────────────────┼──────────────────────────────┘
        │               │                 │
        ▼               ▼                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       预处理层 (Preprocessing)                         │
│  ┌────────────────┐ ┌─────────────────┐ ┌──────────────────────────┐  │
│  │ 行业标准化映射  │ │ 用户画像构建     │ │ NLP 流水线               │  │
│  │ industry_code  │ │ user_profile    │ │ 清洗→意图→实体→扩展       │  │
│  └───────┬────────┘ └───────┬─────────┘ └────────────┬─────────────┘  │
└──────────┼──────────────────┼────────────────────────┼────────────────┘
           │                  │                        │
           ▼                  ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    推荐策略层 (Strategy Layer)                        │
│                                                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐  │
│  │ 策略一            │ │ 策略二            │ │ 策略三                │  │
│  │ 基于内容推荐      │ │ 协同过滤推荐      │ │ 语义匹配推荐          │  │
│  │                  │ │                  │ │                      │  │
│  │ 用户画像向量      │ │ 交互矩阵 R       │ │ Query Embedding      │  │
│  │    ×             │ │ 物品相似度 S     │ │    ×                 │  │
│  │ 模板特征向量      │ │ 评分预测         │ │ 模板 Embedding       │  │
│  │    ↓             │ │    ↓             │ │    ↓                 │  │
│  │ 余弦相似度       │ │ 加权评分         │ │ FAISS ANN 检索       │  │
│  │    ↓             │ │    ↓             │ │    ↓                 │  │
│  │ Top-20 候选      │ │ Top-20 候选      │ │ Top-20 候选          │  │
│  └───────┬──────────┘ └───────┬──────────┘ └──────────┬───────────┘  │
└──────────┼────────────────────┼───────────────────────┼──────────────┘
           │                    │                       │
           └────────────────────┼───────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     融合排序层 (Fusion Layer)                         │
│                                                                      │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │
│  │ 动态权重计算      │ →  │ 加权分数融合      │ →  │ 多样性后处理    │  │
│  │ (基于数据可用性)  │    │ FinalScore =     │    │ (类别去重)      │  │
│  │                  │    │ Σ(w_i × s_i)     │    │                 │  │
│  └─────────────────┘    └──────────────────┘    └───────┬─────────┘  │
└─────────────────────────────────────────────────────────┼────────────┘
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      输出层 (Output Layer)                           │
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐    │
│  │ Top-5 模板列表        │ →  │ 推荐理由生成                      │    │
│  │ (template_id, score) │    │ (基于 dominant strategy + 元数据)  │    │
│  └──────────────────────┘    └──────────────────────────────────┘    │
│                                         │                            │
│                                         ▼                            │
│                              ┌────────────────────┐                  │
│                              │ API Response       │                  │
│                              │ recommendations[5] │                  │
│                              └────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 冷启动决策流

```
用户请求到达
      │
      ▼
  ┌─────────────────┐
  │ 用户历史交互 ≥ 5?│
  └────┬────────────┘
       │
  ┌────┴────┐
  │是       │否 (冷启动)
  ▼         ▼
正常流程   ┌─────────────────┐
           │ 有需求描述？      │
           └────┬────────────┘
           ┌────┴────┐
           │是       │否
           ▼         ▼
      语义匹配     ┌────────────────┐
      (w=0.75)    │ 有行业信息？     │
      +行业默认    └────┬───────────┘
      (w=0.25)    ┌────┴────┐
                  │是       │否
                  ▼         ▼
             行业热门     全局热门
             Top-5       Top-5
```

### 8.3 离线/在线模块划分

```
┌─────────────────────────────────────────────────────────┐
│ 离线计算（定时任务，每日/每周）                            │
│                                                         │
│  • 模板特征向量库更新                                     │
│  • 交互矩阵构建 & 物品相似度矩阵计算                      │
│  • 矩阵分解模型训练（稀疏场景）                           │
│  • 模板 Embedding 索引构建 (FAISS)                       │
│  • 行业热门 / 全局热门排行榜更新                          │
│  • 新模板代理继承分数计算                                  │
└─────────────────────────────────────────────────────────┘
                          ↓ 产出
                  [预计算数据存储]
                    Redis / DB
                          ↓ 读取
┌─────────────────────────────────────────────────────────┐
│ 在线服务（实时请求，延迟 < 200ms）                        │
│                                                         │
│  • 用户画像实时构建（增量更新）                            │
│  • 语义查询 Embedding 编码（~15ms）                      │
│  • FAISS 近邻检索（~5ms）                                │
│  • 三策略并行计算                                        │
│  • 融合排序 + 理由生成                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 9. 附录：关键数据结构定义

```python
@dataclass
class Template:
    id: str
    title: str
    category: str                # 问卷类别
    industry_tags: list[str]     # 适用行业标签
    target_audience: str         # 目标受众
    purpose: str                 # 用途
    description: str             # 模板描述
    questions: list[Question]    # 题目列表
    question_type_counts: dict   # 各题型数量 {"single_choice": 5, "multi_choice": 3, ...}
    complexity_score: float      # 复杂度评分 [0, 1]
    usage_count: int             # 累计使用次数
    popularity_score: float      # 近期热度评分 [0, 1]
    published_at: datetime       # 发布时间

@dataclass
class User:
    id: str
    industry: str                # 所属行业
    history: list[InteractionRecord]  # 历史交互记录
    used_template_ids: set[str]  # 已使用过的模板 ID 集合
    similar_user_count: int      # 相似用户数量
    created_at: datetime         # 注册时间

@dataclass
class InteractionRecord:
    template: Template
    action: str                  # "create" | "edit" | "view" | "favorite"
    created_at: datetime

@dataclass
class Recommendation:
    template_id: str
    score: float                 # 综合推荐分 [0, 1]
    reason: str                  # 推荐理由
    strategy_scores: dict        # {"content": 0.x, "collab": 0.x, "semantic": 0.x}
```

---

*文档结束 — CMP-6 推荐算法架构设计 v1.0*
