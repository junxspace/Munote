'use strict';

const fs   = require('fs');
const path = require('path');

/*
 * 将文件输出base64编码字符串
 * @param file : 文件路径
 */
function encode(file) {
    let bitmap = fs.readFileSync(file);
    return new Buffer(bitmap).toString('base64');
}

/*
 * 将base64编码字符串保存为文件
 * @param base64Str : base64编码字符串
 * @param file      : 文件路径
 */
function decode(base64str, file) {
    let bitmap = new Buffer(base64str, 'base64');
    fs.writeFileSync(file, bitmap);
    logger.info('已保存图片文件：'+file);
}

/* 
 * 保存图片
 */
function save(notePath,base64Str,callback){
	let filename = generateImageName() + '.jpg';//自动生成文件名
	let imgPath  = path.join(__dataPath, notePath,filename);//图片文件真实路径
	mkdir(path.join(__dataPath,notePath));
	decode(base64Str,imgPath);		
	callback && callback(filename);
}

/*
 * 生成图片名称
 */
function generateImageName(){
	return 'img' + new Date().getTime();
}

/*
 * 创建文件目录
 */
function mkdir(dir){
	if(!fs.existsSync(dir)){
	  fs.mkdirSync(dir);
	}
}

module.exports.save=save;