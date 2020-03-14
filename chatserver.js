const WebSocketServer = require('websocket').server;
const ip = require('ip');
// 用于管理文本聊天用户列表。
const connectionArray = [];
let nextID = Date.now();
let appendToMakeUnique = 1;
// 将日志记录信息输出到控制台
const log = text => console.log(`[${new Date().toLocaleTimeString()}] ${text}`);
//  如果要实现对阻止特定来源的支持，这是
//  在哪里做。 只需返回false即可拒绝给定的WebSocket连接
//  指定的原点。
const originIsAllowed = origin => true;
module.exports = webServer => {
  //  扫描用户列表，查看指定名称是否唯一。 如果是，
  //  返回 true。 否则，返回 false。 我们希望所有用户都拥有独特的
  //  名称。
  const isUsernameUnique = name => !connectionArray.some(e => e.username === name);

  //  将消息（已经是JSON字符串）发送到单个
  //  用户，并为其指定用户名。 我们将其用于WebRTC信令，
  //  我们可以将其用于私人短信。
  const sendToOneUser = (target, msgString) => connectionArray.find(e => e.username === target).sendUTF(msgString);

  //  扫描连接列表并返回指定的连接列表
  //  clientID。 每个登录名获得的 ID 在会话期间不会更改，
  //  以便可以在用户名更改时进行跟踪。
  const getConnectionForID = id => connectionArray.find(e => e.clientID === id);

  //  构建类型为 'userlist” 的消息对象，其中包含
  //  所有已连接的用户。 用于增加新登录的用户，并且
  //  效率低下，无法处理名称更改通知。
  // 将用户添加到列表
  const makeUserListMessage = () => Object.assign({}, {
    type: 'userlist',
    users: connectionArray.map(e => e.username)
  });

  //  向所有聊天成员发送'用户列表”消息。 这是一种俗气的方式
  //  以确保每个加入/删除都反映在每个地方。 会更多
  //  有效地向每个用户发送简单的加入/删除消息，但这是
  //  对于这个简单的示例来说已经足够了。
  const sendUserListToAll = () => {
    const userListMsgStr = JSON.stringify(makeUserListMessage());
    connectionArray.forEach(e => e.sendUTF(userListMsgStr));
  }
  // 在分配给该示例的端口上启动 HTTPS 服务器。
  // 这很快就会变成 WebSocket 端口。
  const listenNum = 6503
  webServer.listen(listenNum, () => {
    log(`Server ${ip.address()} is listening on port ${listenNum}`);
  });

  // 通过将 HTTPS 服务器转换为一个来创建 WebSocket 服务器。
  const wsServer = new WebSocketServer({
    httpServer: webServer,
    autoAcceptConnections: false
  });

  !wsServer && log('ERROR: Unable to create WbeSocket server!');

  // 在我们的 WebSocket 服务器上设置'连接”消息处理程序。 这是
  // 每当用户使用以下命令连接到服务器的端口时调用
  // WebSocket 协议。
  wsServer.on('request', request => {
    if (!originIsAllowed(request.origin)) {
      request.reject();
      return log(`Connection from ${request.origin} rejected.`);
    }

    // 接受请求并建立连接。
    const connection = request.accept('json', request.origin);

    // 将新连接添加到我们的连接列表中。
    log(`Connection accepted from ${connection.remoteAddress}.`);
    connectionArray.push(connection);
    connection.clientID = nextID;
    nextID++;

    //  向新客户发送其令牌； 它发送回'用户名”消息给
    //  告诉我们他们要使用的用户名。
    let msg = {
      type: 'id',
      id: connection.clientID
    };
    connection.sendUTF(JSON.stringify(msg));

    // 为通过 WebSocket 接收到的 '消息” 事件设置处理程序。 这个
    // 是客户端发送的消息，可以是与他人共享的文本
    // 用户，一个用户的私人消息（文本或信令）或命令
    // 到服务器。
    connection.on('message', message => {
      if (message.type === 'utf8') {
        log(`Received Message: ${message.utf8Data}`)

        // Process incoming data.

        let sendToClients = true;
        msg = JSON.parse(message.utf8Data);
        const connect = getConnectionForID(msg.id);

        //查看传入的对象并根据其执行操作
        //其类型。 传递未知的消息类型，
        //因为它们可用于实现客户端功能。
        //具有' target”属性的消息仅发送给用户
        //以该名称命名。
        switch (msg.type) {
          // 公开短信
          case 'message':
            msg.name = connect.username;
            msg.text = msg.text.replace(/(<([^>]+)>)/ig, '');
            break;

          // 修改用户名称
          case 'username':
            let nameChanged = false;
            // 通过在名称后加上数字来确保名称唯一
            // 如果不是； 继续尝试直到成功。
            while (!isUsernameUnique(msg.name)) {
              msg.name = `${msg.name}${appendToMakeUnique}`;
              appendToMakeUnique++;
              nameChanged = true;
            }

            // 如果必须更改名称，我们将发送 “ rejectusername”
            // 向用户发送消息，以便他们知道自己的名字
            // 由服务器更改。
            if (nameChanged) {
              connect.sendUTF(JSON.stringify({
                id: msg.id,
                type: 'rejectusername',
                name: msg.name
              }));
            }

            // 设置此连接的最终用户名，然后发送
            // 将用户列表更新为所有用户。 是的，我们正在发送完整的
            // 列表，而不只是更新。 效率极低
            // 但这是一个演示。 不要在真正的应用程序中这样做。
            connect.username = msg.name;
            sendUserListToAll();
            sendToClients = false;  // We already sent the proper responses
            break;
        }

        //将修改后的消息转换回 JSON 并发送出去
        //视情况指定给指定的客户端或所有客户端。 我们
        //传递任何未特别处理的消息
        //在上面的选择块中。 这使客户可以
        //畅通无阻地交换信令和其他控制对象。
        if (sendToClients) {
          const msgString = JSON.stringify(msg);
          // If the message specifies a target username, only send the
          // message to them. Otherwise, send it to every user.
          if (msg.target && msg.target.length !== 0) {
            sendToOneUser(msg.target, msgString);
          } else {
            connectionArray.map(e => e.sendUTF(msgString));
          }
        }
      }
    });

    //处理 WebSocket 的 “关闭” 事件； 这意味着用户已注销
    //或已断开连接。
    connection.on('close', (reason, description) => {
      // 首先，从连接列表中删除该连接。
      connectionArray = connectionArray.filter(el => el.connected);
      // 现在发送更新的用户列表。 同样，请不要在
      // 实际的应用程序。 您的用户不会非常喜欢您。
      sendUserListToAll();
      // 构建并输出日志输出以获取详细信息。
      log(`Connection closed: ${connection.remoteAddress} (${reason}${description ? ': ' + description : ''})`);
    });
  });
}