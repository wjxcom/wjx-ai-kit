[CmdletBinding()]
param(
    [string]$BackendRoot = 'D:\workspace\VSrepos\Branch\tanhao',
    [string]$OutputRoot
)
$ErrorActionPreference = 'Stop'
$testRepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $OutputRoot) { $OutputRoot = Join-Path $testRepositoryRoot '.tmp-survey-logic-integration' }
$OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
$testBin = Join-Path $BackendRoot '04Web\WebSiteNew\Bin'
$testCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
foreach ($testDependency in @($testCompiler, (Join-Path $testBin 'Wjx.Bll.dll'), (Join-Path $testBin 'Wjx.Model.dll'))) {
    if (-not (Test-Path -LiteralPath $testDependency -PathType Leaf)) { throw "Missing dependency: $testDependency" }
}
[IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
$testReferences = @(Get-ChildItem -LiteralPath $testBin -Filter '*.dll' | ForEach-Object { '/reference:' + $_.FullName })
$testCreateReferences = @('Wjx.Bll.dll','Wjx.Model.dll','Wjx.Dal.dll','BusinessLogic.dll','SubSonic.dll','Newtonsoft.Json.dll') | ForEach-Object { '/reference:' + (Join-Path $testBin $_) }
$testCommonArguments = @('/nologo','/target:exe','/langversion:5','/reference:System.Web.dll','/reference:System.Core.dll','/reference:System.Xml.dll','/reference:System.Data.dll','/reference:System.Configuration.dll')
$testPreviousBin = $env:WJX_LOGIC_TEST_BIN
try {
    $env:WJX_LOGIC_TEST_BIN = $testBin
    $testCreateOutput = Join-Path $OutputRoot 'create'
    [IO.Directory]::CreateDirectory($testCreateOutput) | Out-Null
    $testCreateExe = Join-Path $testCreateOutput 'CreateLogicIntegration.exe'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Runtime.config') -Destination ($testCreateExe + '.config') -Force
    & $testCompiler @testCommonArguments ('/out:' + $testCreateExe) @testCreateReferences (Join-Path $PSScriptRoot 'CreateLogicIntegration.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Creation integration fixture compilation failed' }
    & $testCreateExe
    if ($LASTEXITCODE -ne 0) { throw "Creation integration failed; see $testCreateOutput\results.txt" }

    $testUpdateOutput = Join-Path $OutputRoot 'update'
    [IO.Directory]::CreateDirectory($testUpdateOutput) | Out-Null
    $testUpdateExe = Join-Path $testUpdateOutput 'UpdateLogicIntegration.exe'
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Runtime.config') -Destination ($testUpdateExe + '.config') -Force
    # Execute the actual production method. Only external storage/cache/state
    # dependencies are redirected to deterministic fixture implementations.
    $testProductionSource = [IO.File]::ReadAllText((Join-Path $BackendRoot '04Web\WebSiteNew\App_Code\Dsl\WjxDslOpenApiIntegration.cs'))
    $testAliases = @(
        '    using Util = LogicUpdateFixture.FixtureUtil;',
        '    using CacheControl = LogicUpdateFixture.FixtureCache;',
        '    using RedisManager = LogicUpdateFixture.FixtureRedis;',
        '    using WjxActivityControl = LogicUpdateFixture.FixtureCounter;',
        '    using ActivitySettingService = LogicUpdateFixture.FixtureSettingService;',
        '    using ConfigInfo = LogicUpdateFixture.FixtureConfig;',
        '    using Elmah = LogicUpdateFixture.Logging;',
        '    using SurveyXmlChangeAnalyzer = LogicUpdateFixture.DiffProbe;',
        '    using SurveyAnswerIndexAnalyzer = LogicUpdateFixture.IndexProbe;'
    ) -join "`r`n"
    $testNamespace = [regex]::Match($testProductionSource, 'namespace Wjx\.Web\.Dsl\s*\{')
    if (-not $testNamespace.Success) { throw 'Production integration namespace was not found' }
    $testProductionSource = $testProductionSource.Insert($testNamespace.Index + $testNamespace.Length, "`r`n" + $testAliases + "`r`n")
    $testProductionPath = Join-Path $testUpdateOutput 'ProductionUpdateWithStorageSeams.cs'
    [IO.File]::WriteAllText($testProductionPath, $testProductionSource, [Text.UTF8Encoding]::new($true))
    & $testCompiler @testCommonArguments ('/out:' + $testUpdateExe) @testReferences (Join-Path $PSScriptRoot 'UpdateLogicIntegration.cs') $testProductionPath (Join-Path $BackendRoot '04Web\WebSiteNew\App_Code\Dsl\WjxDslApplicationStatus.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Update integration fixture compilation failed' }
    & $testUpdateExe
    if ($LASTEXITCODE -ne 0) { throw "Update integration failed; see $testUpdateOutput\results.txt" }
    Write-Output "Integration fixtures passed. XML and results: $OutputRoot"
}
finally {
    $env:WJX_LOGIC_TEST_BIN = $testPreviousBin
}
