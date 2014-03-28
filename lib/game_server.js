var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];

var currentRoom = {}; // the current room for all existing users
var currentRoomName = {}; // titles for all existing rooms
var currentRoomCount = {}; // number of players for all existing rooms
var currentRoomLimit = {}; // player limits for all existing rooms
var minPlayers = 6; // minimum number of players for any game. value can/should be changed later

currentRoomName[-1] = 'Lobby';

exports.listen = function(server) {
    io = socketio.listen(server);
    io.set('log level', 1);
    io.sockets.on('connection', function(socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        joinRoom(socket, -1); // joins lobby

        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        handleCreateRoom(socket);

        socket.on('rooms', function() {
            socket.emit('rooms', io.sockets.manager.rooms);
        });

        /*
        Not working. But it should be something along these lines. backend should figure this out.
         */
        socket.on('users', function() {
            socket.emit('users', io.sockets.clients('lobby'));
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

/*
 ***existing function***
 list of changes made (03/27/14):
    -the 'room' parameter is now the host socket id, because rooms are distinguished by
        host socket ids
    -instead, the room title is stored inside a global array (currentRoomName) containing
        room names for all existing rooms (with host ids acting as keys)
    -upon user join, the chat now displays both the room title and associated host nickname
    -includes database function to update user's current room in the redis database

 -Matt C
*/
function joinRoom(usersock, hostid) {
    usersock.join(hostid);
    currentRoom[usersock.id] = hostid;
    currentRoomCount[hostid] += 1; // increments number of players by 1
    var room = currentRoomName[hostid];

    updateUserRoom(hostid, usersock); // database function: updates user's current room

    usersock.emit('joinResult', {room: room});
    usersock.broadcast.to(room).emit('message', {
        text: nickNames[usersock.id] + ' has joined ' + room +
            '(' + nickNames[hostid] + ')'
    });

    var usersInRoom = io.sockets.clients(hostid);
    if(usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in ' + room + '(' + nickNames[hostid] + '): ';
        for(var index in usersInRoom) {
            if (usersInRoom.hasOwnProperty(index)) {
                var userSocketId = usersInRoom[index].id;
                if (userSocketId != usersock.id) {
                    if (index > 0) {
                        usersInRoomSummary += ', ';
                    }
                    usersInRoomSummary += nickNames[userSocketId];
                }
            }
        }
        usersInRoomSummary += '.';
        usersock.emit('message', {text: usersInRoomSummary});
    }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function(name) {
        if(name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Names cannot being with "Guest".'
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
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
            } else {
                socket.emit('nameResult', {
                    success: false,
                    message: 'That name is already in use.'
                });
            }
        }
    });
}

function handleMessageBroadcasting(socket) {
    socket.on('message', function(message) {
        socket.broadcast.to(message.room).emit('message', {
            text:nickNames[socket.id] + ': ' + message.text
        });
    });
}

/*
 ***existing function***
 list of changes made (03/27/14):
    -constantly tracks number of players in room
        -if max players reached, game cannot be joined
        -if min players reached, owner is given option to start game (emits 'startOption' message)
        -compatible with the updated joinRoom() above, because it distinguishes rooms by host id, not room title
        -in fact, the room title plays absolutely no role here--it is only a concern in handleCreateRoom() (below)

 -Matt C
*/
function handleRoomJoining(usersock) {
    usersock.on('joinGame', function(hostid) {
        if (gameHasStarted(hostid) == '1') {
            usersock.emit('message', {text: 'Game is already in progress.'});
            return;
        }

        if (currentRoomCount[hostid] < currentRoomLimit[hostid]) { // if number of players is less than max
            usersock.leave(currentRoom[usersock.id]);
            dbaccess.removeUserFromRoom(currentRoom[usersock.id], usersock.id); // database function: removes user from current room
            joinRoom(usersock, hostid); // adds user to new room

            if (currentRoomCount[hostid] == minPlayers) { // if minimum number of players has been reached
                dbaccess.addUserToRoom(hostid, usersock.id); // database function: adds user to room
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
    socket.on('createGame', function(room, size) {
        currentRoomName[socket.id] = room.newRoom;
        currentRoomCount[socket.id] = 0; // initially, there are no players. joinRoom() increments to 1 (the owner)
        currentRoomLimit[socket.id] = size;

        socket.leave(currentRoom[socket.id]);
        dbaccess.removeUserFromRoom(currentRoom[socket.id], socket.id);
        joinRoom(socket.id, socket.id);

        dbaccess.createRoomDatabase(room.newRoom, size, socket.id); // database function: create a room in the database
    });

    socket.on('startGame', function() {
        dbaccess.startGame(socket.id); // database function: sets the game's status to playing

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
                    dbaccess.giveUserRole(socket.id, playerList[i], 'Mafia'); // database function: store this player as a mafia role
                    break;
                case 2:
                    dbaccess.giveUserRole(socket.id, playerList[i], 'TownsFolk'); // database function: store this player as a civilian role
                    break;
                case 3:
                    dbaccess.giveUserRole(socket.id, playerList[i], 'Police'); // database function: store this player as a policeman role
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
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function() {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];

        dbaccess.removeUserFromRoom(currentRoom[socket.id], socket.id); // database function: removes user from current room
        dbaccess.deletePlayerDB(socket.id); // database function: deletes user from database
    });
}