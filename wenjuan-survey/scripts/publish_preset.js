#!/usr/bin/env node
/**
 * 已登记的活动题库一键：登录 → 创建+导入 → 发布（同 workflow_create_and_publish）
 * 用法（在 Skill 根目录）：node scripts/publish_preset.js <valentines|labor|april_fools|april_fools_fun|singles_day>
 */

const path = require("path");
const { workflowCreateAndPublish } = require("./workflow_create_and_publish.js");

const PRESETS = {
  valentines: {
    file: "examples/valentines_day_fun_assess_2026.json",
    title: "2026问卷网·情人节趣味体质测试",
    type: "assess",
  },
  labor: {
    file: "examples/labor_day_fun_assess_2026.json",
    title: "2026问卷网·劳动节趣味体质测试",
    type: "assess",
  },
  april_fools: {
    file: "examples/april_fools_promo_assess_2026.json",
    title: "2026问卷网·愚人节趣味体质测试",
    type: "assess",
  },
  /** 愚人节活动推广版（赛博生存 5 题·4 档结果），见 examples/april_fools_promo_fun_2026.json */
  april_fools_fun: {
    file: "examples/april_fools_promo_fun_2026.json",
    title: "问卷网·愚人节「赛博生存」趣味测试",
    type: "assess",
  },
  singles_day: {
    file: "examples/singles_day_fun_assess_2026.json",
    title: "2026问卷网·光棍节趣味体质测试",
    type: "assess",
  },
};

async function main() {
  const key = process.argv[2];
  if (!key || !PRESETS[key]) {
    console.error(
      "用法: node scripts/publish_preset.js <" +
        Object.keys(PRESETS).join("|") +
        ">"
    );
    process.exit(1);
  }
  const p = PRESETS[key];
  const skillRoot = path.join(__dirname, "..");
  const filePath = path.join(skillRoot, p.file);
  const result = await workflowCreateAndPublish(
    p.title,
    p.type,
    null,
    filePath
  );
  if (!result.success) {
    console.error(result.error || "失败");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
