// minimum required number of players for a game
var currMinConn = null;

// current number of players in room
var currPlayers = 0;

// current room host socket id
var currHostId = null;

// current player (client) socket id
var currSockId = null;

function divRoomItem(message) {
    return $('<div class="mg-item list-group-item selectroom" onclick="roomSelected($(this).text(), $(this));"></div>').html(message);
}

var currentRoomSelected = null;

function roomSelected(e, thisElem) {
    $('.selectroom').css('background-color', '#f9f9f9');
    thisElem.css('background-color', '#dddddd');
    currentRoomSelected = e;
}

var tagsToReplace = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};

function replaceTag(tag) {
    return tagsToReplace[tag] || tag;
}

function safe_tags_replace(str) {
    return str.replace(/[&<>]/g, replaceTag);
}

function divContentElement(message) {
    return $('<div class="mg-item list-group-item"></div>').html(message);
}

function divSystemContentElement(message) {
    return $('<div class="mg-item list-group-item"></div>').html('<i>' + message + '</i>');
}

function stylizeUsername(message) {
    return '<span class="vUser">' + message + '</span>';
}

function processUserInput(chatApp, socket) {
    var message = $('#send-message').val();
    var systemMessage;

    if(message.charAt(0) == '/') {
        systemMessage = chatApp.processCommand(message);
        if(systemMessage) {
            $('#messages').append(divSystemContentElement(systemMessage));
        }
    } else {
        chatApp.sendMessage($('#address').text(), message);
        //console.log("address: " + $('#address').text());
        message = stylizeUsername(safe_tags_replace($('#username').val())) + ': ' + safe_tags_replace(message);
        $('#messages').append(divContentElement(message));
        $('#messages').scrollTop($('#messages').prop('scrollHeight'));
    }

    $('#send-message').val('');
}

function resetRoomList() {
    currentRoomSelected = null;
    socket.emit('rooms');
}

var socket = io.connect();

$(document).ready(function() {
    var chatApp = new Chat(socket);

    socket.emit('getMinPlayers');
    socket.on('getMinPlayers', function(minPlayers){
        currMinConn = minPlayers;
    });

    socket.emit('getSocketId');
    socket.on('getSocketId', function(sid) {
        currSockId = sid;
    });

    socket.emit('rooms'); // put one after user clicks cancel or join too
    socket.emit('nameAttempt', $('#username').text(), $('#avatar').prop('src'));

    socket.on('nameResult', function(result) {
        var message;

        if(result.success) {
            message = 'You are now known as ' + result.name + '.';
            $('#username').val(result.name);
        } else {
            message = result.message;
        }
        $('#messages').append(divSystemContentElement(message));
    });

    socket.on('joinResult', function(result) {
        $('#address').text(result.address);
        $('#room').html('You are currently in:&nbsp;<b>' + result.room + '</b>');
        $('#messages').append(divSystemContentElement('Room changed to ' + result.room + '.'));
    });

    socket.on('message', function (message) {
        var newElement = $('<div class="mg-item list-group-item"></div>').text(message.text);
        $('#messages').append(newElement);
        $('#messages').scrollTop($('#messages').prop('scrollHeight'));
    });

    socket.on('rooms', function(hostarray, namearray, nicknamearray) {
        $('#room-list').empty();

        $('#room-list').append(divRoomItem('Lobby <span style="display: none;">-1</span>'));

        for(var hostid in hostarray) {
            hostid = hostid.substring(1, hostid.length);
            if (hostid != '' && hostid != -1) {
                $('#room-list').append(divRoomItem(namearray[hostid] + ' (host: ' +
                    nicknamearray[hostid] + ') <span style="display: none;">' + hostid + '</span>'));
            }
        }

        $('#room-list div').click(function() {
            chatApp.processCommand('/join ' + $(this).text());
            $('#send-message').focus();
        });
    });

    /*
     I suspect listing the users should be something along these lines. More or less complex.
     */
    socket.on('users', function(sockarray, namearray, avatararray) {
        $('#user-list').empty();

        currPlayers = sockarray.length;

        for(var userid in sockarray) {
            if(userid != '') {

                console.log("user id: " + sockarray[userid]);

                $('#user-list').append(divContentElement('<img src="' + avatararray[sockarray[userid]] + '" />&nbsp;&nbsp;&nbsp;' +
                    namearray[sockarray[userid]]));
            }
        }
    });

    socket.on('updateRoomInfo', function(hostid) {
        currHostId = hostid;
        socket.emit('users');

        if(hostid == -1) {
            $('#leaveroom-btn').css('display', 'none');
            $('#leavegame-btn').css('display', 'none');
        } else {
            $('#leaveroom-btn').css('display', 'inline');
        }
    });

    // client-side in-game functionality goes here !!!
    socket.on('beginGame', function() {
        $('#startgame-btn').css('display', 'none');
        $('#leaveroom-btn').css('display', 'none');
        $('#leavegame-btn').css('display', 'inline');
    });

    socket.on('destroyRoom', function() {
        alert('The host has left the game.');
        chatApp.joinRoom(-1);
    });

    $('#send-message').focus();

    $('#send-form').submit(function() {
        processUserInput(chatApp, socket);
        return false;
    });

    $('#closeroom-btn').click(function() {
        resetRoomList();
    });

    $('#joinroom-btn').click(function() {
        if (currentRoomSelected == null) {
            alert('Must select a room to join');
        } else {
            var roomInfoArray = currentRoomSelected.split(" ");
            var hostid = roomInfoArray[roomInfoArray.length-1];
            chatApp.joinRoom(hostid);

            $('#lobby').modal('hide');
            resetRoomList();

            // if this player is the room host, kick everybody out
            if (currSockId == currHostId) {
                socket.emit('destroyRoom');
            }
        }
    });

    $('#createroom-btn').click(function()
    {
        var name = $('#room-name').val();
        var size = $('#room-size').val();

        if(name.length > 3 && name.length < 16){
            chatApp.createRoom(name, size);
            $('#err-roomname').text('Good!');
            $('#send-message').focus();

            $('#lobby').modal('hide');
            $('#createroom').modal('hide');
            resetRoomList();
        }
        else{
            $('#err-roomname').text('Must have 4-16 characters');
        }
    });

    $('#startgame-btn').click(function() {
        chatApp.startGame();
    });
    $('#leaveroom-btn-yes').click(function() {
        chatApp.joinRoom(-1);
        resetRoomList();

        // if this player is the room host, kick everybody out
        if (currSockId == currHostId) {
            socket.emit('destroyRoom');
        }
    });
    // when user leaves during a game in progress, the appropriate in-game logic should apply (discarded vote, dead, etc.)
    // same goes for disconnection during a game--the logic itself should probably be implemented in a new function
    // if a host leaves, the game presumably ends
    $('#leavegame-btn-yes').click(function() {
        chatApp.joinRoom(-1);
        resetRoomList();

        // if this player is the room host, kick everybody out
        if (currSockId == currHostId) {
            socket.emit('destroyRoom');
        }
    });

    setInterval(function() {
        console.log('current minimum: ' + currMinConn);
        console.log('currrent number of players: ' + currPlayers);

        if(currHostId != -1 && currSockId == currHostId) {
            if(currPlayers < currMinConn || currMinConn == null) {
                $('#startgame-btn').css('display', 'none');
            } else {
                $('#startgame-btn').css('display', 'inline');
            }
        }
    }, 1000);

});