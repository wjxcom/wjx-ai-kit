export const PUSH_FORMAT_GUIDE = {
  overview: "问卷星数据推送（Webhook）在每次收到新答卷时，向配置的 URL 发送 HTTP POST 请求",
  configuration: {
    method: "通过 update_survey_settings 工具的 msg_setting 字段配置",
    fields: {
      push_url: "接收推送的 HTTPS URL",
      is_encrypt: "是否启用 AES 加密（0=关闭, 1=开启）",
      push_custom_params: "自定义推送参数（附加在推送数据中）",
    },
  },
  payload: {
    content_type: "application/x-www-form-urlencoded",
    fields: {
      vid: "问卷编号",
      jid: "答卷编号",
      submitdata: "答卷数据（明文或加密密文，取决于 is_encrypt 设置）",
      submittime: "提交时间（格式：yyyy-MM-dd HH:mm:ss）",
      source: "答卷来源（1=链接, 2=扫码, 3=SDK, 4=微信, 5=企微, ...）",
      ip: "提交者 IP 地址",
      remark: "备注信息",
      custom_params: "自定义参数（与 push_custom_params 配置对应）",
    },
    submitdata_format: "题号$答案}题号$答案（与 wjx://reference/response-format 一致）",
  },
  encryption: {
    algorithm: "AES-128-CBC",
    key_derivation: "MD5(appKey).substring(0, 16) — 取 appKey 的 MD5 哈希前16字符作为密钥",
    padding: "PKCS7",
    iv: "密文的前 16 字节为 IV（初始化向量）",
    encoding: "密文整体经过 Base64 编码",
    decryption_steps: [
      "1. Base64 解码密文得到 bytes",
      "2. 取前 16 字节作为 IV",
      "3. 取剩余字节作为加密数据",
      "4. 使用 AES-128-CBC + PKCS7 解密，密钥 = MD5(appKey).substring(0, 16)",
      "5. 解密结果为 UTF-8 编码的 submitdata 明文",
    ],
  },
  signature: {
    method: "SHA1",
    formula: "sign = SHA1(rawBody + appKey)",
    header: "X-Wjx-Signature（HTTP 请求头中携带签名）",
    verification_steps: [
      "1. 读取 HTTP 请求的原始 body（未经解析的字符串）",
      "2. 将 rawBody 与 appKey 直接拼接",
      "3. 计算 SHA1 哈希值",
      "4. 将计算结果与请求头中的 X-Wjx-Signature 比较",
      "5. 一致则验证通过，否则拒绝该请求",
    ],
  },
  tools: {
    decode_push_payload: "使用 decode_push_payload 工具可直接解密推送密文，无需手动实现解密逻辑",
    get_survey_settings: "使用 get_survey_settings 查看当前推送配置",
    update_survey_settings: "使用 update_survey_settings 的 msg_setting 字段修改推送配置",
  },
};
