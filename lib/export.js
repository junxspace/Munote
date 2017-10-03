'use strict';

const {BrowserWindow}  = require('electron');//窗口
const fs            = require('fs');
const path          = require('path');
const util          = require('util');
const image         = require('./image');
// const htmlDocx      = require('html-docx-js');

// HD
function exportPDF(title,content,callback){
	var pdfFilePath = path.join(__pdfPath,title + '.pdf');

	var win = new BrowserWindow({
	  width: 800,
	  height: 600,
	  show: false
	});

	exportHTML(title,content,function(filepath){
		win.loadURL('file://' + filepath);

		win.webContents.on('did-finish-load'
			, function() {
			    logger.info('finish loading');
			    win.webContents.printToPDF({
		        printBackground: true,
		        landscape: false,
		        pageSize: 'A4'
			    }
			    ,(err, data)=>{
			      logger.info(data);
			      fs.writeFile(pdfFilePath, data, (err)=> {
			        if(err){ 
			        	logger.error('genearte pdf error :' + err);
			        	return;
			        }
			        callback && callback(pdfFilePath);
			      });
		    });
	  	});
	 });
}

function exportMD(title,content,callback){
	var mdFilePath = path.join(__mdPath,title + '.md');
	fs.writeFileSync(mdFilePath,content,'utf8');
	callback && callback(mdFilePath);
}

function exportHTML(title,content,callback){
	var html = buildHTML(title,content);
	var htmlFilePath = path.join(__htmlPath,title + '.html');
	fs.writeFileSync(htmlFilePath,html,'utf8');
	callback.call(this,htmlFilePath);
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


function exportWord(title,content,callback){
	var docFilePath = path.join(__docPath,title + '.docx');
	var html  = buildHTML(title,content);

	var converted = htmlDocx.asBlob(html, {orientation: 'landscape'});

	fs.writeFile(docFilePath, converted, function(err) {
    if (err) logger.error('error : ' + err);
    callback && callback(docFilePath);
  });
}

module.exports.exportPDF  = exportPDF;
module.exports.exportMD   = exportMD;
module.exports.exportHTML = exportHTML;
module.exports.exportWord = exportWord;