# Question Types Reference

Complete mapping of q_type and q_subtype codes used in `wjx survey create --questions <json>`.

## Main Types (q_type)

| q_type | Name | Has Subtypes |
|--------|------|-------------|
| 1 | Page Break | No |
| 2 | Paragraph/Section | No |
| 3 | Single Choice | Yes |
| 4 | Multiple Choice | Yes |
| 5 | Fill-in | Yes |
| 6 | Multi-fill | Yes |
| 7 | Matrix | Yes |
| 8 | File Upload | Yes |
| 9 | Weight | No |
| 10 | Slider | No |

## All Subtypes (q_subtype)

### Single Choice (q_type=3)
| q_subtype | Name | DSL Label |
|-----------|------|-----------|
| 3 | Standard single choice | [单选题] (default, can omit) |
| 301 | Dropdown | [下拉框] |
| 302 | Scale/Likert | [量表题] |
| 303 | Scoring single choice | [评分单选] |
| 304 | Scenario | [情景题] |
| 305 | True/False | [判断题] |

### Multiple Choice (q_type=4)
| q_subtype | Name | DSL Label |
|-----------|------|-----------|
| 4 | Standard multiple choice | [多选题] |
| 401 | Scoring multiple choice | [评分多选] |
| 402 | Sort/Ranking | [排序题] |
| 403 | Commodity/Product | [商品题] |

### Fill-in (q_type=5)
| q_subtype | Name | DSL Label |
|-----------|------|-----------|
| 5 | Standard fill-in / Essay | [填空题] / [简答题] |
| 501 | Multi-level dropdown | [多级下拉题] |

### Multi-fill (q_type=6)
| q_subtype | Name | DSL Label | Note |
|-----------|------|-----------|------|
| 6 | Standard multi-fill | [多项填空题] | q_title must contain {_} |
| 601 | Exam multi-fill | [考试多项填空] | q_title must contain {_} |
| 602 | Exam cloze | [考试完形填空] | q_title must contain {_} |

### Matrix (q_type=7)
| q_subtype | Name | DSL Label |
|-----------|------|-----------|
| 7 | Generic matrix | [矩阵题] |
| 701 | Matrix scale | [矩阵量表题] |
| 702 | Matrix single choice | [矩阵单选题] |
| 703 | Matrix multiple choice | [矩阵多选题] |
| 704 | Matrix fill-in | [矩阵填空题] |
| 705 | Matrix slider | - |
| 706 | Matrix numeric | - |
| 707 | Table fill-in | - |
| 708 | Table dropdown | - |
| 709 | Table combo | - |
| 710 | Table auto-increment | - |
| 711 | Multi-file | - |
| 712 | Multi-essay | - |

### File Upload (q_type=8)
| q_subtype | Name | DSL Label |
|-----------|------|-----------|
| 8 | File upload | [文件上传] |
| 801 | Drawing/Signature | [绘图题] |

## Exam Survey Notes

For exam surveys, set survey type (`--type 6` or `atype=6`). The SAME q_type/q_subtype codes are used -- the distinction is at the survey level:

| Exam Question | Configuration |
|--------------|---------------|
| Exam single choice | atype=6, q_type=3, q_subtype=3 |
| Exam multiple choice | atype=6, q_type=4, q_subtype=4 |
| Exam fill-in | atype=6, q_type=5, q_subtype=5 |
| Exam multi-fill | q_type=6, q_subtype=601 |
| Exam cloze | q_type=6, q_subtype=602 |

## Survey Types (atype)

| atype | Name | API Creatable |
|-------|------|--------------|
| 1 | Survey (调查) | Yes |
| 2 | Assessment (测评) | Yes |
| 3 | Vote (投票) | Yes |
| 4 | 360 Assessment | No |
| 5 | 360 (no assessment) | No |
| 6 | Exam (考试) | Yes |
| 7 | Form (表单) | Yes |
| 8 | User System | No |
| 9 | Teaching Evaluation | No |
| 10 | Scale (量表) | No |
| 11 | Democratic Review | No |
