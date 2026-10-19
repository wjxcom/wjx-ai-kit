using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Xml;
using Wjx.Model;
using Wjx.Model.BllModel.ActivityXml.Dsl;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

internal static class CreateLogicIntegration
{
    private static readonly string Bin = Environment.GetEnvironmentVariable("WJX_LOGIC_TEST_BIN") ?? @"D:\workspace\VSrepos\Branch\tanhao\04Web\WebSiteNew\Bin";
    private static readonly List<string> Results = new List<string>();
    private static int failures;
    private sealed class QueryProjection : ExtQuestionnaire
    {
        public QueryProjection(XmlDocument doc) : base(null, null)
        {
            LoadQuestionnaire(new Questionnaire(doc, new GetQuestionnaireOptions { GetQuestion = true, GetItem = true }));
        }
    }

    private static int Main()
    {
        AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args)
        {
            string path = Path.Combine(Bin, new AssemblyName(args.Name).Name + ".dll");
            return File.Exists(path) ? Assembly.LoadFrom(path) : null;
        };
        return Run();
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static int Run()
    {
        Check("create-hidden-only-question-enables-answer-runtime", delegate
        {
            XmlDocument doc = Build("logic { hide \"3\"; };", false);
            Equal("-1", Q(doc, 3).GetAttribute("Relation"));
            Equal("true", doc.DocumentElement.GetAttribute("HasRefer"));
            Save("hidden-only.xml", doc);
        });
        Check("create-without-logic", delegate
        {
            XmlDocument doc = Build(null, false);
            for (int i = 2; i <= 7; i++) Equal("", Q(doc, i).GetAttribute("Relation"));
            Equal(null, SurveyLogicConverter.Extract(doc.OuterXml));
            Save("without-logic.xml", doc);
        });
        Check("explicit-surveyinfo-introduction-remains-supported", delegate
        {
            string description; bool hasExam;
            string data = SurveyJsonlParser.Parse("{\"type\":\"surveyinfo\",\"title\":\"显式基础信息\",\"introduction\":\"显式描述\"}\n{\"qtype\":\"单选\",\"title\":\"单选题\",\"select\":[\"A\",\"B\"]}", "显式基础信息", out description, out hasExam);
            Equal("显式描述", description);
            Assert(!string.IsNullOrEmpty(data), "explicit surveyinfo returned empty");
        });
        Check("create-user-complete-or-example", delegate
        {
            XmlDocument doc = Build(UserLogic(), false);
            Equal("2,1", Q(doc, 3).GetAttribute("Relation"));
            Equal("2,2", Q(doc, 4).GetAttribute("Relation"));
            Equal("true", doc.DocumentElement.GetAttribute("HasRefer"));
            for (int i = 5; i <= 7; i++) Equal("2,3$3,3$4,3", Q(doc, i).GetAttribute("Relation"));
            Assert(doc.SelectSingleNode("//dsl|//logic") == null, "DSL storage nodes were written");
            Assert(!doc.OuterXml.Contains("then show"), "DSL source was embedded in XML");
            string extracted = SurveyLogicConverter.Extract(doc.OuterXml);
            Equal(doc.OuterXml, SurveyLogicConverter.Apply(doc.OuterXml, extracted));
            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "extracted-logic.txt"), extracted, new UTF8Encoding(true));
            Save("user-logic.xml", doc);
        });
        Check("create-json-relation-legacy", delegate
        {
            XmlDocument doc = Build(null, true);
            Save("json-relation.xml", doc);
            Equal("2,2", Q(doc, 3).GetAttribute("Relation"));
        });
        Check("create-dsl-priority-over-json-relation", delegate
        {
            XmlDocument doc = Build("logic { if \"2::1\" then show \"3\"; };", true);
            Equal("2,1", Q(doc, 3).GetAttribute("Relation"));
            Save("dsl-priority.xml", doc);
        });
        Check("create-invalid-topic-rejected", delegate
        {
            Reject(delegate { Build("logic { if \"2::1\" then show \"99\"; };", false); });
        });
        Check("create-invalid-option-rejected", delegate
        {
            Reject(delegate { Build("logic { if \"2::99\" then show \"3\"; };", false); });
        });
        Check("create-empty-logic-module", delegate
        {
            Equal(Build(null, false).OuterXml, Build("logic {};", false).OuterXml);
        });
        Check("create-question-jump-enables-answer-runtime", delegate
        {
            XmlDocument doc = Build("logic { jump from \"2\" to \"7\"; };", false);
            Equal("7", Q(doc, 2).GetAttribute("AnytimeJumpto"));
            Equal("true", Q(doc, 2).GetAttribute("HasJump"));
            Save("question-jump.xml", doc);
        });
        Check("create-option-jump-enables-answer-runtime", delegate
        {
            XmlDocument doc = Build("logic { jump from \"2\" option \"1\" to \"7\"; };", false);
            Equal("7", ((XmlElement)Q(doc, 2).SelectSingleNode("Item[@ItemValue='1']")).GetAttribute("ItemJump"));
            Equal("true", Q(doc, 2).GetAttribute("HasJump"));
            Save("option-jump.xml", doc);
        });
        Check("create-option-display-enables-answer-runtime", delegate
        {
            XmlDocument doc = Build("logic { if \"2::1\" then show \"3::1\"; };", false);
            Equal("2,1", ((XmlElement)Q(doc, 3).SelectSingleNode("Item[@ItemValue='1']")).GetAttribute("ItemRelation"));
            Equal("true", Q(doc, 3).GetAttribute("HasItemRelation"));
            Save("option-display.xml", doc);
        });
        Check("create-options-reference-enables-answer-runtime", delegate
        {
            XmlDocument doc = Build("logic { reference options from \"3\" to \"2\"; };", false);
            Equal("2", Q(doc, 3).GetAttribute("ReferTopic"));
            Equal("3", Q(doc, 2).GetAttribute("ReferedTopics"));
            Equal("true", doc.DocumentElement.GetAttribute("HasRefer"));
            Save("option-reference.xml", doc);
        });
        Check("partial-update-cannot-introduce-cycle-with-existing-logic", delegate
        {
            string initial = Build("logic { jump from \"2\" to \"3\"; };", false).OuterXml;
            Reject(delegate { SurveyLogicConverter.Apply(initial, "logic { jump from \"3\" to \"2\"; };"); });
        });
        Check("ordinary-query-projects-native-display-condition", delegate
        {
            XmlDocument doc = Build(UserLogic(), false);
            JObject json = JObject.FromObject(new QueryProjection(doc));
            Equal("本地无持久化测试", json["description"].Value<string>());
            Equal("2,1", QueryQuestion(json, 3)["relation"].Value<string>());
            Equal("2,3$3,3$4,3", QueryQuestion(json, 5)["relation"].Value<string>());
            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ordinary-query.json"), json.ToString(), new UTF8Encoding(true));
        });
        Check("ordinary-query-proves-unconditional-show-cleared-condition", delegate
        {
            XmlDocument doc = Build(UserLogic(), false);
            doc.LoadXml(SurveyLogicConverter.Apply(doc.OuterXml, "logic { show \"3\"; };"));
            JObject json = JObject.FromObject(new QueryProjection(doc));
            Equal("本地无持久化测试", json["description"].Value<string>());
            Equal("", QueryQuestion(json, 3)["relation"].Value<string>());
            Equal(false, QueryQuestion(json, 3)["is_hide"].Value<bool>());
            Equal("2,2", QueryQuestion(json, 4)["relation"].Value<string>());
            File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ordinary-query-after-clear.json"), json.ToString(), new UTF8Encoding(true));
        });
        Check("conditional-hide-does-not-silently-become-unconditional", delegate
        {
            Reject(delegate { Build("logic { if \"2::1\" then hide \"3\"; };", false); });
        });
        Check("conditional-jump-does-not-silently-become-unconditional", delegate
        {
            Reject(delegate { Build("logic { if \"2::1\" then jump from \"3\" to \"7\"; };", false); });
        });
        Check("question-only-condition-cannot-silently-clear-display-condition", delegate
        {
            Reject(delegate { Build("logic { if \"2\" then show \"3\"; };", false); });
        });
        Results.Add("Creation integration: " + (Results.Count - failures) + " passed, " + failures + " failed.");
        File.WriteAllLines(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "results.txt"), Results.ToArray(), new UTF8Encoding(true));
        return failures == 0 ? 0 : 1;
    }

    private static XmlDocument Build(string logic, bool legacyRelation)
    {
        StringBuilder jsonl = new StringBuilder("{\"qtype\":\"问卷基础信息\",\"title\":\"DSL创建集成测试\",\"introduction\":\"本地无持久化测试\"}\n");
        // The real parser inserts a page node with Topic=1; questions use Topics 2 through 7.
        for (int i = 2; i <= 7; i++)
        {
            jsonl.Append("{\"qtype\":\"单选\",\"title\":\"题目").Append(i).Append("\",\"select\":[\"A\",\"B\",\"C\"],\"requir\":true");
            if (i == 3 && legacyRelation) jsonl.Append(",\"relation\":\"题目2>>>B\"");
            jsonl.Append("}\n");
        }
        string description; bool hasExam; bool isNeedValue; int totalValue, count;
        string surveyData = SurveyJsonlParser.Parse(jsonl.ToString(), "DSL创建集成测试", out description, out hasExam);
        Equal("本地无持久化测试", description);
        if (legacyRelation && logic == null) File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "legacy-input-surveydata.txt"), surveyData, new UTF8Encoding(true));
        Assert(!string.IsNullOrEmpty(surveyData), "real SurveyJsonlParser returned empty");
        XmlDocument doc = new ActivityCreate(null).BuildSurveyXml(new ActivityCreateModel
        {
            Title = "DSL创建集成测试", Description = description, SurveyData = surveyData, LogicDsl = logic, AType = 0
        }, "local-test", out isNeedValue, out totalValue, out count);
        Equal(6, count);
        Equal(6, doc.SelectNodes("/Questionnaire/Question[@Type!='page' and @Type!='cut']").Count);
        Equal("本地无持久化测试", doc.DocumentElement.GetAttribute("Desc"));
        Equal("page", Q(doc, 1).GetAttribute("Type"));
        for (int i = 2; i <= 7; i++) Equal("题目" + i, Q(doc, i).GetAttribute("Title"));
        return doc;
    }

    private static string UserLogic()
    {
        StringBuilder text = new StringBuilder("logic { if \"2::1\" then show \"3\"; if \"2::2\" then show \"4\";");
        for (int i = 5; i <= 7; i++) text.Append("if \"2::3\" or \"3::3\" or \"4::3\" then show \"").Append(i).Append("\";");
        return text.Append("};").ToString();
    }
    private static XmlElement Q(XmlDocument doc, int topic) { return (XmlElement)doc.SelectSingleNode("/Questionnaire/Question[@Topic='" + topic + "']"); }
    private static JObject QueryQuestion(JObject json, int topic)
    {
        foreach (JObject question in (JArray)json["questions"])
            if (question["q_index"].Value<int>() == topic) return question;
        throw new Exception("ordinary query is missing native Topic " + topic);
    }
    private static void Save(string name, XmlDocument doc) { File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, name), doc.OuterXml, new UTF8Encoding(true)); }
    private static void Reject(Action action) { try { action(); } catch (ArgumentException) { return; } throw new Exception("invalid logic was accepted"); }
    private static void Equal<T>(T expected, T actual) { if (!object.Equals(expected, actual)) throw new Exception("Expected " + expected + "; actual " + actual); }
    private static void Assert(bool condition, string message) { if (!condition) throw new Exception(message); }
    private static void Check(string name, Action body)
    {
        try { body(); Results.Add("PASS " + name); }
        catch (Exception e) { failures++; Results.Add("FAIL " + name + ": " + e); }
        Console.WriteLine(Results[Results.Count - 1]);
    }
}
