# WJX XML DSL v1

> 鍗忚鏍囪瘑锛歚wjx-dsl 1`
> 鍙傝€冪増鏈細`1.0.0`
> MCP Resource锛歚wjx://reference/wjx-xml-dsl`

WJX XML DSL 鏄櫘閫?AI 鏂板缓鍜屽畨鍏ㄤ慨鏀归棶鍗风殑榛樿鏍煎紡锛屼笌 `create_survey_by_text` 浣跨敤鐨勬棫琛屾枃鏈?DSL 涓嶅吋瀹广€傜敓浜?XML 鏄繍琛屾椂浜嬪疄婧愩€?

## 瀹夊叏鏈€灏忕ず渚?

```text
wjx-dsl 1;
xml version = "1.0";
xml encoding = "utf-8";

questionnaire {
  attr "Title" = "浜у搧浣撻獙璋冩煡";
  question radio {
    attr "Topic" = "1";
    attr "Title" = "鎮ㄥ浜у搧鏄惁婊℃剰锛?;
    attr "Requir" = "true";
    item { attr "ItemTitle" = "婊℃剰"; attr "ItemValue" = "1"; };
    item { attr "ItemTitle" = "涓嶆弧鎰?; attr "ItemValue" = "2"; };
  };
  question question {
    attr "Topic" = "2";
    attr "Title" = "璇疯鏄庝富瑕佸師鍥?;
    attr "Requir" = "true";
    attr "Verify" = "澶氳鏂囨湰";
    attr "Height" = "4";
  };
};
```

甯哥敤璇彞涓?`attr`銆乣node`銆乣text`銆乣cdata`銆乣comment` 鍜?`pi`銆傞棶鍗峰埆鍚嶄负 `page`銆乣cut`銆乣question <type>`銆乣item`銆乣row`銆乣rightrow`銆乣column`銆?

`question <type>` 鎺ュ彈涓婅堪鍩虹 Type锛屼篃鎺ュ彈 `dropdown`銆乣scale`銆乣sort`銆乣scenario`銆乣true_false`銆乣commodity`銆乣multi_level_dropdown`銆乣signature`銆乣scoring_single`銆乣scoring_multi`銆乣matrix_scale`銆乣matrix_single`銆乣matrix_multi`銆乣matrix_fill`銆乣matrix_slider`銆乣multi_file`銆乣multi_textarea`銆乣table_fill`銆乣table_dropdown` 绛夎涔夊埆鍚嶃€傚埆鍚嶄細杞崲涓哄熀纭€ Type 骞跺彧琛ラ綈缂哄け鐨?XML 灞炴€э紝鏄惧紡灞炴€т紭鍏堬紱`contacts_user` 鐗瑰埆鏄犲皠涓?`question` + `Verify=ContactsUser` 浠ュ吋瀹规棫缂栬緫鍣ㄨ仈绯讳汉鍗忚锛涘巻鍙叉墿灞?Type 浣跨敤 `node "Question"` 淇濈暀銆傛瘡閬撻鐨?`Topic` 蹇呴』鍞竴锛涢€夐」 `ItemValue` 鍦ㄩ鍐呭敮涓€锛涢粯璁ら鐩繀绛斻€傛柊寤烘椂涓嶈淇′换鎴栬嚜琛屾寚瀹氬唴閮ㄩ棶鍗疯韩浠斤紝澶栭儴鍙娇鐢ㄨ繑鍥炵殑浼犵粺 `vid`銆?

## MCP 鏂板缓宸ヤ綔娴?

1. 鐢熸垚涓€涓畬鏁?`wjx-dsl 1` 鏂囨。銆?
2. 璋冪敤 `create_survey_by_wjx_dsl({ dsl })`锛涙湇鍔＄鍦ㄥ啓鍏ュ墠鏍￠獙 DSL锛屾垚鍔熺粨鏋滀负鑽夌骞惰繑鍥?Activity/vid 绛変紶缁熺粨鏋溿€?
3. 浣跨敤杩斿洖鐨?`vid` 璋冪敤 `query_wjx_dsl({ vid })` fresh-read 鏍搁獙瀹屾暣 DSL 鍜屼紶缁熼棶鍗峰瓧娈碉紱閾炬帴鐩存帴浣跨敤鏈嶅姟绔繑鍥炵殑 URL 瀛楁銆?

鍒涘缓濮嬬粓涓鸿崏绋匡紱浠呭湪鐢ㄦ埛鏄庣‘瑕佹眰鏃堕€氳繃浼犵粺闂嵎鐘舵€佹帴鍙ｅ彂甯冦€?

## MCP 淇敼宸ヤ綔娴?

1. `query_wjx_dsl({ vid })` 鑾峰彇 fresh-read 鐨勫畬鏁?DSL銆?
2. 鍦ㄥ畬鏁?DSL 涓婁慨鏀癸紝淇濈暀鏈煡灞炴€с€佹湭鐭ヨ妭鐐广€乺aw 閫昏緫鍜屽巻鍙叉墿灞曘€?
3. `update_wjx_dsl({ vid, dsl, if_match? })` 鎻愪氦淇敼锛涙湇鍔＄鍦ㄥ啓鍏ュ墠鏍￠獙 DSL銆?
4. 鎴愬姛鍚庡啀娆¤皟鐢?`query_wjx_dsl({ vid })` 鏍搁獙銆?

`if_match` 杩囨湡鏃堕噸鏂拌鍙栵紝浣嗗畠鍙槸寮卞墠缃牎楠岋紝涓嶈兘淇濊瘉鍘熷瓙 CAS锛涘綋鍓嶆病鏈夊叕寮€ DSL dry-run銆乺ollback 鎴栧己骞跺彂瑕嗙洊淇濇姢銆侭reaking change 榛樿鍏抽棴锛涗笉鑳戒互鏉冮檺鏇夸唬绛斿嵎瀹夊叏璇佹嵁銆?

## 鏈煡缁撴灉鍜屽吋瀹硅矾寰?

- `create_survey_by_wjx_dsl`銆乣update_wjx_dsl` 涓嶈嚜鍔ㄩ噸璇曘€?
- 瓒呮椂銆佹柇缃戙€乮n-progress 鎴栫粨鏋滄湭鐭ユ椂锛屼笉鑷姩 fallback 鍒?JSONL銆佹棫鏂囨湰 DSL 鎴栨棫 JSON 鍒涘缓锛屼互鍏嶇敓鎴愰噸澶嶉棶鍗枫€?
- 鍏堥€氳繃杩斿洖鐨勪紶缁?`vid` 鍜?`query_wjx_dsl` 瀵硅处锛涙棤娉曠‘璁ゆ椂鍋滄骞舵姤鍛婃湭鐭ョ姸鎬併€?
- 鐢ㄦ埛鏄庣‘瑕佹眰 JSONL 鏃朵娇鐢?`create_survey_by_json`锛涙槑纭姹傛棫鏂囨湰 DSL 鏃朵娇鐢?`create_survey_by_text`锛涙棫 JSON 鏁扮粍宸ュ叿鍙鐞嗘槑纭吋瀹归渶姹傘€?
