export const SURVEY_TYPES: Record<number, string> = {
  0: "问卷调查",
  1: "问卷调查",
  2: "测评",
  3: "投票",
  4: "360度评估",
  5: "教学评估",
  6: "考试",
  7: "表单",
  8: "报名",
  9: "在线测试",
  10: "量表",
  11: "心理测评",
};

export const QUESTION_TYPES: Record<number, { name: string; subtypes?: Record<number, string> }> = {
  1: {
    name: "单选题",
    subtypes: { 0: "普通单选", 1: "下拉单选", 2: "图片单选" },
  },
  2: {
    name: "多选题",
    subtypes: { 0: "普通多选", 1: "图片多选" },
  },
  3: {
    name: "填空题",
    subtypes: { 0: "单行填空", 1: "多行填空", 2: "数值填空", 3: "日期填空", 4: "邮箱填空", 5: "手机填空", 6: "身份证填空" },
  },
  4: {
    name: "矩阵单选题",
  },
  5: {
    name: "矩阵多选题",
  },
  6: {
    name: "矩阵填空题",
    subtypes: { 0: "矩阵文本填空", 1: "矩阵数值填空" },
  },
  7: {
    name: "排序题",
  },
  8: {
    name: "量表题",
    subtypes: { 0: "普通量表", 1: "矩阵量表" },
  },
  9: {
    name: "多项填空题",
  },
  10: {
    name: "文件上传题",
  },
  11: {
    name: "分页",
  },
  12: {
    name: "评分题",
    subtypes: { 0: "评分单选", 1: "评分多选" },
  },
  13: {
    name: "商品题",
  },
  14: {
    name: "滑动条题",
    subtypes: { 0: "普通滑动条", 1: "矩阵滑动条" },
  },
  15: {
    name: "表格题",
    subtypes: { 0: "表格填空", 1: "表格下拉框", 2: "表格组合", 3: "表格自增" },
  },
  16: {
    name: "情景题",
  },
  17: {
    name: "判断题",
  },
};

export const SURVEY_STATUSES: Record<number, string> = {
  0: "设计中（未发布）",
  1: "收集中（已发布）",
  2: "已暂停",
  3: "已删除（在回收站）",
};

export const VERIFY_STATUSES: Record<number, string> = {
  0: "未审核",
  1: "审核通过",
  2: "审核未通过",
  3: "审核中",
};
