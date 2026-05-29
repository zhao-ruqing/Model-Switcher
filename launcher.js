const http = require("http");
const { spawn } = require("child_process");

const PORT = 51234;
const BACKEND_PORT = 51235;
const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 分钟

let serverProc = null;
let idleTimer = null;
let starting = false;

// 自守护：终端运行时检测已有实例，无则后台重启自身
// 任务计划/已后台化（非 TTY）时跳过，直接作为守护进程运行
if (require.main === module && process.stdout.isTTY) {
  const probe = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    res.resume();
    console.log("[launcher] 已有实例运行中，无需重复启动");
    process.exit(0);
  });
  probe.on("error", () => {
    // 无实例，后台重启自身
    const child = spawn(process.execPath, [__filename], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    // 等待子进程就绪后退出
    let retries = 0;
    const wait = setInterval(() => {
      const chk = http.get(`http://127.0.0.1:${PORT}/`, (r) => {
        r.resume();
        clearInterval(wait);
        console.log("[launcher] 已转为后台运行");
        process.exit(0);
      });
      chk.on("error", () => {
        if (++retries >= 10) {
          clearInterval(wait);
          console.log("[launcher] 启动超时");
          process.exit(1);
        }
      });
      chk.setTimeout(500, () => chk.destroy());
    }, 300);
  });
  probe.setTimeout(1500, () => {
    probe.destroy();
  });
  return;
}

function resetIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (serverProc) {
      serverProc.kill();
      serverProc = null;
      console.log("[launcher] 后端空闲超时，已关闭");
    }
  }, IDLE_TIMEOUT);
}

function checkBackend() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${BACKEND_PORT}/`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startBackend() {
  if (serverProc) return;
  if (starting) return;
  starting = true;

  // 跨平台：Windows 隐藏窗口，macOS/Linux 分离进程
  const isWin = process.platform === "win32";
  const opts = {
    cwd: __dirname,
    stdio: "ignore",
    detached: !isWin,
    windowsHide: true,
  };
  serverProc = spawn("node", ["server.js"], opts);
  if (!isWin && serverProc.pid) {
    serverProc.unref();
  }
  serverProc.on("exit", () => {
    serverProc = null;
    starting = false;
  });
}

function proxyRequest(clientReq, clientRes) {
  const options = {
    hostname: "127.0.0.1",
    port: BACKEND_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: { ...clientReq.headers },
  };
  // 去掉 hop-by-hop headers
  delete options.headers["connection"];
  delete options.headers["keep-alive"];

  const proxy = http.request(options, (backendRes) => {
    clientRes.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(clientRes);
  });
  proxy.on("error", () => {
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    }
    clientRes.end("后端服务不可用");
  });
  clientReq.pipe(proxy);
}

function serveLoading(clientRes) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 配置切换器</title>
<style>
  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
  .box { text-align: center; }
  .spinner { width: 36px; height: 36px; border: 3px solid #eee; border-top-color: #333; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { color: #666; font-size: 14px; }
</style>
</head>
<body>
<div class="box">
  <div class="spinner"></div>
  <p>服务启动中...</p>
</div>
<script>
(function poll(attempts) {
  if (attempts > 30) {
    document.querySelector('p').textContent = '启动超时，请稍后重试';
    return;
  }
  var x = new XMLHttpRequest();
  x.open('GET', 'http://localhost:${PORT}/');
  x.timeout = 1500;
  x.onload = function() { if (x.status === 200 || x.status === 304) location.reload(); else setTimeout(function() { poll(attempts + 1); }, 500); };
  x.onerror = x.ontimeout = function() { setTimeout(function() { poll(attempts + 1); }, 500); };
  x.send();
})(0);
</script>
</body>
</html>`;
  clientRes.writeHead(503, { "Content-Type": "text/html; charset=utf-8" });
  clientRes.end(html);
}

const launcher = http.createServer((req, res) => {
  resetIdle();
  checkBackend().then((alive) => {
    if (alive) {
      proxyRequest(req, res);
    } else {
      startBackend();
      serveLoading(res);
    }
  });
});

launcher.listen(PORT, () => {
  console.log(`[launcher] 监听 http://localhost:${PORT}`);
});

launcher.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log("[launcher] 端口已被占用，可能已有实例在运行");
    process.exit(0);
  }
  throw e;
});
