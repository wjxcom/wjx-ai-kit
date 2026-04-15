# WJX OpenAPI - Remaining Endpoint Documentation

This file contains all WJX OpenAPI endpoint documentation not covered in the
existing spec file. Includes: 开放能力概览, 快速集成接口, 事件推送, 接口规范,
用户体系[1002], 多用户管理[1003], 通讯录[1005], and 其他.

Generated: 2026-03-23
Source: https://openapi.wjx.cn/web/#/5


================================================================================
# 开放能力 概览
================================================================================


================================================================================
## 开放能力
================================================================================

[TOC]

问卷星目前提供以下API：（接口仅对旗舰版提供）

# 快速集成接口
&ensp;&ensp;&ensp;&ensp;快速集成接口可以使己方系统与问卷星数据打通，实现问卷方便快速发放和回收

- #### 自定义链接参数API
通过使用自定义链接可以通过在问卷链接中传递参数（如，您系统中的用户ID）到问卷中，并保存在问卷数据中。同时在填写完成问卷后访问您指定的页面并带入此参数进行后续处理（例如赠送积分或优惠卷给此用户）。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/26 "点击此处链接详情")

- #### 单点登录（SSO）子账户
使用该接口，可以通过单点登录（SSO）的方式创建子账户，创建成功之后可以通过此接口登录子账户。使用此接口创建的用户，属于主账户下属的子账户，权益同主账户同步。除创建和登录方式不同外，其他权益、设置同手动创建的子账户完全一致。点击[此处链接详情](https://openapi.wjx.cn/web/#/5/27 "此处链接详情")

- #### 单点登录（SSO）用户体系
使用该接口，可以通过SSO（单点登录）的方式让参与者登录到您创建的用户体系中。适用的场景为：针对参与者已经有了一套用户系统，但是需要使用问卷星用户体系进行考试、问卷的集中发放，使用该接口后参与者只需要登录您原有的系统，就可以使用一个按钮无缝切换到问卷星的用户体系中。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/28 "点击此处链接详情")

- #### 代理商免登陆账号API
使用该接口，您可以创建一个独立的账户，供自己的客户使用问卷星的全套功能。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/29 "点击此处链接详情")

# 事件推送

&ensp;&ensp;&ensp;&ensp;事件推送包括问卷推送和答卷推送，包含多种方式，可以实时获取到用户提交的数据

- #### 答卷API推送
使用该接口，可以将填写者提交的数据推送到指定的URL，推送数据的格式是JSON，您需要提供接受数据的URL，并且在此URL上写程序接收数据。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/30 "点击此处链接详情")

- #### 答卷提交后跳转推送
在填写者提交答卷后，可以跳转到用户自己的系统页面，并且作答信息（通过接口获取到的）作为页面元素显示在自己系统页面。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/31 "点击此处链接详情")

- #### 问卷推送
创建问卷和编辑问卷链接新增参数支持，并支持直接跳转调用。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/32 "点击此处链接详情")

# 开放接口文档
&ensp;&ensp;&ensp;&ensp;提供问卷创建、获取、修改；答卷提交、获取；用户体系管理；多用户管理。[点击此处链接详情](https://openapi.wjx.cn/web/#/5/33 "点击此处链接详情")





================================================================================
# 快速集成接口
================================================================================


================================================================================
## 自定义链接参数
================================================================================

[TOC]
什么是自定义链接
--------

自定义链接是指：可以在普通问卷链接的基础上添加参数，将参数值传递到问卷中，并存储为问卷的答卷数据。

例如：您有自己的用户系统，在为用户配置问卷参与链接时，可以通过参数带入用户的各种信息，跟踪答题状态，回传作答状态及数据。

使用要求
----

免费版用户无法使用自定义链接的功能。企业标准版及尊享版可使用默认的「sojumpparm」参数，无法添加更多参数。旗舰版及以上，不仅可以使用默认的「sojumpparm」参数，还可以添加更多的参数。

默认参数和添加题目参数
-----------
![](https://helpimage.paperol.cn/20220411110237.png)
### 1、默认参数

问卷星默认会提供一个「sojumpparm」参数，通过此参数传递进来的数据，会保存在答卷的「来源详情」的字段。该参数为：string类型（如果包含中文或特殊字符请使用UrlEncode编码）、最大长度为100个字符。

### 2、添加题目参数

如果需要传递更多的参数，可以在页面上点击「添加参数」，这里添加的参数必须是问卷中的「填空题」、「单选题」或「多级下拉题」，所以需要在设计问卷时添加好对应的问卷题目，如果不想让填写者看到这些题目，可以将这些题目设置为隐藏状态。

题目参数传递进来的数据，会存储在对应的题目数据中，同填写者正常作答的数据一致。题目参数的类型依据对应的题目类型的不同而不同，如「填空题」为字符串类型，「单选题」「多级下拉题」为选择类型。

参数的代入
-----

### 1、开发组装链接参数

一般来说使用「开发组装链接参数」都需要贵方开发人员参与，依据本篇文档进行自定义链接参数的组装，带入贵方系统中的必要字段。需要注意的是：如果添加了多个参数，则只能通过「开发组装」的方式来使用「自定义链接」。

### 2、开发POST参数

「开发POST参数」也需要贵方开发人员参与，通过POST的方式，将参数带入。

POST地址：问卷的通用地址，可以在「链接与二维码」页面获取；

数据格式：x-www-form-urlencoded；

参数带入：以键值对形式带入，参数名及参数值的计算同「链接传参」一致。

![](https://helpimage.paperol.cn/20220616175558.png)

![](https://helpimage.paperol.cn/20220616180151.png)

### 3、手动填入

如果只使用一个参数，则可以在问卷星后台手动批量生成带参数的链接。如果是「sojumpparm」默认参数和「字符串」的参数，可以批量上传一批参数值然后下载获取对应的链接与二维码。如果是「选择类」参数，则无需上传就可以直接批量导出带参数的链接与二维码。

![图片](https://helpimage.paperol.cn/20220411110543.png)

关键参数
----

关键参数是用来控制「 每个关键参数值可作答次数」这个功能的，默认情况下是「sojumpparm」这个参数，添加多个参数后可以修改为其他的参数。

![图片](https://helpimage.paperol.cn/20220411110613.png)

数据查询
----

传递参数时带入isquery参数就可以控制当前访问是「作答」还是「查询」，其中参数值为0时为作答问卷，参数值为1时为查询答卷。isquery参数可以为空，为空时默认为作答问卷，isquery参数也不参与parmsign参数的签名计算。

安全配置
----

![图片](https://helpimage.paperol.cn/20220411110639.png)

1、「只允许从自定义链接访问」，勾选后只能通过自定义链接参数作答，普通问卷链接会提示无法访问。

2、「增加过期时间」，勾选后生成的自定义链接参数会增加一个过期时间戳字段（endts），超过后链接将失效。

3、「校验参数签名」，勾选后生成的自定义链接参数会增加一个签名字段（parmsign），如果有人篡改参数值，链接将失效。

4、「提交后再次访问可查询作答记录」，勾选后用户在「没有达到访问次数」前可以正常访问作答，在「达到访问次数」后将直接进入答卷页面。需要注意的是：这里的设置效果同「 每个关键参数值可作答次数」有强关联。

DEMO
----

为了方便用户进行开发调试，增加的任何参数或设置，均可以在「链接参数URL预览」中体现，并且系统还提供了一个「DEMO」生成的功能，可以手动输入参数进行调用测试。

![图片](https://helpimage.paperol.cn/20220411110730.png) ![图片](https://helpimage.paperol.cn/20220411110922.png)

回传参数
----

带入的参数，如果想回调到自己系统，可以在「设计问卷」》「问卷设置」》「提交后显示」》「跳转到指定页面」中设置一个回调地址，并且按如下规则在回调地址中写入之前带入的参数。

![图片](https://helpimage.paperol.cn/20220411111037.png)

> 默认「sojumpparm」参数的回调写法{output}，需特别注意「sojumpparm」的回调写法并非是{sojumpparm}。
> 
> q1参数的回调写法为{q1}，其他序号题目依次类推。

在问卷页面中显示带进来的参数
--------------

问卷页面支持将默认的「sojumpparm」参数显示在段落说明或题干中。插入方法：将\[sojumpparm\]这个字段输入在段落说明或题干中，如下图所示（显示带进来的参数仅限尊享版用户使用）：

示例：https://www.wjx.cn/jq/37943379.aspx?sojumpparm=张三

![图片](https://pubnew.paperol.cn/36306761/1555637509b5shrF.png)

[自定义链接参数API_旧版文档](https://www.wjx.cn/Help/Help.aspx?helpid=620 "自定义链接参数API_旧版文档")



================================================================================
## 问卷快速创建和编辑
================================================================================

[TOC]

# 创建问卷和编辑问卷链接新增参数支持，并支持直接跳转调用
用户想在自己系统创建一份问卷，并且能同时打通自己系统和问卷星平台数据，可以使用此接口快速创建
## 一、创建问卷

1、PC端链接：`https://www.wjx.cn/newwjx/mysojump/createblankNew.aspx`

URL参数如下

| 参数名  | 说明  |
| ------------ | ------------ |
| name  | 问卷名称（当且仅当有问卷名称参数时，也会直接创建问卷）  |
| osa  |  是否发布问卷，osa=1   表示创建后立即发布 |
| qt  |  问卷类型 &lt;br&gt;qt=1 调查&lt;br&gt;qt=2 考试&lt;br&gt;qt=3 投票&lt;br&gt;qt=4 表单&lt;br&gt;qt=5 360评估&lt;br&gt;qt=6 测评&lt;br&gt;qt=9  教学评估&lt;br&gt;qt=10 人才盘点|
| nowType  |  问卷应用类型&lt;br&gt;nowType=2 员工满意度应用&lt;br&gt;nowType=3 员工敬业度应用&lt;br&gt;nowType=4 NPS问卷调查&lt;br&gt;nowType=5 客户满意度调查 |
| redirecturl  |  编辑完成后将跳转到指定链接 |
| newdesign  |  newdesign=1表示新版编辑页，老用户如跳转为旧版编辑页需要填写该参数，新用户默认为1 |

2、移动端链接： `http://test.example.com/mobile/createnew.aspx`

URL参数如下

| 参数名  | 说明  |
| ------------ | ------------ |
| name  | 问卷名称（当且仅当有问卷名称参数时，也会直接创建问卷）  |
| osa  |  是否发布问卷，osa=1   表示创建后立即发布 |
| qt  |  问卷类型 &lt;br&gt;qt=1 调查&lt;br&gt;qt=3 投票&lt;br&gt;qt=5 360评估&lt;br&gt;qt=6 考试&lt;br&gt;qt=7  表单&lt;br&gt;qt=10 人才盘点|
| redirecturl  |  编辑完成后将跳转到指定链接 |

## 二、编辑问卷

PC端与移动端为统一地址：  `http://www.wjx.cn/newwjx/design/editquestionnaire.aspx`

URL参数如下

| 参数名  | 说明  |
| ------------ | ------------ |
| activity  | 问卷编号  |
| osa  |  是否发布问卷，osa=1   表示创建后立即发布 |
| editmode  |  问卷类型 &lt;br&gt;editmode=1 保留答卷&lt;br&gt;editmode=2 删除所有答卷&lt;br&gt;editmode=3 复制问卷并编辑|
| runprotect  |  运行状态保护&lt;br&gt;runprotect=0    如为运行状态，也不会有操作提示，值不为0时均提示 |
| redirecturl  |  编辑完成后将跳转到指定链接，需要urlencode |
| newdesign  |  newdesign=1表示新版编辑页，老用户如跳转为旧版编辑页需要填写该参数，新用户默认为1 |

## 快速登录
如提示未登录，请使用SSO创建和登录接口配合完成，[点击此处链接详情](https://openapi.wjx.cn/web/#/5/27 &quot;点击此处链接详情&quot;)，SSO创建和登录参数URL填写创建或者编辑问卷的地址，这样就完成了自动登录立即跳转到问卷的创建或编辑

示例：http://test.example.com/zunxiang/login.aspx?appid=10001&amp;ts=123456789&amp;sign=422f895c7d9a407ce276f87653d2b8c5690d8711&amp;subuser=xia&amp;url=http://test.example.com/newwjx/mysojump/createblankNew.aspx?name=SSO登录快速创建问卷&amp;osa=1&amp;qt=1

注意：`http://test.example.com`在生产环境请换成`https://www.wjx.cn`，如果有自定义域名请换成自定义域名。参数说明可参考[SSO创建和登录接口](https://openapi.wjx.cn/web/#/5/27 &quot;SSO创建和登录接口&quot;)，参数url是本接口快速创建问卷地址，如果带有参数，请使用urlencode编码参数再传递（示例为了清楚写明参数未做编码）

## 参数透传

创建问卷和编辑问卷链接支持参数透传，参数名需要以`wjxparams`开头，并支持多个参数，需要配合问卷编辑页全局跳转设置
例如：1、`https://www.wjx.cn/mobile/createnew.aspx?wjxparamstest1=123&amp;wjxparamstest2=456`
2、`https://www.wjx.cn/newwjx/design/editquestionnaire.aspx?wjxparamstest1=1&amp;wjxparamstest2=2`

# 问卷编辑页全局跳转设置

- 编辑跳转设置支持设置跳转Url、是否推送问卷内容、是否仅Ajax请求，[点击此处链接详情](https://openapi.wjx.cn/web/#/5/32 &quot;点击此处链接详情&quot;)；




================================================================================
## 单点登录(SSO)子账户接口
================================================================================

[TOC]

# 一、SSO创建和登录接口
## 1、1 接口介绍
使用该接口，可以通过单点登录（SSO）的方式创建子账户，创建成功之后可以通过此接口登录子账户。使用此接口创建的用户，属于主账户下属的子账户，权益同主账户同步。除创建和登录方式不同外，其他权益、设置同手动创建的子账户完全一致。

## 1、2 接口参数说明
请求方式：`Get`

接口链接：https://www.wjx.cn/zunxiang/login.aspx?appid=&amp;subuser=&amp;mobile=&amp;email=&amp;roleId=&amp;ts=&amp;sign=
&lt;table&gt;
&lt;tr&gt;&lt;th style=&quot;background-color: rgb(64, 158, 255);color: rgb(255, 255, 255);&quot;&gt;参数名&lt;/th&gt;&lt;th style=&quot;background-color: rgb(64, 158, 255);color: rgb(255, 255, 255);&quot;&gt;参数说明&lt;/th&gt;&lt;th style=&quot;background-color: rgb(64, 158, 255);color: rgb(255, 255, 255);&quot;&gt;是否必须&lt;/th&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;appid&lt;/td&gt;&lt;td&gt;开发ID，需联系客服生成，生成后可以在多用户管理页面查看&lt;/td&gt;&lt;td&gt;是&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;appkey&lt;/td&gt;&lt;td&gt;开发秘钥，需联系客服生成，生成后可以在多用户管理页面查看，参与sign签名，无需明文传输&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;ts&lt;/td&gt;&lt;td&gt;时间戳，从1970-01-01 00:00:00开始到现在的秒数，有效期为60秒&lt;/td&gt;&lt;td&gt;是&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;encode&lt;/td&gt;&lt;td&gt;签名验证方式，目前支持sha1和sm3，不传或传入不合法时，默认使用：sha1&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;sign&lt;/td&gt;&lt;td&gt;加密签名算法，sign=sha1(appid+appkey+subuser+mobile+email+roleId+ts)当encode=sm3时，sign=sm3(appid+appkey+subuser+mobile+email+roleId+ts)点击查看 [签名示例](https://www.wjx.cn/signsample.aspx?type=3 &quot;签名示例&quot;)&lt;/td&gt;&lt;td&gt;是&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;subuser&lt;/td&gt;&lt;td&gt;创建子账户的用户名，请使用绝对唯一性字段&lt;/td&gt;&lt;td&gt;是&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;mobile&lt;/td&gt;&lt;td&gt;创建子账户绑定的手机号码，可选字段，留空时子账户的手机号码为空；&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;email&lt;/td&gt;&lt;td&gt;创建子账户绑定的邮箱，可选字段，留空时子账户的邮箱为空；&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;roleId&lt;/td&gt;&lt;td&gt;创建子账户的角色，可选字段，留空默认为“问卷管理员”子账户角色：1-系统管理员，2-问卷管理员，3-统计结果查看员，4-完整结果查看员&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;url&lt;/td&gt;&lt;td&gt;指定登录成功后的跳转地址，不传时默认跳转到我的问卷页面&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;admin&lt;/td&gt;&lt;td&gt;是否主账号登录，非主账号不需要传此参数，主账号登录时admin参数填写1，subuser=主账号；示例：`https://www.wjx.cn/zunxiang/login.aspx?appid=&amp;ts=&amp;sign=&amp;subuser=&amp;admin=1`&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;tr&gt;&lt;td&gt;bnts&lt;/td&gt;&lt;td&gt;支持传递多个bnt，bnt的格式：名称^跳转地址，多个bnt间使用&quot;|&quot;分隔，例：`返回1^https://www.baidu.com|返回2^https://www.baidu.com`注意：参数值需要urlencode&lt;/td&gt;&lt;td&gt;否&lt;/td&gt;&lt;/tr&gt;
&lt;/table&gt;
## 1、3 子账户的创建/登录和删除
创建：第一次使用以上接口时，就是子账户的创建过程；

登录：子账户登录和创建使用相同的接口，其中手机号码、邮箱、角色三个字段，仅在首次创建时有效，在第二次登录时如果三个字段信息有更改，也不会将传递信息更新到问卷星系统；

删除：如需删除子账户，需要主账户登录后，在多用户管理页面手动删除。需要注意是：在您自己系统删除一个员工账户后，无法自动同步删除其在问卷星对应的子账户。

# 二、获取SSO子账户问卷列表接口
## 2、1 接口介绍
通过此接口，可以获取某一个子账户问卷管理员名下的问卷列表。

## 2、2 接口参数说明
请求方式：`Get`

接口链接：`https://www.wjx.cn/zunxiang/getuserq.aspx?appid=&amp;username=&amp;ts=&amp;folder=&amp;sign=`


## 2、3 获取到数据说明
此接口会有`10`分钟的缓存时间，新增的问卷可能需要`10`分钟以后才能获取。如果需要实时获取，请在接口`URL`参数中增加`&amp;nocache=1`（增加参数后，接口每分钟只能调用`5`次）。

数据格式：`JSON`

数据示例： 
```csharp
[
    {
        &quot;qid&quot;: &quot;89767&quot;, 
        &quot;name&quot;: &quot;新考试&quot;, 
        &quot;begindate&quot;: &quot;2017-08-20 11:52:43&quot;, 
        &quot;answercount&quot;: &quot;5&quot;, 
        &quot;pcurl&quot;: &quot;https://www.wjx.cn/jq/89767.aspx&quot;, 
        &quot;murl&quot;: &quot;https://www.wjx.cn/m/89767.aspx&quot;
    }, 
    {
        &quot;qid&quot;: &quot;89819&quot;, 
        &quot;name&quot;: &quot;考试&quot;, 
        &quot;begindate&quot;: &quot;2017-08-18 21:21:35&quot;, 
        &quot;answercount&quot;: &quot;4&quot;, 
        &quot;pcurl&quot;: &quot;https://www.wjx.cn/jq/89819.aspx&quot;, 
        &quot;murl&quot;: &quot;https://www.wjx.cn/m/89819.aspx&quot;
    }
]
```
|参数名|参数说明|
|:---    |:------    |
|qid|问卷ID|
|name|问卷标题|
|begindata|问卷的创建时间|
|answercount|当前问卷答卷数|
|desc|问卷说明（默认不返回），如果需要此字段，请在接口URL参数中增加&amp;includedesc=1。|
|pcurl|PC端问卷访问链接|
|murl|移动端问卷访问链接|

# 三、获取SSO子账户答卷数据接口
## 3、1 接口介绍
通过此接口可以获取到部分答卷数据，包括：提交序号、参与者姓名、总分、提交时间、提交所用时间。需要注意的是，只有答卷总数少于`20000`才能使用此接口，而且此接口只能获取到部分数据而且全部答卷详情数据。如需获取全部答卷详情数据，可以参考：数据推送的`API`接口。

## 3、2 接口参数说明
请求方式：`Get`

接口链接：`https://www.wjx.cn/zunxiang/getjoinlist.aspx?appid=&amp;activity=&amp;ts=&amp;sign=&amp;pageindex=&amp;pagesize=`

## 3、3 获取到数据说明
数据格式：`JSON`

数据示例：
```csharp
[
    {
        &quot;parterjoiner&quot;: &quot;test2&quot;, 
        &quot;totalvalue&quot;: &quot;15&quot;, 
        &quot;index&quot;: &quot;3&quot;, 
        &quot;timetaken&quot;: &quot;8&quot;, 
        &quot;submittime&quot;: &quot;2017-08-20 14:25:39&quot;
    }, 
    {
        &quot;parterjoiner&quot;: &quot;test3&quot;, 
        &quot;totalvalue&quot;: &quot;15&quot;, 
        &quot;index&quot;: &quot;4&quot;, 
        &quot;timetaken&quot;: &quot;141&quot;, 
        &quot;submittime&quot;: &quot;2017-08-20 14:38:55&quot;
    }
]
```
|参数名|参数说明|
|:---    |:------    |
|parterjoiner|参与者姓名|
|totalvalue|当前答卷得分|
|index|当前答卷序号|
|timetaken|当前答卷作答所用的时间，单位：秒|
|submittime|当前答卷的提示时间|

# 四、SSO子账户参与者端接口
## 4、1 接口介绍
使用该接口，作为问卷或考试填写参与者的登录之后，可看到一个完善的填写参与者的用户体系，查看到自己需要作答哪些问卷、已经完成了哪些问卷、积分排行等等信息。

## 4、2 接口参数说明
请求方式：`get`

加密链接参数如下：`https://www.wjx.cn/zunxiang/qlist.aspx?appid=&amp;username=&amp;joiner=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`


## 4、3 访问其他页面
以上接口填写者参与者点击后访问的是用户体系的主页，还可以通过携带参数访问其他不同的页面，如：

1、待参与页面：`https://www.wjx.cn/zunxiang/qlist.aspx?appid=&amp;username=&amp;joiner=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`

2、已参与页面：`https://www.wjx.cn/zunxiang/qlistjoin.aspx?appid=&amp;username=&amp;joiner=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`

3、答卷详情页：`https://www.wjx.cn/zunxiang/joinrelquery.aspx?appid=&amp;username=&amp;joiner=&amp;activity=&amp;joinid=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`，如果需要隐藏返回按钮，请在参数后面加上`&amp;noback=1`。

访问答卷详情页，需增加两个参数：`activity`（问卷ID）和`joinid`（答卷流水号，需使用数据推送接口获取），同时加密签名算法改变为：`sign=sha1(appid+appkey+username+joiner+activity+joinid+realname+dept+extf+ts)`



================================================================================
## 单点注册/登录（SSO）用户体系
================================================================================

[TOC]

# 接口介绍
使用该接口，可以通过SSO（单点登录）的方式让参与者登录到您创建的用户体系中。适用的场景为：您针对参与者已经有了一套用户系统，但是需要使用问卷星用户体系进行考试、问卷的集中发放，使用该接口后参与者只需要登录您原有的系统，就可以使用一个按钮无缝转移到问卷星的用户体系中。

# 接口说明
请求方式:`Get`

加密链接：`https://www.wjx.cn/user/loginform.aspx?u=&amp;userSystem=&amp;systemId=&amp;appid=&amp;uid=&amp;uname=&amp;udept=&amp;uextf=&amp;islogin=&amp;ts=&amp;sign=`

|参数名|参数说明|是否必须|
|:---    |:------    |--- |
|u	|您账户用户名，为固定值	|是|
|userSystem	|用户体系的类型，为固定值 1	|是|
|systemId	|用户体系的ID，为固定值	|是|
|appid	|开发ID，可以在“API自动登录”弹框查询到	|是|
|uid	|参与者ID，鉴别参与者唯一身份的ID	|是|
|ts	|时间戳，从1970-01-01 00:00:00开始到现在的秒数，有效期为300秒	|是|
|encode	|签名验证方式，目前支持sha1和sm3，不传或传入不合法时，默认使用：sha1	|否|
|sign	|加密签名，算法sign=sha1(appid+appkey+uid+ts)当encode=sm3时，sign=sm3(appid+appkey+uid+ts)点击查看 [签名示例](https://www.wjx.cn/signsample.aspx?type=8 &quot;签名示例&quot;)	|是|
|upass	|参与者初始登录密码，用于参与者手动登录（可使用比如用户ID或其后6位等规则），传递后会加密存储。用户体系需添加此字段，否则接口传入也会被舍弃	|否|
|uname	|参与者姓名，用户体系需添加此字段，否则接口传入也会被舍弃	|否|
|udept	|参与者部门，用户体系需添加此字段，否则接口传入也会被舍弃	|否|
|uextf	|参与者附加信息，用户体系需添加此字段，否则接口传入也会被舍弃	|否|
|islogin	|当用户体系中无此参与者时，是否允许自动注册：1为允许，0为不允许，默认为1	|否|
|activity	|需要跳转的问卷编号，跳转的问卷需要已经绑定给了此参与者	|否|
|sojumpparm	|自定义链接参数，支持在答卷来源中记录，跳转时{output}中回传	|否|
|r	|当且仅当activity有值时有效，r = &quot;1&quot; 表示跳转到activity对应问卷的结果查询页	|否|
|returnurl	|指定登录成功后的跳转地址	|否|
|pagetype	|跳转地址类型：默认为待参与列表时可以不带此参数0: 待参与列表 1：已参与列表 2： 积分排行&lt;br&gt;注：当且仅当returnurl参数不为空时有效	|否|
以上参数中：
`u\userSystem\systemId` 在同一个用户体系中均为固定值，在“API自动登录”弹窗的接口链接中可以直接复制获取；
`appid`和`appkey`也可以直接在“API自动登录”弹窗中获取到；


`uid\uname\udept\uextf\islogin\ts\sign`为变量，需要用户根据实际情况传入；

注意：传递的参数值前后任意形式的空格均会被过滤。

# 使用步骤
1、登录问卷星后台创建一个用户体系（不能使用微信服务号和企业微信的方式创建）；
2、用户体系的字段可以自由设置，“用户ID”为必须字段，需注意“”添加的字段和随后传入的字段需保持一致；
3、开发接口，让参与者自动进行登录。


如果需要通过接口批量注册用户体系的参与者，或者说一键同步您系统中通讯录到用户体系中，请参考此开发文档：用户体系参与者批量注册API接口



================================================================================
## 免登录账户
================================================================================

# 1、免登录接口
## 介绍
即单点登录接口，此接口适用于在已有用户体系下，用户可以在已有系统中点击问卷调查的模块即可直接使用问卷星的所有功能，无需另外再注册登录问卷星。

## 接口说明
请求方式：`get`

加密链接参数如下：

`https://www.wjx.cn/partner/login.aspx?appid=&amp;username=&amp;mobile=&amp;subuser=&amp;ts=&amp;sign=`

|字段|说明|
|:---    |:------    |--- |-|--------      |
|subuser|子账户参数，从属于username（可以被username用户进行管理），可选|

sign计算方法：
```csharp
sign = sha1(appid+appkey+username+mobile+subuser+ts)
```
如页面返回信息：签名错误！ 请检查`sign`计算是否正确。


提示：如果需要在`iframe`中使用免登录接口，由于`safari`浏览器对`cookie`的限制，必须使用`JS`脚本的方式进行嵌入： 
```javascript
 &lt;script  type='text/javascript' src='https://www.wjx.cn/handler/loginemed.ashx?url={url}&amp;width=100%&amp;height=100%'&gt;&lt;/script&gt;
```
`src`中需要有`3`个参数：

{url}参数请使用`https://www.wjx.cn/partner/login.aspx?appid=&amp;username=&amp;mobile=&amp;ts=&amp;sign=进行替换。width和height参数可选，默认为100%`。

 

# 2、用户端接口
## 介绍
使用该接口，做为填写者的用户登录之后，可看到一个完善的填写者后台页面，查看到自己需要作答哪些问卷、已经完成了哪些问卷、积分排行等等信息。

## 接口说明
请求方式：`get`

加密链接参数如下：

`http://www.wjx.cn/partner/qlist.aspx?appid=&amp;username=&amp;joiner=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`

sign计算方法：
```csharp
sign = sha1(appid+appkey+username+joiner+realname+dept+extf+ts)
```

获取答题者单独列表接口（参数跟上面的一样）：
格式：`JSON`
a) 获取填写者的待参与列表：
地址：`https://www.wjx.cn/partner/getqlist.aspx?appid=&amp;username=&amp;joiner=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`
sign计算方法：
```csharp
sign = sha1(appid+appkey+username+joiner+realname+dept+extf+ts)
```

b) 获取填写者的已参与列表：
地址：`https://www.wjx.cn/partner/getqlistjoin.aspx?appid=&amp;username=&amp;joiner=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`

sign计算方法：
```csharp
sign = sha1(appid+appkey+username+joiner+realname+dept+extf+ts)

```
c) 获取单份答卷详情链接：
地址：`https://www.wjx.cn/partner/joinrelquery.aspx?appid=&amp;username=&amp;joiner=&amp;activity=&amp;joinid=&amp;realname=&amp;dept=&amp;extf=&amp;ts=&amp;sign=`

sign计算方法：
```csharp
sign = sha1(appid+appkey+username+joiner+activity+joinid+realname+dept+extf+ts)
```

d) 自主拼接用户的单个问卷访问链接：

1、使用a) 获取填写者的待参与列表，提取单个问卷的访问链接，记录为`ActivityUrl`;

2、替换`ActivityUrl`中的`ts`为当前时间；

3、重新计算并替换`partersign`的值；

```csharp
partersign = sha1(appid+appkey+username+joiner+realname+dept+extf+ts)
```

# 3、获取管理员名下的问卷列表
## 介绍
通过此接口，可以获取某一个问卷管理员名下的的问卷列表。

数据获取方式：`get`

## 接口说明
加密链接参数如下：

`http://www.wjx.cn/partner/getuserq.aspx?appid=&amp;username=&amp;ts=&amp;folder=&amp;sign=`

|字段|说明|
|:---    |:------    |--- |
|appid|由问卷星分配|
|appkey|由问卷星分配|
|folder|用户名下的问卷文件夹名称。如加了该参数，则只会获取到指定文件夹里面的问卷数据，如果需要全部问卷数据，可以不加|
|ts|为按秒计数的当前时间戳，通常对应time()函数，系统确认ts是在30s内，并且sign一致，就会自动登录|
|username|使用者的用户名或用户ID，由用户自己生成|

`sign`计算方法：
```csharp
sign = sha1(appid+appkey+username+ts+folder)
```

提示：此接口会有`10`分钟的缓存时间，新增的问卷可能需要`10`分钟以后才能获取。

数据格式：`JSON`

数据示例： 
```csharp
[
    {
        &quot;qid&quot;: &quot;89767&quot;, 
        &quot;name&quot;: &quot;新考试&quot;, 
        &quot;begindate&quot;: &quot;2017-08-20 11:52:43&quot;, 
        &quot;answercount&quot;: &quot;5&quot;
    }, 
    {
        &quot;qid&quot;: &quot;89819&quot;, 
        &quot;name&quot;: &quot;考试&quot;, 
        &quot;begindate&quot;: &quot;2017-08-18 21:21:35&quot;, 
        &quot;answercount&quot;: &quot;4&quot;
    }
]
```

# 4、获取答卷数据API
## 介绍
通过此接口可以直接会获取所有参与者的得分数据，包括：提交序号、参与者姓名、总分、提交时间、提交所用时间。只有答卷总数少于`20000`才能使用此接口。

数据获取方式：`get`

## 接口说明
加密链接参数如下：

`http://www.wjx.cn/partner/getjoinlist.aspx?appid=&amp;activity=&amp;ts=&amp;sign=&amp;pageindex=&amp;pagesize=`

|字段|说明|
|:---    |:------    |--- |-|--------      |
|appid|由问卷星分配|
|appkey|由问卷星分配|
|activity|表示问卷的ID|
|ts|为按秒计数的当前时间戳，通常对应time()函数，系统确认ts是在30s内，并且sign一致，才能获取|
|pageindex|页码序号|
|pagesize |每页数量，默认10条数据，每页最多不超过1000条数据|

`sign`计算方法：
```csharp
sign = sha1(appid+appkey+activity+ts)
```

数据格式：`JSON`

数据示例：

```csharp
[
    {
        &quot;parterjoiner&quot;: &quot;test2&quot;, 
        &quot;totalvalue&quot;: &quot;15&quot;, 
        &quot;index&quot;: &quot;3&quot;, 
        &quot;timetaken&quot;: &quot;8&quot;, 
        &quot;submittime&quot;: &quot;2017-08-20 14:25:39&quot;
    }, 
    {
        &quot;parterjoiner&quot;: &quot;test3&quot;, 
        &quot;totalvalue&quot;: &quot;15&quot;, 
        &quot;index&quot;: &quot;4&quot;, 
        &quot;timetaken&quot;: &quot;141&quot;, 
        &quot;submittime&quot;: &quot;2017-08-20 14:38:55&quot;
    }
]
```

# 6、设置完成问卷后跳转并且有自定义链接参数时，考试会自动带上分数
## 介绍
为防止用户修改分数，系统除了会传递`totalvalue`参数外，还会传递`valuesign`参数。
`valuesign`的计算方式为：
```csharp
valuesign = sha1(totalvalue+&quot;asfw8aslfda899asfdaweasd&quot;)
```

示例：如果用户得分为77.5分，那么参数值为sha1(77.5asfw8aslfda899asfdaweasd)



================================================================================
# 事件推送
================================================================================


================================================================================
## 答卷api推送
================================================================================

[TOC]

如果您需要将答卷数据备份到自己的服务器中，可以使用本接口，将提交的答卷Post到您指定的URL，并保存。
# 一、数据推送API
使用该接口，可以将填写者提交的数据推送到指定的URL，推送数据的格式是JSON，您需要提供接受数据的URL，并且在此URL上写程序接收数据。

数据PostURL：由您指定，但是必须为外网可访问的地址，如：`https://www.wjx.cn/demo/getapipost.aspx` （Demo地址）

推送数据示例：
```csharp
{"activity":"5657754","name":"问卷名称","timetaken":"528","submittime":"2016-08-23 10:01:59",
"q1":"1","q2": "测试","q3","1,2","joinid":"101812480275","totalvalue":"15","sign":""}
```
推送参数说明：
注：系统会自动加上签名参数，参数名为"sign"，计算方式为：sign=sha1(activity+index+推送密钥)，其中activity和index代表问卷ID和作答序号，可以在推送数据中直接获取，推送密钥请联系尊享版客服获取。点击查看 [签名示例](https://www.wjx.cn/signsample.aspx?type=2 "签名示例")
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/7db13b0b3399feacf276deb275de2c2c)
## 注意事项：
（1）推送失败，可勾选“失败自动重发”选项。如连续推送失败超过`10`次，系统将不再向该url推送数据，`30`分钟后会继续发送，如果30分钟后还是失败，系统不会再次重发。

（2）如果使用了数据推送API，同时也使用了自定义链接参数，`sojumpparm`参数带进来的内容也会推送，无需使用“自定义链接参数”功能中的页面跳转传递参数。

（3）<a href="#shili">点击此处可以查看各题型的推送示例详情</a>

## 开发指南：
1、PHP获取Json数据：可以使用`file_get_contents("php://input")`或者`$GLOBALS['HTTP_RAW_POST_DATA']`

2、Python django：可以使用`request.raw_post_data`来获取`Json`数据

3、java代码：使用`org.apache.commons.io.IOUtils`来获取json字符串：
```java
String jsonString = IOUtils.toString(request.getInputStream());
JSONObject json = new JSONObject(jsonString);
```
4、C#代码：读取`Request.InputStream`数据：
```csharp
Stream stream = Request.InputStream;
Byte[] byteData = new Byte[stream.Length];
stream.Read(byteData, 0, (Int32)stream.Length);
string jsonData = Encoding.UTF8.GetString(byteData);
```
# 二、获取题目选项对应文本内容
在数据推送时，为保证推送速度及成功率，只会推送题目及选项对应的序号（推送的内容同按选项序号下载的内容一致，选择题为序号填空题为文本），不会推送题目及选项的文本内容，如需获取题目选项序号和文本的对应值，可以使用以下接口获取：

获取接口：`https://www.wjx.cn/handler/IllustrateApi.ashx?activityID=问卷ID`

序号解释：

1.`q1、q2、q3`以此类推，代表每个题目的题干文字；

2.选择类的题目，`q1#1、q1#2、q1#3`分别代表第一个题的第一个、第二个、第三个选项；

3.多项填空题，只提供题干整体文本；

4.如果是矩阵单选或矩阵多选题，`q1`是题干文本，`q1_1,q1_2`是矩阵题的第一个、第二个左行标题，`q1_1#1,q1_1#2`分别是矩阵题第一个左行标题的，第一个选项、第二个选项内容。

5.矩阵填空，数据推送的时候直接推送的是选项内容，无需获取选项文本。类似的还有矩阵滑动条、表格下拉框、表格数值、表格文本题。

6.考试问卷，不包含正确答案的信息。

获取接口（JSON格式）：`https://www.wjx.cn/handler/IllustrateApi.ashx?activityID=问卷ID&JSON=1`

# 三、数据推送DEMO
## 1、设置测试推送地址
将该地址： `https://www.wjx.cn/demo/getapipost.aspx` 放在数据推送的目标地址。注意，该地址仅用于测试，只显示最近`300`条推送数据。

## 2、查看推送结果
访问该地址：`https://www.wjx.cn/demo/getapipost.aspx` 可以查看测试DEMO获取到的数据详情。

## 注意：
测试环境，请勿推送敏感数据。

<div id = "shili"></div>
# 四、各题型推送示例详情

|字段|说明|示例|
|:---    |:------    |--- |
|activity|问卷ID|"22913715"（22913715为示例问卷id）|
|name|问卷名称|"测试数据推送api"（测试数据推送api为示例名称）|
|joinid|参与序号|"101488475952"（序号为问卷星所有参与者的序号）|
|timetaken|所用时间|"64"（64是参与时间是64秒）|
|submittime|提交答卷时间|"2018-04-23 19:57:52|
|totalvalue|总分|"59"|
|sojumpparm|来源详情||
|ipaddress|ip地址||
|nickname|微信昵称||
|thirdusername|第三方昵称|使用了密码列表，这里会显示每个密码列表对应的附加属性|

如使用了用户体系，会推送以下数据：

|字段|说明|
|:---    |:------    |
|thirdusername|用户ID|
|realname|姓名|
|relDept|部门|
|relExt|附加信息|

## 单选题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/e5ed1c955c2f17ff5afda8d2b8c6663c)
推送形式：
```csharp
"q1":"1"
```
其中q1表示第一题，值“1”表示用户选择了第一个选项。
## 多选题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/52ccb199bfc6c6942b9cdbf2d45d42d3)
推送形式：
```csharp
"q2":"1,2"
```
其中q2表示第2题，值“1,2”表示用户同时选择了第1个和第2个选项。
## 单项填空题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/a4690b94f4199aae9c1944d7c6d942b6)
推送形式：
```csharp
"q3":"测试"
```
其中q3表示第3题，值“测试”表示用户输入的内容。
## 矩阵量表题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/690b27466484765e300ac41e5cf8f6f6)
推送形式：
```csharp
"q4_1":"1","q4_2":"1"
```
其中q4_1表示第4题的第一个小题，即外观这个题目，值“1”表示选择第一个选项，q4_2表示第4题的第二个小题，即功能这个题目，值“1”表示选择第一个选项。
## 矩阵单选题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/ef9f2486414d1a04d9bb06bd0d127cd7)
推送形式：
```csharp
"q5_1":"5","q5_2":"5"
```
其中q5_1表示第5题的第一个小题，即外观这个题目，值“5”表示选择第五个选项，q5_2表示第5题的第二个小题，即功能这个题目，值“5”表示选择第五个选项。
## 矩阵填空题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/75ab5b45081859bcd0979b99c4529285)
推送形式：
```csharp
"q6_1":"填空1测试","q6_2" :"填空2测试"
```
其中q6_1表示第6题的第一个空，值“填空1测试”表示用户输入的内容，	q6_2表示第6题的第二个空，值“填空2测试”表示用户输入的内容。
## 矩阵滑动条：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/0fb45644a4f290844aea03193e8ea954)
推送形式：
```csharp
"q7_1":"62","q7_2":"17"
```
其中q7_1表示第7题的第一个小题，62表示第一小题选择的分数是62分，q7_2表示第7题的第二个小题，17表示第一小题选择的分数是17分。
## 表格下拉框：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/94bcd76b8d0cd557a28b108cbd76a182)
推送形式：
```csharp
"q8_1_1":"很满意","q8_1_2":"很满意","q8_1_3":"很满意","q8_1_4":"很满意","q8_1_5":"很满意",
"q8_2_1":"满意","q8_2_2":"满意","q8_2_3":"满意","q8_2_4":"满意","q8_2_5":"满意"
```
其中q8_1_1表示第8题的第一个小题的第一个选项，即在外观这个小题中百度这个选项，选择的是“很满意”，依次类推。
## 表格数值题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/4d1c4bfc00e4c909e5a0d57807768290)
推送形式：
```csharp
"q9_1_1":"1","q9_1_2":"1","q9_1_3":"1","q9_1_4":"1","q9_1_5":"1","q9_2_1":"2","q9_2_2":"2",
"q9_2_3":"2","q9_2_4":"2","q9_2_5":"2"
```
其中q9_1_1表示第9题的第一个小题的第一个选项，即在外观这个小题中百度这个选项，填写的是“1”，依次类推。
## 表格文本题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/75734ab3c31737bc3342a3f3acb22708)
推送形式：
```csharp
"q10_1_1":"1","q10_1_2":"1","q10_1_3":"1","q10_1_4":"1","q10_1_5":"1","q10_2_1":"2","q10_2_2":"2",
"q10_2_3":"2","q10_2_4":"2","q10_2_5":"2"
```
其中q10_1_1表示第10题的第一个小题的第一个选项，即在外观这个小题中百度这个选项，填写的是“1”，依次类推。
## 上传文件题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/863f4faaa8e95f98c7fe662039538862)
推送形式：
```csharp
"q11":"http://cdn.example.com/22913715_2_q11_-bMdVn-C60qTgxjbRU5Bqg.png?download/2_11_logo.png&e=1524571072&token=YOUR_QINIU_TOKEN"
```
其中q11表示的是第十一题，后面的链接为上传文件的下载地址。
## NPS量表题测试：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/b758eb59505a97bed54216969b3417e0)
推送形式：
```csharp
"q12":"10"
```
其中q12表示第十二题，10表示选择的内容为10分。
## 评分单选题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/0d5e03716400ee3a5bc6bed400f7da7f)
推送形式：
```csharp
"q13":"1"
```
其中q13表示第13题，值“1”表示用户选择了第一个选项；
## 评分多选题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/91a5e9fc5c51a1a163ea6f0d9f262893)
推送形式：
```csharp
"q14":"1,2"
```
其中q14表示第14题，值“1,2”表示用户同时选择了第1个和第2个选项。
## 排序题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/e78e5f13c6abb2f8c0afd668f1ca7372)
推送形式：
```csharp
"q15":"1,2"
```
其中q15表示第15题，值“1,2”表示选项的排序为1、2。
## 多级下拉框：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/6dffb5b861934ea4ddef64750ff0f954)
推送形式：
```csharp
"q16":"中国-湖南"
```
其中q16表示第16题，"中国-湖南"表示一级选项中选择的是中国，二级选项中选择的是湖南。
## 比重题测试：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/51e4dffdff6326c171cbdece9143428c)
推送形式：
```csharp
"q17_1":"33","q17_2":"67"
```
其中q17_1表示第17题的第一个小题，即外观这个题目，选择的比重为33，q17_2表示第17题的第二个小题，即性能这个题目，选择的比重为67。
## 滑动条：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/fb7962cb9903e81f7addee961fd21ab9)
推送形式：
```csharp
q18":"59"
```
其中q18表示第18题，选择的值为59。
## 情景随机题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/744498100b999eba0dfa30d12ecf3eba)
推送形式：
```csharp
"q19":"1"
```
其中q19表示第19题，1表示随机的情景为情景1。
## 商品题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/4e2008a6544bfd2e15e1bff2dcfe30d5)
推送形式：
```csharp
"q20":"1^1,2^1,3^1","index":"3"
```
## 评价题：
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/138f7427c6ed8226b5ab1bab51cc35f7)
推送形式：
```csharp
"q1_3":"业务不熟","q1":"3"
```
其中q1表示第一题，3表示选择了第三个选项q1_3表示第三个选项中，选择了“业务不熟”这个标签
## 测试问卷链接
`https://www.wjx.cn/jq/22913715.aspx`
## 查看推送结果
`http://wjxapi.paperol.cn/data.txt`    （根据id22913715搜索即可）


================================================================================
## 答卷提交后跳转推送
================================================================================

[TOC]

# 一、接口功能应用场景
在问卷设置》跳转设置》跳转到指定页面设置跳转目标的URL，并且开启“POST答卷数据到该地址”的功能。就可以实现：填写者在提交答卷后，跳转到这个指定的`URL`页面，并且系统会同步将该填写者作答的数据`POST`到该`URL`页面。

应用场景：在填写者提交答卷后，可以跳转到用户自己的系统页面，并且作答信息（通过接口获取到的）作为页面元素显示在自己系统页面。如：考试问卷如果不想使用问卷星提供的标准成绩单，可以使用该功能，自己写一个成绩单页面作为跳转页面。

# 二、页面目标地址
使用页面目标地址需要注意以下问题：

1、该地址需保证外网可访问的状态；

2、该地址需要承载填写者提交答卷后的跳转落地页，所以需保证合适的页面内容；

3、数据将以表单的方式`POST`到该地址，需要增加开发代码以读取`form`表单数据的`content`内容。

# 三、POST答卷数据
POST答卷数据会将每个填写者作答的数据，在其点击“提交”时推送到“页面目标地址”。每个填写者点击提交，就会执行一次推送操作；

## 1、推送机制
1） 用户在问卷设置界面设置跳转到指定页面，并勾选“POST答卷数据到该地址”；
![](http://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/bb3c01a71b9efece81446efbc5890e7d)
2） 如果需要获取问卷内容，可同时勾选“POST问卷内容到该地址”。如果未显示此选项，请联系客服顾问开通权限；

3） `POST`答卷数据到跳转的指定页面的方式，与数据推送`API`方式只能二选一，推荐使用`POST`答卷数据到跳转的指定页面；这种方式的实时效性、稳定性更强；

用户在提交完答卷后，问卷星将直接跳转到指定的页面并将答卷数据放在`POST`消息体中；

跳转到用户指定页面后，用户指定页面可以同时读取到`GET`和`POST`的内容；

## 2、数据加密
考虑到答卷数据传输的安全性，推送的答卷数据进行了`AES`加密，加密密钥可以在设置界面获取到；

解密方法如下:

```csharp
1）读取推送的BASE64数据为byte[] encryptedData;

2）取AES加解密密钥作为AES解密的KEY

3) 取byte[] encryptedData的前16位做为IV；

4）取第16位后的字节数组做为待解密内容；

5）解密模式使用CBC（密码块链模式）；

6）填充模式使用PKCS #7（填充字符串由一个字节序列组成，每个字节填充该字节序列的长度）；

7）使用配置好的实例化AES对象执行解密；

8）使用UTF-8的方式，读取二进制数组得到原始数据
```

示例代码（C#）
```csharp
//1）读取推送的BASE64数据为byte[] encryptedData;
byte[] encryptedData = Convert.FromBase64String(encrypted);
if (encryptedData == null || encryptedData.Length < 17)
	return null;
//2）取AES加解密密钥作为AES解密的KEY;
byte[] key = Encoding.UTF8.GetBytes(aesKey);
//3) 取byte[] encryptedData的前16位做为IV；
byte[] iv = encryptedData.Take(16).ToArray();
//4）取第16位后的字节数组做为待解密内容；
encryptedData = encryptedData.Skip(16).ToArray();
using (var aes = new RijndaelManaged())
{
//5）解密模式使用CBC（密码块链模式）；
	aes.Mode = CipherMode.CBC;
//6）填充模式使用PKCS #7（填充字符串由一个字节序列组成，每个字节填充该字节序列的长度）；
	aes.Padding = PaddingMode.PKCS7;
	aes.Key = key;
	aes.IV = iv;
	var cryptoTransform = aes.CreateDecryptor();
//7）使用配置好的实例化AES对象执行解密
	byte[] r = cryptoTransform.TransformFinalBlock(encryptedData, 0, encryptedData.Length);
//8）使用UTF-8的方式，读取二进制数组得到原始数据
	return Encoding.UTF8.GetString(r);
}
```
示例代码（java）
```java
import sun.misc.BASE64Decoder;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class AesUtils {
    private static String ALGO = "AES";
    private static String ALGO_MODE = "AES/CBC/NoPadding";
    public static String aesDecrypt(String encryptedData, String securityKey) {
        try {
            byte[] data = (new BASE64Decoder()).decodeBuffer(encryptedData);
            byte[] iv = Arrays.copyOfRange(data, 0, 16);
            Cipher cipher = Cipher.getInstance(ALGO_MODE);
            SecretKeySpec keySpec = new SecretKeySpec(securityKey.getBytes("utf-8"), ALGO);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec);
            byte[] countent = Arrays.copyOfRange(data, 16, data.length);
            byte[] original = cipher.doFinal(countent);
            String originalString = new String(original);
            return originalString.trim();
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}

--提示
java jdk版本小于1.8_161时需要设置java.security文件中crypto.policy=unlimited
```
## 3、推送内容及格式
1、推送内容存储在表单(`application/x-www-form-urlencoded`)的`content`字段中,（补推的数据需要兼容获取`input.stream`中的内容）;
2、`content`字段的值为经过`aes`加密和`urlencode`后的`base64`字符串，解密后的内容包括答卷数据以及问卷数据；
3、答卷数据：推送内容及格式与数据推送`API`相同，参见：`https://www.wjx.cn/help/help.aspx?helpid=407&h=1`

4、问卷数据：推送内容及格式与问卷开放[API[1000001]](https://openapi.wjx.cn/web/#/5/34 "API[1000001]")接口相同；

# DEMO
## 1、demo地址：
`https://www.wjx.cn/demo/activityredirect.aspx?aes=822861f9c5114dc2bda214cd9567d0dc`注：aes=为AES解密密钥

## 2、示例代码(C#)：
```csharp
public partial class demo_activityredirect : System.Web.UI.Page
{
	string aeskey = "";
	string content = string.Empty;
	protected void Page_Load(object sender, EventArgs e)
	{
		content = Request.Form["content"];/* Request.InputStream*/
		aeskey = Request.QueryString["aes"];
		Write("推送的加密内容[content]:" + Receive());
	}
	//接收推送消息
	protected string Receive()
	{
		try
		{
			if (!string.IsNullOrEmpty(content) && !string.IsNullOrEmpty(aeskey))
			{
				content = Wjx.Common.Encrypt.Aes.Decrypt(content, aeskey);
				return content;
			}
			return "读取内容为空";
		}
		catch (Exception e)
		{
			return "出错啦！\r\n" + e.Message;
		}
	}
}
```



================================================================================
## 问卷新增和编辑后推送
================================================================================


# 问卷新增和编辑页全局推送设置

- 设置此功能请咨询客户顾问
- 编辑跳转设置支持设置跳转Url、是否推送问卷内容、是否仅Ajax请求；
- 设置图如下：
![](https://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile/sign/3530ca53cc7888ee90bee76cbe8a4a04)

- 编辑跳转时，自动携带如下参数：
  1） `ActivityId` 问卷编号（Url内携带）
  2） `ActivityName` 问卷标题（Url内携带）
  3） `ActivityDomain` 问卷访问域名（Url内携带）
  4） `ActivityPCUrl` 问卷访问PC端链接（Url内携带）
  5） `ActivityH5Url` 问卷访问移动端链接（Url内携带）
  6） `Content` 问卷内容（AES加密）（消息体内携带）
  7） `wjxparams***` 自定义参数（Url内携带）

- 当选择了Ajax推送时，会打印推送日志（和答卷推送日志一起存放）
- Ajax推送失败后，会转到后台补发
- PC端与移动端问卷编辑同时支持
- Content格式参考获取[问卷内容接口文档](https://openapi.wjx.cn/web/#/5/34 "问卷内容接口文档")



================================================================================
## 考试答卷阅卷后推送
================================================================================

[TOC]


# 一、应用场景
如果您需要在老师阅完答卷后，拿到答卷数据和总分（包含主观题分数），可以使用本接口，将提交的答卷Post到您指定的URL，并保存。

# 二、页面目标地址
使用页面目标地址需要注意以下问题：

1、该地址需保证外网可访问的状态；

2、该地址需要承载填写者提交答卷后的跳转落地页，所以需保证合适的页面内容；

3、数据将以表单的方式`POST`到该地址，需要增加开发代码以读取`form`表单数据的`content`内容。

4、页面地址可以跟跳转推送地址推送保持一致（为了区分，在推送内容增加了字段`ksyjpost=1`）

# 三、POST答卷数据
POST答卷数据会将在考试答卷主观题阅卷完成后，实时推送到“页面目标地址”。每份答卷完成阅卷后，就会执行一次推送操作；

## 1、推送机制
1） 用户在问卷设置界面其他设置->阅卷完成后推送填上推送地址；
![](https://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile&sign=9d86d5406760ffbdcabc687d42012cf1)
## 2、数据加密
考虑到答卷数据传输的安全性，推送的答卷数据进行了`AES`加密，加密密钥可以在设置界面获取到；

## 3、推送内容及格式
推送答卷编号和总分数据示例：
```csharp
{"activity":"5657754","joinid":"101812480275","totalvalue":"15","ksyjpost":"1"}
```




================================================================================
## 即时抽奖推送
================================================================================

[TOC]


# 二、页面目标地址
![](https://openapi.wjx.cn/server/index.php?s=/api/attachment/visitFile&sign=365ba711f224264306b628402a695045)

使用页面目标地址需要注意以下问题：

1、该地址需保证外网可访问的状态；

2、该地址需要承载填写者提交答卷后的跳转落地页，所以需保证合适的页面内容；

3、数据将以表单的方式`POST`到该地址，需要增加开发代码以读取`form`表单数据的`content`内容。

# 三、POST中奖用户数据

## 1、推送机制
1） 用户在奖品设置界面设置推送到指定页面；


## 2、数据加密
考虑到答卷数据传输的安全性，推送的答卷数据进行了`AES`加密，加密密钥在设置推送地址后显示；

## 3、推送内容及格式

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|vid	|int	|问卷编号	|是	||
|joinid	|int	|提交答卷编号	|是	||
|index	|int	|答卷序号	|是	||
|awarddate	|datetime	|中奖时间	|是	||
|awardName	|string	|奖项名称	|是	||
|name	|string	|中奖人姓名	|是	||
|phoneNumber	|string	|中奖人联系方式	|否	||
|address	|string	|中奖人地址	|否	|奖品类型为优惠券时，返回优惠券代码|
|ext	|string	|附加信息	|否	||
|hassend	|bool	|是否发放	|否	||
|sojumpparm	|string	|自定义链接参数	|否	|||






================================================================================
# 接口规范
================================================================================


================================================================================
## 接口规范
================================================================================

[TOC]

`注：如果您已经自定义域名，请将接口地址中的域名www.wjx.cn换成自定义域名`

1、接口仅支持`post`请求，`json`的数据格式，需要在` http header`中设置 `Content-Type:application/json`。
2、接口使用`Utf-8`编号；
3、以键值对的方式传递参数；
4、可在接口地址后统一加上`?traceid=xxx&amp;action=xxx`来方便跟踪定位；
5、QPS(每秒最大请求数)限制，参见[3.1 数据接口列表](https://www.showdoc.com.cn/wjxopenapi/7565183782246685 &quot;3.1 数据接口列表&quot;)中对各接口的限制；
6、公共参数说明如下：

#### GET请求参数列表：

|字段|类型|是否必须|默认|说明|
|:---    |:------    |--- |-|--------      |
|traceid	  |varchar     |否	|	 | 1:为方便跟踪请求定位问题，建议添加&lt;br&gt; 2:值为全局唯一标识符（GUID，Globally Unique Identifier） &lt;br&gt; 3:GUID值采用32位全小写格式，不含“-”  &lt;br&gt; 4:参与签名&lt;br&gt; 5:traceid参数不要放在POST参数中     |

#### POST请求参数列表：

|字段|类型|是否必须|默认|说明|
|:---    |:------    |--- |-|--------      |
|appid	  |varchar     |是	|	 | 开发ID，开发密钥appkey请联系客户顾问获取   |
|ts	  |varchar     |是	|	 | Unix时间戳（格林威治时间1970年01月01日00时00分00秒起至现在的总秒数）主要用于请求有效期检查的，过期时间为30秒   |
|encode	  |varchar     |否	|	 | 签名验证方式，支持SHA1、SHA256、SHA384、SHA512、SM3，不填默认为SHA1   |
|nocache	  |varchar     |否	|	 | 可选参数，指定查询类接口是否使用缓存，默认值为0；使用缓存，1：不使用缓存   |
|action	  |varchar     |是	|	 | 请求的接口编号，参见3.1 数据接口列表   |
|sign	  |varchar     |是	|	 | sign计算方法：&lt;br&gt;1、对消息体所有参数的参数名按ASCII码字母顺序进行排序；&lt;br&gt;2、根据排序参数名拼接对应的参数值；&lt;br&gt;3、将appkey加上所得的拼接字符串最后，得到加密原串；&lt;br&gt;4、对加密原串进行SHA1（默认）加密得到sign值；&lt;br&gt;5、 appid，appkey请联系客户顾问获取；|


#### 响应参数列表：

|字段|类型|说明|
|:---    |:------    |--- |-|--------      |
|result	  |boolean   | true/false  |
|data	  |object    | 值为true时，data为返回的接口数据  |
|errormsg |varchar   | 值为false时，errormsg为返回的错误描述  |

#### sign计算示例代码如下
C#代码：
```csharp
string url = &quot;https://&quot; + host + &quot;/openapi/default.aspx&quot;;
//时间截，用于判断请求的过期时间
string ts = Convert.ToInt64((DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, 0)).TotalSeconds).ToString();
//使用排序字典来构造参数
SortedDictionary&lt;string, string&gt; dic = new SortedDictionary&lt;string, string&gt;();
dic.Add(&quot;appid&quot;, appid);
dic.Add(&quot;ts&quot;, ts);
dic.Add(&quot;action&quot;, &quot;1000001&quot;);
dic.Add(&quot;vid&quot;, vid);
dic.Add(&quot;get_questions&quot;, &quot;0&quot;);
dic.Add(&quot;get_items&quot;, &quot;0&quot;);
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
string wjxSign = System.Web.Security.FormsAuthentication.HashPasswordForStoringInConfigFile(toSign.ToString(), &quot;SHA1&quot;).ToLower();
//将签名sign添加到参数中
dic.Add(&quot;sign&quot;, wjxSign);
string content = JsonConvert.SerializeObject(dic);
string data = HttpRequestUtility.SendPostHttpRequest(url, &quot;application/json&quot;, content);
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
        String host = &quot;your_host&quot;;
        String appid = &quot;your_appid&quot;;
        String vid = &quot;your_vid&quot;;
        String appkey = &quot;your_appkey&quot;;

        String url = &quot;https://&quot; + host + &quot;/openapi/default.aspx&quot;;
        
        // 时间截，用于判断请求的过期时间
        long ts = (new Date().getTime() / 1000) - (new Date(0).getTime() / 1000);
        
        // 使用排序字典来构造参数
        SortedMap&lt;String, String&gt; dic = new TreeMap&lt;&gt;();
        dic.put(&quot;appid&quot;, appid);
        dic.put(&quot;ts&quot;, String.valueOf(ts));
        dic.put(&quot;action&quot;, &quot;1000001&quot;);
        dic.put(&quot;vid&quot;, vid);
        dic.put(&quot;get_questions&quot;, &quot;0&quot;);
        dic.put(&quot;get_items&quot;, &quot;0&quot;);
        
        StringBuilder toSign = new StringBuilder();
        for (Map.Entry&lt;String, String&gt; kv : dic.entrySet()) {
            if (kv.getValue() != null &amp;&amp; !kv.getValue().isEmpty()) {
                toSign.append(kv.getValue());
            }
        }
        
        // 在拼接好的toSign基础上再加上appkey，组成最终的签名原串
        toSign.append(appkey);
        
        // 计算SHA1签名值，并将签名值转化为小写格式
        String wjxSign = getSHA1(toSign.toString()).toLowerCase();
        
        // 将签名sign添加到参数中
        dic.put(&quot;sign&quot;, wjxSign);
        
        String content = new ObjectMapper().writeValueAsString(dic);
        
        String data = sendPostHttpRequest(url, content);
        System.out.println(data);
    }

    private static String getSHA1(String str) throws NoSuchAlgorithmException {
        MessageDigest messageDigest = MessageDigest.getInstance(&quot;SHA-1&quot;);
        messageDigest.update(str.getBytes());
        byte[] sha1Hash = messageDigest.digest();
        
        StringBuilder hexString = new StringBuilder();
        for (byte b : sha1Hash) {
            String hex = Integer.toHexString(0xff &amp; b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }

    private static String sendPostHttpRequest(String urlString, String json) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setDoOutput(true);
        conn.setRequestMethod(&quot;POST&quot;);
        conn.setRequestProperty(&quot;Content-Type&quot;, &quot;application/json&quot;);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = json.getBytes(&quot;utf-8&quot;);
            os.write(input, 0, input.length);           
        }

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), &quot;utf-8&quot;))) {
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


================================================================================
# 用户体系 [1002]
================================================================================


================================================================================
## 2.3.1 添加参与者[1002001]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/usersystem.aspx`

- # 2.3.1.1请求参数格式

|参数|参数名|类型|必需|备注|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到|
|auto_create_udept	|部门不存在时自动创建	|bool	|否	|0：不创建<br>1：创建<br>默认值为0|
|users	|参与者列表	|String(user[])	|是	|最多允许批量添加100个用户体系的参与者，支持多次调用；<br>参与者对象：<a href="#2.3.1.1.1">2.3.1.1.1参与者对象（user）</a><br>需要将user[]对象转为string|

<div id="2.3.1.1.1"></div>2.3.1.1.1参与者对象（user）

|参数|参数名|类型|必需|备注|
|:---    |:------    |--- |-|--------      |
|uid	|参与者唯一编号	|string	|是	|鉴别参与者的唯一身份编号<br>同一用户体系下不允许重名；<br>只能包含大小写字母、数字、中文；<br>不能包含任何特殊字符；<br>不能超过30个字符；
|uname	|参与者的姓名	|string	|否	|同一用户体系下允许重名<br>只能包含大小写字母、数字、中文；<br>不能超过30个字符；|
|upass	|参与者的初始登录密码	|string	|否	|用于参与者手动登录，传递后会加密存储，用户体系需要添加此字段，否则接口传入也会被舍弃<br>不能超过50个字符；<br>只能包含大小写字母、数字、!@#$%^&*()_?<>{}特殊字符；|
|udept	|参与者的部门	|String[]	|否	|用户体系需要添加此字段，否则接口传入也会被舍弃<br>多级部门从属关系按序号排列；<br>最多支持4级部门；<br>单级部门不能超过50个字符；<br>字符串“(”会自动转化为“（”；<br>字符串“)”会自动转化为“）”；|
|uextf	|参与者的附加信息	|string[]	|否	|用户体系需要添加此字段，否则接口传入也会被舍弃<br>单个附加信息不能超过50个字符；<br>最多支持10个附加信息；<br>只能包含大小写字母、数字、中文；|


-  举例
```csharp
Content-Type:application/json
{
    "action": "1002001",
    "appid": "10001",
    "auto_create_udept": "1",
    "sign": "75a6656da9a76e8fa379c50e47011a01d80f737a",
    "sysid": "103658",
    "ts": "1594104028",
    "users": "[{\"uid\":\"1\",\"uname\":\"c1\",\"upass\":\"123\",\"udept\":[\"a1\",\"b1\",\"c1\"]},{\"uid\":\"2\",\"uname\":\"c2\",\"upass\":\"123\",\"udept\":[\"a1\",\"b1\",\"c1\"]},{\"uid\":\"3\",\"uname\":\"c3\",\"upass\":\"123\",\"udept\":[\"a1\",\"b1\",\"c2\"]}]"
}
```

# 2.3.2.2响应参数列表

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	||


================================================================================
## 2.3.2 修改参与者[1002002]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/usersystem.aspx`
- # 2.3.2.1 请求参数格式

|参数|参数名|类型|必需|备注|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到|
|auto_create_udept	|部门不存在时创建	|bool	|否	|0：不创建<br>1：创建<br>默认值为0|
|users	|参与者列表	|user[]	|是	|最多允许批量修改100个用户体系的参与者，支持多次调用；<br>参与者对象：[2.3.1.1.1参与者对象（user）](https://openapi.wjx.cn/web/#/5/44 "2.3.1.1.1参与者对象（user）")|

-  举例
```csharp
Content-Type:application/json
{
    "action": "1002002",
    "appid": "10001",
    "auto_create_udept": "1",
    "sign": "75a6656da9a76e8fa379c50e47011a01d80f737a",
    "sysid": "103658",
    "ts": "1594104028",
    "users": "[{\"uid\":\"1\",\"uname\":\"c1\",\"upass\":\"123\",\"udept\":[\"a1\",\"b1\",\"a1\"]},{\"uid\":\"2\",\"uname\":\"c2\",\"upass\":\"123\",\"udept\":[\"a1\",\"b1\",\"c1\"]},{\"uid\":\"3\",\"uname\":\"c3\",\"upass\":\"123\",\"udept\":[\"a1\",\"b1\",\"c2\"]}]"
}
```

- # 2.3.2.2 响应参数列表：

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||




================================================================================
## 2.3.3 删除参与者[1002003]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/usersystem.aspx`

- # 2.3.3.1请求参数格式

|参数|参数名|类型|必需|备注|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到|
|uids	|参与者列表	|string[]	|是	|最多允许批量删除100个用户体系的参与者，支持多次调用；|


-  举例
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1002003&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;b0019bdcf7557b8bf834f867628518238617fbaf&quot;,
    &quot;sysid&quot;: &quot;101496&quot;,
    &quot;ts&quot;: &quot;1593340939&quot;,
    &quot;uids&quot;: &quot;[\&quot;1\&quot;,\&quot;2\&quot;,\&quot;3\&quot;]&quot;
}
```

# 2.3.3.2响应参数列表

|参数|类型|说明|必需|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||




================================================================================
## 2.3.4 绑定问卷[1002004]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/usersystem.aspx`

- # 2.3.4.1请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到
|vid	|问卷编号	|int	|是	|问卷星发送问卷链接中activityid的值|
|uids	|指定人群	|string[]	|是	|参与者编号列表，支持多次调用|
|answer_times	|答题次数	|int	|否	|答题次数限制，默认为0，不限制&lt;br&gt;0：不限&lt;br&gt;1：能填写1次&lt;br&gt;2：能填写2次&lt;br&gt;3：能填写3次&lt;br&gt;4：能填写4次&lt;br&gt;5：能填写5次&lt;br&gt;-1：每天可以填写1次&lt;br&gt;-2：每天可以填写2次&lt;br&gt;-3：每天可以填写3次&lt;br&gt;-4：每天可以填写4次&lt;br&gt;-5：每天可以填写5次&lt;br&gt;101:每月可以填写1次&lt;br&gt;102：每月可以填写2次&lt;br&gt;103：每月可以填写3次&lt;br&gt;104：每月可以填写4次&lt;br&gt;105：每月可以填写5次&lt;br&gt;1001：每周可以填写1次&lt;br&gt;1002：每周可以填写2次&lt;br&gt;1003：每周可以填写3次&lt;br&gt;1004：每周可以填写4次&lt;br&gt;1005：每周可以填写5次&lt;br&gt;999：只能打开一次|
|can_view_result	|结果查询	|bool	|否	|0：不允许结果查询&lt;br&gt;1：允许结果查询&lt;br&gt;默认值为1，允许结果查询|
|can_chg_answer	|修改答卷	|bool	|否	|0：不允许修改答卷&lt;br&gt;1：允许修改答卷&lt;br&gt;默认值为0，不允许修改答卷|
|can_hide_qlist	|待参与列表页隐藏	|Bool	|否	|0：不隐藏&lt;br&gt;1：隐藏&lt;br&gt;默认值为0，不隐藏|

- 举例：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1002004&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;b0019bdcf7557b8bf834f867628518238617fbaf&quot;,
    &quot;ts&quot;: &quot;1593340939&quot;,
    &quot;sysid&quot;: &quot;101186&quot;,
    &quot;vid&quot;: &quot;111763&quot;,
    &quot;uids&quot;: &quot;[\&quot;a1\&quot;,\&quot;a2\&quot;,\&quot;b3\&quot;]&quot;
}
```

- # 2.3.4.2 响应参数列表

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到|
|vid	|问卷编号	|int	|是	|问卷星发送问卷链接中activityid的值|
|answer_times	|答题次数	|int	|否	|答题次数限制，默认为0，不限制&lt;br&gt;0：不限&lt;br&gt;1：能填写1次&lt;br&gt;2：能填写2次&lt;br&gt;3：能填写3次&lt;br&gt;4：能填写4次&lt;br&gt;5：能填写5次&lt;br&gt;-1：每天可以填写1次&lt;br&gt;-2：每天可以填写2次&lt;br&gt;-3：每天可以填写3次&lt;br&gt;-4：每天可以填写4次&lt;br&gt;-5：每天可以填写5次&lt;br&gt;101:每月可以填写1次&lt;br&gt;102：每月可以填写2次&lt;br&gt;103：每月可以填写3次&lt;br&gt;104：每月可以填写4次&lt;br&gt;105：每月可以填写5次&lt;br&gt;1001：每周可以填写1次&lt;br&gt;1002：每周可以填写2次&lt;br&gt;1003：每周可以填写3次&lt;br&gt;1004：每周可以填写4次&lt;br&gt;1005：每周可以填写5次&lt;br&gt;999：只能打开一次|
|can_view_result	|结果查询	|bool	|否	|0：不允许结果查询&lt;br&gt;1：允许结果查询&lt;br&gt;默认值为1，允许结果查询|
|can_chg_answer	|修改答卷	|bool	|否	|0：不允许修改答卷&lt;br&gt;1：允许修改答卷&lt;br&gt;默认值为0，不允许修改答卷|
|can_hide_qlist	|待参与列表页隐藏	|Bool	|否	|0：不隐藏&lt;br&gt;1：隐藏&lt;br&gt;默认值为0，不隐藏|



================================================================================
## 2.3.5 查询问卷绑定[1002005]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/usersystem.aspx`

- # 2.3.5.1请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到
|vid	|问卷编号	|int	|是	|问卷星发送问卷链接中activityid的值|
|join_status	|参与状态	|int	|否	|0：所有的（默认）&lt;br&gt;1：待参与&lt;br&gt;2：已参与|
|day	|指定日期	|	|否	|当且仅当join_status为1，2时有效；&lt;br&gt;当且仅当问卷设置了每天填写时有效；&lt;br&gt;默认值为当日；&lt;br&gt;查询结果：返回指定日期的指定参与状态；&lt;br&gt;格式：yyyymmdd&lt;br&gt;如20210701表示2021年7月1日|
|week	|指定第几周	|	|否	|当且仅当join_status为1，2时有效；&lt;br&gt;当且仅当问卷设置了每周填写时有效；&lt;br&gt;默认值为当前周；&lt;br&gt;查询结果：返回指定周的指定参与状态；&lt;br&gt;格式：yyyyww&lt;br&gt;如202119表示2021年第19周|
|month	|指定月份	|	|否	|当且仅当join_status为1，2时有效；&lt;br&gt;当且仅当问卷设置了每月填写时有效；&lt;br&gt;默认值为当月；&lt;br&gt;查询结果：返回指定月的指定参与状态；&lt;br&gt;格式：yyyymm，如202107&lt;br&gt;如202119表示2021年7月|
|force_join_times	|是否强制多次参与	|	|否	|当指定填写次数超过1次时，参数有效；&lt;br&gt;true或1: 强制，用户未达到填写次数，参与状态按待参与返回；&lt;br&gt;false或0： 不强制，用户已填写至少1次，参与状态按已参与返回；&lt;br&gt;默认为：false 不强制|

- 举例：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1002005&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;b0019bdcf7557b8bf834f867628518238617fbaf&quot;,
    &quot;ts&quot;: &quot;1593340939&quot;,
    &quot;sysid&quot;: &quot;101186&quot;,
    &quot;vid&quot;: &quot;111763&quot;
}
```

- # 2.3.5.2 响应参数列表

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系唯一编号	|int	|是	|为固定值，可在创建完用户体系后在参与者主页登录地址中找到|
|vid	|问卷编号	|int	|是	|问卷星发送问卷链接中activityid的值|
|uids	|参与者用户ID	|string[]	|是	|问卷绑定成功后，可以作答的用户编号|
|answer_times	|答题次数	|int	|否	|答题次数限制，默认为0，不限制&lt;br&gt;0：不限&lt;br&gt;1：能填写1次&lt;br&gt;2：能填写2次&lt;br&gt;3：能填写3次&lt;br&gt;4：能填写4次&lt;br&gt;5：能填写5次&lt;br&gt;-1：每天可以填写1次&lt;br&gt;-2：每天可以填写2次&lt;br&gt;-3：每天可以填写3次&lt;br&gt;-4：每天可以填写4次&lt;br&gt;-5：每天可以填写5次&lt;br&gt;101:每月可以填写1次&lt;br&gt;102：每月可以填写2次&lt;br&gt;103：每月可以填写3次&lt;br&gt;104：每月可以填写4次&lt;br&gt;105：每月可以填写5次&lt;br&gt;1001：每周可以填写1次&lt;br&gt;1002：每周可以填写2次&lt;br&gt;1003：每周可以填写3次&lt;br&gt;1004：每周可以填写4次&lt;br&gt;1005：每周可以填写5次&lt;br&gt;999：只能打开一次|
|can_view_result	|结果查询	|bool	|否	|0：不允许结果查询&lt;br&gt;1：允许结果查询&lt;br&gt;默认值为1，允许结果查询|
|can_chg_answer	|修改答卷	|bool	|否	|0：不允许修改答卷&lt;br&gt;1：允许修改答卷&lt;br&gt;默认值为0，不允许修改答卷|
|can_hide_qlist	|待参与列表页隐藏	|Bool	|否	|0：不隐藏&lt;br&gt;1：隐藏&lt;br&gt;默认值为0，不隐藏|

可以根据获取的参与者用户Id，根据单点登录接口，传递问卷id(activity)参与者用户直接跳转问卷作答。
单点登录接口：https://www.wjx.cn/help/help.aspx?helpid=472&amp;h=1


================================================================================
## 2.3.6 查询用户体系用户分配的问卷[1002006]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/usersystem.aspx `

- # 2.3.6.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|sysid	|用户体系ID	|int	|是	||
|uid	|用户体系下的用户id	|string	|是	||

- 举例：
```csharp
Content-Type:application/json
{
    "action": "1002005",
    "appid": "10001",
    "sign": "b0019bdcf7557b8bf834f867628518238617fbaf",
    "ts": "1593340939",
    "sysid": "101186",
    "uid": "111763"
}
```

- # 2.3.6.2 响应参数列表

|参数|类型|说明|必需|说明|
|:---    |:------    |--- |-|--------      |
|page_index	|int	|分页页码	|是	||
|page_size	|int	|每页问卷数	|是	||
|total_count	|int	|问卷总数	|是	||
|sort	|int	|排序规则	|是	|0：问卷编号升序<br>1：问卷编号降序<br>2：问卷开始时间升序<br>3：问卷开始时间降序|
|activitys	|Dictionary<int, activity>	|问卷列表	|是	|主键为问卷编号<br>值为问卷信息<br>排序为问卷编号降序排序|

### 2.3.6.2.1 答卷对象参数（activity）

|参数	|类型	|说明	|必需	|备注|
|:---    |:------    |--- |-|--------      |
|vid	|int	|问卷编号	|是	||
|sid	|string	|问卷短编号	|是	|sid等于vid时，表示问卷未启用短链接|
|begin_date	|string	|问卷开始时间	|是	|时间格式：<br>yyyy-MM-dd HH:mm:ss；|
|end_time	|string	|问卷结束时间 	|	|时间格式：<br>yyyy-MM-dd HH:mm:ss；|
|atype	|int	|问卷类型	|是	|参见[3.2 问卷类型](https://openapi.wjx.cn/web/#/5/56 "3.2 问卷类型")|
|folder	|string	|问卷所在文件夹	|否	|查询参数中包含文件夹参数时会返回这个字段|
|title	|string	|问卷名称	|是	||
|creater	|string	|问卷创建者	|是	||
|answer_valid	|int	|有效答卷数|	是|	|
|answer_total	|int	|答卷总数	|是	||
|status	|int	|问卷状态	|是	|参见[3.8 问卷状态](https://openapi.wjx.cn/web/#/5/62 "3.8 问卷状态")|
|verify_status	|int	|问卷审核状态	|是	|参见[3.9 问卷审核状态](https://openapi.wjx.cn/web/#/5/63 "3.9 问卷审核状态")|
|pc_path	|string	|PC端问卷Url相对路径	|是	||
|mobile_path	|string	|移动端问卷Url相对路径	|是	||
|activity_domain	|string	|问卷访问域名	|是	||
|iframe_auto_url	|string	|iframe自适应链接	|是	||
|iframe_noauto_url	|string	|iframe不自适应链接	|是	||
|join_status	|int	|参与状态	|	|**·** 1：待参与<br>**·** 2：已参与<br>**·** 3：未参与|
|end_time	|string	|问卷结束时间 	|	|时间格式：yyyy-MM-dd HH:mm:ss；|
|answers	|AnswerInfo[]	|答卷列表信息	|	|参见：<a href="#2.3.6.2.1">2.3.6.2.1答卷对象参数（AnswerInfo）</a>|

<div id="2.3.6.2.1"></div>
### 2.3.6.2.1 答卷对象参数（AnswerInfo）

|参数|类型|说明|必需|说明|
|:---    |:------    |--- |-|--------      |
|vid	|int	|问卷id	|是	||
|jid	|long	|参与问卷id	|是	||
|submit_time	|string	|提交答卷时间	|是	||
|answer_seconds	|int	|问卷作答用时	|是	|单位为秒|
|score	|doule	|考试分数	|否	|考试场景下返回有效|


================================================================================
# 多用户管理 [1003]
================================================================================


================================================================================
## 2.4.1 添加子账户[1003001]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/subuser.aspx`

- # 2.4.1.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|subuser	|子账户用户名	|string	|是	|子账户用户名：&lt;br&gt;1、界面将显示该名称；&lt;br&gt;2、子账户唯一性标识，需由保证绝对唯一性；&lt;br&gt;3、用户名一旦创建，不能修改&lt;br&gt;4、子账户用户名规则：&lt;br&gt;**·** 只能包含大小写字母、数字、中文&lt;br&gt;**·** 不能为纯数字；&lt;br&gt;**·** 不能包含任何特殊字符；&lt;br&gt;**·** 不能超过30个字符；|
|role	|角色	|int	|否	|子账户角色：&lt;br&gt;1、可选字段，默认为：2-问卷管理员&lt;br&gt;2、角色列表：&lt;br&gt;**·** 1：系统管理员&lt;br&gt;**·** 2：问卷管理员（默认角色）&lt;br&gt;**·** 3：统计结果查看员&lt;br&gt;**·** 4：完整结果查看员|
|mobile	|手机号码	|string	|否	|子账户手机号码：&lt;br&gt;1、可选字段，留空时子账户的手机号码为空；&lt;br&gt;2、必须符合中国大陆手机号码格式（以1开头的11位数字）&lt;br&gt;3、此接口不进行手机号码的有效性验证|
|email	|邮箱	|string	|否	|子账户邮箱：&lt;br&gt;1、可选字段，留空时子账户的邮箱为空；&lt;br&gt;2、必须符合基本邮箱格式；|
|password	|登录密码	|string	|否	|子账户初始登录密码：&lt;br&gt;1、可选字段，留空时系统将随机生成密码，需要由子账户单点登录后，自行修改登录密码&lt;br&gt;2、子账户登录密码规则：&lt;br&gt;**·** 只能包含大小写字母、数字、!@#$%^&amp;*()_?&lt;&gt;{}*特殊字符；*&lt;br&gt;**·** *不能为纯数字*；&lt;br&gt;**·** *长度为8-20个字符*；|
|group	|分组编号	|int	|否	|**·** 分组信息从界面上先创建&lt;br&gt;**·** 不传时使用默认分组值：0|

- 示例请求参数：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1003001&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;2bca944acdfaba29fb56844487e9d54a45c3ac87&quot;,
    &quot;ts&quot;: &quot;1593340621&quot;,
    &quot;subuser&quot;: &quot;demo_user&quot;,
    &quot;password&quot;: &quot;MyP@ssw0rd123&quot;,
    &quot;email&quot;: &quot;user@example.com&quot;,
    &quot;mobile&quot;: &quot;15688888891&quot;,
    &quot;role&quot;: &quot;2&quot;
}
```

- # 2.4.1.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;用户名已被占用&quot;
}
```



================================================================================
## 2.4.2 修改子账户[1003002]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/subuser.aspx`

- # 2.4.2.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|subuser	|子账户用户名	|string	|是	|1、必须为系统已经添加的子账户&lt;br&gt;2、修改参数均不存在或为空的情况下，返回失败|
|role	|角色	|int	|否	|子账户角色：&lt;br&gt;1、可选字段，默认为：1-系统管理员&lt;br&gt;2、角色列表：&lt;br&gt;**·** 1：系统管理员&lt;br&gt;**·** 2：问卷管理员（默认角色）&lt;br&gt;**·** 3：统计结果查看员&lt;br&gt;**·** 4：完整结果查看员|
|mobile	|手机号码	|string	|否	|子账户手机号码：&lt;br&gt;1、可选字段，留空时子账户的手机号码为空；&lt;br&gt;2、必须符合中国大陆手机号码格式（以1开头的11位数字）&lt;br&gt;3、此接口不进行手机号码的有效性验证|
|email	|邮箱	|string	|否	|子账户邮箱：&lt;br&gt;1、可选字段，留空时子账户的邮箱为空；&lt;br&gt;2、必须符合基本邮箱格式；|

- 示例请求参数：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1003002&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;2bca944acdfaba29fb56844487e9d54a45c3ac87&quot;,
    &quot;ts&quot;: &quot;1593340621&quot;,
    &quot;subuser&quot;: &quot;demo_user&quot;,
    &quot;email&quot;: &quot;user@example.com&quot;,
    &quot;mobile&quot;: &quot;15688888881&quot;,
    &quot;role&quot;: &quot;3&quot;
}
```

- # 2.4.2.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;用户不存在&quot;
}
```



================================================================================
## 2.4.3 删除子账户[1003003]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/subuser.aspx`

- # 2.4.3.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|subuser	|子账户用户名	|string	|是	|1、必须为系统已经添加的子账户&lt;br&gt;2、修改参数均不存在或为空的情况下，返回失败|

- 示例参数：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1003003&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;2bca944acdfaba29fb56844487e9d54a45c3ac87&quot;,
    &quot;ts&quot;: &quot;1593340621&quot;,
    &quot;subuser&quot;: &quot;demo_user&quot;
}
```

- # 2.4.3.2响应参数列表

|参数	|类型	|说明	|必需	|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;用户不存在&quot;
}
```


================================================================================
## 2.4.4 恢复子账户[1003004]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/subuser.aspx`

- # 2.4.4.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|subuser	|子账户用户名	|string	|是	|1、必须为系统已经添加的子账户&lt;br&gt;2、修改参数均不存在或为空的情况下，返回失败|
|mobile	|手机号码	|string	|否	|子账户手机号码：&lt;br&gt;**·** 可选字段，留空时子账户的手机号码为空；&lt;br&gt;**·** 必须符合中国大陆手机号码格式（以1开头的11位数字）&lt;br&gt;**·** 此接口不进行手机号码的有效性验证|
|email	|邮箱	|string	|否	|子账户邮箱：&lt;br&gt;**·** 可选字段，留空时子账户的邮箱为空；&lt;br&gt;**·** 必须符合基本邮箱格式；|

- 示例参数：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1003004&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;2bca944acdfaba29fb56844487e9d54a45c3ac87&quot;,
    &quot;ts&quot;: &quot;1593340621&quot;,
    &quot;subuser&quot;: &quot;demo_user&quot;
}
```

- # 2.4.4.2 响应参数列表

|参数	|类型	|说明	|必需	|备注|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;用户不存在&quot;
}
```



================================================================================
## 2.4.5 查询子账户[1003005]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/subuser.aspx`

- # 2.4.5.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|subuser	|子账户用户名	|string	|否	|不能超过30个字符；
|name_like	|账户名模糊查询	|string	|否	|**·** 只能包含大小写字母、数字、中文&lt;br&gt;**·** 精确匹配账户名中包含模糊关键字的问卷&lt;br&gt;**·** 长度不超过10个字母或汉字|
|role	|角色	|int	|否	|子账户角色：&lt;br&gt;1、可选字段，默认查询所有角色&lt;br&gt;2、角色列表：&lt;br&gt;**·** 1：系统管理员&lt;br&gt;**·** 2：问卷管理员（默认角色）&lt;br&gt;**·** 3：统计结果查看员&lt;br&gt;**·** 4：完整结果查看员|
|group	|分组编号	|int	|否	|**·** 分组信息从界面上先创建&lt;br&gt;**·** 不传时使用默认分组值：0|
|status	|用户状态	|bool	|否	|**·** true或1：活动&lt;br&gt;**·** false或0：删除&lt;br&gt;**·** 默认返回活动用户|

- 示例参数：
```csharp
Content-Type:application/json
{
    &quot;action&quot;: &quot;1003005&quot;,
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;sign&quot;: &quot;2bca944acdfaba29fb56844487e9d54a45c3ac87&quot;,
    &quot;ts&quot;: &quot;1593340621&quot;,
    &quot;role&quot;: &quot;2&quot;
}
```

- # 2.4.5.2 响应参数列表

|参数	|类型	|说明	|必需	|备注|
|:---    |:------    |--- |-|--------      |
|users	|SubUser[]	|问卷列表	|是	|详细定义参见：&lt;a href=&quot;#2.4.5.2.1&quot;&gt;2.4.5.2.1子账户对象参数（SubUser）&lt;/a&gt;|

&lt;div id=&quot;2.4.5.2.1&quot;&gt;&lt;/div&gt;2.4.5.2.1 子账户对象参数（SubUser）

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|subuser	|子账户用户名	|string	|是	||
|role	|角色	|int	|是	|角色列表：&lt;br&gt;**·** 1：系统管理员&lt;br&gt;**·** 2：问卷管理员（默认角色）&lt;br&gt;**·** 3：统计结果查看员&lt;br&gt;**·** 4：完整结果查看员|
|group	|分组编号	|int	|是	|没有分组时使用默认分组0|
|group_name	|分组名称	|string	|是	|没有分组时使用默认为空|
|status	|用户状态	|bool	|否	|**·** true：活动&lt;br&gt;**·** false：删除|
|openid	|微信openid	|string	|否	|子账户绑定了微信才有openid值|
|create_time	|创建时间	|string	|否	|时间格式：yyyy-MM-dd HH:mm:ss；|
|wx_openid	|微信openid	|string	|否	|子账户绑定了微信才有此参数|
|wx_nickname	|微信昵称	|string	|否	|子账户绑定了微信才有此参数|



================================================================================
# 通讯录 [1005]
================================================================================


================================================================================
## 2.6.1 查询成员[1005001]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.1.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；|
|uid	|用户编号	|string	|是	|用户的唯一标识，对应管理界面中的用户ID |

- 示例请求参数：
```csharp
Content-Type:application/json
{
    "action": "1005001",
    "appid": "10001",
    "sign": "2bca944acdfaba29fb56844487e9d54a45c3ac87",
    "ts": "1593340621",
    "corpid": "mul0000010001",
    "uid": "xia"
}
```

- # 2.6.1.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	userid|	用户编号|	string|是	|用户的唯一标识|
|	name|	姓名|	string|是	|用户姓名|
|	nickname|	昵称|	string|否	|用户昵称|
|	mobile|	手机号|	string|否	|手机号|
|	email|	邮箱|	string|否	|邮箱|
|	department|	部门或分组|	string|否	|部门或分组|
|	birthday|	生日|	string|否	|格式：yyyy-MM-dd|
|	date01|	自定义日期01|	string|否	|自定义日期01|
|	date02|	自定义日期02|	string|否	|自定义日期02|
|	gender|	性别|	string|否	|0:保密，1: 男，2: 女|
|	education|	受教育程度|	string|否	|0:保密，<br>1:初中及以下，<br>2:高中或中专，<br>3:大学专科，<br>4:大学本科，<br>5:硕士及以上|
|	marriage|	婚姻状况|	string|否	|0:保密，<br>1:未婚，<br>2:已婚，<br>3:离异|
|	family|	家庭状况|	string|否	|0:保密，<br>1:没有小孩，<br>2:一个小孩，<br>3:两个小孩，<br>4:三个小孩及以上|
|	source|	来源|	string|否	|来源|
|	sourcedetail|	来源详情|	string|否	|来源详情|
|	tags|	用户标签|	`Dictionary<string, HashSet<string>>`|否	|用户标签|
|	appid|	微信应用AppId|	string|否	|微信应用AppId|
|	openid|	微信OpenId|	string|否	|微信OpenId|
|	note|	用户备注|	string|否	|用户备注|
|	followusername|	负责人|	string|否	|负责人|

示例响应参数1：
```csharp
{
    "result": true,
	"data":{
     "userid": "1001",
	 "name": "张三",
	 "nickname": "李三",
	 "mobile": "13110001000",
	 "email": "zhangsan@txn.com",
	 "department": "01",
	 "birthday": "1993-10-02",
	 "date01": "1993-10-03",
	 "date02": "1993-10-04",
	 "gender": "1",
	 "education": "4",
	 "marriage": "1",
	 "family": "0",
	 "source": "",
	 "sourcedetail": "",
	 "tags": "01,02",
	 "appid": "1002002",
	 "openid": "",
	 "note": "",
	 "followusername": ""
	 }
}
```



================================================================================
## 2.6.1 添加或更新成员[1005002]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.2.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；|
|users	|用户列表	|user[]	|是	|最多允许批量修改100个用户体系的参与者，支持多次调用；&lt;br&gt;参与者对象：&lt;a href=&quot;#2.6.2.1.1&quot;&gt;2.6.2.1.1参与者对象（user）&lt;/a&gt; |
|auto_create_udept	|是否自动创建部门	|bool	|否	|0或false：不创建 &lt;br&gt;1或true：创建 &lt;br&gt;默认值为0 |
|auto_create_tag	|是否自动创建标签	|bool	|否	|0或false：不创建&lt;br&gt;1或true：创建&lt;br&gt;默认值为0 |

&lt;div id=&quot;2.6.2.1.1&quot;&gt;&lt;/div&gt;2.6.2.1.1用户对象（user）

|参数|参数名|类型|必需|备注|
|:---    |:------    |--- |-|--------      |
|userid	|用户唯一编号	|string	|是	|鉴别用户的唯一身份编号&lt;br&gt;不允许重复。
|name	|姓名	|string	|是	|不能超过30个字符。|
|nickname	|昵称	|string	|否	|不能超过50个字符。（暂未使用）|
|mobile	|手机号	|string	|否	|不允许重复|
|email	|邮箱	|string	|否	|不允许重复|
|department	|所属部门	|string	|否	|上下级用‘/’隔开且从最上级开始，多部门用；(中文分号)隔开，例如：产品/设计；产品/交互。|
|tags	|标签	|string	|否	|组和标签用‘/’隔开，多标签用；(中文分号)隔开，例如：学历/本科；年龄/18-35。|
|birthday	|生日	|date	|否	|格式：yyyy-MM-dd|
|gender	|性别	|string	|否	|使用数字：保密 = 0,男 = 1, 女 = 2,不传或传入其他值默认为0|
|education	|学历	|string	|否	|保密 = 0,初中及以下 = 1,高中或中专 = 2,大学专科 = 3,大学本科 = 4,硕士及以上 = 5,不传或传入其他值默认为0|
|marriage	|婚姻状况	|string	|否	| 保密 = 0,未婚 = 1,已婚 = 2,离异 = 3,不传或传入其他值默认为0。|
|family	|家庭情况	|string	|否	|保密 = 0,没有小孩 = 1,一个小孩 = 2,两个小孩 = 3,三个小孩及以上 = 4,不传或传入其他值默认为0。|
|pwd	|登录密码	|string	|否	|用户使用账户密码登录场景。|

- 示例请求参数：
```csharp
Content-Type:application/json
{
 &quot;action&quot;: &quot;1005002&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
 &quot;appid&quot;: &quot;10001&quot;,
 &quot;auto_create_udept&quot;: &quot;1&quot;,
 &quot;auto_create_tag&quot;: &quot;1&quot;,
 &quot;sign&quot;: &quot;75a6656da9a76e8fa379c50e47011a01d80f737a&quot;,
 &quot;ts&quot;: &quot;1594104028&quot;,
 &quot;users&quot;: &quot;[{\&quot;userid\&quot;:\&quot;18565886123\&quot;,\&quot;name\&quot;:\&quot;测试2\&quot;,\&quot;nickname\&quot;:\&quot;昵称测试2\&quot;,\&quot;mobile\&quot;:\&quot;18565886123\&quot;,\&quot;email\&quot;:\&quot;12333@qq.ocm\&quot;,\&quot;department\&quot;:\&quot;研发/后端2\&quot;,\&quot;birthday\&quot;:\&quot;1992-10-02\&quot;,\&quot;gender\&quot;:\&quot;1\&quot;,\&quot;education\&quot;:\&quot;4\&quot;,\&quot;marriage\&quot;:\&quot;2\&quot;,\&quot;family\&quot;:\&quot;2\&quot;,\&quot;tags\&quot;:\&quot;123/10032\&quot;,\&quot;pwd\&quot;:\&quot;2\&quot;}]&quot;
}
```

- # 2.6.2.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功||
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```



================================================================================
## 2.6.3 删除成员[1005003]
================================================================================


[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.3.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；|
|uids	|用户编号	|string	|是	|用户的唯一标识，多个用户使用","分隔 |

- 示例请求参数：
```csharp
Content-Type:application/json
{
    "action": "1005003",
    "appid": "10001",
    "sign": "2bca944acdfaba29fb56844487e9d54a45c3ac87",
    "ts": "1593340621",
    "corpid": "mul0000010001",
    "uids": "xia,xia1"
}
```

- # 2.6.3.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    "result": true
}
```
示例响应参数2：
```csharp
{
    "result": false,
    "errormsg": "用户名xia1不存在"
}
```



================================================================================
## 2.6.4 添加或修改管理员[1005004]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.4.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|否	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|users	|管理员列表	|String(adminuser[])		|是	|最多允许批量添加100个管理员，支持多次调用；管理员对象对象：需要将adminuser[]对象转为string |

&lt;div id=&quot;2.6.4.1.1&quot;&gt;&lt;/div&gt;2.6.6.1.1参与者对象（user）

|参数|参数名|类型|必需|备注|
|:---    |:------    |--- |-|--------      |
|userid	|管理员用户ID	|string	|是	|鉴别管理员的唯一身份编号&lt;br&gt;可在通讯录界面下查看；
|role	|管理员权限	|int	|否	|0-系统管理员，1-分组管理员，2-问卷管理员，3-统计结果查看员，4-完整结果查看员，5-部门管理员；默认为完整结果查看员|
|confidential	|是否保密账户	|bool	|否	|1或者true为真，0或者false为假|
|effective_date	|管理员有效期	|string	|否	|格式为yyyy-MM-dd|
|remark	|备注	|string	|否	|备注长度不能超过50个字|

- 示例请求参数：
```csharp
Content-Type:application/json
{
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;corpid&quot;: &quot;org0000010001&quot;,
    &quot;users&quot;: &quot;[{\&quot;userid\&quot;:\&quot;19111112222\&quot;,\&quot;role\&quot;:1,\&quot;confidential\&quot;:1,\&quot;effective_date\&quot;:\&quot;2024-12-25\&quot;,\&quot;remark\&quot;:\&quot;123\&quot;},{\&quot;userid\&quot;:\&quot;205783\&quot;,\&quot;role\&quot;:2,\&quot;confidential\&quot;:0,\&quot;effective_date\&quot;:\&quot;2024-12-26\&quot;,\&quot;remark\&quot;:\&quot;33331\&quot;}]&quot;,
    &quot;sign&quot;: &quot;d2050d70204bc2fd98e60cfe34cd6f2501500078&quot;,
    &quot;action&quot;: &quot;1005004&quot;,
    &quot;ts&quot;: 1583812686
}
```

- # 2.6.4.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```




================================================================================
## 2.6.5 删除管理员[1005005]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.5.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|否	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|uids	|管理员用户ID列表	|string		|是	|多个用户ID使用英文逗号,隔开 |



- 示例请求参数：
```csharp
Content-Type:application/json
{
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;corpid&quot;: &quot;org0000010001&quot;,
    &quot;uids&quot;: &quot;20222,18758920057&quot;,
    &quot;sign&quot;: &quot;d2050d70204bc2fd98e60cfe34cd6f2501500078&quot;,
    &quot;action&quot;: &quot;1005005&quot;,
    &quot;ts&quot;: 1583812686
}
```

- # 2.6.5.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```




================================================================================
## 2.6.6 恢复管理员[1005006]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.6.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|否	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|uids	|管理员用户ID列表	|string		|是	|多个用户ID使用英文逗号,隔开 |



- 示例请求参数：
```csharp
Content-Type:application/json
{
    &quot;appid&quot;: &quot;10001&quot;,
    &quot;corpid&quot;: &quot;org0000010001&quot;,
    &quot;uids&quot;: &quot;20222,18758920057&quot;,
    &quot;sign&quot;: &quot;d2050d70204bc2fd98e60cfe34cd6f2501500078&quot;,
    &quot;action&quot;: &quot;1005006&quot;,
    &quot;ts&quot;: 1583812686
}
```

- # 2.6.6.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	|	|	|	|||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```





================================================================================
## 2.6.7 部门列表[1005101]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.7.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|



- 示例请求参数：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005101&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.7.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|id	|	编号|	string|	是|唯一编号，根部门编号为1|
|name	|	名称|	string|	是|名称|
|parentid	|	所属上级编号|	string|	是||
|order	|	排序|	int|	是|排序，按升序排序|
|create_time	|	创建时间|	datetime|	是|创建时间|
|update_time	|	更新时间|	datetime|	是|更新时间||

示例响应参数：
```csharp
{
    &quot;result&quot;: true,
    &quot;data&quot;: [
        {
            &quot;id&quot;: &quot;06ce9a6c8ea2462b8379e18c0810d375&quot;,
            &quot;name&quot;: &quot;秘书&quot;,
            &quot;parentid&quot;: &quot;0ad16e9607f947ad9305fb24f2772b6e&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;0ad16e9607f947ad9305fb24f2772b6e&quot;,
            &quot;name&quot;: &quot;总裁办&quot;,
            &quot;parentid&quot;: &quot;1&quot;,
            &quot;order&quot;: 1,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;0dc212a53ffc4e089777895fc655c5f8&quot;,
            &quot;name&quot;: &quot;后端2&quot;,
            &quot;parentid&quot;: &quot;f701e11acabc439c9bd1cb5ef46d98b0&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;2025-08-12 18:49:37&quot;,
            &quot;update_time&quot;: &quot;2025-08-12 18:49:37&quot;
        },
        {
            &quot;id&quot;: &quot;0f43c2275d9346febc2c1f11112bcf10&quot;,
            &quot;name&quot;: &quot;前端&quot;,
            &quot;parentid&quot;: &quot;f701e11acabc439c9bd1cb5ef46d98b0&quot;,
            &quot;order&quot;: 2,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;1&quot;,
            &quot;name&quot;: &quot;问卷星&quot;,
            &quot;parentid&quot;: &quot;0&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;13a65ee9b688401faa7b6cd2a13d0b0f&quot;,
            &quot;name&quot;: &quot;客服&quot;,
            &quot;parentid&quot;: &quot;1&quot;,
            &quot;order&quot;: 2,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;1d146a47621e4ed9b4e58ba2bb6b31b4&quot;,
            &quot;name&quot;: &quot;aaaaa&quot;,
            &quot;parentid&quot;: &quot;1dc5339a942a4dac9e5316a7fdf73014&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;1dc5339a942a4dac9e5316a7fdf73014&quot;,
            &quot;name&quot;: &quot;aaaa&quot;,
            &quot;parentid&quot;: &quot;f0bd890429744cf1bba1ba8e659006b1&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;3b0f80ef7d0545b19112bcfbc83f0e67&quot;,
            &quot;name&quot;: &quot;a&quot;,
            &quot;parentid&quot;: &quot;a55007c79d6e41c488a1b32e2a3e2141&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;4d574099e76f4240ba5699d4626a8b8b&quot;,
            &quot;name&quot;: &quot;营销部&quot;,
            &quot;parentid&quot;: &quot;1&quot;,
            &quot;order&quot;: 4,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;6b18257cff9648d2a340b956d510d248&quot;,
            &quot;name&quot;: &quot;客服1&quot;,
            &quot;parentid&quot;: &quot;13a65ee9b688401faa7b6cd2a13d0b0f&quot;,
            &quot;order&quot;: 1,
            &quot;create_time&quot;: &quot;2025-08-12 14:59:27&quot;,
            &quot;update_time&quot;: &quot;2025-08-12 16:01:30&quot;
        },
        {
            &quot;id&quot;: &quot;a55007c79d6e41c488a1b32e2a3e2141&quot;,
            &quot;name&quot;: &quot;一部&quot;,
            &quot;parentid&quot;: &quot;ef9fb2464a414a709cbcd7f8ced76c53&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;ac3eb94a375841aabc2d86d79f1b99f4&quot;,
            &quot;name&quot;: &quot;aa&quot;,
            &quot;parentid&quot;: &quot;3b0f80ef7d0545b19112bcfbc83f0e67&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;ef9fb2464a414a709cbcd7f8ced76c53&quot;,
            &quot;name&quot;: &quot;测试&quot;,
            &quot;parentid&quot;: &quot;f701e11acabc439c9bd1cb5ef46d98b0&quot;,
            &quot;order&quot;: 1,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;f0bd890429744cf1bba1ba8e659006b1&quot;,
            &quot;name&quot;: &quot;aaa&quot;,
            &quot;parentid&quot;: &quot;ac3eb94a375841aabc2d86d79f1b99f4&quot;,
            &quot;order&quot;: 0,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;f0ca7bfb2ed4415c9a19a304b2e55968&quot;,
            &quot;name&quot;: &quot;后端&quot;,
            &quot;parentid&quot;: &quot;f701e11acabc439c9bd1cb5ef46d98b0&quot;,
            &quot;order&quot;: 3,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        },
        {
            &quot;id&quot;: &quot;f701e11acabc439c9bd1cb5ef46d98b0&quot;,
            &quot;name&quot;: &quot;研发&quot;,
            &quot;parentid&quot;: &quot;1&quot;,
            &quot;order&quot;: 3,
            &quot;create_time&quot;: &quot;1970-01-01 00:00:00&quot;,
            &quot;update_time&quot;: &quot;1970-01-01 00:00:00&quot;
        }
    ]
}
```






================================================================================
## 2.6.8 添加部门[1005102]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.8.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|depts	|部门列表	|string		|是	|上下级用‘/’隔开且从最上级开始，例如：产品/设计，每级名称不能超过50字符 |



- 示例请求参数：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;depts&quot;: &quot;[\&quot;研发/研发1\&quot;,\&quot;客服/客服1\&quot;]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005102&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.8.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功|
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```





================================================================================
## 2.6.9 修改部门[1005103]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.9.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|depts	|部门列表	|dept[]		|是	|部门信息：&lt;a href=&quot;#2.6.9.1.1&quot;&gt;2.6.9.1.1部门对象（dept）&lt;/a&gt; |

&lt;div id=&quot;2.6.9.1.1&quot;&gt;&lt;/div&gt;部门对象

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|id	|部门编号	|string	|是	|部门编号，从部门列表中获取|
|name	|名称	|string		|否	|需要修改的名称，名称不能超过50字符 |
|order	|排序	|int		|否	|需要修改的排序，大于0的整数 |

- 示例请求参数：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;depts&quot;: &quot;[{\&quot;id\&quot;:\&quot;ec935ece40164b46ba7689e6bd08760c\&quot;,\&quot;name\&quot;:\&quot;研发2\&quot;,\&quot;order\&quot;:\&quot;1\&quot;},{\&quot;id\&quot;:\&quot;6b18257cff9648d2a340b956d510d248\&quot;,\&quot;客服2\&quot;:\&quot;10031\&quot;,\&quot;order\&quot;:\&quot;1\&quot;}]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005103&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.9.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功|
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```







================================================================================
## 2.6.10 删除部门[1005104]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.10.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|type	|传参类型	|string		|是	|1：传入部门编号(xxxxxx)，2：传入部门路径（客服/客服1） |
|depts	|部门列表	|string[]		|是	|参考请求参数示例 |


- 示例请求参数1：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;type&quot;: &quot;1&quot;,
  &quot;depts&quot;: &quot;[\&quot;ec935ece40164b46ba7689e6bd08760c\&quot;,\&quot;ec935ece40164b46ba7689e6bd08760c\&quot;]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005104&quot;,
  &quot;ts&quot;: 1583812686
}
```

- 示例请求参数2：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;type&quot;: &quot;1&quot;,
  &quot;depts&quot;: &quot;[\&quot;研发/研发一部\&quot;,\&quot;客服/客服1\&quot;]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005104&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.10.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功|
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```








================================================================================
## 2.6.11 标签列表[1005201]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.11.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|

- 示例请求参数：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005201&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.11.2 响应参数列表

标签组对象

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|tagid	|	父标签（标签组） id|	string|	是|唯一编号|
|tagname	|	父标签名称|	string|	是|名称|
|create_time	|	创建时间|	datetime|	是|格式 yyyy-MM-dd HH:mm:ss	|
|is_radio	|	选择类型（是否单选）|	bool|	是|false：多选，true：单选|
|childs	|	子标签列表|	array|	否|见下方||

子标签对象

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|tagid	|	父标签（标签组） id|	string|	是|唯一编号|
|tagname	|	父标签名称|	string|	是|名称|
|create_time	|	创建时间|	datetime|	是|格式 yyyy-MM-dd HH:mm:ss	|

示例响应参数：
```csharp
{
    &quot;result&quot;: true,
    &quot;data&quot;: [
        {
            &quot;tagid&quot;: &quot;2981c279dcfa42d19f764eaeff6c8e41&quot;,
            &quot;childs&quot;: [
                {
                    &quot;tagid&quot;: &quot;16e6cddd1e50444d9344a12042c7ebc6&quot;,
                    &quot;tagname&quot;: &quot;羽毛球&quot;,
                    &quot;create_time&quot;: &quot;2024-10-28 15:06:45&quot;
                },
                {
                    &quot;tagid&quot;: &quot;1cb9d21bd2a74b598052275b2ebbba5b&quot;,
                    &quot;tagname&quot;: &quot;篮球1&quot;,
                    &quot;create_time&quot;: &quot;2025-08-11 10:28:07&quot;
                },
                {
                    &quot;tagid&quot;: &quot;29b1ce4c14544c369150d828833e11d5&quot;,
                    &quot;tagname&quot;: &quot;足球2&quot;,
                    &quot;create_time&quot;: &quot;2025-08-11 10:28:07&quot;
                }
            ],
            &quot;tagname&quot;: &quot;爱好&quot;,
            &quot;create_time&quot;: &quot;2024-10-28 15:06:45&quot;,
            &quot;is_radio&quot;: false
        },
        {
            &quot;tagid&quot;: &quot;35cb9c4315dd448f918562f33b63de51&quot;,
            &quot;childs&quot;: [
                {
                    &quot;tagid&quot;: &quot;0f796cf2fc0140dab217d151bacd0630&quot;,
                    &quot;tagname&quot;: &quot;1004&quot;,
                    &quot;create_time&quot;: &quot;2025-08-12 09:55:47&quot;
                },
                {
                    &quot;tagid&quot;: &quot;3b2ea3c4a5824066b98da2a285888a4f&quot;,
                    &quot;tagname&quot;: &quot;10032&quot;,
                    &quot;create_time&quot;: &quot;2025-08-12 18:49:37&quot;
                },
                {
                    &quot;tagid&quot;: &quot;afddefb272f24103ae9e98666a1f9e0b&quot;,
                    &quot;tagname&quot;: &quot;1002&quot;,
                    &quot;create_time&quot;: &quot;2025-08-12 09:52:27&quot;
                },
                {
                    &quot;tagid&quot;: &quot;db50f7be9e2a41c68a95901fa476d81a&quot;,
                    &quot;tagname&quot;: &quot;1003&quot;,
                    &quot;create_time&quot;: &quot;2025-08-12 09:52:44&quot;
                }
            ],
            &quot;tagname&quot;: &quot;123&quot;,
            &quot;create_time&quot;: &quot;2025-08-12 09:51:59&quot;,
            &quot;is_radio&quot;: true
        },
        {
            &quot;tagid&quot;: &quot;6e5bcfe357094a53a81c53b8ea168a4c&quot;,
            &quot;childs&quot;: [
                {
                    &quot;tagid&quot;: &quot;7b6f5015f52c4a91ba26d6b021e2f0e9&quot;,
                    &quot;tagname&quot;: &quot;癖好1&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 14:48:52&quot;
                },
                {
                    &quot;tagid&quot;: &quot;f3f121ad44d54de2877d7a2ddcce35b3&quot;,
                    &quot;tagname&quot;: &quot;癖好2&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 14:48:52&quot;
                }
            ],
            &quot;tagname&quot;: &quot;特殊癖好&quot;,
            &quot;create_time&quot;: &quot;2025-01-09 14:48:52&quot;,
            &quot;is_radio&quot;: false
        },
        {
            &quot;tagid&quot;: &quot;fd15cc4759064d85a398791ca29b2456&quot;,
            &quot;childs&quot;: [
                {
                    &quot;tagid&quot;: &quot;5ba30fee609a4884b3de83b7f8834ca4&quot;,
                    &quot;tagname&quot;: &quot;华中&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 09:16:44&quot;
                },
                {
                    &quot;tagid&quot;: &quot;6f9d4498afb742f48b96884525a59981&quot;,
                    &quot;tagname&quot;: &quot;东北&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 09:16:44&quot;
                },
                {
                    &quot;tagid&quot;: &quot;bb28025b79a34f3283f5e459e1919ad7&quot;,
                    &quot;tagname&quot;: &quot;华北&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 09:16:44&quot;
                },
                {
                    &quot;tagid&quot;: &quot;f27cdb7093ad4605bf22d0132fb13ae2&quot;,
                    &quot;tagname&quot;: &quot;中南&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 09:16:44&quot;
                },
                {
                    &quot;tagid&quot;: &quot;f340864bace44c1ba33f713e9afdb75f&quot;,
                    &quot;tagname&quot;: &quot;华南&quot;,
                    &quot;create_time&quot;: &quot;2025-01-09 09:16:44&quot;
                }
            ],
            &quot;tagname&quot;: &quot;地区&quot;,
            &quot;create_time&quot;: &quot;2025-01-09 09:16:44&quot;,
            &quot;is_radio&quot;: false
        }
    ]
}
```








================================================================================
## 2.6.12 添加标签[1005202]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.12.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|is_radio	|标签类型（是否单选）	|bool		|否	|0或false：多选&lt;br&gt;1或true：单选&lt;br&gt;不传值或其他值会转为0 |
|child_names	|标签列表	|string		|是	|组和标签用‘/’隔开，例如：学历/本科；年龄/18-35，标签组和标签名限定长度50 |


- 示例请求参数：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;is_radio&quot;: &quot;1&quot;,
  &quot;child_names&quot;: &quot;[\&quot;123/1002\&quot;,\&quot;123/1004\&quot;]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005202&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.12.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功|
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```







================================================================================
## 2.6.13 修改标签[1005203]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.13.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|tp_id	|标签组ID	|string		|是	|确定要修改的标签组 |
|tp_name	|标签组名称	|string		|否	|需要修改的名称，不传默认不修改，限定长度50 |
|child_names	|标签列表	|tag[]		|是	|标签信息：&lt;a href=&quot;#2.6.13.1.1&quot;&gt;2.6.13.1.1标签对象（tag）&lt;/a&gt; |

&lt;div id=&quot;2.6.13.1.1&quot;&gt;&lt;/div&gt;标签对象

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|id	|标签编号	|string	|是	|标签编号，从标签列表中获取|
|name	|名称	|string		|否	|需要修改的名称，限定长度50 |

- 示例请求参数：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;tp_id&quot;: &quot;1590adc3e21a4744bfd68c3631732589&quot;,
  &quot;tp_name&quot;: &quot;12345&quot;,
  &quot;child_names&quot;: &quot;[{\&quot;id\&quot;:\&quot;ad36992a0514418d93df3e50cadce3d7\&quot;,\&quot;name\&quot;:\&quot;10021\&quot;},{\&quot;id\&quot;:\&quot;eb56962b66fb424eb2044976fbf610f7\&quot;,\&quot;name\&quot;:\&quot;10031\&quot;}]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005203&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.13.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功|
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```








================================================================================
## 2.6.14 删除标签[1005204]
================================================================================

[TOC]

# 接口地址
生产环境：`https://www.wjx.cn/openapi/contacts.aspx`

- # 2.6.14.1 请求参数格式

|参数|参数名|类型|必需|说明|
|:---    |:------    |--- |-|--------      |
|corpid	|通讯录/联系人编号	|string	|是	|通讯录/联系人编号：子账户用户名：可从管理界面中获取；问卷星自建通讯录需要填写，企微通讯录无需填写|
|type	|传参类型	|string		|是	|1：传入标签编号(xxxxx)，2：传入标签名称（爱好/足球） |
|tags	|标签列表	|string[]		|是	|参考返回示例 |


- 示例请求参数1：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;type&quot;: &quot;1&quot;,
  &quot;tags&quot;: &quot;[\&quot;ec935ece40164b46ba7689e6bd08760c\&quot;,\&quot;ec935ece40164b46ba7689e6bd08760c\&quot;]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005204&quot;,
  &quot;ts&quot;: 1583812686
}
```

- 示例请求参数2：
```csharp
Content-Type:application/json
{
  &quot;appid&quot;: &quot;10001&quot;,
  &quot;corpid&quot;: &quot;org0000010001&quot;,
  &quot;type&quot;: &quot;2&quot;,
  &quot;tags&quot;: &quot;[\&quot;12345\&quot;,\&quot;爱好/足球\&quot;]&quot;,
  &quot;sign&quot;: &quot;e3647ce8c121089ff5adbc5f22701ea84a417d65&quot;,
  &quot;action&quot;: &quot;1005204&quot;,
  &quot;ts&quot;: 1583812686
}
```

- # 2.6.14.2 响应参数列表

|参数	|参数名	|类型	|必需	|说明|
|:---    |:------    |--- |-|--------      |
|	result|	返回状态|bool	|是	|true代表成功|
|	errormsg|	返回信息|string	|否	|失败返回具体信息||

示例响应参数1：
```csharp
{
    &quot;result&quot;: true
}
```
示例响应参数2：
```csharp
{
    &quot;result&quot;: false,
    &quot;errormsg&quot;: &quot;参数错误&quot;
}
```









================================================================================
# 其他
================================================================================


================================================================================
## 获取问卷短链接
================================================================================

# 获取问卷短链接
## 介绍
当需要在问卷链接上组装参数，然后通过自己的短信去发问卷链接，如果需要隐藏一些参数或者是因为过长导致链接失败时，可以将长链接转为短链接。

## 接口说明
请求方式：`get`

请求地址：

`https://www.wjx.cn/openapi/shortlink.aspx`

请求参数：

|字段|说明|
|:---    |:------    |--- |-|--------      |
|url|需要转换的长链接地址，该地址必须是问卷星问卷地址|


示例1（未带参数）：
`https://www.wjx.cn/openapi/shortlink.aspx?url=https://demo.example.com/vm/w4GZh.aspx`
示例1（带入参数）：
`https://www.wjx.cn/openapi/shortlink.aspx?url=https%3A%2F%2Fdemo.example.com%2Fvm%2FPJn0P.aspx%3Fsojumpparm%3D234%26parmsign%3Dc8432440b620eb9abd32fa46cf11f19845f5508f`

提示：url带入的参数需要URLEncode编码。 

返回示例：
```json
{
    &quot;success&quot;: true,
    &quot;msg&quot;: null,
    &quot;data&quot;: &quot;https://demo.example.com/s/jv&quot;
}
```


