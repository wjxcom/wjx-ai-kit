#!/bin/bash
#
# 问卷网 Skill 环境检测与安装脚本 (Node.js 版本)
# 检测并安装 Node.js 和 npm 依赖包
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
        elif type lsb_release >/dev/null 2>&1; then
            OS=$(lsb_release -si)
        elif [ -f /etc/lsb-release ]; then
            . /etc/lsb-release
            OS=$DISTRIB_ID
        elif [ -f /etc/debian_version ]; then
            OS="Debian"
        elif [ -f /etc/redhat-release ]; then
            OS="Red Hat"
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

# 检测 Node.js
check_node() {
    print_info "检测 Node.js 环境..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        
        print_info "检测到 Node.js 版本: $NODE_VERSION"
        
        if [ "$NODE_MAJOR" -ge 18 ]; then
            print_success "Node.js 版本符合要求 (>= 18)"
            return 0
        else
            print_error "Node.js 版本过低，需要 18+"
            return 1
        fi
    else
        print_error "未检测到 Node.js"
        return 1
    fi
}

# 安装 Node.js (macOS)
install_node_macos() {
    print_info "正在安装 Node.js (macOS)..."
    
    if ! command -v brew &> /dev/null; then
        print_info "安装 Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install node
    print_success "Node.js 安装完成"
}

# 安装 Node.js (Ubuntu/Debian)
install_node_debian() {
    print_info "正在安装 Node.js (Ubuntu/Debian)..."
    
    # 使用 NodeSource 安装较新版本
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    print_success "Node.js 安装完成"
}

# 安装 Node.js (CentOS/RHEL/Fedora)
install_node_redhat() {
    print_info "正在安装 Node.js (CentOS/RHEL/Fedora)..."
    
    # 使用 NodeSource 安装较新版本
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    
    if command -v dnf &> /dev/null; then
        sudo dnf install -y nodejs
    else
        sudo yum install -y nodejs
    fi
    
    print_success "Node.js 安装完成"
}

# 安装 Node.js (Arch)
install_node_arch() {
    print_info "正在安装 Node.js (Arch Linux)..."
    
    sudo pacman -S --noconfirm nodejs npm
    
    print_success "Node.js 安装完成"
}

# 安装 Node.js (openSUSE)
install_node_suse() {
    print_info "正在安装 Node.js (openSUSE)..."
    
    sudo zypper install -y nodejs npm
    
    print_success "Node.js 安装完成"
}

# 安装 Node.js (Alpine)
install_node_alpine() {
    print_info "正在安装 Node.js (Alpine Linux)..."
    
    apk add --no-cache nodejs npm
    
    print_success "Node.js 安装完成"
}

# 安装 Node.js
install_node() {
    OS=$(detect_os)
    print_info "操作系统: $OS"
    
    case "$OS" in
        "macOS")
            install_node_macos
            ;;
        "Ubuntu"*|"Debian"*)
            install_node_debian
            ;;
        "CentOS"*|"Red Hat"*|"Fedora"*)
            install_node_redhat
            ;;
        "Arch"*)
            install_node_arch
            ;;
        "openSUSE"*)
            install_node_suse
            ;;
        "Alpine"*)
            install_node_alpine
            ;;
        "Windows")
            print_error "Windows 系统请使用以下方式安装 Node.js:"
            echo "  方式一: winget install OpenJS.NodeJS"
            echo "  方式二: 访问 https://nodejs.org 下载安装程序"
            echo "  方式三: 使用 WSL (Windows Subsystem for Linux)"
            exit 1
            ;;
        *)
            print_error "不支持自动安装 Node.js 的系统: $OS"
            echo "请手动安装 Node.js 18+ 版本:"
            echo "  - 访问 https://nodejs.org 下载安装程序"
            echo "  - 或使用系统的包管理器安装"
            echo ""
            echo "常见系统安装命令:"
            echo "  macOS:     brew install node"
            echo "  Ubuntu:    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
            echo "  CentOS:    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
            echo "  Fedora:    sudo dnf install -y nodejs npm"
            echo "  Arch:      sudo pacman -S nodejs npm"
            echo "  openSUSE:  sudo zypper install -y nodejs npm"
            echo "  Alpine:    apk add --no-cache nodejs npm"
            exit 1
            ;;
    esac
}

# 检测 npm
check_npm() {
    print_info "检测 npm..."
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm 已安装 (版本: $NPM_VERSION)"
        return 0
    else
        print_error "未检测到 npm"
        return 1
    fi
}

# 仅展示当前 npm registry，不执行 npm config set（不修改用户全局源）
print_npm_registry_info() {
    if command -v npm &> /dev/null; then
        print_info "当前 npm registry: $(npm config get registry)（本脚本不会修改 registry，请自行按需配置镜像）"
    fi
}

# 安装依赖前的安全与风险提示
print_install_risk_notice() {
    echo ""
    print_warning "安装与安全提示（请阅读）"
    echo "  • npm install 将从当前 registry 拉取第三方依赖，请在可信网络下执行，并确保 registry 来源可信。"
    echo "  • 使用问卷网接口时，登录凭证会写入本机（如 ~/.wenjuan 或 Skill 目录下 .wenjuan/）；请勿将含 token 的文件提交到 Git 或发送给他人。"
    echo "  • 清除登录态请自行删除相关文件，见 references/auth.md「清除本机登录态（手动）」。"
    echo ""
}

# 安装 npm 依赖
install_dependencies() {
    print_info "安装 npm 依赖包..."
    
    if [ -f "$SCRIPT_DIR/package.json" ]; then
        cd "$SCRIPT_DIR"
        npm install
        print_success "依赖包安装完成"
    else
        print_error "未找到 package.json"
        exit 1
    fi
}

# 验证安装
verify_installation() {
    print_info "验证安装..."
    
    # 检查 Node.js
    NODE_VERSION=$(node --version)
    print_success "Node.js: $NODE_VERSION"
    
    # 检查 npm
    NPM_VERSION=$(npm --version)
    print_success "npm: $NPM_VERSION"
    
    # 检查依赖包
    cd "$SCRIPT_DIR"
    
    if node -e "require('axios')" 2>/dev/null; then
        AXIOS_VERSION=$(node -e "console.log(require('axios/package.json').version)")
        print_success "axios: $AXIOS_VERSION"
    else
        print_error "axios 未安装"
        return 1
    fi
    
    if node -e "require('open')" 2>/dev/null; then
        OPEN_VERSION=$(node -e "console.log(require('open/package.json').version)")
        print_success "open: $OPEN_VERSION"
    else
        print_error "open 未安装"
        return 1
    fi
    
    return 0
}

# 显示帮助
show_help() {
    cat << EOF
问卷网 Skill 环境检测与安装脚本 (Node.js 版本)

用法: $0 [选项]

选项:
    -h, --help      显示帮助信息
    -y, --yes       自动安装缺失的环境（无需确认，推荐）
    -c, --check     仅检查环境，不安装
    -v, --verify    验证安装是否完整

示例:
    $0              # 交互式检查环境，提示后安装
    $0 -y           # 自动检测并安装缺失的环境（推荐）
    $0 -c           # 仅检查环境
    $0 -v           # 验证安装

EOF
}

# 主函数
main() {
    echo ""
    echo "============================================================"
    echo "  问卷网 Skill 环境检测与安装 (Node.js 版本)"
    echo "============================================================"
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
    
    # 仅验证模式
    if [ $VERIFY_ONLY -eq 1 ]; then
        if verify_installation; then
            echo ""
            print_success "环境验证通过！"
            exit 0
        else
            echo ""
            print_error "环境验证失败"
            exit 1
        fi
    fi
    
    # 检测 Node.js
    NODE_OK=0
    if check_node; then
        NODE_OK=1
    else
        if [ $CHECK_ONLY -eq 1 ]; then
            echo ""
            print_error "环境检查未通过"
            echo ""
            echo "Node.js 未安装或版本过低（需要 18+）"
            echo ""
            echo "安装指南:"
            echo "  macOS:     brew install node"
            echo "  Ubuntu:    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
            echo "  CentOS:    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
            echo "  Fedora:    sudo dnf install -y nodejs npm"
            echo "  Arch:      sudo pacman -S nodejs npm"
            echo "  openSUSE:  sudo zypper install -y nodejs npm"
            echo "  Alpine:    apk add --no-cache nodejs npm"
            echo "  Windows:   winget install OpenJS.NodeJS"
            echo ""
            exit 1
        elif [ $AUTO_INSTALL -eq 1 ]; then
            echo ""
            install_node
            echo ""
        else
            echo ""
            print_warning "Node.js 未安装或版本过低"
            read -p "是否自动安装 Node.js? (y/N) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                install_node
            else
                echo ""
                echo "安装指南:"
                echo "  macOS:    brew install node"
                echo "  Ubuntu:   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
                echo "  CentOS:   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
                echo "  Windows:  winget install OpenJS.NodeJS"
                echo ""
                exit 1
            fi
        fi
    fi
    
    # 检测 npm
    NPM_OK=0
    if check_npm; then
        NPM_OK=1
    else
        print_warning "npm 未安装，尝试安装..."
        install_node
        if ! check_npm; then
            print_error "npm 安装失败"
            exit 1
        fi
    fi
    
    # 仅提示当前 registry，不修改
    if [ $CHECK_ONLY -eq 0 ]; then
        print_npm_registry_info
    fi
    
    # 安装依赖
    if [ $CHECK_ONLY -eq 0 ]; then
        print_install_risk_notice
        install_dependencies
    fi
    
    # 验证
    echo ""
    if verify_installation; then
        echo ""
        echo "============================================================"
        print_success "环境准备完成！"
        echo "============================================================"
        echo ""
        echo "当前环境：Node.js 与项目 npm 依赖已安装，可正常执行本目录下的 Node 脚本。"
        echo "二次校验可运行: node \"${SCRIPT_DIR}/scripts/check_env.js\""
        echo ""
        exit 0
    else
        echo ""
        echo "============================================================"
        print_error "环境验证失败"
        echo "============================================================"
        echo ""
        exit 1
    fi
}

# 运行主函数
main "$@"
