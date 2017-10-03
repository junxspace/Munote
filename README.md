# 1. 简介
Munote是一个编写markdown笔记的软件，支持OS X、Windows和Linux。  
支持以下特性：

1. GFM语法  
2. 导出PDF  
3. 导出HTML  
4. 日间/夜间主题模式
5. 中文/英文语言
    
# 2. 使用方法
1. 下载对应平台的软件包  
2. 解压缩
3. 运行方式
OS X    : 双击Electron  
Linux   : ./Electron  
Windows : 双击Electron.exe  

# 3. 快捷键
1. cmd/ctrl + N : 新建笔记  
2. cmd/ctrl + shift + M : 显示/隐藏主窗口切换  
3. cmd/ctrl + shift + ← : 隐藏侧边栏  
4. cmd/ctrl + shift + → : 显示侧边栏  
5. cmd/ctrl + E : 编辑/阅读模式切换  
6. cmd/ctrl + S : 保存  

# 4. 其他说明
## 4.1 数据文件
munote笔记数据默认在${user_home}/.munote目录，Munote的配置文件在${user_home}/.munote/munote.json,通过修改`__dataPath`来改变数据文件的存放目录。

## 4.2 语言文件
`munote_cn.properties`表示中文语言配置，`munote_gb.properties`表示英文语言配置，所在目录为：  

+ OS X : `{app_home}/Electron.app/Contents/Resources/app/lang`  
+ Window和Linux ：`{app_home}/resources/app/lang`