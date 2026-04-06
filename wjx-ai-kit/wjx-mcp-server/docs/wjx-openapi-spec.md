# 问卷星 OpenAPI 接口文档

> 来源: https://openapi.wjx.cn/web/#/5

---

## 接口规范

[TOC]

`注：如果您已经自定义域名，请将接口地址中的域名www.wjx.cn换成自定义域名`

1、接口仅支持`post`请求，`json`的数据格式，需要在` http header`中设置 `Content-Type:application/json`。
2、接口使用`Utf-8`编号；
3、以键值对的方式传递参数；
4、可在接口地址后统一加上`?traceid=xxx&action=xxx`来方便跟踪定位；
5、QPS(每秒最大请求数)限制，参见[3.1 数据接口列表](https://www.showdoc.com.cn/wjxopenapi/7565183782246685 "3.1 数据接口列表")中对各接口的限制；
6、公共参数说明如下：

#### GET请求参数列表：

|字段|类型|是否必须|默认|说明|
|:---    |:------    |--- |-|--------      |
|traceid	  |varchar     |否	|	 | 1:为方便跟踪请求定位问题，建议添加<br> 2:值为全局唯一标识符（GUID，Globally Unique Identifier） <br> 3:GUID值采用32位全小写格式，不含“-”  <br> 4:参与签名<br> 5:traceid参数不要放在POST参数中     |

#### POST请求参数列表：

|字段|类型|是否必须|默认|说明|
|:---    |:------    |--- |-|--------      |
|appid	  |varchar     |是	|	 | 开发ID，开发密钥appkey请联系客户顾问获取   |
|ts	  |varchar     |是	|	 | Unix时间戳（格林威治时间1970年01月01日00时00分00秒起至现在的总秒数）主要用于请求有效期检查的，过期时间为30秒   |
|encode	  |varchar     |否	|	 | 签名验证方式，支持SHA1、SHA256、SHA384、SHA512、SM3，不填默认为SHA1   |
|nocache	  |varchar     |否	|	 | 可选参数，指定查询类接口是否使用缓存，默认值为0；使用缓存，1：不使用缓存   |
|action	  |varchar     |是	|	 | 请求的接口编号，参见3.1 数据接口列表   |
|sign	  |varchar     |是	|	 | sign计算方法：<br>1、对消息体所有参数的参数名按ASCII码字母顺序进行排序；<br>2、根据排序参数名拼接对应的参数值；<br>3、将appkey加上所得的拼接字符串最后，得到加密原串；<br>4、对加密原串进行SHA1（默认）加密得到sign值；<br>5、 appid，appkey请联系客户顾问获取；|


#### 响应参数列表：

|字段|类型|说明|
|:---    |:------    |--- |-|--------      |
|result	  |boolean   | true/false  |
|data	  |object    | 值为true时，data为返回的接口数据  |
|errormsg |varchar   | 值为false时，errormsg为返回的错误描述  |

#### sign计算示例代码如下
C#代码：
```csharp
string url = "https://" + host + "/openapi/default.aspx";
//时间截，用于判断请求的过期时间
string ts = Convert.ToInt64((DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, 0)).TotalSeconds).ToString();
//使用排序字典来构造参数
SortedDictionary<string, string> dic = new SortedDictionary<string, string>();
dic.Add("appid", appid);
dic.Add("ts", ts);
dic.Add("action", "1000001");
dic.Add("vid", vid);
dic.Add("get_questions", "0");
dic.Add("get_items", "0");
StringBuilder toSign = new StringBuilder();
foreach (var kv in dic)
{
    if (!string.IsNullOrEmpty(kv.Value))
    {
        toSign.Append(kv.Value);
    }
}
//在拼接好的toSign基础上再加上appkey，组成最终的签名原串
toSign.Append(appkey);
//计算SHA1签名值，并将签名值转化为小写格式
string wjxSign = System.Web.Security.FormsAuthentication.HashPasswordForStoringInConfigFile(toSign.ToString(), "SHA1").ToLower();
//将签名sign添加到参数中
dic.Add("sign", wjxSign);
string content = JsonConvert.SerializeObject(dic);
string data = HttpRequestUtility.SendPostHttpRequest(url, "application/json", content);
```

Java代码：
```java
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.OutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Date;
import java.util.SortedMap;
import java.util.TreeMap;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Main {
    public static void main(String[] args) throws Exception {
        String host = "your_host";
        String appid = "your_appid";
        String vid = "your_vid";
        String appkey = "your_appkey";

        String url = "https://" + host + "/openapi/default.aspx";
        
        // 时间截，用于判断请求的过期时间
        long ts = (new Date().getTime() / 1000) - (new Date(0).getTime() / 1000);
        
        // 使用排序字典来构造参数
        SortedMap<String, String> dic = new TreeMap<>();
        dic.put("appid", appid);
        dic.put("ts", String.valueOf(ts));
        dic.put("action", "1000001");
        dic.put("vid", vid);
        dic.put("get_questions", "0");
        dic.put("get_items", "0");
        
        StringBuilder toSign = new StringBuilder();
        for (Map.Entry<String, String> kv : dic.entrySet()) {
            if (kv.getValue() != null && !kv.getValue().isEmpty()) {
                toSign.append(kv.getValue());
            }
        }
        
        // 在拼接好的toSign基础上再加上appkey，组成最终的签名原串
        toSign.append(appkey);
        
        // 计算SHA1签名值，并将签名值转化为小写格式
        String wjxSign = getSHA1(toSign.toString()).toLowerCase();
        
        // 将签名sign添加到参数中
        dic.put("sign", wjxSign);
        
        String content = new ObjectMapper().writeValueAsString(dic);
        
        String data = sendPostHttpRequest(url, content);
        System.out.println(data);
    }

    private static String getSHA1(String str) throws NoSuchAlgorithmException {
        MessageDigest messageDigest = MessageDigest.getInstance("SHA-1");
        messageDigest.update(str.getBytes());
        byte[] sha1Hash = messageDigest.digest();
        
        StringBuilder hexString = new StringBuilder();
        for (byte b : sha1Hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }

    private static String sendPostHttpRequest(String urlString, String json) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setDoOutput(true);
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = json.getBytes("utf-8");
            os.write(input, 0, input.length);           
        }

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), "utf-8"))) {
            StringBuilder response = new StringBuilder();
            String responseLine = null;
            while ((responseLine = br.readLine()) != null) {
                response.append(responseLine.trim());
            }
            return response.toString();
        }
    }
}
```

---

## 2.1.6 创建问卷[1000101]

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/default.aspx`

-  # 2.1.6.1 请求参数格式

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|creater	|string	|创建者	|否	|默认使用主账户创建问卷，也可指定子账户来创建问卷，子账户必须有系统管理员或问卷管理员权限|
|source_vid	|string	|需要复制的问卷ID	|否	|复制其他问卷来创建新问卷，注：填写该参数后，atype、desc、compress_img、questions无需传入|
|atype	|int	|问卷类型	|是	|参见[3.2 问卷类型](https://openapi.wjx.cn/web/#/5/56 "3.2 问卷类型")|
|title	|string	|问卷名称	|是	||
|desc	|string	|问卷描述	|是	||
|publish	|bool	|是否发布问卷	|否	|默认不发布问卷|
|compress_img	|bool	|是否图片压缩	|否	|默认为false|
|is_string	|bool	|是否字符串提交	|否	|默认为false，考试投票类型问卷建议传true|
|questions	|String(question[])	|题目列表	|是	|**·** 参见<br>**·** 创建问卷时将以题目列表顺序依次添加问卷题目<br>**·** 需要将question[]对象转成字符串|

- # 2.1.6.2分页参数（page）

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	|int	|分页编号	|是	||
|q_type	|int	|题目类型	|是	|参见[3.3 题目类型](https://openapi.wjx.cn/web/#/5/57 "3.3 题目类型")|
|is_zhenbie	|bool	|是否是甄别页	|否	|默认为false|
|min_time	|int	|最短填写时间，单位为秒	|否	|默认为0|
|max_time	|int	|最长填写时间，单位为秒	|否	|默认为0|

-  举例
```csharp
{
    "q_index": 1,
    "q_type": 1,
    "is_zhenbie": true,
    "min_time": 10,
    "max_time": 100
}
```
- # 2.1.6.3段落参数（cut）

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_type	|int	|题目类型	|是	|参见[3.3 题目类型](https://openapi.wjx.cn/web/#/5/57 "3.3 题目类型")|
|q_title	|string	|问题标题	|是	|||

- 样例：
```csharp
{
	"q_type": 2,
    "q_title": "这是段落说明文字"
}
```
- # 2.1.6.4 题目参数（question）

## 2.1.6.4.1 通用题目属性（所有题型均包含这些属性）

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	|int	|题目编号	|是	||
|q_type	|int	|题目类型	|是	|参见3.3 题目类型|
|q_subtype	|int	|题目细分类	|否	|默认即当前主题型<br>参见[3.4题目细分类型](https://openapi.wjx.cn/web/#/5/58 "3.4题目细分类型")|
|q_title	|string	|问题标题	|是	||
|is_requir	|bool	|是否必填	|是	|默认为true|
|q_ceshi	|bool	|是否是考试	|否	|默认为false|
|q_score	|doule	|问题分值	|否	|默认为0|
|q_parsing	|string	|题目解析	|否	|默认为空|
|prompt	|string	|填写提示	|否	|默认为空|

## 2.1.6.4.2 单选题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|has_value	|bool	|是否有值	|否	|默认为false|
|choice_random	|bool	|是否选项随机	|否	|默认为false|
|description	|string	|针对所有选项的说明文字	|否	|默认为空|
|style	|int	|单选题展现形式	|否	|默认为常规<br>常规 = 0,<br>分值 = 1,<br>星级 = 2,<br>点赞 = 3,<br>条形 = 6,<br>描述 = 101,|
|items	|item[]	|问题选项列表	|否	|参见<a href="#2.1.6.5.2">2.1.6.5.2 item选项</a>|

- 样例：
```csharp
{
	questions:"[
    {
        "is_zhenbie": false, 
        "min_time": 0, 
        "max_time": 0, 
        "q_index": 1, 
        "q_type": 1, 
        "q_subtype": 1, 
        "q_title": "", 
        "is_requir": true, 
        "has_jump": false
    }, 
    {
        "items": [
            {
                "item_image": "//pubnew.paperol.cn/111597/1627266907Hm3eNb.png?x-oss-process=image/quality,q_90/resize,w_705", 
                "q_index": 1, 
                "item_index": 1, 
                "item_title": "对", 
                "item_image_text": "这是选项说明1", 
                "item_selected": true
            }, 
            {
                "item_image": "//pubnew.paperol.cn/111597/162726691563CzHK.png", 
                "q_index": 1, 
                "item_index": 2, 
                "item_title": "错", 
                "item_image_text": "这是选项说明2", 
                "item_selected": false
            }
        ], 
        "q_index": 1, 
        "q_type": 3, 
        "q_subtype": 305, 
        "q_title": "标题", 
        "is_requir": true, 
        "has_jump": false, 
        "is_panduan": true, 
        "is_toupiao": 3, 
        "has_value": true, 
        "q_ceshi": true, 
        "q_score": 5, 
        "q_parsing": "这是答案解析", 
        "prompt": "这是填写提示"
    }, 
    {
        "items": [
            {
                "item_image": "", 
                "q_index": 2, 
                "item_index": 1, 
                "item_title": "选项1", 
                "item_score": 0, 
                "item_selected": true
            }, 
            {
                "item_image": "", 
                "q_index": 2, 
                "item_index": 2, 
                "item_title": "选项2", 
                "item_score": 0, 
                "item_selected": false
            }, 
            {
                "item_image": "", 
                "q_index": 2, 
                "item_index": 3, 
                "item_title": "选项6", 
                "item_score": 0, 
                "item_selected": false
            }
        ], 
        "q_index": 2, 
        "q_type": 4, 
        "q_subtype": 401, 
        "q_title": "标题", 
        "is_requir": true, 
        "has_jump": false, 
        "is_partscore": false, 
        "fixed_partscore": 0, 
        "is_toupiao": 3, 
        "has_value": true, 
        "q_ceshi": true, 
        "q_score": 5
    }
]"
}
```
## 2.1.6.4.3 多选题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|items	|item[]	|问题选项列表	|是	|参见<a href="#2.1.6.5.2">2.1.6.5.2 item选项</a>|
|has_value	|bool	|是否有值	|否	|默认为false|
|choice_random	|bool	|是否选项随机	|否	|默认为false|
|description	|string	|针对所有选项的说明文字	|否	|默认为空|
|check_mode	|int	|多选题模式	|否	|Mode=1表示排序题|
|is_toupiao	|int	|是否是投票	|否	|1：投票<br>2：测评<br>3：考试|
|is_partscore	|bool	|少选得部分分值	|否	|默认为false|
|fixed_partscore	|doule	|少选得固定分值	|否	|默认为0|
|min_options	|int	|至少选项数	|否	|默认为0，不生效|
|max_options	|int	|至多选项数	|否	|默认为0，不生效|
|is_shop	|bool	|是否是商品题型	|否	|默认为false|
|has_payment_channel	|bool	|是否设置了支付方式	|否	|默认为false|
|min_shoptype	|int	|最少购买商品种数	|否	|默认为0，不生效|
|max_shoptype	|int	|最多购买商品种数	|否	|默认为0，不生效|

- 样例：
```csharp
{
	"q_index": 1,
	"q_type": 4,
	"q_subtype": 4,
	"q_title": "标题",
	"items": [
		{
			"q_index": 1,
			"item_index": 1,
			"item_title": "选项2"
		},
		{
			"q_index": 1,
			"item_index": 2,
			"item_title": "选项3"
		},
		{
			"q_index": 1,
			"item_index": 3,
			"item_title": "选项4"
		}
	],
}
```

## 2.1.6.4.4 填空题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|verify	|int	|效验类型	|否	|**·** 默认为0，即不验证<br>**·** 参见[3.5 文本校验类型](https://openapi.wjx.cn/web/#/5/59 "3.5 文本校验类型")|
|need_only	|bool	|是否要求填写唯一	|否	|默认为false|
|default_value	|string	|默认值	|否	|默认为空|
|answer	|string	|填空答案	|否	|默认为空|
|include_keyword	|bool	|是否包含答案即可	|否	|默认为false|
|case_sensitive	|bool	|答案是否区分大小写	|否	|默认为false|
|punctuation_sensitive	|bool	|答案是否区分标点符号	|否	|默认为false|
|level_data	|string	|多级下拉菜单内容	|否	|**·** verify=24和verify=27包含此参数<br>**·** 默认为空|
|allow_search	|bool	|多级下拉是否允许搜索	|否	|**·** verify=24是包含此参数<br>**·** 默认为false|
|height	|int	|高度（行数）	|否	|默认为0，不生效|
|width	|int	|宽度	|否	|默认为0，不生效|
|min_words	|int	|最小字数	|否	|默认为0，不生效|
|max_words	|int	|最大字数	|否	|默认为0，不生效|
|need_sms_verify	|bool	|使用短信验证	|否	|**·** verify=4是包含此参数<br>**·** 默认为false|
|date_limit	|bool	|是否控制日期范围	|否	|**·** verify=3是包含此参数<br>**·** 默认为false|
|start_date_limit	|int	|日期开始时间	|否	|**·** verify=3是包含此参数<br>**·** 默认不带入参数，即不生效<br>**·** 参数值含义如下：<br>0：当天<br>1：当前日期1天后<br>2：当前日期2天后<br>3：当前日期3天后<br>4：当前日期4天后<br>5：当前日期5天后<br>6：当前日期6天后<br>7：当前日期7天后|
|end_date_limit	|int	|日期结束时间	|否	|**·** verify=3是包含此参数<br>**·** 默认不带入参数，即不生效<br>**·** 参数值含义如下：<br>-1：不限制<br>0：起始日期1天内<br>1：起始日期2天内<br>2：起始日期3天内<br>3：起始日期4天内<br>4：起始日期5天内<br>5：起始日期6天内<br>6：起始日期7天内

- 样例：
```csharp
{
	"q_index": 1,
}
```

## 2.1.6.4.5 多项填空题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_rows	|itemrow[]	|问题选项列表	|是	|参见<a href="#2.1.6.5.1">2.1.6.5.1 itemrow选项</a>|
|gap_count	|int	|填空数量	|是	||
|is_cloze	|bool	|是否是完型填空	|否	|默认为false|
|case_sensitive	|bool	|答案是否区分大小写	|否	|默认为false|
|punctuation_sensitive	|bool	|答案是否区分标点符号	|否	|默认为false|
|use_textbox	|bool	|是否使用文本框样式	|否	|默认为false|

- 样例：
```csharp
{
	"q_index": 1,
	"q_type": 6,
	"q_subtype": 6,
	"q_title": "姓名：_________;年龄：___岁<br>\n电话：____________",
	"is_requir": true,
	"has_jump": false,
	"gap_count": 3,
	"itemrows": [
		{
			"q_index": 1,
			"item_index": 1,
			"item_title": "姓名：___",
		},
		{
			"q_index": 1,
			"item_index": 2,
			"item_title": "年龄：___岁",
		},
		{
			"q_index": 1,
			"item_index": 3,
			"item_title": "电话：___",
		}
	]
}
```

## 2.1.6.4.6 矩阵题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_rows	|itemrow[]	|问题行标题	|是	|参见<a href="#2.1.6.5.1">2.1.6.5.1 itemrow选项</a>|
|item_columns	|itemrowtitle[]	|问题列标题	|否	|参见[2.1.1.6.3 itemrowtitle选项](https://openapi.wjx.cn/web/#/5/34 "2.1.1.6.3 itemrowtitle选项")|
|items	|item[]	|问题选项列表	|否	|参见<a href="#2.1.6.5.2">2.1.6.5.2 item选项</a>|
|item_right_rows	|itemrow[]	|问题右行标题	|否	|参见<a href="#2.1.6.5.1">2.1.6.5.1 itemrow选项</a>|
|matrix_mode	|int 	|矩阵模式	|是	|参见[3.6 矩阵展现形式](https://openapi.wjx.cn/web/#/5/60 "3.6 矩阵展现形式")|
|table_mode	|int	|表格模式	|否	|参见[3.7 表格展现形式](https://openapi.wjx.cn/web/#/5/61 "3.7 表格展现形式")|
|style_mode	|int	|表格模式	|是	|0：常规，默认<br>1：分值<br>101：描述<br>2：星级<br>3：点赞<br>6：条形|
|has_value	|bool	|是否有值	|否	|默认为false|
|is_random_row	|bool	|是否行标题随机	|否	|默认为false|
|use_row_daozhi	|bool	|是否启用行列倒置	|否	|默认为false|
|has_part_requir	|bool	|选项列表是否存在部分必答的情况	|否	|默认为false|
|allow_digit	|bool	|是否允许小数	|否	|默认为false|
|min_rows	|int	|自增表格题默认显示行数	|否	|默认为0，不生效|
|max_rows	|int	|自增表格题最大允许行数	|否	|默认为0，不生效|

- 矩阵填空样例：
```csharp
{
	"q_index": 1,
	"q_type": 7,
	"q_subtype": 709,
	"matrix_mode": 302,
	"table_mode": 1,
	"style_mode": 0,
	"q_title": "标题",
	"item_rows": [
		{
			"q_index": 1,
			"item_index": 1,
			"item_title": "成员1"
		},
		{
			"q_index": 1,
			"item_index": 2,
			"item_title": "成员2"
		}
	],
	"item_columns": [
		{
			"q_index": 1,
			"item_index": 1,
			"item_title": "姓名",
			"min_words": 3,
			"max_words": 6
		},
		{
			"q_index": 1,
			"item_index": 2,
			"item_title": "年龄",
			"verify": 1,
			"min_words": 2,
			"max_words": 10
		},
		{
			"q_index": 1,
			"item_index": 3,
			"item_title": "性别",
			"verify": 5,
			"item_choice": "男,女"
		}
	]
}
```
- 矩阵量表样例：
```csharp
{
		"q_index": 1,
        "style_mode": 0,
        "q_title": "写在后台的标题",
		"q_type": 7,
        "matrix_mode": 101,
        "items": [{
                "item_score": "0",
                "item_title": "A0"
        }, {
                "item_score": "1",
                "item_title": "A1"
        }, {
                "item_score": "2",
                "item_title": "A2"
        }, {
                "item_score": "3",
                "item_title": "A3"
        }, {
                "item_score": "4",
                "item_title": "A4"
        }],
        "item_rows": [{
                "item_index": 1,
                "q_index": 1,
                "item_title": "第1行标题11"
        }, {
                "item_index": 2,
                "q_index": 2,
                "item_title": "第2行标题22"
        }, {
                "item_index": 3,
                "q_index": 3,
                "item_title": "第3行标题33"
        }]
}
```

## 2.1.6.4.7文件上传题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|width	|int	|显示宽度	|否	|默认为200|
|ext	|string	|上传文件后缀	|否	|默认为空，不限制|
|max_size	|int	|上传文件大小限制	|否	|默认为4096KB|
|max_length	|int	|上传文件个数限制	|否	|默认为1|
|is_drawing	|bool	|是否是绘图题	|否	|仅绘图题时包含此参数值|
|high_size	|int	|绘图板高度	|否	|仅绘图题时包含此参数值|
|drawing_bg	|string	|绘图板背景图片	|否	|仅绘图题时包含此参数值|

- 样例：
```csharp
{
	"q_index": 1,
	"q_type": 8,
	"q_subtype": 8,
	"q_title": "这是文件上传题",
	"ext": ".gif|.png|.jpg|.jpeg|.bmp|.doc|.docx|.pdf|.xls|.xlsx|.ppt|.pptx|.txt|.rar|.zip|.gzip",
	"max_size": 4096,
	"max_length": 1
}
```

## 2.1.6.4.8比重题

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|total	|int	|可分配的总比重值	|是	|默认为100|
|row_width	|int	|行标题宽度	|是	|默认为15|

- 样例：
```csharp
{
	"q_index": 1,
	"q_type": 9,
	"q_subtype": 9,
	"q_title": "标题",
	"total": 150
}
```

## 2.1.6.4.9滑动条

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|min_value	|int	|最小值	|是	|默认为0|
|max_value	|int	|最大值	|是	|默认为100|
|min_value_text	|string	|最小值描述	|否	|默认为空|
|max_value_text	|string	|最大值描述	|否	|默认为空|

- 样例：
```csharp
{
	"q_index": 2,
	"q_type": 10,
	"q_subtype": 10,
	"q_title": "标题",
	"min_value": 0,
	"max_value": 100,
	"min_value_text": "非常不满意",
	"max_value_text": "非常满意",
	"prompt": "这是填写提示"
}
```

- # 2.1.6.5 题目选项对象参数(item)

<div id="2.1.6.5.1"></div>
## 2.1.6.5.1 itemrow选项（所有选项均包含此属性）

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	|int	|问题编号	|是	||
|item_index	|int	|选项编号	|是	||
|item_title	|string	|选项标题	|是	|||

<div id="2.1.6.5.2"></div>
## 2.1.6.5.2 item选项

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_score	|string	|选项分值	|是	|**·** 当为商品题时，值为商品的价格<br>**·** 当为情景题时，值为情景的数量限制|
|item_max	|int	|矩阵题中，选项可选择的最大次数	|否	|矩阵题才有|
|item_selected	|bool	|默认选中	|否	|为考试时，默认选中的选项为正确答案|
|allow_filltext	|bool	|允许填空	|否	|选择题才有|
|is_item_required	|bool	|允许填空时，是否必填	|否	|选择题才有|
|item_image	|string	|选项图片引用	|否	|选择题才有|
|item_image_text	|string	|选项文字描述，可以是文字描述或Url引用	|否	|选择题才有|
|is_item_huchi	|bool	|选项是否互斥，仅对多选题有用	|否	|多选题才有|
|shop_unit	|string	|购买商品单位	|否	|商品题才有|
|min_shopnum	|int	|购买商品最小数量	|否	|商品题才有|
|max_shopnum	|int	|购买商品最大数量	|否	|商品题才有|
|item_jump	|int	|跳转至对应编号的题目	|否	|**·** 选择题或商品题才有<br>**·** 商品题时代表总库存<br>**·** 0:代表不跳转按顺序填写下一题<br>**·** 1:代表跳转到问卷末尾结束作答<br>**·** -1:代表直接提交为无效答卷|

## 2.1.6.5.3 itemrowtitle选项

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|verify	|int	|文本效验类型	|否	|参见[3.5 文本校验类型](https://openapi.wjx.cn/web/#/5/59 "3.5 文本校验类型")|
|is_requir	|bool	|是否是必答项	|否	||
|need_only	|bool	|是否检查唯一性	|否	||
|item_choice	|string	|下拉选项，用逗号分隔	|否	||
|min_words	|int	|最小字数	|否	||
|max_words	|int	|最大字数	|否	||
|ext	|string	|上传文件后缀	|否	|默认为空，不限制|
|max_size	|int	|上传文件大小限制	|否	|默认为4096KB|


- 样例：
```csharp
Content-Type:application/json
{
    "encode": "sha1",
    "vid": "91432",
    "appid": "10001",
    "sign": "d2050d70204bc2fd98e60cfe34cd6f2501500078",
    "action": "1000001",
    "ts": 1583812686
}
```

- # 2.1.6.6响应参数列表：

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	|int	|问卷编号	|是	||
|sid	|string	|问卷短编号	|是	|sid等于vid时，表示问卷未启用短链接|
|status	|int	|问卷状态	|是	|参见[3.8 问卷状态](https://openapi.wjx.cn/web/#/5/62 "3.8 问卷状态")|
|verify_status	|int	|问卷审核状态	|是	|参见[3.9 问卷审核状态](https://openapi.wjx.cn/web/#/5/63 "3.9 问卷审核状态")|
|pc_path	|string	|PC端问卷Url相对路径	|是	||
|mobile_path	|string	|移动端问卷Url相对路径	|是	||
|activity_domain	|string	|问卷访问域名	|是	||
|iframe_auto_url	|string	|iframe自适应链接	|是	||
|iframe_noauto_url	|string	|iframe不自适应链接	|是	|||


---

## 2.1.1获取问卷内容[1000001]

[TOC]

# 接口地址

生产环境：`https://www.wjx.cn/openapi/default.aspx` 
如果已经使用自定义域名，请求`www.wjx.cn` 换成相应的自定义域名；

-  # 2.1.1.1 请求参数格式

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	  |int   | 问卷编号 | 是 | 问卷星后台管理界面获取；如：问卷链接中activityid |
|get_questions	  |bool    | 是否获取题目信息  |否 | **·**“0”或false：不获取<br>**·**“1”或true：获取 <br>**·** 默认为true |
|get_items	  |bool    | 是否获取题目选项信息  |否 | **·**“0”或false：不获取<br>**·**“1”或true：获取 <br>**·** 默认为true |
|get_exts |bool   | 是否获取问答选项列表  |否 | **·**“0”或false：不获取<br>**·**“1”或true：获取 <br>**·** 默认为false |
|get_setting |bool   | 是否获取题目设置信息  |否 | **·**“0”或false：不获取<br>**·**“1”或true：获取 <br>**·** 默认为false |
|get_page_cut |bool   | 是否获取分页信息  |否 | **·**“0”或false：不获取<br>**·**“1”或true：获取 <br>**·** 默认为false |
|get_tags |bool   | 是否获取绑定的题目标签信息  |否 | **·**“0”或false：不获取<br>**·**“1”或true：获取 <br>**·** 默认为false |
|get_simple_return |bool   | 是否返回简洁数据  |否 | **·**“0”或false：不返回简洁数据<br>**·**“1”或true：返回简洁数据 <br>**·** 默认为false<br>**·** 传“1”或true时:参数`get_questions`、`get_items`、<br>`get_exts`、`get_setting`、`get_page_cut`失效 |
|get_json |bool   | data数据是否返回json格式  |否 | **·** 仅`get_simple_return`为true时生效<br>**·**“0”或false：不返回json<br>**·**“1”或true：返回 <br>**·** 默认为false |
|showtitle |string   | 是否返回问卷标题  |否 | **·** 仅`get_json`为true时有效<br>**·**“0”：不返回<br>**·**“1”：返回 <br>**·** 默认为“0” |

-  举例1(完整模式-<a href="#fhsl.1">返回示例</a>)

```csharp
Content-Type:application/json
{
    "encode": "sha1",
    "vid": "91432",
    "appid": "10001",
    "sign": "d2050d70204bc2fd98e60cfe34cd6f2501500078",
    "action": "1000001",
    "ts": 1583812686
}
```
-  # 2.1.1.2 响应参数列表
-  ## 2.1.1.2.1完整模式

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	  |int   | 问卷编号 | 是 |  |
|begin_time	  |string    | 问卷开始时间  |是 | 时间格式：yyyy-MM-dd HH:mm:ss；|
|update_time |string   | 问卷最近更新时间  |是 | 时间格式：yyyy-MM-dd HH:mm:ss； |
|version |int   | 问卷版本  |是 | 数值递增 |
|atype |int   | 问卷类型  |是 | 参见[3.2 问卷类型](https://openapi.wjx.cn/web/#/5/56 "3.2 问卷类型") |
|title |string   | 问卷名称  |是 |  |
|description |string   | 问卷描述  |是 |  |
|notes |string   | 问卷备注  |是 |  |
|compress_img |bool   | 是否图片压缩  |否 | 默认为false |
|status |int   | 问卷状态  |是 | 参见[3.8问卷状态](https://openapi.wjx.cn/web/#/5/62 "3.8问卷状态") |
|verify_status |int   | 问卷审核状态  |是 | 参见[3.9问卷审核状态](https://openapi.wjx.cn/web/#/5/63 "3.9问卷审核状态") |
|answer_valid |int   | 有效答卷数  |是 |  |
|answer_total |int   | 答卷总数  |是 |  |
|questions |question[]   | 题目列表  |否 | **·** 参见<a href="#2.1.1.5">2.1.1.5题目对象参数（question）</a><br>**·** get_questions为false时为空 <br>**·** 题目列表按问卷设计的题目顺序依次排列|
|q_extractions |Dictionary<int, qextraction>   |题目扩展信息  |否 | **·** 主键为题目编号<br>**·** 值为答案对应题目扩展选项<br>**·** 属性参见 <a href="#2.1.2.7">2.1.2.7 题目扩展对象(qextraction)</a><br>**·** get_exts为false时，值为空|

-  ## 2.1.1.2.2简洁模式

参数get_json=false时

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|data	  |string   | 问卷内容 | 是 |  |

get_json=true

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|Title	  |string   | 问卷标题 | 否 | showtitle=1时返回 |
|Questions	  |Questionaire   | 问卷内容 | 是 | <a href="#2.1.2.8">Questionaire类型参考2.1.2.8</a> |


-  举例2（简洁模式-<a href="#fhsl.2">返回示例</a>）
```csharp
Content-Type:application/json
{
    "encode": "sha1",
    "vid": "108169",
    "appid": "10001",
    "sign": "d2050d70204bc2fd98e60cfe34cd6f2501500078",
    "action": "1000001",
    "get_simple_return":true,
    "ts": 1583812686
}
```

-  举例3（简洁模式-<a href="#fhsl.3">返回示例</a>）
```csharp
Content-Type:application/json
{
    "encode": "sha1",
    "vid": "108169",
    "appid": "10001",
    "sign": "d2050d70204bc2fd98e60cfe34cd6f2501500078",
    "action": "1000001",
    "get_simple_return":true,
    "get_json":true,
    "showtitle":"1",
    "ts": 1583812686
}
```

get_simple_return为true返回序号解释：（<a href="#fhsl.2">返回示例</a>）
1. q1、q2、q3以此类推，代表每个题目的题干文字。
2. 选择类的题目，q1#1、q1#2、q1#3分别代表第一个题的第一个、第二个、第三个选项。
3. 多项填空题，只提供题干整体文本。
4. 如果是矩阵单选或矩阵多选题，q1是题干文本，q1_1,q1_2是矩阵题的第一个、第二个左行标题，q1_1#1,q1_1#2分别是矩阵题第一个左行标题的，第一个选项、第二个选项内容。
5. 矩阵填空，数据推送的时候直接推送的是选项内容，无需获取选项文本。类似的还有矩阵滑动条、表格下拉框、表格数值、表格文本题。
6. 考试问卷，不包含正确答案的信息。

-  # 2.1.1.3 分页参数（page）

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	  |int   | 分页编号 | 是 |  |
|q_type	  |int   | 题目类型 | 是 | 参见[3.3题目类型](https://openapi.wjx.cn/web/#/5/57 "3.3题目类型") |
|is_zhenbie	  |bool   | 是否是甄别页 | 否 | 默认为false |
|min_time	  |int   | 最短填写时间，单位为秒 | 否 | 默认为0 |
|max_time	  |int   | 最长填写时间，单位为秒 | 否 | 默认为0 |

-  # 2.1.1.4 段落参数（cut）

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	  |int   | 题目编号 | 是 |  |
|q_type	  |int   | 题目类型 | 是 | 参见[3.3题目类型](https://openapi.wjx.cn/web/#/5/57 "3.3题目类型") |
|q_title	  |string   | 问题标题 | 是 |  ||

<div id = "2.1.1.5"></div>

- #  2.1.1.5 题目对象参数（question）

## 2.1.1.5.1 通用题目属性（所有题型均包含此属性）

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	  |int   | 题目编号 | 是 |  |
|q_type	  |int   | 题目类型 | 是 | 参见[3.3题目类型](https://openapi.wjx.cn/web/#/5/57 "3.3题目类型") |
|q_subtype	  |int   | 题目细分类 | 是 | 参见[3.4题目细分类型](https://openapi.wjx.cn/web/#/5/58 "3.4题目细分类型") |
|q_title	  |string   | 问题标题 | 是 |  |
|is_requir	  |bool   | 是否必填 | 是 | 默认为true |
|has_jump	  |bool   | 是否有跳题逻辑 | 是 | 默认为false |
|is_hide	  |bool   | 是否隐藏题 | 是 | 默认为false |
|q_ceshi	  |bool   | 是否是考试 | 否 | 默认为false |
|is_manual_score	  |bool   | 是否需人工阅卷 | 否 | 考试问卷生效，默认为false |
|is_ai_grading	  |bool   | 是否是ai阅卷 | 否 | 考试问卷生效，默认为false |
|q_score	  |doule   | 问题分值 | 否 | 默认为0 |
|q_parsing	  |string   | 题目解析 | 否 | 默认为空 |
|prompt	  |string   | 填写提示 | 否 | 默认为空 |

 ## 2.1.1.5.2 单选题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|items	  | item[]  | 问题选项列表 | 否 | 参见<a href="#2.1.1.6.2">2.1.1.6.2item选项</a> get_items为false时，值为空 |
|has_value	  |bool   | 是否有值 | 否 | 默认为false |
|choice_random	  |bool   | 是否选项随机 | 否 | 默认为false |
|description	  |string   | 针对所有选项的说明文字 | 否 | 默认为空 |
|style	  |int   | 单选题展现形式 | 否 | 默认为常规<br>常规 = 0,<br>分值 = 1,<br>星级 = 2,<br>点赞 = 3,<br>条形 = 6,<br>描述 = 101, |
|is_panduan	  |bool   | 是否为判断题 | 否 | 默认为false |
|is_qingjing	  |bool   | 是否是情景题 | 否 | 默认为false |
|is_nps	  |bool   | 是否是NPS量表题 | 否 | 默认为false |
|vector_level	  |int   | 量表等级 | 否 | 默认为0, 即此题并非量表题 |

## 2.1.1.5.3 多选题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|items	  |item[]   | 问题选项列表 | 否 | 参见<a href="#2.1.1.6.2">2.1.1.6.2item选项</a> get_items为false时，值为空 |
|has_value	  |bool   | 是否有值 | 否 | 默认为false |
|choice_random	  |bool   | 是否选项随机 | 否 | 默认为false |
|description	  |string   | 针对所有选项的说明文字 | 否 |默认为空  |
|check_mode	  |int   | 多选题模式 | 否 | Mode=1表示排序题 |
|is_partscore	  |bool   | 少选得部分分值 | 否 | 默认为false |
|fixed_partscore	  |doule   | 少选得固定分值 | 否 | 默认为0 |
|min_options	  |int   | 至少选项数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|max_options	  |int   | 至多选项数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|is_shop	  |bool   | 是否是商品题型 | 否 | 默认为false【get_setting为false时不返回】 |
|has_payment_channel	  |bool   | 是否设置了支付方式 | 否 | 默认为false【get_setting为false时不返回】 |
|min_shoptype	  |int   | 最少购买商品种数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|max_shoptype	  |int   | 最多购买商品种数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |

## 2.1.1.5.4 填空题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|verify	  |int   | 效验类型 | 否 | **·** 默认为0，即不验证<br>**·** 参见[3.5文本校验类型](https://openapi.wjx.cn/web/#/5/59 "3.5文本校验类型") |
|need_only	  |bool   | 是否要求填写唯一 | 否 | 默认为false |
|default_value	  |string   | 默认值 | 否 | 默认为空 |
|answer	  |string   | 填空答案 | 否 |默认为空  |
|include_keyword	  |bool   | 是否包含答案即可 | 否 | 默认为false |
|case_sensitive	  |bool   | 答案是否区分大小写 | 否 | 默认为false |
|punctuation_sensitive	  |bool   | 答案是否区分标点符号 | 否 | 默认为false |
|level_data	  |string   | 多级下拉菜单内容 | 否 | **·** verify=24和verify=27包含此参数<br>**·** 默认为空 |
|allow_search	  |bool   | 多级下拉是否允许搜索 | 否 | **·** verify=24是包含此参数<br>**·** 默认为false <br>【get_setting为false时不返回】|
|height	  |int   | 高度（行数） | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|width	  |int   | 宽度 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|min_words	  |int   | 最小字数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|max_words	  |int   | 最大字数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|need_sms_verify	  |bool   | 使用短信验证 | 否 | **·** verify=4是包含此参数<br>**·** 默认为false<br>get_setting为false时不返回】 |
|date_limit	  |bool   | 是否控制日期范围 | 否 | **·** verify=3是包含此参数<br>**·** 默认为false<br>【get_setting为false时不返回】 |
|start_date_limit	  |int   | 日期开始时间 | 否 | **·** verify=3是包含此参数<br>**·** 默认不带入参数，即不生效<br>**·** 参数值含义如下：<br>0：当天<br>1：当前日期1天后<br>2：当前日期2天后<br>3：当前日期3天后<br>4：当前日期4天后<br>5：当前日期5天后<br>6：当前日期6天后<br>7：当前日期7天后<br>【get_setting为false时不返回】 |
|end_date_limit	  |int   | 日期结束时间 | 否 | **·** verify=3是包含此参数<br>**·** 默认不带入参数，即不生效<br>**·** 参数值含义如下：<br>-1：不限制<br>0：当前日期1天后<br>1：当前日期2天后<br>2：当前日期3天后<br>3：当前日期4天后<br>4：当前日期5天后<br>5：当前日期6天后<br>6：当前日期7天后<br>【get_setting为false时不返回】 |

## 2.1.1.5.5 多项填空题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_rows	  |itemrow[]   | 问题选项列表 | 是 | 参见<a href="#2.1.1.6.1">2.1.1.6.1itemrow选项</a> |
|gap_count	  |int   | 填空数量 | 是 |  |
|is_cloze	  |bool   | 是否是完型填空 | 否 | 默认为false |
|case_sensitive	  |bool   | 答案是否区分大小写 | 否 |默认为false  |
|punctuation_sensitive	  |bool   | 答案是否区分标点符号 | 否 | 默认为false |
|use_textbox	  |bool   | 是否使用文本框样式 | 否 | 默认为false |

## 2.1.1.5.6 矩阵题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_rows	  |itemrow[]   | 问题行标题 | 是 | 参见<a href="#2.1.1.6.1">2.1.1.6.1itemrow选项</a> |
|item_columns	  |itemrowtitle[]   | 问题列标题 | 否 | 参见 [2.1.4.5.3 itemrowtitle选项](https://openapi.wjx.cn/web/#/5/37 "2.1.4.5.3 itemrowtitle选项") |
|items	  |item[]   | 问题选项列表 | 否 | 参见<a href="#2.1.1.6.2">2.1.1.6.2item选项 |
|item_right_rows	  |itemrow[]   | 问题右行标题 | 否 |参见<a href="#2.1.1.6.1">2.1.1.6.1itemrow选项</a>  |
|matrix_mode	  |int   | 矩阵模式 | 是 | 参见3.6 矩阵展现形式 |
|table_mode	  |int   | 表格模式 | 是 | 参见3.7 表格展现形式 |
|has_value	  |bool   | 是否有值 | 否 | 默认为false【get_setting为false时不返回】 |
|is_random_row	  |bool   | 是否行标题随机 | 否 | 默认为false【get_setting为false时不返回】 |
|use_row_daozhi	  |bool   | 是否启用行列倒置 | 否 | 默认为false【get_setting为false时不返回】 |
|has_part_requir	  |bool   | 选项列表是否存在部分必答的情况 | 否 | 默认为false【get_setting为false时不返回】 |
|allow_digit	  |bool   | 是否允许小数 | 否 | 默认为false【get_setting为false时不返回】 |
|min_rows	  |int   | 自增表格题默认显示行数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |
|max_rows	  |int   | 自增表格题最大允许行数 | 否 | 默认为0，不生效【get_setting为false时不返回】 |

## 2.1.1.5.7 文件上传题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|width	  |int   | 显示宽度 | 否 | 默认为200 |
|ext	  |string   | 上传文件后缀 | 否 | 默认为空，不限制 |
|max_size	  |int   | 上传文件大小限制 | 否 | 默认为4096KB |
|max_length	  |int   | 上传文件个数限制 | 否 | 默认为1 |
|is_drawing	  |bool   | 是否是绘图题 | 否 | 仅绘图题时包含此参数值 |
|high_size	  |int   | 绘图板高度 | 否 | 仅绘图题时包含此参数值 |
|drawing_bg	  |string   | 绘图板背景图片 | 否 | 仅绘图题时包含此参数值 |

## 2.1.1.5.8 比重题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|total	|int	|可分配的总比重值|	是|	默认为100|
|row_width|	int|	行标题宽度|	是|	默认为15|

## 2.1.1.5.9 滑动条

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|min_value	|int	|最小值	|是	|默认为0|
|max_value	|int	|最大值	|是	|默认为100|
|min_value_text	|string	|最小值描述	|否	|默认为空|
|max_value_text	|string	|最大值描述	|否	|默认为空|

- # 2.1.1.6 题目选项对象参数(item)
<div id = "2.1.1.6.1"></div>

## 2.1.1.6.1 itemrow选项（所有选项均包含此属性）

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	|int	|问题编号	|是	| |
|item_index	|int	|选项编号	|是	| |
|item_title	|string	|选项标题	|是	|  ||
<div id = "2.1.1.6.2"></div>
## 2.1.1.6.2 item选项

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_score	|string	|选项分值	|是	|**·** 当为商品题时,值为商品的价格<br>**·** 当为情景题时，值为情景的数量限制|
|item_max	|int	|矩阵题中，选项可选择的最大次数	|否	|矩阵题才有|
|item_selected	|bool	|默认选中	|否	|为考试时，默认选中的选项为正确答案|
|allow_filltext	|bool	|允许填空	|否	|选择题才有|
|is_item_required	|bool	|允许填空时，是否必填	|否	|选择题才有|
|item_image	|string	|选项图片引用	|否	|选择题才有|
|item_image_text	|string	|选项文字描述，可以是文字描述或Url引用	|否	|选择题才有|
|is_item_huchi	|bool	|选项是否互斥，仅对多选题有用	|否	|多选题才有|
|shop_unit	|string	|购买商品单位	|否	|商品题才有|
|min_shopnum	|int	|购买商品最小数量	|否	|商品题才有|
|max_shopnum	|int	|购买商品最大数量	|否	|商品题才有|
|item_jump	|int	|跳转至对应编号的题目	|否	|**·** 选择题或商品题才有<br>**·** 商品题时代表总库存<br>**·** 0:代表不跳转按顺序填写下一题<br>**·** 1:代表跳转到问卷末尾结束作答<br>**·** -1:代表直接提交为无效答卷|
|item_tag	|Dictionary<int, string[]>	|评价题标签	|否	|评价题才有，默认只有一条key为default的数据，开启分类后key为相应的类别名|

## 2.1.1.6.3 itemrowtitle选项

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|verify	|int	|文本效验类型	|否	|参见[3.5文本校验类型](https://openapi.wjx.cn/web/#/5/59 "3.5文本校验类型")|
|is_requir	|bool	|是否是必答项	|否	||
|need_only	|bool	|是否检查唯一性	|否	||
|item_choice	|string	|下拉选项，用逗号分隔	|否	||
|min_words	|int	|最小字数	|否	||
|max_words	|int	|最大字数	|否	||
|ext	|string	|上传文件后缀	|否	|默认为空，不限制|
|max_size	|int	|上传文件大小限制	|否	|默认为4096KB|
<div id = "2.1.2.7"></div>
- #2.1.2.7 题目扩展对象(qextraction)

## 2.1.2.7.0 公共参数

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_answerid	|int	|答案编号	|是	||
|q_index	|int	|题目编号	|是	||
|q_type	|int	|题目类型	|是	|参见[3.3 题目类型](https://openapi.wjx.cn/web/#/5/57 "3.3 题目类型")|
|q_subtype	|int	|题目细分类	|是	|参见[3.4题目细分类型](https://openapi.wjx.cn/web/#/5/58 "3.4 题目细分类型")|
不同题型差异部分：

## 2.1.2.7.1 单选题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_index	|int	|答案对应选项编号 	|是	||
|items	|item[]	|问题选项列表	|是	|参见<a href="#2.1.1.6.2">2.1.1.6.2item选项</a>|

## 2.1.2.7.2多选题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_index	|int	|答案对应选项编号 	|是	||
|item	|item	|问题选项	|是	|参见<a href="#2.1.1.6.2">2.1.1.6.2item选项</a>|

## 2.1.2.7.3 填空题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

## 2.1.2.7.4多项填空题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|q_index	|int	|题目编号	|是	||
|item	|item	|问题选项	|是	|参见2.1.1.6.2item选项|

## 2.1.2.7.5矩阵题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|item_row_index	|int	|矩阵行编号	|是	||
|item_col_index	|int|	矩阵列编号	|是	||
|items	|item[]	|问题选项列表	|是	|参见<a href="#2.1.1.6.2">2.1.1.6.2item选项</a>|
|item_right_rows	|itemrow	|问题右行标题	|是	|参见<a href="#2.1.1.6.1">2.1.1.6.1itemrow选项</a>|
|item_rows	|itemrow	|问题行标题	|是	|参见<a href="#2.1.1.6.1">2.1.1.6.1itemrow选项</a>|
|item_columns	|itemrowtitle	|问题列标题	|是	|参见[2.1.4.5.3 itemrowtitle选项](https://openapi.wjx.cn/web/#/5/37 "2.1.4.5.3 itemrowtitle选项")|

## 2.1.2.7.6文件上传题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

## 2.1.2.7.7比重题

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

## 2.1.2.7.8滑动条

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

<div id = "2.1.2.8"></div>
- #2.1.2.8 简洁模式对象

## 2.1.2.8.1 Questionaire对象

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|Id	|string	|题目编号	|是	||
|Title	|string	|题目标题	|是	||
|TypeName	|string	|题目类型	|是	||
|Info	|object	|多项填空、比重。矩阵题项目	|否	|举例：{"q1_1": "问答1", "q1_2": "问答2" }|
|Values	|List<Choice>	|选择题选项	|否	|<a href="#2.1.2.8.2">Choice类型参考2.1.2.8.2</a>|

<div id = "2.1.2.8.2"></div>
## 2.1.2.8.2简洁模式选项Choice类型

|字段|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|Id	|int	|选择项序号	|是	||
|Text	|string	|选择项文本内容	|是	||
|Image	|string	|选择项图片	|否	||
|ImageDesc	|string	|选择项图片描述	|否	|||

<div id = "fhsl.1"></div>
-  返回示例（完整模式）

```csharp
{
    "result": true,
    "data": {
        "vid": 91432,
        "begin_time": "2019-12-27 10:31:43",
        "update_time": "2019-12-27 10:31:43",
        "atype": 1,
        "title": "标题",
        "description": "我是描述",
		"notes": "我是备注",
        "version": 1,
        "answer_valid": 22,
        "answer_total": 22,
        "status": 1,
        "verify_status": 2,
        "questions": [
            {
                "items": [
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 1,
                        "item_title": "选项2",
                        "item_score": 1.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 2,
                        "item_title": "选项3",
                        "item_score": 2.0,
                        "item_selected": false
                    }
                ],
                "q_index": 1,
                "q_type": 3,
                "q_subtype": 3,
                "q_title": "标题",
                "is_requir": true,
                "has_jump": false,
				"is_hide": false,
                "tag_bind": [
                    {
                        "q_tagid": 449,
                        "q_tag": "维尔"
                    }
                ]
            },
            {
                "items": [
                    {
                        "item_image": "",
                        "q_index": 2,
                        "item_index": 1,
                        "item_title": "选项4",
                        "item_score": 1.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 2,
                        "item_index": 2,
                        "item_title": "选项5",
                        "item_score": 2.0,
                        "item_selected": false
                    }
                ],
                "q_index": 2,
                "q_type": 3,
                "q_subtype": 3,
                "q_title": "标题",
                "is_requir": true,
                "has_jump": false,
				"is_hide": false
            },
            {
                "items": [
                    {
                        "item_image": "",
                        "q_index": 3,
                        "item_index": 1,
                        "item_title": "选项6",
                        "item_score": 1.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 3,
                        "item_index": 2,
                        "item_title": "选项7",
                        "item_score": 2.0,
                        "item_selected": false
                    }
                ],
                "q_index": 3,
                "q_type": 3,
                "q_subtype": 3,
                "q_title": "标题",
                "is_requir": true,
                "has_jump": false,
				"is_hide": false
            },
			{
                "items": [
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 1,
                        "item_title": "很不满意",
                        "item_tag": {
                            "default": [
                                "服务态度差",
                                "没有耐心",
                                "非常不专业"
                            ]
                        },
                        "item_score": 1.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 2,
                        "item_title": "不满意",
                        "item_tag": {
                            "好评吗": [
                                "122",
                                "21122",
                                "434224"
                            ],
                            "差评不": [
                                "大幅度",
                                "dsfas",
                                "是否"
                            ]
                        },
                        "item_score": 2.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 3,
                        "item_title": "一般",
                        "item_tag": {
                            "default": [
                                "不积极",
                                "业务不熟",
                                "服务不周"
                            ]
                        },
                        "item_score": 3.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 4,
                        "item_title": "一般满意",
                        "item_tag": {
                            "default": [
                                "较专业",
                                "服务态度好",
                                "解决问题及时"
                            ]
                        },
                        "item_score": 4.0,
                        "item_selected": false
                    },
                    {
                        "item_image": "",
                        "q_index": 1,
                        "item_index": 5,
                        "item_title": "很满意",
                        "item_tag": {
                            "default": [
                                "热情周到",
                                "有耐心",
                                "业务能力强"
                            ]
                        },
                        "item_score": 5.0,
                        "item_selected": false
                    }
                ],
                "q_index": 1,
                "q_type": 3,
                "q_subtype": 302,
                "q_title": "标题",
                "is_requir": true,
                "has_jump": false,
                "vector_level": 5,
                "style": 2,
                "has_value": true,
                "is_hide": false
            }
        ],
        "total_score": 0.0
    }
}
```
<div id = "fhsl.2"></div>
-  返回示例2（简洁模式）
```csharp
Content-Type:application/json
{
    "result": true,
    "data": "title:hes考试<br/>q1:标题<br/>q1#1:选项1<br/>q1#2:选项2<br/>q2:标题二<br/>q3:标题三<br/>"
}
```
<div id = "fhsl.3"></div>
-  返回示例3（简洁模式）
```csharp
Content-Type:application/json
{
    "result": true,
    "data": {
        "Title": "hes考试",
        "Questions": [
            {
                "Id": "q1",
                "Title": "标题",
                "TypeName": "考试单选",
                "Info": null,
                "Values": [
                    {
                        "Id": 1,
                        "Text": "选项1",
                        "Image": "",
                        "ImageDesc": ""
                    },
                    {
                        "Id": 2,
                        "Text": "选项2",
                        "Image": "",
                        "ImageDesc": ""
                    }
                ]
            },
            {
                "Id": "q2",
                "Title": "标题二",
                "TypeName": "考试简答",
                "Info": null,
                "Values": []
            },
            {
                "Id": "q3",
                "Title": "标题三",
                "TypeName": "单项填空",
                "Info": null,
                "Values": []
            }
        ]
    }
}
```

---

## 2.1.2获取问卷列表[1000002]

[TOC]

# 接口地址接口地址
生产环境：`https://www.wjx.cn/openapi/default.aspx`，
如果已经使用自定义域名，请求`www.wjx.cn` 换成相应的自定义域名。
# 2.1.2.1请求参数格式
|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|creater	|问卷发布者	|string	|否	|不填时获取主账户发布的问卷,企业微信子账户需要在子账户名前加“qw$”前缀|
|vid	|问卷编号	|int	|否	||
|atype	|问卷类型	|int	|否	|参见 [3.2问卷类型](https://openapi.wjx.cn/web/#/5/56 "3.2问卷类型")|
|query_all	|是否获取企业的所有问卷	|bool	|否	|**·**“0”或false：仅获取主账户的问卷<br>**·**“1”或true：获取企业的所有问卷<br>**·** 仅在creater为主账户时有效<br>**·** 默认值为“0”，即仅获取主账户的问卷|
|folder	|文件夹名	|string	|否	|获取文件夹下的问卷|
|is_xingbiao	|是否是星标问卷	|bool	|否	|**·**“0”或false：获取星标与非星标问卷<br>**·**“1”或true：仅获取星标问卷<br>**·** 默认值为“0”|
|name_like	|问卷名模糊查询关键字	|string	|否	|不能包含特殊字符<br>精确匹配问卷名中包含模糊关键字的问卷<br>长度不超过10个字母或汉字|
|status	|问卷状态	|int	|否	|获取指定状态的问卷,详细定义见：[3.8问卷状态](https://openapi.wjx.cn/web/#/5/62 "3.8问卷状态")|
|verify_status	|问卷审核状态	|int	|否	|获取指定审核状态的问卷,详细定义见：[3.9问卷审核状态](https://openapi.wjx.cn/web/#/5/63 "3.9问卷审核状态")|
|time_type	|按时间查询类型	|int	|否	|默认为0<br>0：不按时间查询<br>1：按问卷开始时间<br>2：按问卷创建时间|
|begin_time	|查询开始时间截（含节点时间）	|long	|否	|查询此时间截以后的问卷,Unix时间戳（格林威治时间1970年01月01日00时00分00秒起至现在的总毫秒数）|
|end_time	|查询结束时间截（不含节点时间）	|long	|否	|查询此时间截以前的问卷,Unix时间戳（格林威治时间1970年01月01日00时00分00秒起至现在的总毫秒数）|
|sort	|排序规则	|int	|否	|0：问卷编号升序<br>1：问卷编号降序<br>2：问卷开始时间升序<br>3：问卷开始时间降序<br>4：问卷创建时间升序<br>5：问卷创建时间降序|
|page_index	|分页页码	|int	|否	|默认值为1，即返回第1分页|
|page_size	|分页大小	|int	|否	|默认分页数为10，最大分页数为300，超过最大分页数时，使用默认分页数10;|

-  举例

```csharp
Content-Type:application/json
{
    "encode": "sha1",
    "creater": "demo_user",
    "appid": "10001",
    "sign": "d2050d70204bc2fd98e60cfe34cd6f2501500078",
    "action": "1000002",
    "ts": 1583812686
}
```

# 2.1.2.2响应参数列表

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|page_index	|int	|分页页码	|是	||
|page_size	|int	|每页问卷数	|是	||
|total_count	|int	|问卷总数	|是	||
|sort	|int	|排序规则	|是	|0：问卷编号升序<br>1：问卷编号降序<br>2：问卷开始时间升序<br>3：问卷开始时间降序|
|activitys	|Dictionary<int, activity>	|问卷列表	|是	主|键为问卷编号，值为问卷信息<br>参见:2.1.2.2.1 <a href="#2.1.1.6.1">2.1.2.2.1答卷对象参数（activity）</a>|

<div id = "2.1.2.2.1"></div>
## 2.1.2.2.1 答卷对象参数（activity）

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	|int	|问卷编号	|是	||
|sid	|string	|问卷短编号	|是	|sid等于vid时，表示问卷未启用短链接|
|begin_date	|string	|问卷开始时间	|是	|时间格式：yyyy-MM-dd HH:mm:ss；|
|create_date	|string	|问卷创建时间	|是	|时间格式：yyyy-MM-dd HH:mm:ss；|
|atype	|int	|问卷类型	|是	|参见[3.2 问卷类型](https://openapi.wjx.cn/web/#/5/56 "3.2 问卷类型")|
|folder	|string	|问卷所在文件夹	|否	|查询参数中包含文件夹参数时会返回这个字段|
|title	|string	|问卷名称	|是	||
|creater	|string	|问卷创建者	|是	||
|answer_valid	|int	|有效答卷数	|是	||
|answer_total	|int	|答卷总数	|是	||
|status	|int	|问卷状态	|是	|参见[3.8 问卷状态](https://openapi.wjx.cn/web/#/5/62 "3.8 问卷状态")|
|verify_status	|int	|问卷审核状态	|是	|参见[3.9 问卷审核状态](https://openapi.wjx.cn/web/#/5/63 "3.9 问卷审核状态")|
|pc_path	|string	|PC端问卷Url相对路径	|是	||
|mobile_path	|string	|移动端问卷Url相对路径	|是	||
|activity_domain	|string	|问卷访问域名	|是	||
|iframe_auto_url	|string	|iframe自适应链接	|是	||
|iframe_noauto_url	|string	|iframe不自适应链接	|是	|||

-  返回示例

```csharp
{
    "result": true,
    "data": {
        "page_index": 1,
        "page_size": 10,
        "total_count": 455,
        "sort": 0,
        "activitys": {
            "123": {
                "vid": 123,
                "sid": "123",
                "atype": 1,
                "title": "调查1",
                "status": 4,
                "verify_status": 2,
                "answer_valid": 0,
                "answer_total": 0,
                "begin_date": "2019-01-22 11:36:12",
                "create_date": "2019-01-22 11:36:12",
                "creater": "demo_user",
                "activity_domain": "https://www.wjx.cn",
                "pc_path": "/jq/123..aspx",
                "mobile_path": "/m/123..aspx",
                "iframe_auto_url": "<script type='text/javascript' src='https://www.wjx.cn/handler/jqemed.ashx?activity=123&width=760&source=iframe'></script>",
                "iframe_noauto_url": "<iframe src='https://www.wjx.cn/jq/123.aspx?width=760&source=iframe&s=t' width='799' height='800' frameborder='0' style='overflow:auto'></iframe>"
            },
            "456": {
                "vid": 456,
                "sid": "456",
                "atype": 1,
                "title": "调查1",
                "status": 4,
                "verify_status": 2,
                "answer_valid": 0,
                "answer_total": 0,
                "begin_date": "2019-01-22 11:37:32",
                "create_date": "2019-01-22 11:37:32",
                "creater": "demo_user",
                "activity_domain": "https://www.wjx.cn",
                "pc_path": "/jq/456..aspx",
                "mobile_path": "/m/456..aspx",
                "iframe_auto_url": "<script type='text/javascript' src='https://www.wjx.cn/handler/jqemed.ashx?activity=456&width=760&source=iframe'></script>",
                "iframe_noauto_url": "<iframe src='https://www.wjx.cn/jq/456.aspx?width=760&source=iframe&s=t' width='799' height='800' frameborder='0' style='overflow:auto'></iframe>"
            },
            "789": {
                "vid": 789,
                "sid": "789",
                "atype": 1,
                "title": "调查1",
                "status": 4,
                "verify_status": 2,
                "answer_valid": 0,
                "answer_total": 0,
                "begin_date": "2019-01-22 11:38:16",
                "create_date": "2019-01-22 11:38:16",
                "creater": "demo_user",
                "activity_domain": "https://www.wjx.cn",
                "pc_path": "/jq/789..aspx",
                "mobile_path": "/m/789..aspx",
                "iframe_auto_url": "<script type='text/javascript' src='https://www.wjx.cn/handler/jqemed.ashx?activity=789&width=760&source=iframe'></script>",
                "iframe_noauto_url": "<iframe src='https://www.wjx.cn/jq/789.aspx?width=760&source=iframe&s=t' width='799' height='800' frameborder='0' style='overflow:auto'></iframe>"
            }
        }
    }
}
```

---

## 2.1.7修改问卷状态[1000102]

[TOC]

# 接口地址接口地址
生产环境：`https://www.wjx.cn/openapi/default.aspx`

-  # 2.1.7.1 请求参数格式

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	|int	|问卷编号	|是	||
|state	|int	|问卷状态	|是	|1：发布或运行，2：暂停，3：删除。其他参数视为无效|

-  举例

```csharp
{
    "encode": "sha1",
    "vid": "91432",
    "appid": "10001",
    "sign": "d2050d70204bc2fd98e60cfe34cd6f2501500078",
    "action": "1000102",
    "ts": 1583812686,
    "state": 1

}
```

- # 2.1.7.2响应参数格式：

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	|string	|问卷id	|是	||
|state	|int	|问卷状态	|是	|1：发布或运行，2：暂停，3：删除|

---

## 3.2 问卷类型

3.2 问卷类型

|  类型 |  编码 |
| :------------ | :------------ |
| 调查  |  1 |
| 测评  |  2 |
| 投票  |  3 |
| 360度评估  | 4  |
| 360评估无测评关系  | 5  |
| 考试  | 6  |
| 表单  | 7  |
| 用户体系 | 8  |
| 教学评估  | 9  |
| 民主评议  | 11  |


---

## 3.3 题目类型

3.3 题目类型

| 类型  | 编码  |
| :------------ | :------------ |
| 分页  | 1  |
| 段落  | 2  |
| 单选题  | 3  |
| 下拉框  | 301  |
| 多选题  | 4  |
| 填空题  | 5  |
| 多项填空  | 6  |
| 矩阵题  | 7  |
| 文件上传  | 8  |
| 比重题  | 9  |
| 滑动条  | 10  |



---

## 3.4 题目细分类型

3.4 题目细分类型

| 类型  | 编码  |
| :------------ | :------------ |
| 单选题  | 3  |
| 下拉框  | 301  |
| 量表题  | 302  |
| 评分单选  | 303  |
| 情景题  | 304  |
| 判断题  | 305  |
| 多选题  | 4  |
| 评分多选  | 401  |
| 排序题  | 402  |
| 商品题  | 403  |
| 填空题  | 5  |
| 多级下拉题  | 501  |
| 普通多项填空  | 6  |
| 考试多项填空  | 601  |
| 考试完型填空--  | 602  |
| 矩阵题  | 7  |
| 矩阵量表题  | 701  |
| 矩阵单选题  | 702  |
| 矩阵多选题  | 703  |
| 矩阵填空题  | 704  |
| 矩阵滑动条  | 705  |
| 矩阵数值题  | 706  |
| 表格填空题  | 707  |
| 表格下拉框  | 708  |
| 表格组合题  | 709  |
| 表格自增题  | 710  |
| 多项文件题  | 711  |
| 多项简答题  | 712  |
| 文件上传  | 8  |
| 绘图题  | 801  |
| 比重题  | 9  |
| 滑动条  | 10  |



---

