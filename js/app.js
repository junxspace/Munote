'use strict';

const {ipcRenderer}  = require('electron');
const {clipboard} = require('electron');
const {shell} = require('electron');
const fs = require('fs');
const path = require('path');
const log4js = require('log4js');
const mkdirs = require('node-mkdirs');
const hljs = require('highlight.js');//代码高亮
const rmdir = require('rmdir');
var t_notebook            = "t_notebook";  
var t_note                = "t_note"; 
var	t_default_notebook    = "t_default_notebook";	
var DEFAULT_NOTEBOOK_NAME = "我的笔记本";
var DEFAULT_SEARCH_TITLE  = "Search Results";
var sortMode              = -1; // 搜索模式 1-asc , -1-desc
var searching             = false; // 表明是否在搜索中，防止搜索结果未出现时，重复搜索
var sortCondition         = 'update_time'; // 默认按照更新时间排序
var noteChanged           = false; // 笔记内容有变化时为true
var firstRenderNote       = true;  // 是否首次渲染笔记
var defaultLang           = 'gb';// united states
var
  Config                // 配置信息对象
  ,md
  ,db                   // 数据库对象
  ,editor               // CodeMirror 对象
  ,config               // 配置对象
  ,state                // 当前状态，1：timeline模式，2：empty-note模式，3：note编辑模式，4：阅读模式
  ,currentNoteId        // 当前操作（鼠标右键）的笔记id
  ,activeNoteId         // 当前激活（打开）的笔记id
  ,currentNoteItem      // 当前操作的（鼠标右键）的笔记item对象
  ,activeNoteItem       // 当前激活（打开）的笔记item对象   
  ,currentNotebookId    // 当前操作（鼠标右键）的笔记本id     
  ,activeNotebookId     // 当前激活（打开）的笔记本id    
  ,currentNotebookItem  // 当前操作的（鼠标右键）的笔记本item对象    
  ,activeNotebookItem   // 当前激活（打开）的笔记本item对象     
  ,defaultNotebookId;   // 默认的笔记本id，有且仅有一个

/**
 * 显示loading...
 */
function loading(_opacity){
  $('.loading-wrapper').css('opacity', _opacity ? _opacity : 0.9).show();
}

/**
 * 隐藏loading
 */
function unloading(){
  $('.loading-wrapper').css('opacity',0).hide();
}

/**
 * 根据点击事件的坐标显示浮动面板
 * @param {Object} target : jquery对象/dom对象
 * @param {Object} e       : 事件对象
 * @param {Object} pos       : 显示位置
 */
function showFloatPanel(target,e,callback,pos){
  logger.info('pos :  ' + pos);
  logger.info('target :  ' + target);
  let $target = $(target);
  let coords  = getCoords($target,e,pos);
  logger.info('>> coords : top=' + coords.top + ',left = ' + coords.left);
  $target.css('top',coords.top)
        .css('left',coords.left)
        .velocity('finish')
        .velocity('transition.bounceIn',300,callback);
}

/**
 * 隐藏浮动面板
 * @param {Object} target : jquery对象/dom对象
 * @param {boolean} quickly  : 快速隐藏
 * @param {function} callback : 回调函数
 */
function hideFloatPanel(target,quickly,callback){

  if(quickly){
    $(target).hide();
    return;
  }

  $(target).velocity('finish').velocity('transition.bounceOut',300,callback);
}

/**
 * 判断回车键按下时，执行回调函数
 * @param {Object} e          : event
 * @param {function} callback : 回调函数 
 */
function enterPress(e,callback){
  let code = (e.keyCode ? e.keyCode : e.which);
  if (code == 13){
    //回车键
    callback.call(this);
    return;
  }
}

/**
 * 隐藏新建笔记本面板
 */
function hideNewNotebookPanel(){
  hideFloatPanel($('#new_notebook_panel'));
}

/**
 * 显示新建笔记本面板
 * @param {Object} e : event
 */
function showNewNotebookPanel(e){
  e.stopPropagation();

  // 清空笔记本名称输入框
  $('#notebook_name').val('');

  // 显示新建笔记本面板
  showFloatPanel($('#new_notebook_panel'),e,()=>{
    // 使笔记本名称输入框并获得焦点
    $('#notebook_name').focus();
  });
}

/**
 * 新建笔记本<li/>按下回车或点击确定时，保存笔记本到数据库
 */
function createNotebook(){
  let _name        = $('#notebook_name').val();
  let _create_time = new Date().getTime();
  let _update_time = _create_time;

  if(!_name){
    logger.warn('笔记本名称为空');
    $('#notebook_name').velocity('finish').velocity('callout.shake',1000);
    return;
  }

  db.insert({
      t_name      :t_notebook
      ,name       :_name
      ,update_time:_update_time
      ,create_time:_create_time
      ,is_default :0
    }
    ,(err,r)=>{
      if(err){
        logger.error('新建笔记本出现异常，' + err);
        return;
      }

      logger.info('create notebook success！！！');

      // 新建笔记成功之后将笔记本添加到笔记本列表并隐藏面板
      let notebook = createNotebookItem(r);
      $('#notebook_list').prepend(notebook);

      // notebook.velocity("scroll", {  
      //         duration: 250
      //         ,delay: 25
      //         ,container:$('#note_catalog_wrapper')});

      $(notebook).velocity('transition.slideLeftIn',300);
      hideNewNotebookPanel();
    });
}

/**
 * 处理笔记列表鼠标点击事件（左键和右键）
 * @param {String} e : event对象
 */
function handleNoteMouseUp(e){
  let $target = $(e.target).closest('li.note');
  let _id     = $target.attr('id');

  if(!_id){
    logger.debug('not note item!');
    return;
  }

  logger.info('>> current note id  = ' + _id);


  // 鼠标左键
  if(e.button == 0){
    logger.debug('>> mouse left click！');
    activeNote(_id);
    return;
  }

  // 鼠标右键
  if(e.button == 2){
    logger.debug('>> mouse right click！');

    currentNoteId = _id;
    currentNoteItem = $('#'+currentNoteId);

    showNoteMenu(e);
    return;
  }

  logger.warn(' not supported mouse click!' + e.button);
}

/**
 * 激活指定id的笔记：
 * 1. 保存激活笔记id
 * 2. 保存激活笔记item对象
 * 3. 设置激活样式
 * @param {String} _id : 要激活的笔记id
 * @param {String} editing : 是否默认编辑
 * 
 */
function activeNote(_id,editing){
  activeNoteId = _id;
  activeNoteItem = $('#'+activeNoteId);
  activeNoteItem.parent().children().removeClass('active');
  activeNoteItem.addClass('active');

  noteChanged     = false;  // 每次激活新笔记本时，要先将笔记改变置为false
  firstRenderNote = true;   // 首次渲染笔记

  showNote(_id,editing);
}

/**
 * 显示笔记
 * @param {String} _id: 要显示的笔记id
 * @param {String} editing : 是否默认编辑
 */
function showNote(_id,editing){
  logger.info('显示笔记，noteId=' + _id);

  db.query({'_id':_id,"t_name":t_note},(err,records)=>{
    if(err){
      logger.error('查询笔记失败，error:' + err);
      return;
    }

    // 根据id只能查到一条
    let note          = records[0];
    let _note_name    = note.note_name;
    let notePath   = note.note_path;
    let _update_time  = note.update_time;
    let starred       = note.starred;
    let _noteBookId = activeNoteItem.attr('notebook-id');
    let absoluteNotePath = path.join(Config.__dataPath, _noteBookId, activeNoteId);
    logger.info('>>> 笔记路径：' + absoluteNotePath);
    // 读取文件内容
    note.note_content = fs.readFileSync(path.join(absoluteNotePath, 'content.md'),"utf-8");

    let $note_name = $('#note_name');
    $note_name.val(_note_name);
    $note_name.velocity('finish').velocity('transition.slideDownIn',300);

    $('#editor_content_container')    
    .velocity('finish')
    .velocity('transition.slideUpIn'
        ,{
          duration:350
          ,begin :()=>{
            // editor.setValue(_note_content);

            if(editing){
              showNoteContainer(note);
            }else{
              showPreviewContainer(note);
            }            
          }
          ,complete:()=>{
            logger.info('finish');
            // $(window).resize();
          }
        });

    // 设置星标状态
    let $starred = $('#starred_btn > i');
    if(starred == '1'){
      $starred.removeClass('fa-star-o').addClass('fa-star');
    }else{
      $starred.removeClass('fa-star').addClass('fa-star-o');
    }

  });
}

function setNoteName(_note_name){
  let $note_name = $('#note_name');
  $note_name.val(_note_name);
  $note_name.velocity('finish').velocity('transition.slideDownIn',300);
}

function setNoteContent(_note_content){
  // $('#editor_content_container').velocity('finish').velocity('transition.slideUpIn',300,function(){
  //   // $(window).resize().updateScrollbars();
  //   // $('.scrollbar-macosx').scrollbar();
  //   logger.info('finish');
  //   $('#editor_content_container').css('height','auto');
  // });

  $('#editor_content_container')    
    .velocity('finish')
    .velocity('transition.slideUpIn'
        ,{
          duration:350
          ,begin :()=>{
            editor.setValue(_note_content);
          }
          ,complete:()=>{
            logger.info('finish');
            // $(window).resize();
          }
        });

}

function toggleStarred(){
  if(!activeNoteId || !$('#starred_btn').hasClass('active')){
    return;
  }

  noteChanged = true;

  let _starred        = activeNoteItem.attr('starred');
  let $starred_btn    = $('#starred_btn').find('i.starred');
  let $starred_item   = activeNoteItem.find('i.starred');

  if(_starred == "0"){
    $starred_btn.removeClass('fa-star-o').addClass('fa-star');
    $starred_item.removeClass('fa-star-o').addClass('fa-star');
    activeNoteItem.attr('starred',"1");
  }else{
    $starred_btn.removeClass('fa-star').addClass('fa-star-o');
    $starred_item.removeClass('fa-star').addClass('fa-star-o');
    activeNoteItem.attr('starred',"0");
  }
}

/**
 * 新建笔记
 * 有两个入口：
 * 1. 笔记本右键菜单
 * 2. 笔记列表的新建笔记按钮
 * @param {int} _type : 类型， 1-菜单进入；2-按钮进入
 */
function toCreateNote(_type){
  let _notebook_id = "";

  if(_type == 1) {
    logger.info('按钮进入');
    // 取激活的笔记本id
    _notebook_id = activeNotebookId;
  }else if(_type == 2){ 
    logger.info('菜单进入');
    hideFloatPanel($('#notebook_menu'));
    // 取当前笔记本id
    _notebook_id = currentNotebookId;
  }else{
    logger.info('快捷键进入');
    // 取激活的笔记本id
    _notebook_id = activeNotebookId;
  }

  // 没有id则取默认笔记本
  if(!_notebook_id){
    logger.info('获取默认笔记本id');
    _notebook_id = getDefaultNotebookId();
    activeNotebook(_notebook_id);
  }

  createNote(_notebook_id);
}

function createNote(_notebook_id){
  let _create_time = new Date().getTime();
  let _update_time = _create_time;
  db.insert({
      't_name'       :t_note
      ,'note_name'   :'Untitled-' + new Date().Format("yyyy.MM.dd hh:mm:ss")  
      ,'note_content':''
      ,'create_time' :_create_time
      ,'update_time' :_update_time
      ,'notebook_id' :_notebook_id
      ,'starred'     :'0'
    },function(err,newRecord){
      if(err){
        logger.error('新建笔记出现异常，error:' + err);
        return;
      }
      console.log(newRecord);

      let notPath = path.join(_notebook_id, newRecord._id);
      let absoluteNotePath = path.join(Config.__dataPath, notPath);
      
      mkdirs(absoluteNotePath);

      fs.writeFile(path.join(absoluteNotePath, 'content.md'), '', (e)=> {
        if (e){
          throw e ;
        }

        db.update(
            {'_id':newRecord._id, 't_name' : t_note}
            ,{ $set: {
              'note_path': notPath,
              'update_time' : _update_time,
              }
            }
            ,(err,numReplaced)=>{
              if(err){
                logger.error('保存笔记失败，错误原因:' + err);
                return;
              }

              if(numReplaced){
                logger.info("File Saved !"); //文件保存成功

                let noteItem = createNoteItem(newRecord);
                $('#note_list').prepend(noteItem);

                $('#'+newRecord._id).velocity("scroll", {  
                        duration: 250
                        ,delay: 25
                        ,container: $('#note_list_content_wrapper')});                

                $(noteItem).velocity('finish').velocity('transition.slideLeftBigIn',300);

                
                // 新增笔记的时候，笔记列表数量要+1
                let count = parseInt($('#note_list_count').text());
                $('#note_list_count').text(count+1);

                activeNote(newRecord._id,true);    
              }
          }); 
       });
    }
  ); 
}


/**
 * 创建默认笔记本
 */ 
function createDefaultNotebook(callback){
  logger.info('新建默认笔记本');
  let _create_time = new Date().getTime();
  let _update_time = _create_time;  

  db.insert({
      t_name      :t_notebook
      ,name       :DEFAULT_NOTEBOOK_NAME
      ,update_time:_update_time
      ,create_time:_create_time
    }
    ,(err,r)=>{
      if(err){
        logger.error('新建默认笔记本出现异常，' + err);
        return;
      }

      logger.info('create notebook success！！！');

      // 新建笔记成功之后将笔记本添加到笔记本列表并隐藏面板
      // let $notebook = $('<li notebook="1" class="default" id="'+r._id+'"><div class="header">'+r.name+'</div></li>');
      // let notebook = createNotebookItem(r);
      // $('#notebook_list').append(notebook);
      // $(notebook).velocity('transition.slideLeftIn',300);

      db.remove({t_name:t_default_notebook},(err, numRemoved)=>{
        if(err){
          logger.error('清空默认笔记本失败，'+err);
          return;
        }
        let _create_time = new Date().getTime();
        let _update_time = _create_time;

        db.insert({
          t_name      : t_default_notebook
          ,notebook_id: r._id          
          ,create_time:_create_time
          ,update_time:_update_time
        },(err,newRecord)=>{
          if(err){
            logger.error('保存默认笔记本失败，'+err);
            return;
          }
          logger.info('保存默认笔记本成功');
          defaultNotebookId = r._id;
          callback();
        });
      });
    });
}

/**  
 *  标记默认笔记本
 */ 
function toMarkDefaultNotebook(e){
  logger.info('标记默认笔记本id：'+currentNotebookId);

  db.update(
    {"t_name":t_default_notebook}
    ,{
      $set:{
        notebook_id : currentNotebookId
        ,update_time:new Date().getTime()
      }
    }
    ,(err,newRecord) =>{
      let $defaultNotebookItem = $('#'+currentNotebookId);
      $defaultNotebookItem.parent().children().removeClass('default');
      $defaultNotebookItem.addClass('default');
      hideNotebookMenu();
      defaultNotebookId = currentNotebookId;
  });
}

/**
 * 获取默认笔记本
 */
function getDefaultNotebookId(){
  let $defaultNotebookItem = getDefaultNotebookItem();
  return $defaultNotebookItem.attr('id');
}

function getDefaultNotebookItem(){
  return $('#notebook_list').find('li.default');
}

/**
 * 处理笔记本列表鼠标点击事件（左键和右键）
 * @param {String} e : event对象
 */
function handleNotebookMouseDown(e){
  let $target = $(e.target).closest('li.notebook');
  let _id     = $target.attr('id');

  if(!_id){
    logger.debug('not notebook item!');
    return;
  }

  logger.info('>> current notebook id  = ' + _id);

  // 设置当前右键的笔记本id

  // 鼠标左键
  if(e.button == 0){
    logger.debug('>> mouse left click！');
    activeNotebook(_id);
    return;
  }

  // 鼠标右键
  if(e.button == 2){
    logger.debug('>> mouse right click！');

    // 保存当前操作笔记本信息
    currentNotebookId   = _id;
    currentNotebookItem = $('#'+currentNotebookId);

    showNotebookMenu(e);
    return;
  }

  logger.warn(' not supported mouse click!' + e.button);
}

/**
 * 
 * 激活指定笔记本item
 * 
 */
function activeNotebook(_id){
  $('.note-catalog > ul.list').children().removeClass('active');

  // 保存当前激活笔记本信息
  activeNotebookId   = _id;
  activeNotebookItem = $('#' + activeNotebookId);

  // 给当前激活笔记本item添加样式
  activeNotebookItem.parent().children().removeClass('active');
  activeNotebookItem.addClass('active');

  showNoteListByNotebookId(activeNotebookId);
}

/**
 * 处理排序按钮鼠标点击事件（左键和右键）
 * @param {String} e : event对象
 */
function handleSortModeMouseUp(e){
  let $target = $(e.target); 
  
  // 鼠标左键
  if(e.button == 0){
    logger.debug('>> mouse left click！');
    toggleSortMode(e);
    return;
  }

  // 鼠标右键
  if(e.button == 2){
    logger.debug('>> mouse right click！');
    showSortModeMenu(e);
    return;
  }

  logger.warn(' not supported mouse click!' + e.button);
}

function showSortModeMenu(e){
  showFloatPanel($('#sort_mode_menu'),e,function(){},'right-bottom');
}

function hideSortModeMenu(){
  hideFloatPanel($('#sort_mode_menu'));
}

/**
 * 根据笔记本id展示笔记列表
 */
function showNoteListByNotebookId(_id){
  db.query({t_name:t_note,notebook_id : _id}).sort(getSortCondition()).exec((err,records)=>{
    if(err){
      logger.error('查询笔记本id:'+currentNotebookId + '下面的笔记出错，error:' + error);
      return;
    }
    initNoteList(records,getActiveNotebookName());
  });
}

function getSortCondition(){
  let _sortCondition = {};

  if(sortCondition === 'starred'){ //按照笔记星标排序
    _sortCondition = {starred:sortMode};  
  }else if(sortCondition === 'create_time'){ //按照笔记创建时间排序
    _sortCondition = {create_time:sortMode} ;  
  }else if(sortCondition === 'note_name'){ //按照笔记名称排序
    _sortCondition = {note_name:sortMode} ;  
  }else{ //按照笔记更新时间排序
    _sortCondition =  {update_time:sortMode};  
  }  
  return _sortCondition;
}

/**
 * 根据星标展示笔记列表
 */
function showNoteListByStarred(target){
  clearSearch();

  $('#notebook_list li').removeClass('active');
  
  let $li = $(target).closest('li');
  $li.parent().children().removeClass('active');
  $li.addClass('active');

  db.query({t_name:t_note,starred : "1"}).sort(getSortCondition()).exec((err,records)=>{
    if(err){
      logger.error('查询星标笔记出错，error:' + error);
      return;
    }

    initNoteList(records,$('.l-starred').text());
  });
}

/**
 * 显示所有笔记
 */
function showAllNoteList(target){
  clearSearch();

  $('#notebook_list li').removeClass('active');

  let $li = $(target).closest('li');
  $li.parent().children().removeClass('active');
  $li.addClass('active');

  db.query({'t_name':t_note}).sort(getSortCondition()).exec((err,records)=>{
    if(err){
      logger.error('查询笔记出错，error:' + error);
      return;
    }
    initNoteList(records,$('.l-all-notes').text());
  });
}

/**
 * 清空笔记列表名称及笔记列表大小显示
 */
function clearNoteListName(){
  $('#note_list_name').text('');
  $('#note_list_count').text('');
}

/**
 * 清空笔记列表
 */
function clearNoteList(){
  $('#note_list').empty();
}

/**
 * 搜索笔记
 */
function searchNote(){
  let keyword = $('#search_content').val();

  if(!keyword){
    logger.info(' no search keyword:' + keyword);
    return;
  }

  if(isSearching()){
    logger.info(' searching.');
    return;
  }

  startSearching();

  //
  clearActiveCatalog();

  logger.info('搜索内容:' + keyword);

  db.query({
      't_name'       :t_note
      ,'note_content':
        { $regex: new RegExp('\\b'+ keyword +'\\b', 'ig') }})
    .sort(getSortCondition())
    .exec((err,records)=>{
      if(err){
        logger.error('搜索笔记出现异常，' + err);
        return;
      }

      initNoteList(records,DEFAULT_SEARCH_TITLE);
      stopSearching();

      $('#clear_search').show();
    });
}

function clearActiveCatalog(){
  $('.note-catalog li.active').removeClass('active');
  currentNotebookId   = null;
  currentNotebookItem = null;
  activeNotebookId    = null;
  activeNotebookItem  = null;
  currentNoteId       = null;
  currentNoteItem     = null;
  activeNoteId        = null;
  activeNoteItem      = null;
}


function clearSearch(){
  $('#search_content').val('');
  $('#clear_search').hide();
}


function isSearching(){
  return searching;
}

function startSearching(){
  searching = true;
  $('#searching').show();
}

function stopSearching(){
  searching = false;
  $('#searching').hide();
}

/**
 * 按照笔记名称排序
 */
function sortByName(e){
  hideFloatPanel($('#sort_mode_menu'));

  let $target = $(e.target).closest('li');
  $target.parent().find('i').hide();
  $target.find('i').show();

  sortCondition = {note_name :sortMode };
  reloadNoteList();
}

/**
 * 搜索笔记排序方式
 */
function sortBy(_type){
  hideFloatPanel($('#sort_mode_menu'));

  let $target = $('#sort_by_'+_type);
  $target.parent().find('i').hide();
  $target.find('i').show();

  sortCondition = _type;
  // if(_type === 'starred'){ //按照笔记星标排序
  //   sortCondition = 'starred';  
  // }else if(_type === 'create_time'){ //按照笔记创建时间排序
  //   sortCondition = 'create_time';  
  // }else if(_type === 'note_name'){ //按照笔记名称排序
  //   sortCondition = 'note_name';  
  // }else{ //按照笔记更新时间排序
  //   sortCondition = 'update_time';  
  // }

  // reloadNoteList();
}


/**
 * 重新加载笔记列表
 */
function reloadNoteList(){
  searchNote();
}

/**
 * 切换搜索模式
 * 
 */
function toggleSortMode(e){
  let $target = $(e.target);

  // fa-sort-amount-desc : -1 desc
  // fa-sort-amount-asc  : 1  asc
  if($('#sort_mode').hasClass('fa-sort-amount-asc')){
    sortMode = -1;
    $('#sort_mode').removeClass('fa-sort-amount-asc').addClass('fa-sort-amount-desc');
  }else{
    sortMode = 1;
    $('#sort_mode').removeClass('fa-sort-amount-desc').addClass('fa-sort-amount-asc');
  }
  logger.info('current sort mode : ' + sortMode);
}

/**
 * 显示笔记时间线，以下情况会显示：
 *
 * 1. 首次进入系统；
 * 2. 删除已打开的笔记本；
 * 3. 删除已打开的笔记。
 *
 */
function showTimelineContainer(){
  $('#timeline_note_container')    
    .velocity('finish')
    .velocity('transition.slideDownBigIn'
        ,{
          duration:350
          ,begin :()=>{
            $('#starred_btn').find('i.starred').removeClass('fa-star').addClass('fa-star-o');            
            $('#preview_container').hide();
            $('#note_container').hide();
            $('#empty_note_container').hide();
          }
          ,complete:()=>{
            $('#timeline_note_container > .content').velocity('finish').velocity('callout.bounce');
            state = 1;

            $('#toggle_preview_btn').removeClass('active');
            $('#starred_btn').removeClass('active');
            $('#save_btn').removeClass('active');
            $('#export_btn').removeClass('active');
            $('#preview_btn').removeClass('active');            
          }
        });
}

/**
 * 显示空笔记面板，以下情况会显示：
 * 1. 打开笔记本没有笔记；
 */
function showEmptyNoteContainer(){
  state = 2;

  $('#toggle_preview_btn').removeClass('active');
  $('#starred_btn').removeClass('active');
  $('#save_btn').removeClass('active');
  $('#export_btn').removeClass('active');
  $('#preview_btn').removeClass('active');

  $('#preview_container').hide();
  $('#note_container').hide();
  $('#timeline_note_container').hide();
  $('#empty_note_container').show();
  $('#empty_note_container > .content').velocity('finish').velocity('callout.bounce');
}

/**
 * 显示笔记面板，以下情况会显示：
 * ctrl+e或cmd+e切换编辑模式时
 */ 
function showNoteContainer(_note){
  $('#note_container')
    .velocity('finish')
    .velocity('transition.slideDownBigIn'
        ,{
          duration:350
          ,begin :()=>{
            let _note_content = _note.note_content;
            editor.setValue(_note_content);            
            
            $('#preview_container').hide();
            $('#empty_note_container').hide();
            $('#timeline_note_container').hide();
          }
          ,complete:()=>{
            state = 3; // 编辑模式
            $('#toggle_preview_btn > i').removeClass('fa-pencil').addClass('fa-eye');
            $('#toggle_preview_btn').addClass('active');
            $('#starred_btn').addClass('active');
            $('#save_btn').addClass('active');
            $('#export_btn').addClass('active');
            $('#preview_btn').removeClass('active');

            refreshEditor();
            focusEditor();
        }
      });
}

function refreshEditor(){
  editor.refresh();
}

function focusEditor(){
  editor.focus();
}

/**
 * 预览模式
 * 点击笔记列表中的笔记时默认预览
 */
function showPreviewContainer(_note){
  let $target  = $('#preview_container');
  $target
    .velocity('finish')
    .velocity('transition.slideUpBigIn',
      {
        duration:350
        ,begin :()=>{
          let _note_content = _note.note_content;
          editor.setValue(_note_content);

          $('#empty_note_container').hide();
          $('#timeline_note_container').hide();
          $('#note_container').hide();

          // 如果首次渲染笔记或者笔记内容已改变，则需要重新渲染markdown
          logger.info('firstRenderNote : ' + firstRenderNote);
          logger.info('noteChanged : ' + noteChanged);
          if(firstRenderNote || noteChanged){
            renderMarkdown();
          }
        }
        ,complete:()=>{
          state = 4; // 预览模式

          $('#toggle_preview_btn > i').removeClass('fa-eye').addClass('fa-pencil');

          $('#toggle_preview_btn').addClass('active');
          $('#starred_btn').removeClass('active');
          $('#save_btn').removeClass('active');
          $('#export_btn').addClass('active');
          $('#preview_btn').addClass('active');
        }
      });
}

/**
 * 笔记名称input变化时
 */
function noteNameChange(){
  logger.info('noteNameChange()');
  noteChanged = true;
}


/**
 * 初始化笔记列表
 */
function initNoteList(records,name){
  clearNoteList();

  let _size = records ? records.length : 0;

  // 设置笔记列表的名称和数量
  $('#note_list_name').text(name);
  $('#note_list_count').text(records.length);

  if(_size == 0 ){
    // 笔记为空显示空笔记面板
    logger.info('empty note!!!');
    showEmptyNoteContainer();
    return;
  }
  
  $(records).each((i,r)=>{
    let noteItem = createNoteItem(r);
    $('#note_list').append(noteItem);
  });

  $('#note_list').velocity('finish').children().velocity('transition.slideLeftBigIn', { stagger: 20}).delay(20);

  let _id = $('#note_list').children().first().attr('id');
  activeNote(_id);
}

function createNoteItem(r){
  let _id             = r._id;
  let _note_name      = r.note_name;
  let _update_time    = r.update_time;
  let _create_time    = r.create_time;
  let _starred        = r.starred;
  let _notebook_name  = $('#'+ r.notebook_id).attr('notebook-name');
  let noteHTML        = '<li class="item note" notebook-id="' + r.notebook_id + '" create-time ="'+jQuery.format.prettyDate(_create_time)+'" note-name="'+_note_name+'" notebook-name="'+_notebook_name+'" id="'+_id+'" starred="'+ r.starred+'" update-time="'+ jQuery.format.prettyDate(_update_time) +'">'
                         +'  <div class="header">'
                         +'    <i class="starred fa '+ (_starred == "1" ? "fa-star" : "fa-star-o") +'"></i><span class="note-name">' + _note_name + '</span>'
                         +'  </div>'
                         +'  <div class="content"><span>'+ jQuery.format.prettyDate(_update_time) +'</span></div>'
                         +'</li>';
  return noteHTML;
}

/**
 * @return 当前操作笔记本名称
 */
function getCurrentNotebookName(){
  return currentNotebookItem.find('.header').text();
}

/**
 * @return 获得当前激活笔记本的名称
 */
function getActiveNotebookName(){
  return activeNotebookItem.find('.header').text();
}

/**
 * 显示笔记本菜单
 * @param {String} e : event对象
 */
function showNotebookMenu(e){
  showFloatPanel($('#notebook_menu'),e,()=>{});
}

/**
 * 隐藏笔记本右键菜单
 */
function hideNotebookMenu(){
  hideFloatPanel($('#notebook_menu'));
}

/**
 * 显示笔记菜单
 * @param {String} e : event对象
 */
function showNoteMenu(e){
  showFloatPanel($('#note_menu'),e,()=>{});
}

/**
 * 隐藏笔记右键菜单
 */
function hideNoteMenu(){
  hideFloatPanel($('#note_menu'));
}


/**
 * 重命名笔记本
 * @param {Object} e : event对象
 */
function toRenameNotebook(e){
  hideFloatPanel($('#notebook_menu'),true);
  showRenameNotebookPanel(e);
}

/**
 * 显示重命名笔记本面板
 * @param {Object} e : event对象
 */
function showRenameNotebookPanel(e){
  showFloatPanel($('#rename_notebook_panel'),e,()=>{
      let beforeName = getCurrentNotebookName();
      $('#new_notebook_name').val(beforeName);
      $('#new_notebook_name').focus();
      $('#new_notebook_name').select();
    });
}

/**
 * 隐藏重命名笔记本面板
 */
function hideRenameNotebookPanel(){
  hideFloatPanel($('#rename_notebook_panel'));
}

/**
 * 新建笔记本
 */
function toCreateNotebook(e){
  hideFloatPanel($('#notebook_menu'),true);
  showNewNotebookPanel(e)
}

/**
 * 删除笔记本
 */
function toDelNotebook(e){
  hideFloatPanel($('#notebook_menu'));

  if(currentNotebookItem.hasClass('default')){
    $.alert('不能删除默认笔记本',e);
    return;
  }

  $.confirm(e,{
      title   : '确定要删除?'
      ,content: getCurrentNotebookName()
      ,okClick: deleteNotebook
    }
  );  
}

function deleteNotebookOfDb(){
  db.remove({_id :currentNotebookId , t_name : t_notebook},(err,count) => {
    if(err){
      logger.error('删除笔记本失败，error: ' + err);
      return;
    }

    logger.debug('删除笔记本成功，count : ' + count);

    db.remove({'t_name' :t_note , 'notebook_id' : currentNotebookId}, (err,count) => {
      if(err){
        logger.error('删除笔记本下的笔记出现异常'+ err);
        return;
      }

      // 删除笔记本成功之后移除笔记本列表对应的元素
      currentNotebookItem.velocity('transition.slideLeftBigOut',300,()=>{
        currentNotebookItem.remove();

        // 当前操作的笔记本id和已打卡的笔记本id相同时
        // 表明删除的笔记本已经打开，则显示笔记时间线面板
        if(currentNotebookId == activeNotebookId){
          // 清空笔记列表
          clearNoteList();
          clearNoteListName();

          // 显示时间线
          showTimelineContainer();
        }

        // 删除笔记本之后清空相关变量
        currentNotebookId   = null;
        currentNotebookItem = null;
        activeNotebookId    = null;
        activeNotebookItem  = null;
      });
    });
  });
}

function deleteNotebook(){
  logger.info('删除笔记本, id：'+currentNotebookId);
  let _notebookPath = path.join(__dataPath, currentNotebookId);
  logger.debug('本地笔记本路径： ' + _notebookPath);

  // 笔记本路径不存在，只需要删除数据库记录即可。
  if(!fs.existsSync(_notebookPath)){
    deleteNotebookOfDb();
    return;

  }

  rmdir(_notebookPath, (err, dirs, files) => {
    if(err){
      logger.error('删除本地笔记本路径失败，错误原因：' + err);
      return;
    }

    logger.debug('删除本地笔记本路径成功');
    deleteNotebookOfDb();
  });
}

/**
 * 删除笔记本
 */
function toDelNote(e){
  hideFloatPanel($('#note_menu'));
  $.confirm(e,{
      title   : '确定要删除?'
      ,content: getCurrentNoteName()
      ,okClick: deleteNote
    }
  );  
}

function deleteNoteOfDb(){
 db.remove({_id :currentNoteId , t_name : t_note},(err,count)=>{
    if(err){
      logger.error('删除笔记失败，error: ' + err);
      return;
    }

    logger.debug('删除笔记成功，count : ' + count);

    // 删除笔记本成功之后移除笔记本列表对应的元素
    currentNoteItem.velocity('transition.slideLeftBigOut',300,()=>{
      currentNoteItem.remove();

      // 当前操作的笔记id和已打卡的笔记id相同时
      // 表明删除的笔记已经打开，则显示笔记时间线面板
      if(currentNoteId = activeNoteId){
        showTimelineContainer();
      }

      // 删除笔记的时候，笔记列表数量要-1
      let count = parseInt($('#note_list_count').text());
      logger.info('count:' + count);
      $('#note_list_count').text(count - 1);

      currentNoteId   = null;
      currentNoteItem = null
      activeNoteId    = null;
      activeNoteItem  = null;
    });
  });
}

function deleteNote(){
  logger.info('删除笔记, id：' + currentNoteId);
  let _notePath = path.join(__dataPath, activeNotebookId, currentNoteId);
  logger.debug('本地笔记路径： ' + _notePath);

  // 笔记路径不存在，只需要删除数据库记录即可。
  if(!fs.existsSync(_notePath)){
    deleteNoteOfDb();
    return;

  }

  rmdir(_notePath, (err, dirs, files) => {
    if(err){
      logger.error('删除本地笔记路径失败，错误原因：' + err);
      return;
    }

    logger.debug('删除本地笔记成功');
    deleteNoteOfDb();
  }); 
}

function getCurrentNoteName(){
  return currentNoteItem.find('.note-name').text();
}

/**
 * 重命名笔记本
 */
function renameNotebook(){
  let _name = $('#new_notebook_name').val();

  if(!_name){
    logger.warn('笔记本名称为空');
    $('#new_notebook_name').velocity('finish').velocity('callout.shake',1000);
    return;
  }

  logger.info(' notebook name:' + _name);

  let _update_time = new Date().getTime();

  db.update({
      t_name : t_notebook
      ,_id   : currentNotebookId
    }
    ,{
      $set:{
        name        : _name
        ,update_time:_update_time
      }
    }
    ,(err,numReplaced)=>{
      if(err){
        logger.error('新建笔记本出现异常，' + err);
        return;
      }

      logger.info('rename notebook success！！！');
      // 重命名笔记成功之后修改笔记本列表的名称并隐藏面板
      currentNotebookItem.find('.header > span').text(_name);
      hideRenameNotebookPanel();

      // 如果修改的笔记本已经打开，则修改笔记列表名称
      if(currentNotebookId == activeNotebookId){
        $('#note_list_name').text(_name);
      }
  });
}

/**
 * 给编辑区选中的文字两边添加符号，并添加符号后的选中字符串
 */
function wordWrap(symbol){
  let selText = editor.getSelection();
  let symLen  = symbol.length; 
  let content = "";
  if(!selText){
    return;
  }

  if(selText.startWith(symbol) && selText.endWith(symbol)){
    content = selText.substring(symLen,selText.length-symLen);
  }else {
    content = symbol+selText+symbol;
  }

  editor.replaceSelection(content,'around');
}

function initEditorCore(){
	logger.info('initEditorCore()');
  editor = CodeMirror.fromTextArea(document.getElementById('editor-content'), {
		mode           : 'gfm',
		// lineNumbers    : true, //行数
		lineWrapping   : true, //自动折行
		styleActiveLine: true, //显示当前行
    scrollbarStyle : "null", //滚动条主题
		theme          : 'eclipse',//light主题
		extraKeys      : {
      "Enter": "newlineAndIndentContinueMarkdownList",
      "Alt-F": "findPersistent"
    }
    // ,highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: true}
  });
}

/**
 * 剪切
 */
function applyCut(){
	  let selText = editor.getSelection();
	  clipboard.writeText(selText);
	  editor.replaceSelection('');
}

/**
 * 复制
 */
function applyCopy(){
	  let selText = editor.getSelection();
	  clipboard.writeText(selText);
}

/**
 * 粘贴
 */
function applyPaste(cm){
  let image     = clipboard.readImage();
  let dataURL   = image.toDataURL();
  let base64Str = dataURL.split(',')[1];

  logger.debug('clipboard image : ' + image);
  // logger.debug('clipboard image  dataURL: ' +  dataURL);
  let _notePath = path.join(activeNotebookId, activeNoteId, __baseurl);
  console.log('save image: ' + _notePath);
  if(base64Str){
  	//保存剪贴板图片请求
  	emit('save-image',{notePath: _notePath, data:base64Str},(event,filename)=>{
      logger.info('[save-image-resp] ' + filename);
      let content        = '![]('+ __baseurl+ '/' + filename + ')';
      let currLineNumber = editor.getCursor().line;
      let currLinech     = editor.getCursor().ch;
      logger.info('content:' + content);
      editor.replaceRange(content,{line:currLineNumber,ch:currLinech},{line:currLineNumber,ch:currLinech})   
    });

  	return;
  }

  let text      = clipboard.readText();    //获取剪贴板的内容
  let curr_line = editor.getCursor().line; //鼠标当前行
  let curr_ch   = editor.getCursor().ch;  

  logger.debug('clipboard text : ' + text);
  if(editor.somethingSelected()){
    editor.replaceSelections(new Array(text),'around');
    return;
  }
  editor.replaceRange(text,{line:curr_line,ch:curr_ch},{line:curr_line,ch:curr_ch});
}

/**
 * 粗体
 */
function applyBold(){
	logger.info('applyBold()');
	wordWrap('**');
}

function applyItalic(){
	logger.info('applyItalic()');
	wordWrap('*');
}

/**
 * 保存笔记
 */
function saveNote(){
  logger.debug('saveNote(), activeNoteId='+activeNoteId+',noteChanged='+noteChanged+',state='+state);
  if(!activeNoteId || !noteChanged || state != 3 || !$('#save_btn').hasClass('active')){
    logger.warn('不满足保存笔记条件!');
    return;
  }

  // if(!activeNoteId){
  //   logger.warn('没有激活的笔记本,不进行保存。');
  //   return;
  // }
  let _note_name    = $("#note_name").val();
  let _note_content = editor.getValue();
  let _starred      = starred();
  let _update_time  = new Date().getTime();

  let notPath = path.join(activeNotebookId, activeNoteId);
  let absoluteNotePath = path.join(Config.__dataPath, notPath);
      
  mkdirs(absoluteNotePath);
  logger.info('>>> [保存]笔记路径：' + absoluteNotePath);

  fs.writeFile(path.join(absoluteNotePath, 'content.md'), _note_content, (e)=> {
      if (e){
        throw e ;
      }
      db.update(
          {'_id':activeNoteId,'t_name' : t_note}
          ,{ $set: {
            'note_name'   : _note_name,
            'note_path': notPath,
            'starred'     : _starred,
            'update_time' : _update_time,
            }
          }
          ,(err,numReplaced)=>{
            if(err){
              logger.error('保存笔记失败，错误原因:' + err);
              return;
            }

            if(numReplaced){
              activeNoteItem.attr('note-name',_note_name);
              activeNoteItem.attr('update-time',jQuery.format.prettyDate(_update_time));
              activeNoteItem.attr('starred',_starred);
              activeNoteItem.find('.note-name').text(_note_name);
              activeNoteItem.find('.content > span').text(jQuery.format.prettyDate(_update_time));
            }
        }); 

      logger.info("File Saved !"); //文件保存成功
     });
}

function starred(){
  return $('#starred_btn').find('i').hasClass('fa-star') ? "1" : "0";
}

function toggleSettings(e){
  let $target = $('#settings_panel');
  if($target.is(':visible')){
    hideFloatPanel($target);
  }else{
    showFloatPanel($target,e);
  }
}


/**
 * 下划线
 */
function applyUnderline(){
  logger.info('applyUnderline()');
  wordWrap('_');
}


/**
 * 删除线
 */
function applyStrikethrough(){
  logger.info('applyStrikethrough()');
  wordWrap('~~');
}


/**
 * 下脚标
 */
function applyeSubscript(){
  logger.info('applyeSubscript()');
  wordWrap('~');
}

/**
 * 上脚标
 */
function applySuperscript(){
  logger.info('applyeSubscript()');
  wordWrap('^');
}

/*
 * 引用
 *
 * 两种情况的处理
 * 1. 未选中字符串 ： 如有当前行有字符串，则在字符串前面增加引用符号+空格，如果存在引用符号，则去掉。
 * 2. 选中字符串   ： 如果选中字符串不存在引用符号，则在字符串前面增加引用符号+空格，如果存在引用符号，则去掉。
 */
function applyQuote(){
  let currLineNumber = editor.getCursor().line;//鼠标当前行
  let currLineText   = editor.getLine(currLineNumber);//鼠标当前行的字符串
  let symbol         = '>';
  let replaceText    = '';
  let isSel = editor.somethingSelected();
  if(isSel){//选中字符串
    let sels  = editor.getSelections();//选中的字符串
    let selTexts = sels.pop().split('\n');//按照换行分割
    let len = selTexts.length;
    $(selTexts).each(function(index,item){
      if(item.startWith(symbol)){
        replaceText += item.substring((symbol + ' ').length,item.length);
      }else{
        replaceText += symbol + ' ' + item;
      }
    
      if(index < (len-1)){
        replaceText += '\n';
      }
    });
    editor.replaceSelections(new Array(replaceText),'around');
    //editor.setSelection({line:currLineNumber-len,ch:0},{line:currLineNumber,ch:null});
  }else{//未选中字符串
    replaceText = symbol + ' ';
    if(currLineText){
      if(currLineText.startWith(symbol)){
        replaceText = currLineText.substring(replaceText.length,currLineText.length);
      }else{
        replaceText += currLineText;
      }
    }else{
      editor.setCursor({line:currLineNumber,ch:replaceText.length});
    }
   editor.replaceRange(replaceText,{line:currLineNumber,ch:0},{line:currLineNumber,ch:null});
  }
}

/*
 * 标题，共6级
 */
function applyHeader(){
  let currLineNumber = editor.getCursor().line;
  let currLineText   = editor.getLine(currLineNumber);
  let replaceText = "";

  if(!currLineText){
    editor.replaceRange("# ",{line:currLineNumber,ch:0},{line:currLineNumber,ch:null})  
    editor.setCursor({line:currLineNumber,ch:0});
  }

  // max h6
  if(currLineText && currLineText.indexOf('######')==0){
    return ;
  }

  if(currLineText && currLineText.indexOf('#')==0){
    replaceText = '#' + currLineText;
  }else{
    replaceText = '# ' + currLineText;
  }

  // editor.replaceSelection(replaceText,'around');
  editor.replaceRange(replaceText,{line:currLineNumber,ch:0},{line:currLineNumber,ch:null})  
}

/*
 * 无序列表
 * 
 * 两种情况的处理
 * 1. 未选中字符串 ： 如有当前行有字符串，则在字符串前面增加列表符号+空格，如果存在列表符号，则去掉。
 * 2. 选中字符串   ： 如果选中字符串不存在列表符号，则在字符串前面增加列表符号+空格，如果存在列表符号，则去掉。
 * 列表符号: * - +
 */
function applyList(){
  let currLineNumber = editor.getCursor().line;//鼠标当前行
  let currLineText   = editor.getLine(currLineNumber);//鼠标当前行的字符串
  let symbol         = '+';
  let replaceText    = '';
  let isSel = editor.somethingSelected();
  if(isSel){//选中字符串
    let sels  = editor.getSelections();//选中的字符串
    let selTexts = sels.pop().split('\n');//按照换行分割
    let len = selTexts.length;
    $(selTexts).each(function(index,item){
      if(item.startWith('* ')){
        symbol = '*';
      }else if(item.startWith('- ')){
        symbol = '-';
      }else if(item.startWith('+ ')){
        symbol = '+';
      }

      if(item.startWith(symbol)){
        replaceText += item.substring((symbol + ' ').length,item.length);
      }else{
        replaceText += symbol + ' ' + item;
      }
    
      if(index < (len-1)){
        replaceText += '\n';
      }
    });
    editor.replaceSelections(new Array(replaceText),'around');
  }
}

/*
 * 有序列表
 * 
 * 两种情况的处理
 * 1. 未选中字符串 ： 如有当前行有字符串，则在字符串前面增加数字+空格，如果存在数字符号，则去掉。
 * 2. 选中字符串   ： 如果选中字符串不存在数字符号，则在字符串前面增加数字符号+空格，如果存在数字符号，则去掉。
 * 列表符号: * - +
 */
function applyOrderedList(){
  let currLineNumber = editor.getCursor().line;//鼠标当前行
  let currLineText   = editor.getLine(currLineNumber);//鼠标当前行的字符串
  let symbol         = '+';
  let replaceText    = '';
  let isSel = editor.somethingSelected();
  
  if(isSel){//选中字符串
    let sels  = editor.getSelections();//选中的字符串
    let selTexts = sels.pop().split('\n');//按照换行分割
    let len = selTexts.length;
    $(selTexts).each(function(index,item){
      if(item.indexOf('. ')!=-1){
        // example :  '1. apple' => '1'
        let num = item.substring(0,item.indexOf('. '));
        if(!isNaN(num)){
          replaceText += item.substring((num + '. ').length,item.length);
        }
      }else{
        replaceText += (index+1) + '. ' + item;
      }
    
      if(index < (len-1)){
        replaceText += '\n';
      }
    });
    editor.replaceSelections(new Array(replaceText),'around');
  }
}

/**
 * 应用链接
 * 格式： [Munote](http://www.munote.com/)
 */
function applyLink(){
  let linkText   = $('#link_input_text').val();
  let selText    = editor.getSelection();
  let repContent = '[' + editor.getSelection() + '](' + linkText +')';

  if(!linkText){
    return;
  }

  editor.replaceSelection(repContent,'around');
  hideEditorToolbar();
}

/**
 * 添加图片
 */
function applyImage(){
  logger.info('applyImage()');

  //显示添加图片模式窗口
  $('<input type="file" accept="image/jpeg,image/png,image/jpg,image/gif,image/bmp" onchange="handleFiles(this.files)" style="display:none">').click();

}

/**
 * 处理上传图片文件
 */
function handleFiles(files){ 
  if(files.length){  
    var file = files[0];  
    var reader = new FileReader();   

    reader.onload = function() {  
      let dataURI   = this.result;
      let base64Str = dataURI.split(',')[1];
      logger.info('upload image.');
      let _notePath = path.join(activeNotebookId, activeNoteId, __baseurl);
      emit('save-image',{notePath: _notePath, data:base64Str},(event,filename)=>{
        logger.info('[save-image-resp] ' + filename);
        let selText    = editor.getSelection();
        let repContent = '![' + selText + ']('+ __baseurl+ '/' + filename + ')';
        logger.info('repContent:' + repContent);
        editor.replaceSelection(repContent,'around');
        hideEditorToolbar();      
      });
    }; 
    reader.readAsDataURL(file);
  }  
}

/**
 * 导出笔记文件：
 * @param {String} type : 类型，'markdown','pdf','html','doc'
 */
function exportFile(type){
  loading();
  hideNoteMenu();
  hideExportMenu();

  logger.info('exportFile() :' + type);
  let _title   = $('#note_name').val();
  let _noteContent = editor.getValue();

  if(type == 'markdown'){
    let _data  = {'title':_title,'content':_noteContent};
    emit('export-'+type,_data,downloadFile);
    return;
  }


  let _renderContent = md.render(_noteContent);
  let $html    =  $('<div>' + _renderContent + '</div>');
  handleImgLink($html);// 处理图片地址
  convertImage2DataURI($html,($h)=>{
    let _content = $h.html();
    let _data    = {'title':_title,'content':_content};
    emit('export-'+type,_data,downloadFile);
  });
}

/**
 * 将本地文件通过html5的download属性下载到指定位置
 * 主要是会弹出窗口让用户选择路径
 */
function downloadFile(e,file){
  unloading();
  let $downloadLink = $('<a href="" download=""></a>');
  $downloadLink.attr('href',file).attr('download',path.basename(file));
  $downloadLink[0].click();
}

/**
 *  初始化codemirror编辑器快捷键
 */
function initEditorKeyMap(){
	logger.info('initEditorKeyMap()');
  let map = {
    "Cmd-B" : applyBold
		,"Ctrl-B" : applyBold

    ,"Cmd-I": applyItalic
    ,"Ctrl-I": applyItalic

    ,"Cmd-U": applyUnderline
    ,"Ctrl-U": applyUnderline

		,"Ctrl-C": applyCopy
		,"Cmd-C" : applyCopy

		,'Cmd-V' : applyPaste
		,'Ctrl-V': applyPaste

    ,'Cmd-X' : applyCut
    ,'Ctrl-X': applyCut

    ,'Cmd-F': showSearchDialog
    ,'Ctrl-F': showSearchDialog

    ,'Esc': hideEditorToolbar

    // ,'Ctrl-S' : saveNote
		// ,'Cmd-S' : saveNote
  };

  editor.addKeyMap(map);
}

/**
 * 查找上一个
 */
function findPrevious(){
  let searchFor  = $('#search_for').val();
  let around     = $('#wrap_around_cb').prop('checked');
  let caseIgnore = !$('#match_case_cb').prop('checked');

  logger.info(' searchFor :' + searchFor);
  logger.info(' around :' + around);
  logger.info(' caseIgnore :' + caseIgnore);

  let selection = editor.getSelection();
  let isMatched = caseIgnore ? (selection.toLowerCase() === searchFor.toLowerCase()) : (selection === searchFor);
  
  logger.info(' isMatched : ' + isMatched);
  
  let pos = isMatched  ? editor.getCursor('from') : editor.getCursor("to");
  let cursor     = editor.getSearchCursor(searchFor,pos,caseIgnore);

  if(!cursor.findPrevious()){
    if(around){
      let lastLine = editor.lastLine();
      let lastCh   = editor.getLine(lastLine).length;
      lastCh =  lastCh == 0 ? 0 : (lastCh -1) ;
      cursor = editor.getSearchCursor(searchFor,{line:lastLine,ch:lastCh},caseIgnore);
      if(!cursor.findPrevious()){
        return;
      }
    }else {
      logger.debug(' no results!');
      return;
    }
  } 

  editor.setSelection(cursor.from(), cursor.to());
  editor.scrollIntoView({from: cursor.from(), to: cursor.to()}, 20);
}

function findNext(){
  let searchFor  = $('#search_for').val();
  let around     = $('#wrap_around_cb').prop('checked');
  let caseIgnore = !$('#match_case_cb').prop('checked');

  logger.info(' searchFor :' + searchFor);
  logger.info(' around :' + around);
  logger.info(' caseIgnore :' + caseIgnore);

  let selection = editor.getSelection();
  let isMatched = caseIgnore ? (selection.toLowerCase() === searchFor.toLowerCase()) : (selection === searchFor);
  
  logger.info(' isMatched : ' + isMatched);

  let pos = isMatched  ? editor.getCursor('to') : editor.getCursor("from");
  let cursor     = editor.getSearchCursor(searchFor,pos,caseIgnore);

  if(!cursor.findNext()){
    if(around){
      cursor = editor.getSearchCursor(searchFor,{line:0,ch:0},caseIgnore);
      if(!cursor.findNext()){
        return;
      }
    }else {
      logger.debug(' no results!');
      return;      
    }
  } 

  editor.setSelection(cursor.from(), cursor.to());
  editor.scrollIntoView({from: cursor.from(), to: cursor.to()}, 20);
}

function replaceOnce(){
  let searchFor    = $('#search_for').val();
  let around       = $('#wrap_around_cb').prop('checked');
  let caseIgnore   = !$('#match_case_cb').prop('checked');
  let replace_with = $('#replace_with').val();
  
  let selection    = editor.getSelection();
  let isMatched    = caseIgnore ? (selection.toLowerCase() === searchFor.toLowerCase()) : (selection === searchFor);
  
  if(isMatched){// 替换时查看是否已经选中匹配字符串
    editor.replaceSelection(replace_with);
  }else{
    findNext();// 未选中，则向下查找一次
    selection = editor.getSelection();
    isMatched = caseIgnore ? (selection.toLowerCase() === searchFor.toLowerCase()) : (selection === searchFor);
    if(!isMatched) return;

    editor.replaceSelection(replace_with);
  }
}

function replaceAll(){
  let searchFor    = $('#search_for').val();
  let around       = $('#wrap_around_cb').prop('checked');
  let caseIgnore   = !$('#match_case_cb').prop('checked');
  let replace_with = $('#replace_with').val();
  let count = 0;
  // var ranges = [];
  var cursor = editor.getSearchCursor(searchFor, {line:0,ch:0}, caseIgnore);
  while (cursor.findNext()) {
    // ranges.push({anchor: cursor.from(), head: cursor.to()});
    editor.setSelection(cursor.from(),  cursor.to());
    editor.replaceSelection(replace_with);
    count ++;
  }

  logger.info(' number replaced : ' + count);

  // if (ranges.length){
  //   editor.setSelections(ranges, 0);
  //   editor.replaceSelection();
  // }
}

function showSearchDialog(){
  showFloatPanel($('#search_dialog'),null,()=>{
    let _selText = editor.getSelection();
    $('#replace_with').val('');
    $('#search_for').val(_selText).focus().select();
  });
}

function hideSearchDialog(){
  hideFloatPanel($('#search_dialog'));
}

/**
 * 初始化编辑器
 */
 function initEditor(){
 	logger.info('initEditor() 初始化编辑器');
 	initEditorCore();
 	initEditorKeyMap();
  initEditorListener();
  initEditorMenubar();
  initEditorToolbar();
}

function initEditorListener(){
  // editor.on('mousedown',(cm)=>{
  //   logger.info('[mousedown] ');
  //   logger.info(cm.doc);
  // });
  editor.on('change',(cm)=>{
    noteChanged    = true;
  });

  // scroll
  editor.on('update',(cm)=>{
    $('#editor_content_container').css('height','auto'); 
  });

  // editor.on('beforeSelectionChange',(cm)=>{
  //   logger.info('beforeSelectionChange');
  // });
  
}

/**
 * 选择文字情况下显示编辑工具栏，否则隐藏工具栏
 */
function toggleEditorToolbar(e){

  if(e.button == 0){ // 鼠标左键
    hideEditorToolbar();
  }

  if(e.button == 2){ // 鼠标右键
    showEditorToolbar(e);
  }

  // codemirror bug!!!
  // let isSelected = editor.somethingSelected();
  // let selText = editor.getSelection();
  // logger.info('' + isSelected + ' == ' + selText );

  // if(editor.somethingSelected()){
  //   showEditorToolbar(e);
  // }else{
  //   hideEditorToolbar();
  // }
}

/**
 * 显示编辑工具栏，只在有选择文字的情况下出现
 * @param {Object} e : event对象
 */
function showEditorToolbar(e){
  logger.debug('showEditorToolbar()');
  let $target = $('#editor_toolbar');
  let coords  = getTopCenterCoords($target,e,'top-center');
  $target.show()
        .css('left',coords.left)
        .css('top',coords.top);

  $('#editor_toolbar_list').velocity('finish').velocity('transition.slideRightBigIn',350);
}

/**
 * 隐藏编辑器工具栏
 */
function hideEditorToolbar(){
  logger.debug('hideEditorToolbar()');
  let $target = $('#editor_toolbar');
  $target.hide();
  // showEditorToolbarList();
  $('#link_input').velocity('finish').hide();

  // $('#link_input').velocity('finish').velocity('transition.slideLeftBigOut',0,()=>{
  //   $('#editor_toolbar_list').velocity('finish').velocity('transition.slideRightBigIn',350);
  // });

}

function showEditorToolbarList(){
  $('#link_input').velocity('finish').velocity('transition.slideLeftBigOut',350,()=>{
    $('#editor_toolbar_list').velocity('finish').velocity('transition.slideRightBigIn',350);
  });
}

function showLinkInput(){
  $('#editor_toolbar_list').velocity('finish').velocity('transition.slideLeftBigOut',350,()=>{
    $('#link_input').velocity('finish').velocity('transition.slideRightBigIn',350,()=>{
      $('#link_input_text').focus();
    });
  });  
} 

/**
 * 打印对象
 */
function writeObj(obj){ 
  let description = ""; 
  for(let i in obj){ 
    let property=obj[i]; 
    description+=i+" = "+property+"\n"; 
  } 
  logger.info(description); 
} 

function initEditorMenubar(){
  $('#editor_menubar > div.active').on('click',(e)=>{
    let $target = $(e.target).closest('div');
    if($target.is('div')){
      $target.velocity('finish').velocity('transition.bounceIn',300);    
    }
  });
}

function initEditorToolbar(){
  $('#editor_toolbar > div.toolbar > div.item').on('click',(e)=>{
    let $target = $(e.target).closest('div');
    // alert($target.html());
    if($target.is('div')){
      $target.find('i').velocity('finish').velocity('transition.bounceIn',300);    
    }
  });
}

/**
 * 通过ipcRenderer与后台通信
 * 
 * @param {String} event      : 事件名称
 * @param {Object} data       : 传输的对象
 * @param {function} callback : 回调函数
 */ 
function emit(event,data,callback){
  callback && ipcRenderer.once(event+'-resp',callback);
	ipcRenderer.send(event+'-req',data);
}

/**
 * 初始化配置
 */
function initConfig(callback){
	console.log('初始化logger');

  log4js.configure({
    appenders: [{ 
        "type"  : 'console',
        "layout": {
          "type"   : "pattern",
          "pattern": ">> [%r] [%5.5p] - %m%n"
        }
      },
    ]
  }); 

 let logger = log4js.getLogger();
	logger.setLevel('debug');

	window.logger = logger;

 	emit('get-config','',(event,data) => {
  	console.log("get config : " + JSON.stringify(data));
    Config = data;

    window.__dataPath = Config.__dataPath ;
		window.__baseurl  = Config.__baseurl;
		window.__appname  = Config.__appname;
		window.__dataPath = Config.__dataPath;
		window.__imgPath  = Config.__imgPath;
  	db = require('./lib/db'); // 初始化数据

    $('.l-version').text(Config.__version);

    callback();
  });
}

function toggleSidebar(){
	if($('#sidebar_container').is(':hidden')){
    logger.info('show sidebar');
		showSidebar();
	}else{
    hideNavigation();
		hideSidebar();
    logger.info('hide sidebar');
	}
}

/**
 * 隐藏侧边栏
 */
function hideSidebar(){
  $('#toggle_sidebar_btn > i').removeClass('fa-expand').addClass('fa-compress');
  $('#sidebar_container')
    .velocity("finish")
    .velocity(
        {'margin-left':-380}
        ,{ 
          duration: 350
          ,begin :()=>{
            let _width ;
            if(state == 3){
              _width = $('#note_container').width();
            }else{
              _width = $('#preview_container').width();
            }

            $('#note_container').css('width',_width);
            $('#preview_container').css('width',_width);
          }
          ,complete:()=>{
            $('#sidebar_container').hide();
          }
        }
    );
}

/**
 * 显示侧边栏
 */
function showSidebar(){
	$('#toggle_sidebar_btn > i').removeClass('fa-compress').addClass('fa-expand');
  $('#sidebar_container')
    .velocity("finish")
    .velocity(
      {'margin-left':0}
      ,{ 
        duration: 350
        ,begin :()=>{
          $('#sidebar_container').show();
        }
        ,complete:()=>{
          $('#note_container').css('width','');
          $('#preview_container').css('width','');
        }
      }
    );
}

function toggleNotebookList(){
  clearSearch();

  if($('#notebook_list').is(':visible')){
    hideNotebookList();
  }else{
    showNotebookList();
  }
}

function showNotebookList(){
  if($('#notebook_list').is(':visible')){
    return;
  }

  $('#notebook_list').velocity('finish').velocity('transition.slideDownIn',300);
}

function hideNotebookList(){
  if($('#notebook_list').is(':hidden')){
    return;
  }  
  $('#notebook_list').velocity('finish').velocity('transition.slideUpOut',300);
}


/**
 * 初始化笔记本
 */
function initNotebook(){
  db.query({t_name:t_notebook},(err,records)=>{
    if(err){
      logger.error('查询笔记本出现异常，'+ err);
      return;
    }

    logger.debug('begin init notebook.');
    $(records).each((i,r)=>{
      $('#notebook_list').append(createNotebookItem(r));
      logger.debug(' append notebook. ');
    });
    logger.debug('end init notebook.');
    showNotebookList();

  });
}

function createNotebookItem(r){
  return '<li notebook-name="'+ r.name +'" class="notebook '+(r._id == defaultNotebookId? "default" : "")+'" id="'+r._id+'"><div class="animation header"><div class="animation mark"></div><span>'+r.name+'<span></div></li>';
}

/**
 * 初始化默认笔记本
 */
function initDefaultNotebook(){
  logger.info('initDefaultNotebook()');
  db.query({t_name:t_default_notebook},(err,records)=>{
    if(err){
      logger.error('查询默认笔记本失败，'+err);
      return;
    }

    // 查不到记录新建默认笔记本
    if(records.length == 0){
      logger.info('默认笔记本为空，新建默认笔记本');
      createDefaultNotebook(initNotebook); 
      return;
    }

    let _defaultNotebook = records[0];
    defaultNotebookId = _defaultNotebook.notebook_id;
    logger.info('defaultNotebookId:'+defaultNotebookId);

    db.count({_id:defaultNotebookId},(err,count)=>{
      if(err){
        logger.error('查询默认笔记本是否存在出现异常,'+err);
        return;
      }

      // 有记录，但是在笔记本中不存在，创建默认笔记本
      if(count == 0){
        logger.info('默认笔记本不存在，新建默认笔记本');
        createDefaultNotebook(initNotebook); 
        return;
      }

      initNotebook();
    });
  });
}

/**
 * 初始化侧边栏，笔记本分类
 */
function initSidebar(){
	logger.info('initSidebar()');
  initDefaultNotebook();
}

function showExportMenu(e){
  if(!activeNoteId || !$('#export_btn').hasClass('active')){
    return;
  }
  showFloatPanel($('#export_menu'),e,function(){},'left-bottom');
}

function hideExportMenu(){
  hideFloatPanel($('#export_menu'));
}

/**
 * 显示隐藏预览
 */
function togglePreview(){
  if(!activeNoteId || !$('#toggle_preview_btn').hasClass('active')){
    return;
  }

  let $target  = $('#preview_container');
  if(state == 4){ // 预览模式
    hideNavigation();
    

    $('#toggle_preview_btn > i').removeClass('fa-pencil').addClass('fa-eye');

    $target.velocity('finish')
      .velocity('transition.slideDownBigOut',350,()=>{
          $('#note_container')
            .velocity('finish')
            .velocity('transition.slideDownBigIn',350,()=>{
              refreshEditor();
              state = 3; // 编辑模式

              $('#toggle_preview_btn').addClass('active');
              $('#starred_btn').addClass('active');
              $('#save_btn').addClass('active');
              $('#export_btn').addClass('active');
              $('#preview_btn').removeClass('active'); 
                           
            });
        });
  }else{ 
    // showNavigation();

    $('#toggle_preview_btn > i').removeClass('fa-eye').addClass('fa-pencil');

    $('#note_container').velocity('finish')
      .velocity('transition.slideUpBigOut',350,()=>{
          // 如果首次渲染笔记或者笔记内容已改变，则需要重新渲染markdown
          logger.info('firstRenderNote : ' + firstRenderNote);
          logger.info('noteChanged : ' + noteChanged);
          if(firstRenderNote || noteChanged){
            renderMarkdown();
          }
          
          $target
            .velocity('finish')
            .velocity('transition.slideUpBigIn',350);
            state = 4; // 预览模式

            $('#toggle_preview_btn').addClass('active');
            $('#starred_btn').removeClass('active');
            $('#save_btn').removeClass('active');
            $('#export_btn').addClass('active');
            $('#preview_btn').addClass('active');             
        });
  }
}

/**
 * 渲染markdown笔记
 */
function renderMarkdown(){
  logger.info('renderMarkdown()');
  let _content       = editor.getValue();
  let _renderContent = md.render(_content);
  
  let _note_name     = activeNoteItem.attr('note-name');  
  let _update_time   = activeNoteItem.attr('update-time');
  let _notebook_name = activeNoteItem.attr('notebook-name');
  let _create_time   = activeNoteItem.attr('create-time');
  
  $('#preview_container .note-name').text(_note_name);
  $('.note-detail .update-time').text(_update_time);
  $('.note-detail .create-time').text(_create_time);
  $('.note-detail .notebook-name').text(_notebook_name);

  $('#preview_content').html(_renderContent);
  handleImgLink($('#preview_content')); // 处理图片地址

  $('#preview_content').clone();

    //禁止预览窗口所有a链接点击事件
  $("#preview_container a").click(openExternal);
  
  createToc('#markdown_toc','#preview_content');

  firstRenderNote = false;
  noteChanged     = false;
}

function createToc(tocId,mdId){
  let _tocHtml   = '<ul class="toc-tree"> ';
  $(mdId).find(':header').each((i,h)=>{
    let level   = parseInt(h.nodeName.substring(1), 10);
    let title   = $(h).text();
    let id = 'md_toc_' + i + '_' + level;
    _tocHtml += '<li class="level-'+level+'"><span target-id="'+id+'">' + title + '</span>';
    $(h).attr('id',id);
  });

  _tocHtml += '</ul>';
  // logger.debug(_tocHtml);

  $(tocId).empty().html(_tocHtml);

  $(tocId + ' li').on('click',(e)=>{
    let $target = $(e.target).closest('li');
    $target.siblings().removeClass('active');
    $target.addClass('active');
    let targetId = $target.find('span').attr('target-id');
    $('#' + targetId).velocity("scroll", {  
        duration: 800
        ,delay: 40
        ,container:$('#preview_content')});
  });
}



function openExternal(e){
  e.preventDefault();  

  var _tagName = $(e.target).get(0).tagName;
  logger.debug('openExternal...' + $(e.target).get(0).tagName);
  if(_tagName != 'A'){
    return;
  }

  if($(e.target).attr('href').startWith('#')){
    return;
  }

  // 使用系统默认的浏览器打开 URL。
  shell.openExternal(e.target.href);
}

/**
 * 将munote域名的图片资源转换为本地路径
 */
function handleImgLink($target){
  let $imgs = $target.find('img');
  $imgs.each((i,img)=>{
    let imgSrc = $(img).attr('src');
    if(imgSrc.startWith(__baseurl)){
      // imgSrc = imgSrc.substring((__baseurl).length, imgSrc.length);
      // activeNotebookId
      imgSrc = path.join(Config.__dataPath, activeNoteItem.attr('notebook-id'), activeNoteId, imgSrc);
      logger.info('imgSrc = ' + imgSrc);
      $(img).attr('src',imgSrc);
    }     
  });
  return $target;
}

/**
 * 所有的img标记的src转换为为base64 dataURI
 */
function convertImage2DataURI(target,callback){
  let $imgs = target.find("img");
  let len   = $imgs.length ;

  logger.info('>> image length = ' + len)
  if(len === 0){
    logger.info('no image to handle.');
    callback(target);
    return;
  }

  $imgs.each(function(i,img){
    let beforeImgSrc = $(img).attr('src');
    let afterImgSrc  = beforeImgSrc;

    // // 处理本地域名的图片
    // if(beforeImgSrc.startWith(__baseurl+'/')){
    //   beforeImgSrc = beforeImgSrc.substring((__baseurl+'/').length,beforeImgSrc.length);
    //   afterImgSrc = __imgPath + '/' + activeNoteId + '/' + beforeImgSrc;

    //   logger.info("将munote域名的图片资源转换为本地路径");
    //   logger.info('>>> in-src=' + beforeImgSrc);
    //   logger.info('>>> out-src=' + afterImgSrc);
    // }

    //在转换为HTML时在转换为dataURI
    convertImgToBase64(afterImgSrc,(_imgSrc)=>{
      // logger.info('>> [convertImage2DataURI] beforeImgSrc = ' + afterImgSrc );
      // logger.info('>> [convertImage2DataURI] afterImgSrc = ' + _imgSrc );
      logger.info('>> index = ' + i);
      $(img).attr('src',_imgSrc);

      // 所有元素遍历处理完成之后执行回调函数
      if(i === (len-1)){
        callback(target);
      }
    });
  });
  logger.info('done!');
}

/**
 * 转换图片文件为dataURI
 */
function convertImgToBase64(url, callback, outputFormat){ 
  let canvas = document.createElement('canvas'); 
  let ctx    = canvas.getContext('2d'); 
  let img    = new Image; 
  img.crossOrigin = 'Anonymous'; 
  img.onload = ()=>{ 
    canvas.height = img.height; 
    canvas.width  = img.width; 
    ctx.drawImage(img,0,0); 
    logger.info(' convertImgToBase64()');
    callback(canvas.toDataURL(outputFormat || 'image/png')); 
    // Clean up 
    canvas = null; 
  };
  img.src = url;
}

/**
 * 初始化键盘快捷键监听器
 */
function initkeyListener(){
	logger.info('initkeyListener()');
  let listener = new window.keypress.Listener();
  
  //ctrl + left : 隐藏侧边栏
  listener.simple_combo("ctrl left", hideSidebar);
	
	// ctrl + right : 显示侧边栏
  listener.simple_combo("ctrl right", showSidebar);
  
  //ctrl + e ：编辑模式/阅读模式
  listener.simple_combo("ctrl e", togglePreview);
  listener.simple_combo("cmd e", togglePreview);
  
  //ctrl + s : 保存笔记(持久化)
  listener.simple_combo("ctrl s", saveNote);
  listener.simple_combo("cmd s", saveNote);  

  //ctrl + n : 新建笔记
  listener.simple_combo("ctrl n", toCreateNote);
  listener.simple_combo("cmd n", toCreateNote);

  listener.simple_combo("esc", hideSearchDialog);

  //ctrl + e : 编辑模式
  // listener.simple_combo("ctrl e", toggleEdit);
}

/**
 * 显示/隐藏导航栏
 */
function toggleNavigation(){
  let $target = $('#toc_wrapper');

  // TODO 目前预览模式才能有导航
  if(state != 4 || !$('#preview_btn').hasClass('active')){
    return;
  }
  if($target.is(':visible')){
    hideNavigation();
  }else{
    showNavigation();
  }
}

function hideNavigation(){
  $('#toc_wrapper').velocity('finish').velocity('transition.slideLeftBigOut',350);
}

function showNavigation(){
 $('#toc_wrapper').velocity('finish').velocity('transition.slideLeftBigIn',350); 
}


var languageOverrides = {
  js: 'javascript',
  html: 'xml'
};

/**
 * 初始化markdown解析器
 */
function initRenderer(){
  md = require('markdown-it')({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function(code, lang){
      if(languageOverrides[lang]) lang = languageOverrides[lang];
      if(lang && hljs.getLanguage(lang)){
        try {
          return hljs.highlight(lang, code).value;
        }catch(e){
          logger.error("highlight error:" + e);
        }
      }
      return '';
    }
  })
  .use(require('markdown-it-footnote'))
  .use(require('markdown-it-checkbox'))
  .use(require('markdown-it-toc'))
  .use(require('markdown-it-sup'))
  .use(require('markdown-it-sub'));  
}

/**
 * 初始化滚动条事件
 */
function initScrollbar(){
  $('.scrollbar-macosx').scrollbar();
}

function switchTheme(_theme){
  if(_theme == 'day'){
    dayMode();
    Config.__theme = "day";
  }else{
    nightMode();
    Config.__theme = "night";
  }
  emit('save-config',Config);
}

function dayMode(){
  logger.info('day mode');
  hideFloatPanel($('#settings_panel'));

  $('#night_mode_btn').removeClass('btn-primary').addClass('btn-default');
  $('#day_mode_btn').removeClass('btn-default').addClass('btn-primary');

  $('#markdown_css').attr('href','css/theme/github-markdown-light.css');
  $('#app_css').attr('href','css/theme/app-light.css');

  editor.setOption('theme','eclipse');
}

function nightMode(){
  logger.info('night mode');
  hideFloatPanel($('#settings_panel'));

  $('#day_mode_btn').removeClass('btn-primary').addClass('btn-default');
  $('#night_mode_btn').removeClass('btn-default').addClass('btn-primary');
  
  // $('#night-mode-btn').parent().children().removeClass('active');
  // $('#night-mode-btn').addClass('active');

  $('#markdown_css').attr('href','css/theme/github-markdown-dark.css');
  $('#app_css').attr('href','css/theme/app-dark.css');
  editor.setOption('theme','zenburn');
}

/**
 * 切换语言
 */
function switchLang(_lang){
  logger.info('切换语言：'+_lang);

  hideFloatPanel($('#settings_panel'));

  Config.__lang = _lang;
  emit('save-config',Config);

  setLang(_lang);
}

function setLang(_lang){

  $('#lang_'+_lang).prop('checked',true);

  $.i18n.properties({
      name                   : 'munote', 
      path                   : 'lang/', 
      mode                   : 'map',
      language               : _lang,
      checkAvailableLanguages: true,
      async                  : true,
      cache                  : false, 
      encoding               : 'UTF-8', 
      callback               : function() {
        logger.info('>> 切换系统语言:'+_lang);
        logger.info($.i18n.prop('l-notebook-name'));
        $('.l-notebook-name').text($.i18n.prop('l-notebook-name'));
        $('.l-all-notes').text($.i18n.prop('l-all-notes'));
        $('.l-starred').text($.i18n.prop('l-starred'));
        $('.l-no-notes-do-u-want').text($.i18n.prop('l-no-notes-do-u-want'));
        $('.l-new-notes').text($.i18n.prop('l-new-notes'));
        $('.l-pls-input-notebook-name').text($.i18n.prop('l-pls-input-notebook-name'));
        $('.l-cancel').text($.i18n.prop('l-cancel'));
        $('.l-confirm').text($.i18n.prop('l-confirm'));
        $('.l-new-note').text($.i18n.prop('l-new-note'));
        $('.l-mark-default').text($.i18n.prop('l-mark-default'));
        $('.l-new-notebook').text($.i18n.prop('l-new-notebook'));
        $('.l-rename').text($.i18n.prop('l-rename'));
        $('.l-delete').text($.i18n.prop('l-delete'));
        $('.l-export-markdown').text($.i18n.prop('l-export-markdown'));
        $('.l-export-pdf').text($.i18n.prop('l-export-pdf'));
        $('.l-export-html').text($.i18n.prop('l-export-html'));
        $('.l-sort-by-starred').text($.i18n.prop('l-sort-by-starred'));
        $('.l-sort-by-name').text($.i18n.prop('l-sort-by-name'));
        $('.l-sort-by-create-time').text($.i18n.prop('l-sort-by-create-time'));
        $('.l-sort-by-update-time').text($.i18n.prop('l-sort-by-update-time'));
        $('.l-current-version').text($.i18n.prop('l-current-version'));
        $('.l-day-mode').text($.i18n.prop('l-day-mode'));
        $('.l-night-mode').text($.i18n.prop('l-night-mode'));
        $('.l-find-and-replace').text($.i18n.prop('l-find-and-replace'));
        $('.l-previous').text($.i18n.prop('l-previous'));
        $('.l-next').text($.i18n.prop('l-next'));
        $('.l-replace').text($.i18n.prop('l-replace'));
        $('.l-replace-all').text($.i18n.prop('l-replace-all'));
        $('.l-math-case').text($.i18n.prop('l-math-case'));
        $('.l-wrap-around').text($.i18n.prop('l-wrap-around'));


        $('#notebook_name').attr('placeholder',$.i18n.prop('l-pls-input-notebook-name'));
        $('#search_for').attr('placeholder',$.i18n.prop('l-search-for'));
        $('#replace_with').attr('placeholder',$.i18n.prop('l-replace-with'));

        DEFAULT_NOTEBOOK_NAME = $.i18n.prop('l-default-notebook-name');
        DEFAULT_SEARCH_TITLE  = $.i18n.prop('l-default-search-title');
      }
  });  
}

/**
 * 初始化系统语言
 */
function initLang(){
  let _lang =  Config.__lang;
  _lang = _lang ? _lang : defaultLang;
  setLang(_lang);
}

function initSortMode(){
  sortBy('update_time');
}

function initTheme(){
  if(Config.__theme == 'day'){
    dayMode(); //日间模式
  }else{
    nightMode(); // 夜间模式
  }
  
}

function initContentWrapper(){
  showTimelineContainer(); //首次进入系统默认显示笔记时间线
}

function initFloatPanelEvent(){
  // float-panel显示后，点击其他任何地方，都会隐藏float-panel
  $(document).on('click',()=>{
    // logger.info(' document click()');
    // logger.info(' document click()' + $('.float-panel').is(':hidden'));
    // logger.info(' document click()' + $('.float-panel').hasClass('confirm'));

    $($('.float-panel')).each((i,e)=>{
      if($(e).is(':hidden')){
        return true;
      }

      if($(e).hasClass('confirm') || $(e).hasClass('draggable')){
        return;
      }

      hideFloatPanel($(e));
    });
  });

  // 阻止float-panel内点击时触发关闭float-panel
  $('.float-panel').on('click',(e)=>{
    // if($(e.target).closest('.menu')){
    // }
    e.stopPropagation();
  });  
}

function initButtonEffect(){
  // 给所有的button添加点击回弹效果
  $('button.active').on('click',(e)=>{
    let $target = $(e.target);
    $target.velocity('finish').velocity('transition.bounceIn',300);    
  });
}

function initDraggable(){
  $('#search_dialog').draggable({ handle: ".title" });
  // $('#search_dialog').draggable();
}

// function initNavation(){

// }

function initAutoSave(){
  setTimeout(autoSave,3000);
}

function autoSave(){
  logger.info('定时保存笔记...');
  saveNote();
  setTimeout(autoSave, 3000);
}

function init(){
	initConfig(()=>{
    initEditor();
    initRenderer();
    initSidebar();
    initkeyListener();
    initScrollbar();
    initLang();
    initTheme();
    initSortMode();
    initContentWrapper();
    initFloatPanelEvent();
    initButtonEffect();
    initDraggable();
    // initAutoSave();
    // initNavation();
    unloading(); // 所有处理完之后，隐藏loading
  });
}

init();