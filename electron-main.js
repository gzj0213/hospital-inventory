const { app, BrowserWindow } = require('electron');
const path = require('path');

// Windows特有：禁用硬件加速，解决黑屏/白屏问题
app.disableHardwareAcceleration();

// Windows特有：修复GPU进程崩溃问题
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // Windows特有：禁用同源策略（不影响安全性）
      allowRunningInsecureContent: false
    },
    // 隐藏默认菜单栏
    autoHideMenuBar: true,
    // Windows特有：窗口图标
    icon: path.join(__dirname, 'build', 'icon.ico')
  });

  // 加载Vite构建后的文件（Windows路径兼容）
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // 开发时打开开发者工具（生产环境注释掉）
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});