using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Web;
using System.Xml;
using BusinessLogic.BusinessObject;
using Wjx.Model;
using Wjx.Model.BllModel.ActivityXml.Dsl;
using Wjx.Web.Dsl;

namespace LogicUpdateFixture
{
    internal static class Program
    {
        internal static readonly string Bin = Environment.GetEnvironmentVariable("WJX_LOGIC_TEST_BIN") ?? @"D:\workspace\VSrepos\Branch\tanhao\04Web\WebSiteNew\Bin";
        private static readonly List<string> Results = new List<string>();
        private static int failures;
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
            HttpContext.Current = new HttpContext(new HttpRequest("", "http://fixture.test/", ""), new HttpResponse(new StringWriter()));
            Check("logic-only-persists-native-xml-and-preserves-content", delegate
            {
                State.Reset(Build(null, false, false));
                string before = State.Xml;
                var result = Update(null, "logic { if \"2::1\" then show \"3\"; };");
                Success(result); Equal(1, State.Writes); Equal(1, State.MetadataWrites);
                Equal("2,1", Attr(3,"Relation")); Equal("true", RootAttr("HasRefer").ToLowerInvariant());
                Equal(ContentWithoutLogic(before), ContentWithoutLogic(State.Xml));
                Equal((short)0, State.Activity.Status); Equal(4, State.Activity.CacheVersion);
                Assert(!State.Xml.Contains("then show") && Load(State.Xml).SelectSingleNode("//dsl|//logic") == null, "DSL text was stored");
                Save("logic-only.xml");
            });
            Check("logic-partial-update-preserves-unrelated-rules", delegate
            {
                State.Reset(Build("logic { if \"2::2\" then show \"3\"; if \"2::3\" then show \"4\"; };", false, false));
                Success(Update(null,"logic { if \"2::1\" then show \"3\"; };"));
                Equal("2,1",Attr(3,"Relation")); Equal("2,3",Attr(4,"Relation"));
            });
            Check("logic-unconditional-show-clears-condition", delegate
            {
                State.Reset(Build("logic { if \"2::2\" then show \"3\"; };", false, false));
                Success(Update(null,"logic { show \"3\"; };"));
                Equal("",Attr(3,"Relation")); Equal(null,SurveyLogicConverter.Extract(State.Xml));
                Save("cleared-logic.xml");
            });
            Check("content-and-logic-use-final-topics-and-dsl-priority", delegate
            {
                State.Reset(Build(null,false,false));
                var result=Update(Jsonl(true,true),"logic { if \"2::3\" then show \"3\"; };");
                if(!result.Success) {
                    if(State.LastDiff!=null)foreach(var item in State.LastDiff.Changes)Console.WriteLine("DIFF "+item.IsBreaking+" "+item.Path+" "+item.LeftValue+" -> "+item.RightValue);
                    if(State.LastImpact!=null)foreach(var item in State.LastImpact.Changes)Console.WriteLine("INDEX "+item.IsBreaking+" "+item.Message);
                }
                Success(result);
                Equal("2,3",Attr(3,"Relation")); Equal("更新题目3",Q(Load(State.Xml),3).GetAttribute("Title"));
                Equal("更新问卷",State.Activity.Name); Equal("keep",RootAttr("OpaqueRoot"));
                Assert(Load(State.Xml).SelectSingleNode("/Questionnaire/Opaque") != null,"Extension node was removed");
                Equal("Opaque",Load(State.Xml).DocumentElement.LastChild.Name);
                Save("content-and-logic.xml");
            });
            Check("content-update-preserves-interleaved-extension-position",delegate
            {
                XmlDocument before=Load(Build(null,false,false));
                XmlNode opaque=before.SelectSingleNode("/Questionnaire/Opaque");
                before.DocumentElement.InsertBefore(opaque,Q(before,3));
                State.Reset(before.OuterXml);
                Success(Update(Jsonl(true,false),null));
                Equal("Opaque",Q(Load(State.Xml),3).PreviousSibling.Name);
            });
            Check("json-reference-enables-root-runtime-gate",delegate
            {
                State.Reset(Build(null,false,false));
                string jsonl=Jsonl(false,false).Replace("\"title\":\"题目3\",", "\"title\":\"题目3\",\"referselect\":\"题目2\",");
                Success(Update(jsonl,null));Equal("2",Attr(3,"ReferTopic"));
                Equal("true",RootAttr("HasRefer").ToLowerInvariant());
            });
            Check("json-reference-runtime-gate-survives-jump-only-dsl",delegate
            {
                State.Reset(Build(null,false,false));
                string jsonl=Jsonl(false,false).Replace("\"title\":\"题目3\",", "\"title\":\"题目3\",\"referselect\":\"题目2\",");
                Success(Update(jsonl,"logic { jump from \"4\" to \"7\"; };"));
                Equal("2",Attr(3,"ReferTopic"));Equal("7",Attr(4,"AnytimeJumpto"));
                Equal("true",RootAttr("HasRefer").ToLowerInvariant());
            });
            Check("explicit-title-overrides-jsonl-metadata",delegate
            {
                State.Reset(Build(null,false,false));
                Success(Update(Jsonl(true,false),null,false,null,"显式标题"));
                Equal("显式标题",State.Activity.Name);
            });
            Check("missing-jsonl-title-preserves-previous-title",delegate
            {
                State.Reset(Build(null,false,false));
                string jsonl=Jsonl(true,false).Replace("\"title\":\"更新问卷\",","");
                var result=Update(jsonl,null);
                if(!result.Success && State.LastDiff!=null)foreach(var item in State.LastDiff.Changes)Console.WriteLine("NO-META DIFF "+item.IsBreaking+" "+item.Path+" "+item.LeftValue+" -> "+item.RightValue);
                Success(result);Equal("原问卷",State.Activity.Name);
            });
            Check("invalid-jsonl-title-is-rejected-before-write",delegate
            {
                State.Reset(Build(null,false,false));
                string jsonl=Jsonl(true,false).Replace("更新问卷","问卷星非法标题");
                Failure(Update(jsonl,null),"ValidationFailed");Equal(0,State.Writes);
            });
            Check("invalid-topic-does-not-write",delegate { Invalid("logic { if \"2::1\" then show \"99\"; };"); });
            Check("invalid-option-does-not-write",delegate { Invalid("logic { if \"2::99\" then show \"3\"; };"); });
            Check("invalid-content-and-logic-does-not-write",delegate
            {
                State.Reset(Build(null,false,false)); string before=State.Xml;
                Failure(Update(Jsonl(true,false),"logic { if \"2::1\" then show \"99\"; };"),"ValidationFailed");
                Equal(0,State.Writes); Equal(0,State.MetadataWrites); Equal(before,State.Xml);
            });
            Check("new-jump-cycle-does-not-write",delegate { Invalid("logic { jump from \"2\" to \"3\"; jump from \"3\" to \"2\"; };"); });
            Check("new-jump-cannot-cycle-with-preserved-rule",delegate
            {
                State.Reset(Build("logic { jump from \"2\" to \"3\"; };",false,false)); string before=State.Xml;
                Failure(Update(null,"logic { jump from \"3\" to \"2\"; };"),"ValidationFailed");
                Equal(0,State.Writes); Equal(before,State.Xml);
            });
            Check("overwriting-jump-removes-old-edge-before-cycle-check",delegate
            {
                State.Reset(Build("logic { jump from \"2\" to \"3\"; };",false,false));
                Success(Update(null,"logic { jump from \"2\" to \"4\"; jump from \"3\" to \"2\"; };"));
                Equal("4",Attr(2,"AnytimeJumpto")); Equal("2",Attr(3,"AnytimeJumpto"));
                Equal("true",Attr(2,"HasJump").ToLowerInvariant());
            });
            Check("structural-removal-needs-explicit-consent",delegate
            {
                State.Reset(Build(null,false,false)); string before=State.Xml;
                Failure(Update(Jsonl(false,false,5),null),"ValidationFailed");
                Equal(0,State.Writes); Equal(before,State.Xml);
            });
            Check("structural-removal-with-no-answers-can-save",delegate
            {
                State.Reset(Build(null,false,false));
                Success(Update(Jsonl(false,false,5),null,true));
                Equal(5,State.Activity.TotalQCount); Equal(1,State.Writes); Equal(1,State.CounterReads);
            });
            Check("existing-answers-protect-structural-removal",delegate
            {
                State.Reset(Build(null,false,false)); State.Answers=2;
                Failure(Update(Jsonl(false,false,5),null,true),"ValidationFailed"); Equal(0,State.Writes);
            });
            Check("unknown-answer-count-blocks-structural-write",delegate
            {
                State.Reset(Build(null,false,false)); State.FailCounts=true;
                Failure(Update(Jsonl(false,false,5),null,true),"DependencyFailure"); Equal(0,State.Writes);
            });
            Check("readback-mismatch-is-not-success",delegate
            {
                State.Reset(Build(null,false,false)); State.FailReadback=true;
                Failure(Update(null,"logic { if \"2::1\" then show \"3\"; };"),"PersistenceFailed");
                Equal(1,State.Writes); Equal(0,State.MetadataWrites);
            });
            Check("publish-failure-reports-content-already-saved",delegate
            {
                State.Reset(Build(null,false,false)); State.FailPublish=true;
                var result=Update(null,"logic { if \"2::1\" then show \"3\"; };",false,true);
                Failure(result,"PersistenceFailed"); Equal("2,1",Attr(3,"Relation"));
                Assert(result.Message.Contains("内容已保存"),"Partial-save state was not disclosed");
            });
            Check("ownership-is-checked-before-reading-or-writing",delegate
            {
                State.Reset(Build(null,false,false)); State.Owned=false;
                Failure(Update(null,"logic {};"),"NotFound"); Equal(0,State.Reads); Equal(0,State.Writes);
            });
            Check("unchanged-logic-module-is-no-op",delegate
            {
                State.Reset(Build("logic { if \"2::1\" then show \"3\"; };",false,false));
                var result=Update(null,"logic {};"); Success(result); Assert(result.Data.NoChange,"No-op not reported");
                Equal(0,State.Writes); Equal(0,State.MetadataWrites);
            });
            Results.Add("Update integration: " + (Results.Count-failures) + " passed, " + failures + " failed.");
            File.WriteAllLines(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"results.txt"),Results.ToArray(),new UTF8Encoding(true));
            return failures==0?0:1;
        }

        private static SurveyJsonExecutionResult Update(string jsonl,string logic,bool allow=false,bool? publish=null,string title=null)
        {
            return SurveyJsonOpenApiIntegration.UpdateSurveyByJson(HttpContext.Current,7,"fixture-actor",42,jsonl,title,logic,allow,null,publish,"fixture-correlation");
        }
        private static void Invalid(string logic)
        {
            State.Reset(Build(null,false,false)); string before=State.Xml;
            Failure(Update(null,logic),"ValidationFailed"); Equal(0,State.Writes); Equal(0,State.MetadataWrites); Equal(before,State.Xml);
        }
        internal static string Jsonl(bool changed,bool relation,int count=6)
        {
            string title=changed?"更新问卷":"原问卷";
            StringBuilder result=new StringBuilder("{\"qtype\":\"问卷基础信息\",\"title\":\""+title+"\",\"introduction\":\"说明\"}\n");
            for(int topic=2;topic<2+count;topic++)
            {
                result.Append("{\"qtype\":\"单选\",\"title\":\"").Append(changed&&topic==3?"更新题目":"题目").Append(topic).Append("\",\"select\":[\"A\",\"B\",\"C\"],\"requir\":true");
                if(relation&&topic==3)result.Append(",\"relation\":\"题目2>>>B\"");
                result.Append("}\n");
            }
            return result.ToString();
        }
        private static string Build(string logic,bool changed,bool relation)
        {
            string description; bool exam,need; int total,count;
            string survey=SurveyJsonlParser.Parse(Jsonl(changed,relation),changed?"更新问卷":"原问卷",out description,out exam);
            XmlDocument doc=new ActivityCreate(null).BuildSurveyXml(new ActivityCreateModel {Title=changed?"更新问卷":"原问卷",Description=description,SurveyData=survey,AType=1,LogicDsl=logic},"42",out need,out total,out count);
            doc.DocumentElement.SetAttribute("OpaqueRoot","keep");
            XmlElement extension=doc.CreateElement("Opaque"); extension.AppendChild(doc.CreateCDataSection("preserve me")); doc.DocumentElement.AppendChild(extension);
            return doc.OuterXml;
        }
        private static string ContentWithoutLogic(string xml)
        {
            XmlDocument doc=Load(xml); doc.DocumentElement.RemoveAttribute("HasRefer");
            foreach(XmlElement element in doc.SelectNodes("//*")) foreach(string name in new[]{"Relation","ItemRelation","HasJump","AnytimeJumpto","ItemJump"})element.RemoveAttribute(name);
            return doc.OuterXml;
        }
        private static XmlDocument Load(string xml){XmlDocument doc=new XmlDocument();doc.XmlResolver=null;doc.LoadXml(xml);return doc;}
        private static XmlElement Q(XmlDocument doc,int topic){return (XmlElement)doc.SelectSingleNode("/Questionnaire/Question[@Topic='"+topic+"']");}
        private static string Attr(int topic,string name){return Q(Load(State.Xml),topic).GetAttribute(name);}
        private static string RootAttr(string name){return Load(State.Xml).DocumentElement.GetAttribute(name);}
        private static void Save(string file){File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,file),State.Xml,new UTF8Encoding(true));}
        private static void Success(SurveyJsonExecutionResult result){Assert(result.Success,"Expected success, got "+result.Data.Status+": "+result.Message);}
        private static void Failure(SurveyJsonExecutionResult result,string status){Assert(!result.Success,"Expected failure");Equal(status,result.Data.Status);}
        private static void Equal(object expected,object actual){if(!object.Equals(expected,actual))throw new Exception("Expected ["+expected+"] actual ["+actual+"]");}
        private static void Assert(bool condition,string message){if(!condition)throw new Exception(message);}
        private static void Check(string name,Action test){try{test();Results.Add("PASS "+name);Console.WriteLine("PASS "+name);}catch(Exception error){failures++;Results.Add("FAIL "+name+": "+error.GetType().Name+": "+error.Message);Console.WriteLine("FAIL "+name+": "+error);}}
    }

    internal static class State
    {
        internal static WjxActivity Activity;
        internal static string InitialXml,Path;
        internal static int Reads,Writes,MetadataWrites,CounterReads,Answers,Publishes;
        internal static SurveyXmlDiffResult LastDiff;
        internal static SurveyAnswerIndexImpact LastImpact;
        internal static bool Owned,FailReadback,FailCounts,FailPublish;
        internal static string Xml {get{return File.ReadAllText(Path,Encoding.UTF8);}}
        internal static void Reset(string xml)
        {
            Path=System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"stored.xml");File.WriteAllText(Path,xml,new UTF8Encoding(true));InitialXml=xml;
            Activity=new WjxActivity {NewActivityId=42,Name="原问卷",Description="说明",QType=1,Status=0,QuestionnaireURL="fixture",TotalQCount=6,CacheVersion=3,BeginDate=new DateTime(2026,1,1)};
            Reads=Writes=MetadataWrites=CounterReads=Answers=Publishes=0; Owned=true;FailReadback=FailCounts=FailPublish=false;
            LastDiff=null;LastImpact=null;
        }
    }
    internal static class FixtureCache
    {
        public static WjxActivity GetWjxActivity(int id){return id==42?State.Activity:null;}
        public static void ClearXmlDocumentCache(int id,int version){}
        public static void ClearWjxActivity(int id){}
        public static void ClearThirdApp(WjxActivity activity){}
        public static void ClearTpCache(WjxActivity activity,bool force){}
    }
    internal static class FixtureUtil
    {
        public static bool IsActivityBelongCommany(WjxActivity activity,int companyId){return State.Owned&&companyId==7;}
        public static string GetXmlRealPath(string path,HttpContext context){return State.Path;}
        public static string GetFileXml(string path,WjxActivity activity){State.Reads++;return State.FailReadback&&State.Writes>0?State.InitialXml:File.ReadAllText(path,Encoding.UTF8);}
        public static void UpdateFileXmlOnly(string path,string xml,WjxActivity activity){State.Writes++;File.WriteAllText(path,xml,new UTF8Encoding(true));}
        public static void UpdateWjxActivityField(List<string> fields,WjxActivity activity){State.MetadataWrites++;}
        public static string encodeWjxId(int id){return id.ToString();}
    }
    internal sealed class FixtureCounter
    {
        public FixtureCounter(string ignored){}
        public void GetWjxActivityBothTimes(int id,out int joined,out int current){State.CounterReads++;if(State.FailCounts)throw new InvalidOperationException("fixture count unavailable");joined=current=State.Answers;}
    }
    internal static class FixtureRedis{public static int[] GetActivityBothTimes(int id){return new[]{State.Answers,State.Answers};}}
    internal sealed class FixtureSettingService
    {
        private readonly WjxActivity activity;
        public FixtureSettingService(WjxActivity value){activity=value;}
        public bool SetWjxactivitystatus(short status,out string error){State.Publishes++;error=State.FailPublish?"fixture publish failure":null;if(State.FailPublish)return false;activity.Status=status;return true;}
    }
    internal static class FixtureConfig{public static class DatabaseConnectionNames{public const string Sojump="fixture";}}
    internal static class DiffProbe
    {
        public static SurveyXmlDiffResult CompareXml(string before,string after,SurveyXmlOptions options){State.LastDiff=SurveyXmlChangeAnalyzer.CompareXml(before,after,options);File.WriteAllText(System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"last-candidate.xml"),after);return State.LastDiff;}
    }
    internal static class IndexProbe
    {
        public static SurveyAnswerIndexImpact Compare(SurveyXmlDocument before,SurveyXmlDocument after,SurveyAnswerIndexPolicy policy,SurveyXmlOptions options){State.LastImpact=SurveyAnswerIndexAnalyzer.Compare(before,after,policy,options);return State.LastImpact;}
    }
}
namespace LogicUpdateFixture.Logging
{
    public sealed class Error{public Error(Exception error){}}
    public sealed class ErrorLog{public static ErrorLog GetDefault(HttpContext ignored){return new ErrorLog();}public void Log(Error ignored){}}
}
