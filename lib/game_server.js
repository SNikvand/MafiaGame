// latest version: 03/29/14 - clean up of comments/disintegration with the database
// note: for now, everything is stored locally. this is for the sake of moving things forward
// however, in the end, for efficiency we will integrate all database functions with the game server
// and the program should work just the same

var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {}; // all nicknames for each room
var namesUsed = []; // all nicknames in the entire app--used for enforcing uniqueness
var minPlayers = 6; // minimum number of players for a game

// user-related info
var currentRoom = {};         // all players' current rooms (keyed by user sockid)
var currentAvatar = {};       // all players' avatar urls

// room-related info
var currentRoomName = {};     // all room titles (keyed by hostid)
var currentRoomPlayer = [[]]; // all players for each room
var currentRoomLimit = {};    // all room player limits (keyed by hostid)
var currentGameStarted = {};  // all room 'states' (game started or not)

// lobby-related info
// hostid is arbitrary, and is set to -1 to avoid conflict
currentRoomName[-1] = 'Lobby';
currentRoomPlayer[-1] = [];
currentRoomLimit[-1] = 9999;

exports.listen = function(server) {
    io = socketio.listen(server);
    io.set('log level', 1);
    io.sockets.on('connection', function(socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        joinRoom(socket, -1); // player joins lobby

        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        handleCreateRoom(socket);

        // sends list of rooms to populate 'room-list'
        socket.on('rooms', function() {
            socket.emit('rooms', io.sockets.manager.rooms, currentRoomName, nickNames);
        });

        // sends list of users and avatar urls to populate 'user-list'
        socket.on('users', function() {
            socket.emit('users', currentRoomPlayer[currentRoom[socket.id]], nickNames, currentAvatar);
        });

        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};


function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;
    /*
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    */
    namesUsed.push(name);
    return guestNumber + 1;
}

function joinRoom(usersock, hostid) {
    console.log("Room: " + currentRoomName[hostid] + ".   Size: " + currentRoomLimit[hostid]);

    usersock.join(hostid);
    currentRoom[usersock.id] = hostid;
    var room = currentRoomName[hostid];

    usersock.emit('joinResult', {room: room, address: hostid});
    usersock.broadcast.to(hostid).emit('message', {
        text: nickNames[usersock.id] + ' has joined ' + room + '.'
    });

    var usersInRoom = io.sockets.clients(hostid);
    if(usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in ' + room + ': ';
        for(var index in usersInRoom) {
            var userSocketId = usersInRoom[index].id;
            if (userSocketId != usersock.id) {
                if (index > 0) {
                    usersInRoomSummary += ', ';
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        usersInRoomSummary += '.';
        usersock.emit('message', {text: usersInRoomSummary});
    }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function(name, avatar) {
        currentAvatar[socket.id] = avatar;

        while(namesUsed.indexOf(name) != -1) {
            //if duplicate, assign a random number 0-9999 and append to the end
            name = name + parseInt(Math.random() * 10000);
            socket.emit('nameResult', {
                success: false,
                message: 'That name is already in use. Attempting new Name Change...'
            });
        }
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        namesUsed.push(name);
        nickNames[socket.id] = name;

        delete namesUsed[previousNameIndex];
        socket.emit('nameResult', {
            success: true,
            name: name
        });
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
            text: previousName + ' is now known as ' + name + '.'
        });
        currentRoomPlayer[-1].push(socket.id);
    });
}

function handleMessageBroadcasting(socket) {
    socket.on('message', function(message) {
        socket.broadcast.to(message.room).emit('message', {
            text:nickNames[socket.id] + ': ' + message.text
        });
    });
}

function handleRoomJoining(usersock) {
    usersock.on('joinGame', function(hostid) {
        if (currentGameStarted[hostid] == 1) {
            usersock.emit('message', {text: 'Game is already in progress.'});
            return;
        }

        if (currentRoomPlayer[hostid].length < currentRoomLimit[hostid]) { // if number of players is less than max
            usersock.leave(currentRoom[usersock.id]);

            // removes user from previously occupied room
            currentRoomPlayer[currentRoom[usersock.id]].splice(currentRoomPlayer[currentRoom[usersock.id]].indexOf(usersock.id), 1);

            // adds user to new desired room
            joinRoom(usersock, hostid);
            currentRoomPlayer[hostid].push(usersock.id);

            if (currentRoomPlayer[hostid].length == minPlayers) {
                usersock.emit('startOption'); // makes "start game" button available for host (client-side)
            }
        } else {
            usersock.emit('message', {text: 'Max number of players has been reached.'});
        }
    });
}

/*
 --------------------------------------------------------------------------------
 purpose: Creates a room when message 'createGame' is received from client,
 resulting from a user clicking the "Create Game" button and sending the
 necessary information: room title and preset player limit. The server calls
 a database function 'createRoomDatabase()' to store the room title, player limit
 and host socket id into the database.

 When the message 'startGame' is received from client, this function fetches the
 list of players for this room and shuffles them, then randomly assigns each of
 them to one of four different roles for the game. Then it broadcasts a
 'beginGame' message to all players signifying that the game can start.

 created by: Matthew Chan
 date/modified: 03/27

 version: 1

 peer reviewed by: none yet
 -------------------------------------------------------------------------------
*/
function handleCreateRoom(socket) {
    socket.on('createGame', function(room) {
        currentRoomName[socket.id] = room.newRoom;
        currentRoomPlayer[socket.id] = []; // initially empty--joinRoom() adds owner to room
        currentRoomLimit[socket.id] = room.newSize;
        currentGameStarted[socket.id] = 0; // initially, game is not started

        socket.leave(currentRoom[socket.id]);

        // removes user from previously occupied room
        currentRoomPlayer[currentRoom[socket.id]].splice(currentRoomPlayer[currentRoom[socket.id]].indexOf(socket.id), 1); // removes the player nickname from the room list

        // adds user to new desired room
        joinRoom(socket, socket.id);
        currentRoomPlayer[socket.id].push(socket.id); // adds the player nickname to the room list
    });

    // ALGORITHM NEEDS TO BE CHANGED!!!
    /*socket.on('startGame', function() {
        currentGameStarted[socket.id] = 1;

        var playerList = dbaccess.getPlayerList(socket.id); // database function: fetches list of players based on host socket id (room)

        playerList.sort(function() {return 0.5 - Math.random()}); // randomly sorts the array
        // if the function returns less than 0, elem1 is less than elem2
        // if the function returns 0, elem1 and elem2 are equal (no sort)
        // if the function returns greater than 0, elem1 is greater than elem2

        // this for-loop assigns each player a role in the game
        // this section can/should be edited later depending on the roles involved in the actual game
        var counter = 1;
        for (var i = 0; i < playerList.length; i++) {
            switch(counter) {
                case 1:
                    // dbaccess.giveUserRole(socket.id, playerList[i], 'Mafia'); // database function: store this player as a mafia role
                    break;
                case 2:
                    // dbaccess.giveUserRole(socket.id, playerList[i], 'TownsFolk'); // database function: store this player as a civilian role
                    break;
                case 3:
                    // dbaccess.giveUserRole(socket.id, playerList[i], 'Police'); // database function: store this player as a policeman role
                    break;
            }

            // counter allows for-loop to cycle through different role assignments
            // a better algorithm should likely be made later to replace this one, as this implementation may be rough and/or ineffective
            if (counter == 3) {
                counter = 1;
            } else {
                counter += 1;
            }
        }

        // broadcasts to all player clients (including the game owner) that the game will start
        // not sure if this is how it's done. syntax or logical errors may ensue
        socket.broadcast.to(currentRoom[socket.id]).emit('beginGame', {
            text:"Game Starting..."
        });
    });*/
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function() {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);

        // remove user from current room
        currentRoomPlayer[currentRoom[socket.id]].splice(currentRoomPlayer[currentRoom[socket.id]].indexOf(socket.id), 1);

        // remove user and associated nickname
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}