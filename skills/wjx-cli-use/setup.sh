#!/bin/bash
#
# 问卷星 AI Skill 环境检测与安装脚本
# 检测 Node.js → 安装 wjx-cli → 引导获取 API Key → 配置 → 验证
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_WJX_CLI_VERSION="0.4.1"
DEFAULT_WJX_BASE_URL="https://www.wjx.cn"

# 打印函数
print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

has_nonblank() {
    [ -n "${1//[[:space:]]/}" ]
}

trim_whitespace() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

config_has_api_key() {
    local path="$1"
    [ -f "$path" ] || return 1
    node -e 'const fs = require("node:fs"); try { const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.exit(value && typeof value.apiKey === "string" && value.apiKey.trim() ? 0 : 1); } catch { process.exit(1); }' "$path"
}

# Compare semantic versions without relying on GNU sort (the script also runs on macOS).
version_at_least() {
    node -e 'const [actual, minimum] = process.argv.slice(1); const parse = value => value.replace(/^v/, "").split(".").map(part => Number.parseInt(part, 10) || 0); const a = parse(actual); const b = parse(minimum); process.exit(a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] >= b[2]))) ? 0 : 1);' "$1" "$2"
}

print_cli_source_guide() {
    echo "wjx-cli ${MIN_WJX_CLI_VERSION} 已发布到 npm，请直接安装或升级："
    echo "  npm install -g wjx-cli@latest && wjx skill install --force"
    echo "如果需要从源码开发，再执行："
    echo "  git clone https://github.com/wjxcom/wjx-ai-kit.git"
    echo "  cd wjx-ai-kit && npm install"
    echo "  npm run build --workspace=wjx-api-sdk"
    echo "  npm run build --workspace=wjx-cli"
    echo "  npm link ./wjx-cli"
}

check_cli_version() {
    if ! WJX_VERSION="$(wjx --version 2>/dev/null)"; then
        print_error "无法执行 wjx --version"
        print_cli_source_guide
        return 1
    fi
    WJX_VERSION="$(printf '%s' "$WJX_VERSION" | awk 'NR == 1 { print; exit }')"
    if ! has_nonblank "$WJX_VERSION" || ! version_at_least "$WJX_VERSION" "$MIN_WJX_CLI_VERSION"; then
        print_error "wjx-cli 版本过低: ${WJX_VERSION:-unknown}（需要 ${MIN_WJX_CLI_VERSION}+）"
        print_cli_source_guide
        return 1
    fi
    print_success "wjx-cli ${WJX_VERSION}"
    return 0
}

install_core_skill() {
    print_info "安装 wjx-cli-use 技能..."
    local root
    root="$(resolve_install_root)"
    if wjx skill install --force --target-dir "$root"; then
        print_success "wjx-cli-use 技能已安装"
        return 0
    fi
    print_error "wjx-cli-use 技能安装失败"
    return 1
}

# Keep the shell installer and the CLI's default discovery rules aligned.
resolve_install_root() {
    local value
    value="$(trim_whitespace "${WJX_INSTALL_ROOT:-}")"
    if has_nonblank "$value"; then
        printf '%s' "$value"
    elif value="$(trim_whitespace "${CLAUDE_PROJECT_DIR:-}")" && [ -d "$value" ]; then
        printf '%s' "$value"
    elif value="$(trim_whitespace "${WORKBUDDY_HOME:-}")" && [ -d "$value" ]; then
        printf '%s' "$value"
    elif value="$(trim_whitespace "${CLAW_HOME:-}")" && [ -d "$value" ]; then
        printf '%s' "$value"
    else
        printf '%s' "$PWD"
    fi
}

check_core_skill() {
    local root
    local missing=0
    root="$(resolve_install_root)"
    for path in \
        "$root/skills/wjx-cli-use/SKILL.md" \
        "$root/.claude/skills/wjx-cli-use/SKILL.md" \
        "$root/.claude/agents/wjx-cli-expert.md"; do
        if [ ! -s "$path" ]; then
            print_warning "缺少核心 Skill 文件: $path"
            missing=1
        fi
    done
    if [ "$missing" -eq 0 ] && ! cmp -s \
        "$root/skills/wjx-cli-use/SKILL.md" \
        "$root/.claude/skills/wjx-cli-use/SKILL.md"; then
        print_warning "核心 Skill 镜像内容不一致，请运行 wjx skill install --force"
        missing=1
    fi
    if [ "$missing" -eq 0 ]; then
        print_success "wjx-cli-use Skill 与 Claude 镜像已安装"
        return 0
    fi
    return 1
}

upgrade_cli() {
    print_info "正在升级 wjx-cli 到最新版本..."
    if npm install -g wjx-cli@latest; then
        return 0
    fi
    if command -v sudo &> /dev/null && sudo npm install -g wjx-cli@latest; then
        return 0
    fi
    print_error "wjx-cli 升级失败"
    return 1
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
        else
            OS="Linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="Windows"
    else
        OS="Unknown"
    fi
    echo "$OS"
}

# Step 1: 检测 Node.js
check_node() {
    print_info "Step 1/5: 检测 Node.js 环境..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1)

        if [ "$NODE_MAJOR" -ge 20 ]; then
            print_success "Node.js $NODE_VERSION"
            return 0
        else
            print_error "Node.js 版本过低: $NODE_VERSION（需要 20+）"
            return 1
        fi
    else
        print_error "未检测到 Node.js"
        return 1
    fi
}

# 打印 Node.js 安装指引
print_node_install_guide() {
    echo ""
    echo "请安装 Node.js 20+ 后重新运行本脚本："
    echo ""
    echo "  macOS:    brew install node"
    echo "  Ubuntu:   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  CentOS:   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
    echo "  Windows:  winget install OpenJS.NodeJS"
    echo "  通用:     https://nodejs.org 下载安装"
    echo ""
}

# Step 2: 安装 wjx-cli
install_cli() {
    print_info "Step 2/5: 安装 wjx-cli..."

    if command -v wjx &> /dev/null; then
        if ! check_cli_version; then
            upgrade_cli || return 1
            check_cli_version || return 1
        fi
        install_core_skill
        return $?
    fi

    print_info "正在全局安装 wjx-cli..."
    NPM_ERR=$(mktemp)
    if npm install -g wjx-cli@latest 2>"$NPM_ERR"; then
        rm -f "$NPM_ERR"
        if check_cli_version; then
            if ! install_core_skill; then return 1; fi
            print_success "wjx-cli 与 wjx-cli-use 安装成功"
            return 0
        fi
        return 1
    else
        print_warning "全局安装失败，错误信息："
        cat "$NPM_ERR" 2>/dev/null
        rm -f "$NPM_ERR"
        print_info "尝试 sudo..."
        if command -v sudo &> /dev/null; then
            if sudo npm install -g wjx-cli@latest; then
                if check_cli_version; then
                    if ! install_core_skill; then return 1; fi
                    print_success "wjx-cli 与 wjx-cli-use 安装成功（sudo）"
                    return 0
                fi
                return 1
            fi
        fi
        echo ""
        print_error "wjx-cli 安装失败"
        echo ""
        echo "请手动安装已发布的 wjx-cli ${MIN_WJX_CLI_VERSION}+："
        echo "  sudo npm install -g wjx-cli@latest && wjx skill install --force"
        echo ""
        echo "或使用 npx 免安装运行："
        echo "  npx wjx-cli@${MIN_WJX_CLI_VERSION} survey list"
        echo ""
        print_cli_source_guide
        echo ""
        return 1
    fi
}

# Resolve the deployment origin used both for the API Key page and wjx init.
# Accepting an origin here prevents private deployments from accidentally
# opening the public wjx.cn login page.
normalize_base_url() {
    local value
    value="$(trim_whitespace "${1:-$DEFAULT_WJX_BASE_URL}")"
    value="${value:-$DEFAULT_WJX_BASE_URL}"
    while [[ "$value" == */ ]]; do value="${value%/}"; done
    if [[ "$value" != http://* && "$value" != https://* ]]; then
        value="https://$value"
    fi
    if [[ "$value" == */openapi/* ]]; then
        value="${value%%/openapi/*}"
    fi
    printf '%s' "$value"
}

configure_base_url() {
    local value="$(trim_whitespace "${WJX_BASE_URL:-}")"
    if ! has_nonblank "$value"; then
        if [ "${AUTO_INSTALL:-0}" -eq 1 ] || [ ! -t 0 ]; then
            value="$DEFAULT_WJX_BASE_URL"
        else
            read -r -p "  问卷星部署地址（公网直接回车，私有化填写域名） [$DEFAULT_WJX_BASE_URL]: " value
            value="$(trim_whitespace "$value")"
            value="${value:-$DEFAULT_WJX_BASE_URL}"
        fi
    fi
    WJX_BASE_URL="$(normalize_base_url "$value")"
    export WJX_BASE_URL
}

# Step 3: 引导获取 API Key
guide_api_key() {
    print_info "Step 3/5: 获取问卷星 API Key..."

    configure_base_url
    if has_nonblank "${WJX_API_KEY:-}"; then
        print_success "检测到 WJX_API_KEY 环境变量，跳过浏览器取 Key"
        return 0
    fi
    if [ "${AUTO_INSTALL:-0}" -eq 1 ] && [ ! -t 0 ]; then
        print_error "非交互自动安装缺少 WJX_API_KEY；请先设置环境变量后重新运行"
        return 1
    fi
    LOGIN_URL="${WJX_BASE_URL}/weixinlogin.aspx?redirecturl=%2Fnewwjx%2Fmanage%2Fuserinfo.aspx%3FshowApiKey%3D1"

    echo ""
    if [ "$WJX_BASE_URL" = "$DEFAULT_WJX_BASE_URL" ]; then
        echo "  当前使用问卷星公网地址。"
    else
        echo "  当前使用私有化部署地址：$WJX_BASE_URL"
    fi
    echo "  即将打开浏览器，请用微信扫码登录问卷星。"
    echo "  登录后会自动跳转到 API Key 管理页面，复制你的 API Key。"
    echo ""

    # 尝试打开浏览器
    OPENED=0
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$LOGIN_URL" 2>/dev/null && OPENED=1
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        cmd.exe /c start "" "$LOGIN_URL" 2>/dev/null && OPENED=1
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$LOGIN_URL" 2>/dev/null && OPENED=1
    fi

    if [ $OPENED -eq 0 ]; then
        print_warning "无法自动打开浏览器，请手动复制以下链接到浏览器打开："
        echo ""
        echo "  $LOGIN_URL"
        echo ""
    else
        print_success "已打开浏览器"
    fi

    echo "  请在浏览器页面复制 API Key，然后继续下一步。"
    echo ""
    if [ $AUTO_INSTALL -eq 0 ]; then
        read -p "  按回车键继续..." -r
    fi
}

# Step 4: 配置 wjx-cli
configure_cli() {
    print_info "Step 4/5: 配置 wjx-cli..."
    if has_nonblank "${WJX_API_KEY:-}"; then
        local args=(--api-key "$WJX_API_KEY" --base-url "$WJX_BASE_URL" --no-install-skill)
        if has_nonblank "${WJX_CORP_ID:-}"; then
            args+=(--corp-id "$WJX_CORP_ID")
        fi
        wjx init "${args[@]}"
        return $?
    fi
    echo ""
    echo "  请将刚才复制的 API Key 粘贴到下方："
    echo ""
    # install_cli already installs the core skill; avoid asking the user to
    # install the same Skill a second time during this setup flow.
    wjx init --no-install-skill
}

# Step 5: 验证
verify_setup() {
    print_info "Step 5/5: 验证连接..."
    wjx doctor
    echo ""
    print_info "人工验收：列出问卷..."
    wjx survey list --format table
}

# 仅检查环境
check_only() {
    echo ""
    echo "============================================"
    echo "  问卷星 AI Skill 环境检查"
    echo "============================================"
    echo ""

    PASS=1

    # Node.js
    if check_node; then true; else PASS=0; fi

    # npm
    if command -v npm &> /dev/null; then
        print_success "npm $(npm --version)"
    else
        print_error "未检测到 npm"
        PASS=0
    fi

    # wjx-cli
    if command -v wjx &> /dev/null; then
        check_cli_version || PASS=0
        check_core_skill || PASS=0
    else
        print_warning "wjx-cli 未安装或版本低于 ${MIN_WJX_CLI_VERSION}（请执行 npm install -g wjx-cli@latest && wjx skill install --force）"
        PASS=0
    fi

    # 配置文件（可由 WJX_CONFIG_PATH 覆盖）
    CONFIG_PATH="$(trim_whitespace "${WJX_CONFIG_PATH:-$HOME/.wjxrc}")"
    if has_nonblank "${WJX_API_KEY:-}"; then
        print_success "WJX_API_KEY 环境变量已配置"
    elif config_has_api_key "$CONFIG_PATH"; then
        print_success "$CONFIG_PATH 配置文件含有效 API Key"
    else
        print_warning "$CONFIG_PATH 未配置（运行 wjx init）"
        PASS=0
    fi

    echo ""
    if [ $PASS -eq 1 ]; then
        print_success "环境检查通过"
        exit 0
    else
        print_error "环境检查未通过"
        exit 1
    fi
}

# 仅验证
verify_only() {
    echo ""
    echo "============================================"
    echo "  问卷星 AI Skill 安装验证"
    echo "============================================"
    echo ""

    check_node || exit 1

    if command -v wjx &> /dev/null; then
        check_cli_version || exit 1
    else
        print_error "wjx-cli 未安装"
        exit 1
    fi

    check_core_skill || exit 1

    echo ""
    wjx doctor
    echo ""
    wjx survey list --format table
}

# 显示帮助
show_help() {
    cat << EOF
问卷星 AI Skill 环境检测与安装脚本

用法: $0 [选项]

选项:
    -h, --help      显示帮助信息
    -y, --yes       自动安装（无需确认，推荐）
    -c, --check     仅检查环境，不安装
    -v, --verify    验证安装是否完整

示例:
    $0              # 交互式安装
    $0 -y           # 自动安装（推荐）
    $0 -c           # 仅检查环境
    $0 -v           # 验证安装

安装流程:
    1. 检测 Node.js 20+
    2. 安装并验证 wjx-cli >= ${MIN_WJX_CLI_VERSION}（安装后使用命令 wjx）
    3. 选择公网或私有化部署地址，打开对应页面获取 API Key（微信扫码登录）
    4. 配置 wjx init（粘贴 API Key）
    5. 验证连接 wjx doctor，并用 wjx survey list --format table 做人工验收

EOF
}

# 主函数
main() {
    echo ""
    echo "============================================"
    echo "  问卷星 AI Skill 环境安装"
    echo "============================================"
    echo ""

    # 解析参数
    CHECK_ONLY=0
    AUTO_INSTALL=0
    VERIFY_ONLY=0

    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--check)
                CHECK_ONLY=1
                shift
                ;;
            -y|--yes)
                AUTO_INSTALL=1
                shift
                ;;
            -v|--verify)
                VERIFY_ONLY=1
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 仅检查模式
    if [ $CHECK_ONLY -eq 1 ]; then
        check_only
        exit $?
    fi

    # 仅验证模式
    if [ $VERIFY_ONLY -eq 1 ]; then
        verify_only
        exit $?
    fi

    # Step 1: Node.js
    if ! check_node; then
        print_node_install_guide
        exit 1
    fi

    # Step 2: wjx-cli
    if ! install_cli; then
        exit 1
    fi

    # Step 3: API Key
    guide_api_key

    # Step 4: 配置
    configure_cli

    # Step 5: 验证
    echo ""
    verify_setup

    echo ""
    echo "============================================"
    print_success "安装完成！"
    echo "============================================"
    echo ""
    echo "  试试对 AI 说："
    echo "  「帮我创建一份客户满意度调查问卷」"
    echo ""
    echo "  或命令行直接用："
    echo "  wjx survey list                    # 查看问卷列表"
    echo "  wjx survey jsonl-template --raw    # 生成 JSONL 问卷模板"
    echo "  wjx survey create --file survey.jsonl # 用 JSONL 创建问卷"
    echo "  wjx response report --vid 12345    # 查看问卷报告"
    echo ""
}

main "$@"
