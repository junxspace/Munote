'use strict';

////////////////////////////////////////////////////////
// 公共函数定义
////////////////////////////////////////////////////////
// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符， 
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) 
// 例子： 
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423 
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18 
Date.prototype.Format = function (fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

/**
 * 判断字符串是否以指定的字符串结尾
 */
String.prototype.endWith=function(endStr){
  let len = endStr.length;
  return (len >= 0 && this.indexOf(endStr) == 0);
}

/**
 * 判断字符串是否以指定的字符串开头
 */
String.prototype.startWith=function(startStr){
  let len = startStr.length;
  return (len >= 0 && this.indexOf(startStr) == 0);
}

/**
 * 判断是否text节点
 */
function isTextNode(){
  return this.nodeType==3;//文本节点
}

/**
 * 判断是否具有指定的属性
 */
$.fn.hasAttr=function(attrName){
  return $(this).attr(attrName);
}

function exists(obj){
  return obj!='undefined' && obj != null && obj != '';
}

// $.fn.center = function (container) {
//     this.css('position','absolute');
//     this.css('top', ( $(container).height() - this.height() ) / 2 + $(container).scrollTop() + 'px');
//     this.css('left', ( $(container).width() - this.width() ) / 2 + $(container).scrollLeft() + 'px');
//     return this;
// }

/**
 * 递归删除文件
 */
function delFolderRecursive(_path) {
  if( fs.existsSync(_path) ) {
    fs.readdirSync(_path).forEach(function(file,index){
      var curPath = _path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { 
        // recurse 
        delFolderRecursive(curPath);
      } else { 
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(_path);
  }
};

/**
 * 根据事件对象和dom对象计算以事件发生的坐标为中心的坐标信息
 * 如果不存在事件对象，则计算相对于屏幕中心的坐标信息
 * 
 * @param {Object} target : jquery对象，required 
 * @param {Object} event  : event对象
 * @param {Object} pos  : 显示的位置信息
 */
function getCoords(target,event,pos){
  let coords = {};
  if(event){
    if(pos == 'left-top'){

    }else if(pos == 'left-top'){

    }else if(pos == 'left-center'){

    }else if(pos == 'left-bottom'){
      coords = getLeftBottomCoords(target,event);
    }else if(pos == 'right-top'){
      
    }else if(pos == 'right-center'){

    }else if(pos == 'right-bottom'){
      coords = getRightBottomCoords(target,event);
    }else if(pos == 'top-center'){
      coords = getTopCenterCoords(target,event);
    }else if(pos == 'bottom-center'){

    }else{
      coords = getCenterCoords(target,event);
    }
    return coords;
  }

  let _top,_left;
  // 计算为屏幕中央
  _top  = ($(window).height() - target.height()) / 2 ;
  _left = ($(window).width() - target.width()) / 2 ;
  coords.left = _left;
  coords.top = _top;
  return coords;
}
/**
 * 根据事件发生坐标计算目标的右边-顶部位置
 */
function getLeftBottomCoords(target,event){
  let $target      = $(target);
  let _eTop        = event.clientY;
  let _eLeft       = event.clientX;
  let _width       = $target.outerWidth();
  let _height      = $target.outerHeight();
  
  let screenHeight = $(window).outerHeight(); 
  let screenWidth  = $(window).outerWidth();
  let gap          = 24;

  let _top         = _eTop - gap;
  let _left        = _eLeft - _width +  gap;

  // 坐标小于指定间距的情况
  _top  = _top < gap ? gap : _top;
  _left = _left < gap ? gap : _left;

  // 坐标超出屏幕的情况
  _top  = (_top + _height ) >  screenHeight ? (screenHeight - _height - gap) : _top;
  _left = (_left + _width ) >  screenWidth ? (screenWidth - _width - gap) : _left;

  let coords = {};
  coords.left = _left;
  coords.top = _top;
  return coords; 
} 


/**
 * 根据事件发生坐标计算目标的右边-底部位置
 */
function getRightBottomCoords(target,event){
  let $target      = $(target);
  let _eTop        = event.clientY;
  let _eLeft       = event.clientX;
  let _width       = $target.outerWidth();
  let _height      = $target.outerHeight();
  
  let screenHeight = $(window).outerHeight(); 
  let screenWidth  = $(window).outerWidth();
  let gap          = 24;
  
  // let _top         = _eTop  - _height - 16;
  // let _left        = _eLeft - _width/2;

  let _top  = _eTop - gap;
  let _left = _eLeft - gap;

  // 坐标小于指定间距的情况
  _top  = _top < gap ? gap : _top;
  _left = _left < gap ? gap : _left;

  // 坐标超出屏幕的情况
  _top  = (_top + _height ) >  screenHeight ? (screenHeight - _height - gap) : _top;
  _left = (_left + _width ) >  screenWidth ? (screenWidth - _width - gap) : _left;

  let coords = {};
  coords.left = _left;
  coords.top = _top;
  return coords; 
} 


/**
 * 根据事件发生坐标计算目标的顶部-中部位置
 */
function getTopCenterCoords(target,event){
  let $target      = $(target);
  let _eTop        = event.clientY;
  let _eLeft       = event.clientX;
  let _width       = $target.outerWidth();
  let _height      = $target.outerHeight();
  
  let screenHeight = $(window).outerHeight(); 
  let screenWidth  = $(window).outerWidth();
  let gap          = 24;
  
  let _top         = _eTop  - _height - 16;
  let _left        = _eLeft - _width/2;

  // 坐标小于指定间距的情况
  _top  = _top < gap ? gap : _top;
  _left = _left < gap ? gap : _left;

  // 坐标超出屏幕的情况
  _top  = (_top + _height ) >  screenHeight ? (screenHeight - _height - gap) : _top;
  _left = (_left + _width ) >  screenWidth ? (screenWidth - _width - gap) : _left;

  let coords = {};
  coords.left = _left;
  coords.top = _top;
  return coords; 
} 

/**
 * 根据事件发生坐标计算目标的中心的位置
 */
function getCenterCoords(target,event){
  let $target      = $(target);
  let _eTop        = event.clientY;
  let _eLeft       = event.clientX;
  let _width       = $target.outerWidth();
  let _height      = $target.outerHeight();
  
  let screenHeight = $(window).outerHeight(); 
  let screenWidth  = $(window).outerWidth();
  let gap          = 24;
  
  let _top         = _eTop  - _height/2;
  let _left        = _eLeft - _width/2;

  // 坐标小于指定间距的情况
  _top  = _top < gap ? gap : _top;
  _left = _left < gap ? gap : _left;

  // 坐标超出屏幕的情况
  _top  = (_top + _height ) >  screenHeight ? (screenHeight - _height - gap) : _top;
  _left = (_left + _width ) >  screenWidth ? (screenWidth - _width - gap) : _left;

  let coords = {};
  coords.left = _left;
  coords.top = _top;
  return coords; 
}


/** 扩展jquery方法 */
$.extend({
  // 
  /**
   * 弹出确认框
   * @param {Object} e      : event对象
   * @param {Object} config : 配置对象
   *       - {String}   content       : 弹出的提示文字
   *       - {String}   cancelBtnTitle: cancel按钮标题文字
   *       - {String}   okBtnTitle    : ok按钮标题文字
   *       - {function} cancelFunc    : cancel按钮标题文字
   *       - {function} okFunc        : cancel按钮标题文字
   */
  confirm : (e,config)=>{
    let defaultOkBtnTitle     = "确定";
    let defaultCancelBtnTitle = "取消";
    let confirmHTML = '<div class="float-panel confirm">'
                      +'  <div class="pure-g">'
                      +'    <div class="pure-u-1-1 title">'
                      +'      <span>' + (config.title ? config.title : "") +'</span>'
                      +'    </div>'                      
                      +'    <div class="pure-u-1-1 center">'
                      +'      <span>' + (config.content ? config.content : "") +'</span>'
                      +'    </div>'
                      +'  </div>'
                      +'  <div class="pure-g center" >'
                      +'    <div class="pure-u-1-2">'
                      +'      <button class="btn btn-default cancel-btn" type="button" >'+ ( config.cancelBtnTitle ? config.cancelBtnTitle : defaultCancelBtnTitle)+'</button>'
                      +'    </div>        '
                      +'    <div class="pure-u-1-2">'
                      +'      <button class="btn btn-primary ok-btn" type="button">'+ (config.okBtnTitle ? config.okBtnTitle : defaultOkBtnTitle) +'</button>'
                      +'    </div>'
                      +'  </div>'
                      +'</div>';
    let $confirmHTML = $(confirmHTML);    
    $(document.body).append($confirmHTML);

    // 绑定“取消”按钮点击事件
    $confirmHTML.find('.cancel-btn').on('click',()=>{
      if(typeof config.cancelClick == 'function'){
        config.cancelClick();
      }

      hideFloatPanel($confirmHTML,false,()=>{
        $confirmHTML.remove();
      });
    });

    // 绑定“确定”按钮点击事件
    $confirmHTML.find('.ok-btn').on('click',()=>{
      if(typeof config.okClick == 'function'){
        config.okClick();
      }

      hideFloatPanel($confirmHTML,false,()=>{
        $confirmHTML.remove();
      });      
    });

    showFloatPanel($confirmHTML,e);
  }

  /**
   * 提示框，只有一个按钮
   * @param {Object} e : event对象
   * @param {String} content : 显示的内容
   * @param {String} okBtnTitle : 按钮文字
   * @param {function} callback : 点击按钮后的回调函数
   */
  ,alert : (content,e,okBtnTitle,callback)=>{
    let defaultOkBtnTitle     = "确定";
    let alertHTML = '<div class="float-panel confirm">'
                      +'  <div class="pure-g">'
                      +'    <div class="pure-u-1-1">'
                      +'      <b>' + content +'</b>'
                      +'    </div>'
                      +'  </div>'
                      +'  <div class="pure-g">'
                      +'    <div class="pure-u-1-1 center">'
                      +'      <button class="btn btn-primary btn-sm ok-btn" type="button">'+ (okBtnTitle ? okBtnTitle : defaultOkBtnTitle) +'</button>'
                      +'    </div>'
                      +'  </div>'
                      +'</div>';
    let $alertHTML = $(alertHTML);
    $(document.body).append($alertHTML);

    // 绑定“确定”按钮点击事件
    $alertHTML.find('.ok-btn').on('click',()=>{
      if(typeof callback == 'function'){
        callback();
      }

      hideFloatPanel($alertHTML,false,()=>{
        $alertHTML.remove();
      });      
    });

    showFloatPanel($alertHTML,e);    
  }
});

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