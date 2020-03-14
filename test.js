//	定义并行任务池
var syncTask = {
  //  任务状态
  status: 'Idle',
  //  状态映射
  statusObj: {
    //  空闲
    idle: 'Idle',
    //  等待结果中
    pending: 'pending'
  },
  //  任务数组
  taskList: [],
  //  队列的执行函数
  postMessage: () => {
    syncTask.status = syncTask.statusObj.pending;
    //  从队列第一个函数开始执行
    sdk.postMessage(syncTask.taskList[0].apiName, syncTask.taskList[0].params, (...resList) => {
      //  用户定义的回调函数
      syncTask.taskList[0].callback(...resList);
      //  移除第一个接口调起任务
      syncTask.taskList.shift();
      //  移除了第一个函数之后，检查任务池是否还有任务，没有则停止，有则继续执行
      if (syncTask.taskList.length) {
        //  继续执行任务池
        syncTask.postMessage();
      } else {
        //  如果任务池为空，则修改状态为空闲
        syncTask.status = syncTask.statusObj.idle;
      }
    });
  }
};

//	统一封装发送指令的方法
//	apiName: 接口名称
//  type: 接口类型,sync/串行,async/并行
//  isRepeatable: 是否重复挂起等待执行
//  params: 接口参数
//  callback: 回调函数
var messageOn = (apiName, type, isRepeatable, params = {}, callback) => {
	if (type === 'sync') {
      if (!isRepeatable && syncTask.taskList.some(e => e.apiName === apiName)) {
        //  如果不支持以及挂起重复的串行任务，则跳出
        return;
      }
      //	先往任务池加任务
      syncTask.taskList.push({
        apiName: apiName,
        params: params,
        callback: callback
      });
      //  当前串行任务池状态如果为 pending 状态
      if (syncTask.staus === statusObj.idle) {
        //  开始发送指令
        syncTask.postMessage();
      }
    } else {
      //  串行接口直接执行
      sdk.postMessage(apiName, params, callback);
    }
};
