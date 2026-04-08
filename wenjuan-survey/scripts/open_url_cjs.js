/**
 * 在 CommonJS 脚本中打开系统默认浏览器（微信扫码页、绑定手机号页、报表页等共用）。
 *
 * 策略链（尽量覆盖本机 / WSL / OpenClaw / Workerbuddy 等）：
 * 1. WENJUAN_BROWSER：显式指定可执行文件（各平台 Agent 可配置）
 * 2. 动态 import('open')：兼容 open@10+ ESM，且 open 包对 WSL 等有处理
 * 3. Linux+WSL：wslview（若可用）
 * 4. 系统默认：macOS `open`、Linux `xdg-open`、Windows `rundll32 url.dll`（URL 整段传参，避免 & 被 cmd 截断）
 * 5. Linux+WSL：经 Windows 宿主 `cmd /c start` 或 PowerShell `Start-Process`
 * 6. Windows：PowerShell 回退（部分环境 rundll32 不可用）
 * 7. BROWSER：类 Unix 常见约定（仅 linux/darwin，避免与 Windows 误配冲突）
 *
 * 无图形会话时子进程仍可能“成功”退出，业务侧须配合写入完整 URL 文件（见 writeUrlForManualOpen）。
 */

const { spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

const OPEN_UNREF_MS = 3000;

/**
 * @param {string} url
 * @param {{ wait?: boolean }} [options]
 * @returns {Promise<boolean>} 是否由 npm open 成功调用
 */
async function openWithNpmOpen(url, options = {}) {
  try {
    const mod = await import("open");
    const fn = typeof mod.default === "function" ? mod.default : mod;
    if (typeof fn !== "function") {
      return false;
    }
    await fn(url, { wait: false, ...options });
    return true;
  } catch {
    return false;
  }
}

function isWsl() {
  if (process.platform !== "linux") {
    return false;
  }
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return true;
  }
  try {
    const v = fs.readFileSync("/proc/version", "utf8");
    return /microsoft/i.test(v);
  } catch {
    return false;
  }
}

/**
 * detached 子进程打开 URL；短时 resolve 并 unref，避免阻塞登录/绑定轮询。
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} [extraOpts]
 */
function spawnOpenDetached(command, args, extraOpts = {}) {
  return new Promise((resolve, reject) => {
    const opts = { detached: true, stdio: "ignore", ...extraOpts };
    const child = spawn(command, args, opts);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`浏览器打开失败，退出码: ${code}`));
      }
    });
    setTimeout(() => {
      child.unref();
      resolve();
    }, OPEN_UNREF_MS);
  });
}

/**
 * @param {string} spec WENJUAN_BROWSER / BROWSER，可为 `firefox` 或 `firefox %s --new-window`
 * @param {string} url
 */
async function spawnFromBrowserSpec(spec, url) {
  const s = String(spec).trim();
  if (!s) {
    throw new Error("empty spec");
  }
  let cmd;
  let args;
  if (s.includes("%s")) {
    const parts = s.split("%s");
    const left = parts[0].trim().split(/\s+/).filter(Boolean);
    const right = parts.slice(1).join("%s").trim().split(/\s+/).filter(Boolean);
    cmd = left[0];
    if (!cmd) {
      throw new Error("invalid BROWSER spec");
    }
    args = [...left.slice(1), url, ...right];
  } else {
    const tokens = s.split(/\s+/).filter(Boolean);
    cmd = tokens[0];
    args = [...tokens.slice(1), url];
  }
  await spawnOpenDetached(cmd, args, process.platform === "win32" ? { windowsHide: true } : {});
}

async function openViaWenjuanBrowserEnv(url) {
  const spec = (process.env.WENJUAN_BROWSER || "").trim();
  if (!spec) {
    return false;
  }
  try {
    await spawnFromBrowserSpec(spec, url);
    return true;
  } catch {
    return false;
  }
}

/** 仅类 Unix；Windows 不用 BROWSER，避免 SSH 会话里误指向 Linux 路径 */
async function openViaStandardBrowserEnv(url) {
  if (process.platform !== "linux" && process.platform !== "darwin") {
    return false;
  }
  const spec = (process.env.BROWSER || "").trim();
  if (!spec) {
    return false;
  }
  try {
    await spawnFromBrowserSpec(spec, url);
    return true;
  } catch {
    return false;
  }
}

async function tryWslview(url) {
  try {
    await spawnOpenDetached("wslview", [url]);
    return true;
  } catch {
    return false;
  }
}

/**
 * WSL 内无 DISPLAY 时 xdg-open 常失败，改由 Windows 宿主默认浏览器打开。
 */
async function openWslThroughWindowsHost(url) {
  if (!isWsl()) {
    return false;
  }
  const cmdExe = "/mnt/c/Windows/System32/cmd.exe";
  const psExe =
    "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";

  if (fs.existsSync(cmdExe)) {
    try {
      await spawnOpenDetached(cmdExe, ["/c", "start", "", url], { windowsHide: true });
      return true;
    } catch {
      /* try powershell */
    }
  }
  if (fs.existsSync(psExe)) {
    try {
      const safe = url.replace(/'/g, "''");
      await spawnOpenDetached(
        psExe,
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Start-Process '${safe}'`,
        ],
        { windowsHide: true }
      );
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function openWindowsPowerShell(url) {
  if (process.platform !== "win32") {
    return false;
  }
  const sys = process.env.SystemRoot || "C:\\Windows";
  const ps = path.join(sys, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  if (!fs.existsSync(ps)) {
    return false;
  }
  try {
    const safe = url.replace(/'/g, "''");
    await spawnOpenDetached(
      ps,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Start-Process '${safe}'`,
      ],
      { windowsHide: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 整段 URL 作为单个参数传给子进程，避免 Windows cmd 解析 &。
 * @param {string} url
 * @returns {Promise<void>}
 */
function spawnOpenUrl(url) {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    let command;
    let args = [];
    const opts = { detached: true, stdio: "ignore" };

    switch (platform) {
      case "darwin":
        command = "open";
        args = [url];
        break;
      case "linux":
        command = "xdg-open";
        args = [url];
        break;
      case "win32":
        command = "rundll32";
        args = ["url.dll,FileProtocolHandler", url];
        opts.windowsHide = true;
        break;
      default:
        reject(new Error(`不支持的操作系统: ${platform}`));
        return;
    }

    const child = spawn(command, args, opts);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`浏览器打开失败，退出码: ${code}`));
      }
    });
    setTimeout(() => {
      child.unref();
      resolve();
    }, OPEN_UNREF_MS);
  });
}

/**
 * 依次尝试：显式浏览器 → npm open → WSL 专用 → 系统默认 → 平台回退 → BROWSER。
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function openUrlBestEffort(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  if (await openViaWenjuanBrowserEnv(url)) {
    return true;
  }
  if (await openWithNpmOpen(url, { wait: false })) {
    return true;
  }
  if (process.platform === "linux" && isWsl()) {
    if (await tryWslview(url)) {
      return true;
    }
  }

  try {
    await spawnOpenUrl(url);
    return true;
  } catch {
    /* fall through */
  }

  if (process.platform === "linux" && isWsl()) {
    if (await openWslThroughWindowsHost(url)) {
      return true;
    }
  }

  if (process.platform === "win32") {
    if (await openWindowsPowerShell(url)) {
      return true;
    }
  }

  if (await openViaStandardBrowserEnv(url)) {
    return true;
  }

  return false;
}

/**
 * 将完整 URL 写入文件，避免终端折行、半选复制导致查询参数丢失（Agent / SSH 场景）。
 * @param {string} url
 * @param {string} dir
 * @param {string} fileName
 * @returns {Promise<string>} 绝对路径
 */
async function writeUrlForManualOpen(url, dir, fileName) {
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, fileName);
  await fsp.writeFile(file, `${url}\n`, "utf-8");
  try {
    await fsp.chmod(file, 0o600);
  } catch {
    /* Windows 等环境可能不支持 chmod */
  }
  return file;
}

module.exports = {
  openWithNpmOpen,
  spawnOpenUrl,
  openUrlBestEffort,
  writeUrlForManualOpen,
  isWsl,
};
