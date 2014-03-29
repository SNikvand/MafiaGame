var Chat = function(socket) {
    this.socket = socket;
};

/*--------------------------------------------------------------------------------
 Purpose: Sends message to room.

 Created by: Emanuel Haiek
 Data / Modified: March 28th 2014

 Version: 1

 Peer Reviewed By: Shahin
 -------------------------------------------------------------------------------*/
Chat.prototype.sendMessage = function(room, text) {
    var message = {
        room: room,
        text: text
    };
    this.socket.emit('message', message);
};
/*--------------------------------------------------------------------------------
 Purpose: Processes the command.

 Return Data: the corresponding message.

 Created by: Emanuel Haiek
 Data / Modified: March 28th 2014

 Version: 1

 Peer Reviewed By: Shahin
 -------------------------------------------------------------------------------*/
Chat.prototype.processCommand = function(command) {
    var words = command.split(' ');
    var command = words[0]
        .substring(1, words[0].length)
        .toLowerCase();
    var message = false;

    switch(command) {
        case 'join':
            words.shift();
            var room = words.join(' ');
            this.changeRoom(room);
            break;
        case 'nick':
            words.shift();
            var name = words.join(' ');
            this.socket.emit('nameAttempt', name);
            break;
        default:
            message = 'Unrecognized command.';
            break;
    }

    return message;
};
/*--------------------------------------------------------------------------------
 Purpose: Joins specified room.

 Created by: Emanuel Haiek.
 Data / Modified: March 26th 2014

 Version: 1

 Peer Reviewed By: Shahin
 -------------------------------------------------------------------------------*/
Chat.prototype.changeRoom = function(room) {
    this.socket.emit('join', {
        newRoom: room
    });
};

Chat.prototype.joinRoom = function(hostid) {
    this.socket.emit('joinGame', hostid);
}

Chat.prototype.createRoom = function(room, size) {
    this.socket.emit('createGame', {newRoom: room, newSize: size})
};