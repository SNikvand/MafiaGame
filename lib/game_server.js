// latest version: 03/30/14
//      - validation in place: no blank messages can be sent
//      - 'start game', 'leave room' and 'leave game' (during a game) buttons created
//      - 'start game' only appears when minimum number of players have been met. does not appear in lobby, and
//         only appears to the host
//      - clicking 'leave room' sends the user back to the lobby after a yes/no modal. everything is updated accordingly
//      - clicking 'leave game' does the same thing atm, but it should be modified later so that game logic is adjusted properly
//        (i.e. discarded vote, dead player, etc.)
//      - clicking 'start game' actually starts the game (sends a 'beginGame' message to client), and sorts all
//        players to their given roles according to the game rules document (by Chris M. on Mar 28)
//      - roles are stored in a json object called playerRoles. example of what it looks like is provided beneath
//      - when a host leaves a room, an alert box pops up for every user, and everybody is kicked to the lobby
//      - same thing happens when host leaves a game (when the 'leave game' button is clicked). the game presumably ends, but
//        this should be modified slightly so that all game variables are properly discarded/deleted
//      - added 'this user has left' message whenever a player leaves a room. does not appear in lobby
//      - lobby now constantly displays in the room list, even if there are no users in it

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

// json object containing every user's current roles for every room
var playerRoles = {};
// ex. playerRoles = {hostid, hostid, hostid, ...}
//     playerRoles[hostid] = [{userid, role}, {userid, role}, ...]

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

        // sends list of rooms to populate 'room-lislocationst'
        socket.on('rooms', function() {
            socket.emit('rooms', io.sockets.manager.rooms, currentRoomName, nickNames);
        });

        // sends list of users and avatar urls to populate 'user-list'
        socket.on('users', function() {
            socket.emit('users', currentRoomPlayer[currentRoom[socket.id]], nickNames, currentAvatar);
        });

        socket.on('getMinPlayers', function() {
            socket.emit('getMinPlayers', minPlayers);
        });

        socket.on('getSocketId', function() {
            socket.emit('getSocketId', socket.id);
        });

        // if host has left the room
        socket.on('destroyRoom', function() {
            var roomSize = currentRoomPlayer[socket.id].length;

            // tell everybody else that the host has left
            // then moves all players to lobby
            socket.broadcast.to(socket.id).emit('destroyRoom');

            delete currentRoomName[socket.id];
            delete currentRoomLimit[socket.id];
            delete currentGameStarted[socket.id];

            currentRoomPlayer.splice(currentRoomPlayer.indexOf(socket.id), 1);
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

    usersock.emit('updateRoomInfo', hostid);
    usersock.broadcast.to(hostid).emit('updateRoomInfo', hostid);

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

        socket.emit('updateRoomInfo', -1);
        socket.broadcast.to(-1).emit('updateRoomInfo', -1);
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
            if (currentRoom[usersock.id] != -1) {
                usersock.broadcast.to(currentRoom[usersock.id]).emit('message', {
                    text: nickNames[usersock.id] + ' has left.'
                });
            }

            // removes user from previously occupied room
            currentRoomPlayer[currentRoom[usersock.id]].splice(currentRoomPlayer[currentRoom[usersock.id]].indexOf(usersock.id), 1);

            if (currentRoomPlayer[hostid].length == minPlayers) {
                usersock.emit('startOption'); // makes "start game" button available for host (client-side)
            }

            usersock.broadcast.to(currentRoom[usersock.id]).emit('updateRoomInfo', currentRoom[usersock.id]);

            // adds user to new desired room
            joinRoom(usersock, hostid);
            currentRoomPlayer[hostid].push(usersock.id);
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

        playerRoles[socket.id] = []; // no players initially, and no roles

        socket.leave(currentRoom[socket.id]);

        // removes user from previously occupied room
        currentRoomPlayer[currentRoom[socket.id]].splice(currentRoomPlayer[currentRoom[socket.id]].indexOf(socket.id), 1); // removes the player nickname from the room list

        socket.broadcast.to(currentRoom[socket.id]).emit('updateRoomInfo', currentRoom[socket.id]);

        // adds user to new desired room
        joinRoom(socket, socket.id);
        currentRoomPlayer[socket.id].push(socket.id); // adds the player nickname to the room list
    });

    socket.on('startGame', function() {
        currentGameStarted[socket.id] = 1;

        var playerList = currentRoomPlayer[socket.id]; // database function: fetches list of players based on host socket id (room)

        console.log("player list (before sorting): " + playerList.toString());

        playerList.sort(function () {
            return 0.5 - Math.random()
        });

        // randomly sorts the array
        // if the function returns less than 0, elem1 is less than elem2
        // if the function returns 0, elem1 and elem2 are equal (no sort)
        // if the function returns greater than 0, elem1 is greater than elem2

        console.log("player list (after sorting): " + playerList.toString());

        // player list in the specific game
        var counter = playerList.length;
        // variable to track amount of special role
        var mafia_player;
        var cop_player;
        var doctor_player;

        if (counter < 12) {
            //2 Mafia 2 cop  2-7 citizen
            mafia_player = 2;
            cop_player = 3;
            doctor_player = 4;
        }
        else if (counter > 11 && counter < 18) {
            // 3 Mafia 3 cop  6-11 citizen
            mafia_player = 3;
            cop_player = 5;
            doctor_player = 6;
        }
        else if (counter > 17) {
            // 4 Mafia 4 cop  rest citizen
            mafia_player = 4;
            cop_player = 6;
            doctor_player = 8;
        }

        for (var i = 0; i < playerList.length; i++) {
            if (i < mafia_player) {
                giveUserRole(socket.id, playerList[i], 'Mafia');
            }
            else if (i >= mafia_player && i < cop_player) {
                giveUserRole(socket.id, playerList[i], 'Cop');
            }
            else if (i >= cop_player && i < doctor_player) {
                giveUserRole(socket.id, playerList[i], 'Doctor');
            }
            else {
                giveUserRole(socket.id, playerList[i], 'Citizen');
            }
        }

        for(var x in playerRoles[socket.id]) {
            console.log("user: " + playerRoles[socket.id][x].uid + "   role: " + playerRoles[socket.id][x].role);
        }

        // broadcasts to all player clients (including the game owner) that the game will start
        socket.broadcast.to(socket.id).emit('message', {
            text: "Game Starting..."
        });
        // starts the game for all players
        socket.broadcast.to(socket.id).emit('beginGame');
    });
}

function giveUserRole(hostid, userid, role) {
    playerRoles[hostid].push({uid: userid, role: role});
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function() {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);

        // remove user from current room
        currentRoomPlayer[currentRoom[socket.id]].splice(currentRoomPlayer[currentRoom[socket.id]].indexOf(socket.id), 1);

        // update other users' lists for the current room
        socket.broadcast.to([currentRoom[socket.id]]).emit('updateRoomInfo', currentRoom[socket.id]);

        // nullify user information
        currentRoom[socket.id] = null;
        currentAvatar[socket.id] = null;

        // remove user and associated nickname
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}