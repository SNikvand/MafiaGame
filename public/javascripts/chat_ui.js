function divEscapedContentElement(message) {
    return $('<div class="mg-item list-group-item"></div>').text(message);
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
        chatApp.sendMessage($('#room').text(), message);
        message = stylizeUsername(safe_tags_replace($('#username').val())) + ': ' + safe_tags_replace(message);
        $('#messages').append(divContentElement(message));
        $('#messages').scrollTop($('#messages').prop('scrollHeight'));


    }

    $('#send-message').val('');
}

var socket = io.connect();

$(document).ready(function() {
    var chatApp = new Chat(socket);
    socket.emit('nameAttempt', $('#username').text());
    socket.emit('createUser', $('#username').text(), $('#avatar').prop('src'));

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
        $('#room').html('You are currently in:&nbsp;<b>' + result.room + '</b>');
        $('#messages').append(divSystemContentElement('Room changed.'));
    });

    socket.on('message', function (message) {
        var newElement = $('<div class="mg-item list-group-item"></div>').text(message.text);
        $('#messages').append(newElement);
        $('#messages').scrollTop($('#messages').prop('scrollHeight'));
    });

    socket.on('rooms', function(hostarray, namearray) {
        $('#room-list').empty();

        for(var hostid in hostarray) {
            hostid = hostid.substring(1, hostid.length);
            if(hostid != '') {
               $('#room-list').append(divEscapedContentElement(namearray[hostid] + ' ' +
                   hostid));
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
    socket.on('users', function(data) {
        $('#user-list').empty();

        // for the time being, this only prints the usernames
        // once the database implementation is complete, the server can send over the avatar urls to display
        // along with these nicknames
        for(var user in data) {
            if(user != '') {
                $('#user-list').append(divContentElement(data[user]));
            }
        }
    });

    setInterval(function() {
       socket.emit('rooms');
       socket.emit('users');
    }, 1000);

    $('#send-message').focus();

    $('#send-form').submit(function() {
        processUserInput(chatApp, socket);
        return false;
    });

    $('#createroom-btn').click(function()
    {
        var name = $('#room-name').val();
        var size = $('#room-size').val();

        if(name.length > 3 && name.length < 16){
            chatApp.createRoom(name, size);
            $('#err-roomname').text('Good!');
            $('#send-message').focus();
        }
        else{
            $('#err-roomname').text('Must have 4-16 characters');
        }
    });
});