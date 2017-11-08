'use strict';

const {BrowserWindow} = require('electron');//窗口
const fs = require('fs');
const path = require('path');
const util = require('util');
const image = require('./image');
const shell = require('shelljs');
const zipdir = require('zip-dir');
// const htmlDocx      = require('html-docx-js');

function exportPDF(options, callback){
	let title = options.title;
	let content = options.content;
	let fileName = options.fileName;

	var win = new BrowserWindow({
	  width: 800,
	  height: 600,
	  show: false
	});

	exportHTML(options, function(filepath){
		logger.info('exportPDF: ');
		logger.info('html file: ' + filepath);
		logger.info('pdf file: ' + fileName);

		// TODO
		// let cmd = '/usr/local/bin/wkhtmltopdf --lowquality "' + filepath + '" "' + fileName + '"';
		let cmd = __wkhtmltopdf_path + ' --lowquality "' + filepath + '" "' + fileName + '"';
		let opts = {silent:true};
		
		shell.exec(cmd, opts, (code, stdout, stderr) => {
		  logger.info('Exit code:', code);
		  logger.info('Program output:' + stdout);
		  logger.info('Program stderr:' + stderr);

		  if(code != 0){
		  	throw new Error('Fail to Export PDF.');
		  	return;
		  }

		  callback && callback(fileName);
		});
		
		// win.loadURL('file://' + filepath);
		// win.webContents.on('did-finish-load'
		// 	, function() {
		// 	    logger.info('finish loading');
		// 	    win.webContents.printToPDF({
		//         printBackground: true,
		//         landscape: false,
		//         pageSize: 'A4'
		// 	    }
		// 	    ,(err, data)=>{
		// 	      logger.info(data);
		// 	      fs.writeFile(fileName, data, (err)=> {
		// 	        if(err){ 
		// 	        	logger.error('genearte pdf error :' + err);
		// 	        	return;
		// 	        }
		// 	        callback && callback(fileName);
		// 	      });
		//     });
	 //  	});
	 });
}

function exportMD(options, callback){
	// var mdFilePath = path.join(__mdPath,title + '.md');
	let title = options.title;
	let content = options.content;
	let fileName = options.fileName;
	let notePath = options.notePath;

	logger.info('exportMD() title: ' + title);
	logger.info('exportMD() fileName: ' + fileName);
	logger.info('exportMD() notePath: ' + notePath);
	// fs.writeFileSync(mdFilePath,content,'utf8');

	zipdir(notePath, { saveTo: fileName}, function(e) {
	    if(e) {
	       logger.error(e);
	    } 

	    callback && callback(fileName);
	});
}

function exportHTML(options, callback){
	let title = options.title;
	let content = options.content;
	let fileName = options.fileName;

	if(!fileName.endsWith('html')){
		fileName = path.join(__htmlPath, title + '.html');
	}

	logger.debug('title:' + title);
	logger.debug('fileName:' + fileName);

	let html = buildHTML(title, content);

	fs.writeFileSync(fileName, html, 'utf8');
	callback.call(this, fileName);
}

function buildHTML(title,content){
	var gmCss      =  fs.readFileSync(path.join(__apphome,'css/github-markdown.css'), 'utf8')
	var hlCss      =  fs.readFileSync(path.join(__apphome,'node_modules/highlight.js/styles/default.css'), 'utf8')
	// var emojifyCss =  fs.readFileSync(path.join(__apphome,'node_modules/emojify.js/dist/css/basic/emojify.css'), 'utf8')
	var html = '<!DOCTYPE html>'+
		'<html lang="en">'+
		'<head>'+
		'<meta charset="UTF-8">'+
		'<meta name="viewport" content="width=device-width, initial-scale=1" />'+
		'<title>' + title + '</title>' +
		'<style>'+ gmCss + '</style>' + 
		'<style>'+ hlCss + '</style>' + 
		// '<style>'+ emojifyCss + '</style>' + 
		'<style>' +
		'  .markdown-body {'+
		'      box-sizing: border-box;'+
		'      min-width: 200px;'+
		'      max-width: 980px;'+
		'      margin: 0 auto;'+
		'      padding: 45px;'+
		'  }'+
		'</style>'+
		'</head>'+
		'<body>'+
		'<article class="markdown-body">'+ content+ '</article>'+
		'</body>'+
		'</html>';
	return html;
}


// function exportWord(title,content,callback){
// 	var docFilePath = path.join(__docPath,title + '.docx');
// 	var html  = buildHTML(title,content);

// 	var converted = htmlDocx.asBlob(html, {orientation: 'landscape'});

// 	fs.writeFile(docFilePath, converted, function(err) {
//     if (err) logger.error('error : ' + err);
//     callback && callback(docFilePath);
//   });
// }

module.exports.exportPDF  = exportPDF;
module.exports.exportMD   = exportMD;
module.exports.exportHTML = exportHTML;
// module.exports.exportWord = exportWord;