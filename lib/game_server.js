var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var minPlayers = 6; // minimum number of players for any game. value can/should be changed later

// note: all the following arrays can and should theoretically be replaced by the database functions
// for the sake of efficiency
// there shouldn't be any need to store things locally when everything's in redis
// however, they're adequate in the moment for making things work
var currentRoom = {}; // the current room for all existing users
var currentRoomName = {}; // titles for all existing rooms
var currentRoomPlayer = [[]]; // list of players for all existing rooms
var currentRoomLimit = {}; // player limits for all existing rooms

// the lobby is not created, so we need to instantiate it ourselves
// the value of -1 is arbitrary, but chosen to avoid conflict
currentRoomName[-1] = 'Lobby';
currentRoomPlayer[-1] = [];

/*
 ***existing function***
 list of changes made (03/28/14):
    -added the handleCreateRoom() listener
    -on receiving 'users' message, now properly sends back the list of players for the current room
    -creates a user table in the database for the new user

 -Matt C
 */
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

        // creates a user table in database with the appropriate username and avatar
        socket.on('createUser', function(username, avatarsrc) {
            // dbaccess.createUserDatabase(username, socket.id, avatarsrc);
        });

        // sends the list of rooms (host socket ids) and their names to populate the room list
        socket.on('rooms', function() {
            socket.emit('rooms', io.sockets.manager.rooms, currentRoomName);
        });

        // sends the list of users and avatars to populate the user list for this current room
        socket.on('users', function() {
            // use the uncommented function for the time being -- switch to database functions when
            // dbaccess is confirmed to perform 100% correctly and in sync with this file

            // playerList = dbaccess.getPlayerList(currentRoom[socket.id]);
            // playerAvatarList = dbaccess.getPlayerAvatars(currentRoom[socket.id]);
            // ^not yet implemented as of this writing
            // socket.emit('users', playerList, playerAvatarList)); <-- the client uses this to populate the user list

            socket.emit('users', currentRoomPlayer[currentRoom[socket.id]]); // sends only player list, not avatars
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
    console.log("Room: " + currentRoomName[hostid] + ".   Size: " + currentRoomLimit[hostid]);

    usersock.join(hostid);
    currentRoom[usersock.id] = hostid;
    var room = currentRoomName[hostid];

    // dbaccess.updateUserRoom(hostid, usersock); // database function: updates user's current room
    // ^not yet implemented as of this writing

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

/*
 ***existing function***
 03/28/14 - this function is largely obsolete to be honest, because a user can't
 change their nickname anyway. However, since this is where their chosen nickname
 is "assigned" to them, I only push their nickname to the lobby's list of names
 on line 154.

 -Matt C
 */
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

                currentRoomPlayer[-1].push(nickNames[socket.id]);
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

        if (currentRoomPlayer[hostid].length < currentRoomLimit[hostid]) { // if number of players is less than max
            usersock.leave(currentRoom[usersock.id]);
            // dbaccess.removeUserFromRoom(currentRoom[usersock.id], usersock.id); // database function: removes user from current room
            currentRoomPlayer[currentRoom[usersock.id]].splice(currentRoomPlayer[currentRoom[usersock.id]].indexOf(nickNames[usersock.id]), 1); // removes the player nickname from the room list
            joinRoom(usersock, hostid); // adds user to new room
            currentRoomPlayer[hostid].push(nickNames[usersock.id]); // adds the player nickname to the room list

            if (currentRoomPlayer[hostid].length == minPlayers) { // if minimum number of players has been reached
                // dbaccess.addUserToRoom(hostid, usersock.id); // database function: adds user to room
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
        currentRoomPlayer[socket.id] = []; // the initially created room is an empty array of players (joinRoom() adds the owner)
        currentRoomLimit[socket.id] = room.newSize;

        socket.leave(currentRoom[socket.id]);
        // dbaccess.removeUserFromRoom(currentRoom[socket.id], socket.id);
        currentRoomPlayer[currentRoom[socket.id]].splice(currentRoomPlayer[currentRoom[socket.id]].indexOf(nickNames[socket.id]), 1); // removes the player nickname from the room list
        joinRoom(socket, socket.id);
        currentRoomPlayer[socket.id].push(nickNames[socket.id]); // adds the player nickname to the room list

        // dbaccess.createRoomDatabase(room.newRoom, room.newSize, socket.id); // database function: create a room in the database
    });

    socket.on('startGame', function() {
        // dbaccess.startGame(socket.id); // database function: sets the game's status to playing

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
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function() {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];

        // dbaccess.removeUserFromRoom(currentRoom[socket.id], socket.id); // database function: removes user from current room
        // dbaccess.deletePlayerDB(socket.id); // database function: deletes user from database
    });
}