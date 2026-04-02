import "./dist/core/load-env.js";
import { listSurveys, createSurvey } from "wjx-api-sdk";

const list = await listSurveys({ page_index: 1, page_size: 2 });
console.log("listSurveys:", JSON.stringify(list, null, 2));

const items = [];
for (let i = 0; i <= 10; i++) {
  items.push({ q_index: 1, item_index: i + 1, item_title: String(i) });
}
const questions = JSON.stringify([
  {
    q_index: 1,
    q_type: 3,
    q_subtype: 302,
    q_title: "NPS",
    is_requir: true,
    items,
  },
]);

const create = await createSurvey({
  title: "Probe NPS",
  type: 1,
  description: "d",
  publish: false,
  questions,
});
console.log("createSurvey:", JSON.stringify(create, null, 2));
