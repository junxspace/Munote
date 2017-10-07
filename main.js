'use strict';

const fs               = require('fs');
const path             = require('path');
const electron         = require('electron');
const {shell}          = require('electron');
const {ipcMain}        = require('electron');//主进程通信初始化主窗口
const {app}            = require('electron');//控制应用的生命周期
const {BrowserWindow}  = require('electron');//窗口
const {Menu}           = require('electron');//菜单
const {MenuItem}       = require('electron');//菜单列表
const {Tray}           = require('electron');//托盘
const {globalShortcut} = require('electron');
const {dialog}         = require('electron'); 
const log4js           = require('log4js');
const AppInfo          = require('./package.json');
const exp              = require('./lib/export');
const img              = require('./lib/image');
const appName          = AppInfo.name; // app名称
const appVersion       = AppInfo.version; // app名称

var mainWindow //主窗口
	, loadingWindow // loading窗口
  , appTray    ; //app托盘

// Make this app a single instance app.
//
// The main window will be restored and focused instead of a second window
// opened when a person attempts to launch a second instance.
//
// Returns true if the current version of the app should quit instead of
// launching.
function makeSingleInstance () {
  if (process.mas) return false

  return app.makeSingleInstance(function () {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus();
    }
  })
}

function initGlobalShortcut(){
	globalShortcut.register('CommandOrControl+Shift+M', () => {
		toggleMainWindow();
  });
}

function initApplicationMenu(){
 // Create the Application's main menu
  let template = [{
      label: "Application",
      submenu: [
          { label: "About Application", selector: "orderFrontStandardAboutPanel:" },
          { type: "separator" },
          { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
      ]}, {
      label: "Edit",
      submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
          { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
          { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]}
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));	
}

function initTray(){
	// let contextMenu = new Menu();
 //    contextMenu.append(new MenuItem(
 //    { label: '退出', click: exit }
 //    ));

  let contextMenu = Menu.buildFromTemplate([
    { label: 'markdown语法', click: ()=>{shell.openExternal('https://help.github.com/articles/basic-writing-and-formatting-syntax/');} }
    , { label: 'markdown示例', click: ()=>{shell.openExternal('https://github.github.com/github-flavored-markdown/sample_content.html');} }
    , { label: '关于', click: () => {
        // console.log(dialog.showOpenDialog({properties: ['openFile', 'openDirectory', 'multiSelections']}));
         dialog.showMessageBox({ 
              message: appName + ' version: ' + appVersion
              , buttons: ["OK"] });

      } }
    , { label: '退出', click: exit }
    ]);

  // mac icon
	appTray = new Tray(__dirname + '/img/icon/16@2x.png');
	appTray.setToolTip('欢迎使用' + appName + '! :-)');

	// appTray.on('click', toggleMainWindow);
	appTray.on('right-click', toggleMainWindow);
	appTray.setContextMenu(contextMenu);
}


function toggleMainWindow(){
  if(BrowserWindow.getFocusedWindow() == null){
  	mainWindow.show();

  }else{
  	mainWindow.hide();
  	
  }
}

function exit(){
	logger.info('[exit]');
	if(mainWindow){
		mainWindow.close();	
	}
	mainWindow = null;
	app.quit();
}

function toggleMainWindow(){
  if(BrowserWindow.getFocusedWindow() == null){
  	mainWindow.show();
  }else{
  	mainWindow.hide();
  }
}

function createLoadingWindow() {
	let browserWindowOptions = {
		minWidth             : 1000,
		minHeight            : 600,
		width                : 1000,
		height               : 600,
		center               : true,
		resizable            : true,//Boolean - Whether window is resizable.
		//alwaysOnTop          :true,// Boolean - Whether the window should always stay on top of other windows.
		fullscreen           : false,//Boolean - Whether the window should show in fullscreen. When set to false the fullscreen button will be hidden or disabled on OS X.
		title                : appName,
		show                 : false,// Boolean - Whether window should be shown when created.
		disableAutoHideCursor: true,// Boolean - Whether to hide cursor when typing.
		autoHideMenuBar      : true,//Boolean - Auto hide the menu bar unless the Alt key is pressed.
		// icon                 : __dirname+'/img/icon/16.png',
		// frame : true,
		titleBarStyle        : 'hidden'
	};

  loadingWindow = new BrowserWindow(Object.assign(browserWindowOptions, {parent: mainWindow}));
  loadingWindow.loadURL('file://' + __dirname + '/loading.html');
	loadingWindow.on('closed', () => loadingWindow = null);
  loadingWindow.webContents.on('did-finish-load', () => {
      loadingWindow.show();
  });
}

/**
 * 初始化主窗口
 */
function initMainWindow(){
	let browserWindowOptions = {
		minWidth             : 1000,
		minHeight            : 600,
		width                : 1000,
		height               : 600,
		center               : true,
		resizable            : true,//Boolean - Whether window is resizable.
		//alwaysOnTop          :true,// Boolean - Whether the window should always stay on top of other windows.
		fullscreen           : false,//Boolean - Whether the window should show in fullscreen. When set to false the fullscreen button will be hidden or disabled on OS X.
		title                : appName,
		show                 : false,// Boolean - Whether window should be shown when created.
		disableAutoHideCursor: true,// Boolean - Whether to hide cursor when typing.
		autoHideMenuBar      : true,//Boolean - Auto hide the menu bar unless the Alt key is pressed.
		// icon                 : __dirname+'/img/icon/16.png',
		// frame : true,
		titleBarStyle        : 'hidden'
	};

	mainWindow = new BrowserWindow(browserWindowOptions);
	mainWindow.loadURL('file://'+__dirname+'/main.html');
	// mainWindow.maximize();// 最大化

	// mainWindow.webContents.openDevTools(); //DEV TOOLS
	mainWindow.webContents.__appname = appName;
	mainWindow.on('closed',()=>{
		mainWindow = null;
	});

  mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.show();

      if (loadingWindow) {
          let loadingScreenBounds = loadingWindow.getBounds();
          mainWindow.setBounds(loadingScreenBounds);
          loadingWindow.close();
      }
  });

	// mainWindow.show();
}

/**
 * 目录不存在创建目录（同步）
 * @param {String} 目录的绝对路径
 * @return 创建目录后的路径
 */
function mkdir(_path){
	if(!fs.existsSync(_path)){
	  fs.mkdirSync(_path);
	}
	return _path;
}

/**
 * 初始化logger
 *
 * Useage:
 * *********************
 *		 logger.trace('');
 *		 logger.debug('');
 *		 logger.info('');
 *		 logger.warn('');
 *		 logger.error('');
 *		 logger.fatal('');
 *
 */
function initLogger(){
	let logPath,logger;
	logPath = mkdir(path.join(__basePath,'logs'));
	log4js.configure(path.join(__dirname,'log4js.json'),{cwd:logPath});
	logger = log4js.getLogger('logger');
	logger.setLevel('debug');
	global.logger = logger;
}

/**
 * 初始化配置信息
 */
function initConfig(){
	let _basePath = "";	// 根路径：默认在用户主目录+".munote"下
	let _dataPath = ""; // 数据文件路径
	let _tempPath = ""; // 临时目录
	let _docPath  = ""; // doc文件存放路径
	let _htmlPath = ""; // html文件存放路径
	let _pdfPath  = ""; // pdf文件存放路径
	let _mdPath   = ""; // md文件存放路径

	_basePath = mkdir(path.join(app.getPath('home'),'.munote'));
	_dataPath = mkdir(path.join(_basePath,'data'));

	_tempPath = mkdir(path.join(_basePath,'temp'));
	_docPath  = mkdir(path.join(_tempPath,'doc'));
	_htmlPath = mkdir(path.join(_tempPath,'html'));
	_pdfPath  = mkdir(path.join(_tempPath,'pdf'));
	_mdPath   = mkdir(path.join(_tempPath,'md'));

	global.__apphome  = __dirname;//项目根目录
	global.__basePath = _basePath;
	global.__dataPath = _dataPath;
	global.__tempPath = _tempPath;
	global.__docPath  = _docPath;
	global.__htmlPath = _htmlPath;
	global.__pdfPath  = _pdfPath;
	global.__mdPath   = _mdPath;
}

/**
 * 初始化应用相关事件监听器
 */
function initEventListener(){
	// 所有窗口关闭事件
	app.on('window-all-closed',()=>{
		// if(process.platform!='darwin'){
			app.quit();
		// }
	});

	// app就绪
	app.on('ready',()=>{

		initTray();
		initGlobalShortcut();		
		createLoadingWindow();
		initMainWindow(); // 初始化主窗口
		initApplicationMenu();
	});
}

/**
 * 获取配置信息
 */
function initGetConfigReqChannel(){
	ipcMain.on('get-config-req',(event,args) => {

		let configFile = getConfigFile();

	 	// 判断文件是否存在
		if(!fs.existsSync(configFile)){
			logger.info('config file not exists !');
			fs.writeFileSync(configFile,"{}");
		}

		var Config = require(configFile);
		logger.info(">>> " + JSON.stringify(Config));
		
		Config.__baseurl  = AppInfo.baseurl;
		Config.__version  = appVersion;
		Config.__appname  = appName;
		Config.__dataPath = __dataPath;
		event.sender.send('get-config-resp', Config);
	});
}

function getConfigFile(){
  return path.join(__basePath, 'munote.json');
}

/**
 * 保存配置信息
 */
function initSaveConfigReqChannel(){
	ipcMain.on('save-config-req',(event,config)=>{

		let configFile = getConfigFile();

	 	// 判断文件是否存在
		if(!fs.existsSync(configFile)){
			logger.info('config file not exists !');
			fs.writeFileSync(configFile,"{}");
		}

		fs.writeFileSync(configFile,JSON.stringify(config));
		logger.info(">>> " + JSON.stringify(config));
		logger.info('保存配置成功');
	});	
}

/**
 * 导出pdf
 */
function initExportPdfChannel(){
	ipcMain.on('export-pdf-req',function(event,args){
		logger.info('[export-pdf-req]');
		logger.info("[title]:"+args.title);
		logger.info("[content]:"+args.content);

		exp.exportPDF(args.title,args.content,(file)=>{
			event.sender.send('export-pdf-resp', file);
		});
	});

}

function initSaveImageReqChannel(){
	ipcMain.on('save-image-req',(event,args)=>{
		logger.debug('[save-image-req] ' + args.notePath);
		// logger.debug('[save-image-req] ' + args.data);
		img.save(args.notePath, args.data, (filename)=> {
				logger.info('fiename:'+filename);
				event.sender.send('save-image-resp', filename);		
			});
	});
}

function initExportMarkdownChannel(){
	ipcMain.on('export-markdown-req',(event,args)=>{
		logger.info('[export-markdown-req]');
		logger.info("[title]:"+args.title);
		logger.info("[content]:"+args.content);
		
		exp.exportMD(args.title,args.content,(file)=>{
			event.sender.send('export-markdown-resp', file);
		});
	});
}

function initExportHtmlReqChannel(){
	ipcMain.on('export-html-req',(event,args)=>{
		logger.info('[export-html-req]');
		logger.info("[title]:"+args.title);
		logger.info("[content]:"+args.content);
		
		exp.exportHTML(args.title,args.content,function(file){
			event.sender.send('export-html-resp', file);
		});
	});
}

function initExportWorkReqChannel(){
	ipcMain.on('export-word-req',(event,title,content)=>{
		logger.info('[export-word-req]');
		logger.info("[title]:"+title);
		logger.info("[content]:"+content);
		
		exp.exportWord(title,content,(file)=>{
			event.sender.send('export-word-resp', file);
		});
	});
}

/**
 *  初始化与客户端通信事件
 */
function initChannel(){ 
	initGetConfigReqChannel();
	initSaveConfigReqChannel();
	initExportPdfChannel();
	initSaveImageReqChannel();
	initExportMarkdownChannel();
	initExportHtmlReqChannel();
	initExportWorkReqChannel();
}

/**
 * 初始化应用
 */
function start(){
	let shouldQuit = makeSingleInstance();
  if (shouldQuit) return app.quit();

	initEventListener(); // 初始化应用事件监听器
	initConfig();   // 初始化配置
	initLogger();	   
	initChannel();  // 初始化与客户端渠道事件

	logger.debug('basePath =' + __basePath);
	logger.debug('dataPath =' + __dataPath);
	logger.debug('tempPath =' + __tempPath);
	logger.debug('docPath  =' + __docPath);
	logger.debug('htmlPath =' + __htmlPath);
	logger.debug('pdfPath  =' + __pdfPath);
	logger.debug('mdPath   =' + __mdPath);	
	logger.debug("Finish start app.");
}

start();