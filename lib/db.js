/* ********************************************************
 * *****        数据表说明        ***************************
 * ********************************************************
 * 
 * t_tag 标签表，记录笔记标签类型
 * ------------------------------
 * 	_id         : 主键id
 * 	tag_name    : 标签名称
 * 	tag_color   : 标签颜色
 * 	update_time : 更新时间,时间戳
 * 	create_time : 创建时间,时间戳
 * 
 *
 * t_notebook 笔记本表
 * ------------------------------
 * 	_id          : 主键id
 * 	name         : 笔记本名称 
 * 	update_time  : 更新时间,时间戳
 * 	create_time  : 创建时间,时间戳
 *  is_default   : 是否默认，只能有一个默认笔记
 *
 * t_default_notebook 笔记本表
 * ------------------------------
 * 	_id          : 主键id
 * 	notebook_id  : 笔记本名称 
 * 	update_time  : 更新时间,时间戳
 * 	create_time  : 创建时间,时间戳
 *
 * t_note 笔记表
 * ------------------------------
 * 	_id          : 主键id
 * 	note_name    : 笔记名称
 * 	note_content : 笔记内容
 * 	note_path    : 笔记路径
 * 	update_time  : 更新时间,时间戳
 * 	create_time  : 创建时间,时间戳
 * 	notebook_id  : 笔记本id
 * 	starred      : 是星标，0-否，1-是
 * ********************************************************
 * ********************************************************
 */

var t_notebook = 't_notebook'; // 笔记本表
var t_note     = 't_note';     // 笔记表
var t_tag      = 't_tag';      // 标签表

/**
 * based on nedb.
 * @see https://github.com/louischatriot/nedb
 */
var Datastore = require('nedb');
var path      = require('path');
var db        = null;

/**
 * 初始化数据库
 */
function init(){
	db = new Datastore({ filename: path.join(__dataPath,'munote.db')});
	db.loadDatabase(function (err) {
		if(err){
		  logger.error('load notebooks_db : '+ err);
	  }
	});
}

/**
 * 插入数据
 * @param record     : 数据记录json字符串
 * @param callback   : optional 回调函数function(err,newRecord){}
 * 
 */
function insert(record,callback){
	db.insert(record,callback);
}

/*
 * 更新数据
 * @param query_str  : 查询字符串
 * @param callback   : 回调函数function(err,numReplaced){}, numReplaced  is the number of recoreds replaced
 * 
 */
function update(query_str,replace_str,callback){
	db.update(query_str, replace_str, {upsert:true}, callback);
}

/*
 * 查询数据
 * @param query_str  : 查询字符串
 * @param callback   : 回调函数function(err,records){}, recods is a array
 * 
 */
function query(query_str,callback){
	return db.find(query_str,callback);
}

/*
 * 删除数据
 * @param table_name : 表名
 * @param query_str  : 查询字符串
 * @param callback   : 回调函数function (err, numRemoved){}, numRemoved  is the number of recoreds removed
 * 
 */
function remove(query_str,callback){
	db.remove(query_str,{ multi: true },callback);
}

/*
 * 统计数据
 * @param query_str  : 查询字符串
 * @param callback   : 回调函数function (err, count){}, count is the number of recoreds
 * 
 */
function count(query_str,callback){
	db.count(query_str, callback);
}

init();

module.exports.insert = insert;
module.exports.update = update;
module.exports.query  = query;
module.exports.remove = remove;
module.exports.count  = count;