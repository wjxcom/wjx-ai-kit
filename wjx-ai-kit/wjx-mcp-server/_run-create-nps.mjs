import "./dist/core/load-env.js";
import { createSurvey } from "wjx-api-sdk";

const items = [];
for (let i = 0; i <= 10; i++) {
  items.push({ q_index: 1, item_index: i + 1, item_title: String(i) });
}
const questions = JSON.stringify([
  {
    q_index: 1,
    q_type: 3,
    q_subtype: 302,
    q_title: "您有多大可能向朋友或同事推荐我们的产品/服务？",
    is_requir: true,
    items,
  },
  {
    q_index: 2,
    q_type: 5,
    q_subtype: 5,
    q_title: "您给出该评分的主要原因是什么？",
    is_requir: true,
  },
  {
    q_index: 3,
    q_type: 5,
    q_subtype: 5,
    q_title: "您认为我们还可以在哪些方面改进？",
    is_requir: false,
  },
]);

const result = await createSurvey({
  title: "NPS 客户体验调研",
  type: 1,
  description: "了解客户推荐意愿与改进方向",
  publish: false,
  questions,
});
console.log(JSON.stringify(result, null, 2));
