client.on("error", function(err)
{
    console.log("error " + err);
});

/*--------------------------------------------------------------------------------
 Purpose: Takes in room name, maximum # of user, and the host socket id and creates a database entry for a room.
 A entry is created by giving the entry a database entry name of "room:HOSTSOCKETID" using a hashmap, meaning
 information is being stored by key, field, value, field, value,....,....,...., function.
 the function just does error checking and see if the entry is successfully committed.

 Return Data: returns 0 if database is successfully created.
 returns -1 if database failed to create database.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014.

 Version: 2

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.createRoomDB = function(roomName, maxUsers, hostSockId)
{
    client.hmset
    (
            "room:" + hostSockId    , "Game Name"   , roomName
        , "Min"         , 6
        , "Max"         , parseInt(maxUsers)
        , "Current"     , 1
        , "Creator"     , "user:" + hostSockId
        , "Townsfolk"   , '{"townsFolk": [{"PlayerId": ""}]}'
        , "Mafia"       , '{"mafia": [{"PlayerId": ""}]}'
        , "Police"      , '{"police": [{"PlayerId": ""}]}'
        , "Dead"        , '{"dead": [{"PlayerId": ""}]}'
        , "ListAll"     , '{"allUsers": [{"PlayerId": "' + hostSockId + '"}]}'
        , "Status"      , 0
        ,function(err, result)
        {
            if(err)
                throw err;
            return 0;
        }
    );
    return (-1);
};

/*--------------------------------------------------------------------------------
 Purpose: Takes in a host socket id to determine which room to add to.
 Takes in user socket id that needs to be added to room list.
 Checks if the room exist, gets the max # of players in room, and current # of players.
 If the current player is less then max, current is incremented on database side.
 Grabs the list of all players in the room. currently, it modifies the string, but this can be changed to modify
 json object for better functionality. if not string modification, it turns it into a json object, modifies json
 element, and turns it back into a string and commits the string back to the database.

 Return Data: returns 0 if the user is successfully parsed and added to the database.
 returns -1 if database entry does not exist or if room is maxed out.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014

 Version: 2.0

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.addUserToRoom = function(hostSockId, userSockId)
{
    client.hexists("room:" + hostSockId, "Game Name", function(err, exist)
    {
        if(err)
            throw err;
        if(exist)
        {
            client.hget("room:" + hostSockId, "Max", function(err, gameMax)
            {
                if(err)
                    throw err;
                client.hget("room:" + hostSockId, "Current", function(err, gameCurrent)
                {
                    if(parseInt(gameCurrent) < parseInt(gameMax))
                    {
                        // increment current player value
                        client.hincrby("room:" + hostSockId, "Current", 1, function(err, obj)
                        {
                            if(err)
                                throw err;
                        });
                        //grabs player list
                        client.hget("room:" + hostSockId, "ListAll", function(err, list)
                        {
                            //grabs json string, and modifies it so the new player is appended to list.
                            var stringTemp;
                            stringTemp = list;
                            var insertName = ',{"PlayerId": "' + userSockId + '"}';
                            var position = stringTemp.length-2;
                            var output = [stringTemp.slice(0, position), insertName, stringTemp.slice(position)].join('');
                            var jsonTemp = JSON.parse(output);
                            var jsonString = JSON.stringify(jsonTemp);

                            //update new list of players
                            client.hset("room:" + hostSockId, "ListAll", jsonString, function(err, newList)
                            {
                                if(err)
                                    throw err;
                                return 0;
                            });
                        });
                    }
                    else
                    {
                        return (-1);
                    }
                });
                //if there is room available
                //add user to room
                //return true to say that the user is added
                //NOTE: the actual subscription is done elsewhere
                //return false
            });
        }
        else
        {
            return (-1);
        }
        //return false
    });
};

/*--------------------------------------------------------------------------------
 Purpose: Takes in player name and the user socket id and creates a database entry for a player.
 A entry is created by giving the entry a database entry name of "Player:USERSOCKETID" using a hashmap, meaning
 information is being stored by key, field, value, field, value,....,....,...., function.
 the function just does error checking and see if the entry is successfully committed.

 Return Data: returns 0 if database is successfully created.
 returns -1 if database failed to create database.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014.

 Version: 2

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.createUserDatabase = function(username, userSock, avatar)
{
    client.hmset
    (
            "Player:" + userSock    , "Username"        , username
        , "Avatar"          , avatar
        , "Current Room"    , ""
        ,function(err, result)
        {
            if(err)
                throw err;
            return 0;
        }
    );
    return (-1);

};

/*--------------------------------------------------------------------------------
 Purpose: Deletes a room entry from database.
 Takes in a host socket id and deletes a room with the same id, there is no verification process.
 when deleting, it checks if it deletes properly or not.

 Return Data: return 0 if delete was successful
 return -1 if anything but delete.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014

 Version: 2.0

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.deleteRoomDB = function(hostSockId)
{
    client.del("room:" + hostSockId, function(err, result)
    {
        if(err)
            throw err;
        if(result > 0)
        {
            return 0;
        }
        else
        {
            return (-1);
        }
    });
};

/*--------------------------------------------------------------------------------
 Purpose: Deletes a User entry from database.
 Takes in a User socket id and deletes a user with the same id, there is no verification process.
 when deleting, it checks if it deletes properly or not.

 Return Data: return 0 if delete was successful
 return -1 if anything but delete.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014

 Version: 2.0

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.deletePlayerDB = function(userSockId)
{
    client.del("Player:" + userSockId, function(err, result)
    {
        if(err)
            throw err;
        if(result > 0)
        {
            return 0;
        }
        else
        {
            return (-1);
        }
    });
};

/*--------------------------------------------------------------------------------
 Purpose:

 Return Data:

 Created by:
 Data / Modified:

 Version:

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.getPlayerList = function(hostSockId)
{
    var playerArray = new Array();
    client.hexists("room:" + hostSockId, "ListAll", function(err, exist)
    {
        if(exist)
        {
            client.hget("room:" + hostSockId, "ListAll", function(err, playerList)
            {
                var temp = JSON.parse(playerList);
                for(var inc = 0; inc < parseInt(temp.allUsers.length); inc++)
                {
                    playerArray[inc] = temp.allUsers[inc].PlayerId;
                }
                return playerArray;
            });
        }
        else
        {
            return (-1);
        }
    });
    return (-1);
};

/*--------------------------------------------------------------------------------
 Purpose: Assigns a specific role to a specific user id in a particular room, by passing in a host sock id for a room
 an user sock id and the role you want to assign to it.
 The function checks if a entry of the room and role exist, if it does not, it terminates the function. If the
 entry exist, it grabs a list of everyone in the roles in a json string format. It then parses the string into
 a json object and assigns a check depending on the role, the check is used to check if the first element in
 the json object is a legit entry or blank.
 if the first entry is a blank entry, it initializes the first element in a different manner than if it is adding
 to the json object.
 if it isnt the first entry, it adds a json object onto the end of the list, the json object is then turned into
 a string and committed back to the database.

 Return Data: return -1 if the role assigning is failed.
 return 0 if user is successfully assigned a role.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014

 Version: 2.0

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.giveUserRole = function(hostSockId, userSockId, role)
{
    client.hexists("room:" + hostSockId, role, function(err, exist)
    {
        if(err)
            throw err;
        if(exist)
        {
            client.hget("room:" + hostSockId, role, function(err, roleList)
            {
                var jsonParse = JSON.parse(roleList);
                var check;
                if(err)
                    throw err;

                if(role == "TownsFolk")
                {
                    check = jsonParse.townsFolk[0].PlayerId;
                }
                else if(role == "Police")
                {
                    check = jsonParse.police[0].PlayerId;
                }
                else if(role == "Dead")
                {
                    check = jsonParse.dead[0].PlayerId;
                }
                else if(role == "Mafia")
                {
                    check = jsonParse.mafia[0].PlayerId;
                }

                if(check == "")
                {
                    var lowerCaseRole = role.toLowerCase();
                    var roleEnter = '{"' + lowerCaseRole + '": [{"PlayerId": "' + userSockId + '"}]}';
                    client.hset("room:" + hostSockId, role, roleEnter, function(err, obj)
                    {
                        if(err)
                            throw err;
                        else
                        {
                            return (-1);
                        }
                    });
                }
                else
                {
                    var stringTemp = roleList;
                    var insertName = ',{"PlayerId": "' + userSockId + '"}';
                    var position = stringTemp.length-2;
                    var output = [stringTemp.slice(0, position), insertName, stringTemp.slice(position)].join('');

                    client.hset("room:" + hostSockId, role, output, function(err, newList)
                    {
                        if(err)
                            throw err;
                        else
                        {
                            return 0;
                        }
                    });
                }
            });
        }
        else
        {
            return (-1);
        }
    });
    return (-1);
};

/*--------------------------------------------------------------------------------
 Purpose: The function gets the status of the game for the specific room. takes in the host socket id and accesses the
 database to see if the room has a status of 0 or 1 if it is 1 then it means the game has started, 0 if it has not.

 Return Data: return 0 if game has not started.
 return 1 if the game has started.

 Created by: Christopher Lee
 Data / Modified: March 29, 2014

 Version: 2.0

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.gameHasStarted = function(hostSockId)
{
    client.hexist("room:" + hostSockId, "Status", function(err, exist)
    {
        if(err)
            throw err;
        if(exist)
        {
            client.hget("room:" + hostSockId, "Status", function(err, gameStatus)
            {
                if(err)
                    throw err;
                if(parseInt(gameStatus) == 0)
                {
                    console.log("Game has not started.")
                    return 0;
                }
                else if(parseInt(gameStatus) == 1)
                {
                    console.log("Game has begun.");
                    return 1;
                }
            });
        }
        else
        {
            return (-1);
        }
    });
    return (-1);
};

/*--------------------------------------------------------------------------------
 Purpose:

 Return Data:

 Created by:
 Data / Modified:

 Version:

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.startGame = function(hostSockId)
{
    client.hexists("room:" + hostSockId, "Status", function(err, exist)
    {
        if(err)
            throw err;
        if(exist)
        {
            client.hset("room:" + hostSockId, "Status", 1, function(err, obj)
            {
                if(err)
                    throw err;
                return 0;
            });
        }
    });
    return (-1);
};

/*--------------------------------------------------------------------------------
 Purpose:

 Return Data:

 Created by:
 Data / Modified:

 Version:

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.removeUserFromRoom = function(hostSockId, userSockId)
{
    if(hostSockId == userSockId)
    {
        client.del("room:" + hostSockId);
        return 0;
    }
    else
    {
        var doesUserExist = 0;
        client.hexists("room:" + hostSockId, "ListAll", function(err, exist)
        {
            if(err)
                throw err;
            if(exist)
            {
                client.hget("room:" + hostSockId, "ListAll", function(err, userList)
                {
                    if(err)
                        throw err;
                    var jsonParse = JSON.parse(userList);
                    var listSize;
                    var jsonString;
                    for(var inc = 0; inc < (listSize = parseInt(jsonParse.allUsers.length));inc ++)
                    {
                        var temp = jsonParse.allUsers[inc].PlayerId;
                        var compare = userSockId;
                        if(compare == temp)
                        {
                            jsonParse.allUsers.splice(inc,1);
                            inc--;
                            listSize--;
                            doesUserExist = 1;
                        }
                    }
                    if(doesUserExist)
                    {
                        client.hincrby("room:" + hostSockId, "Current", (-1), function(err, newCurr)
                        {
                            if(err)
                                throw err;
                        });
                    }
                    else
                    {
                        return (-1);
                    }
                    jsonString = JSON.stringify(jsonParse);
                    client.hset("room:" + hostSockId, "ListAll", jsonString, function(err, newList)
                    {
                        if(err)
                            throw err;
                        return 0;
                    });
                });
            }
            else
            {
                return (-1);
            }
        });
    }
};

/*--------------------------------------------------------------------------------
 Purpose:

 Return Data:

 Created by:
 Data / Modified:

 Version:

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.getUserInfoInRoom = function(hostSockId, info)
{
    var playerSockArray = new Array();
    var playerAvatarArray = new Array();
    var playerNameArray = new Array();
    client.hexists("room:" + hostSockId, "ListAll", function(err, exist)
    {
        if(exist)
        {
            client.hget("room:" + hostSockId, "ListAll", function(err, playerList)
            {
                var temp = JSON.parse(playerList);
                for(var inc = 0; inc < parseInt(temp.allUsers.length); inc++)
                {
                    playerArray[inc] = temp.allUsers[inc].PlayerId;
                    client.hexists("Player:" + playerArray[inc], info, function(err, playerExist)
                    {
                        if(err)
                            throw err;
                        if(playerExist)
                        {
                            if(info == 'username')
                            {
                                client.hget("Player:" + playerArray[inc], "Username", function(err, name)
                                {
                                    if(err)
                                        throw err;
                                    playerNameArray[inc] = name;
                                });
                            }
                            if(info == 'avatar')
                            {
                                client.hget("Player:" + playerArray[inc], "Avatar", function(err, picture)
                                {
                                    if(err)
                                        throw err;
                                    playerAvatarArray[inc] = picture;
                                });
                            }
                        }
                        else
                        {
                            return (-1);
                        }
                    });
                }

                if(info == 'socket')
                {
                    return playerSockArray;
                }
                if(info == 'avatar')
                {
                    return playerSockArray;
                }
                if(info == 'username')
                {
                    return playerNameArray;
                }
            });
        }
        else
        {
            return (-1);
        }
    });
};

/*--------------------------------------------------------------------------------
 Purpose:

 Return Data:

 Created by:
 Data / Modified:

 Version:

 Peer Reviewed By:
 -------------------------------------------------------------------------------*/
exports.getRoleList = function(hostSockId, role, arrayType)
{
    var roleArraySock = new Array();
    var roleArrayName = new Array();
    client.hexists("room:" + hostSockId, role, function(err, exist)
    {
        if(err)
            throw err;
        if(exist)
        {
            client.hget("room:" + hostSockId, role, function(err, roleList)
            {
                var json = JSON.parse(roleList);
                var inc = 0;
                switch(roleList)
                {
                    case "Mafia":
                        for(inc = 0; inc < parseInt(json.mafia.length); inc++)
                        {
                            roleArraySock[inc] = json.mafia[inc].PlayerId;
                            client.hexists("Player:" + json.mafia[inc].PlayerId, "Username", function(err, roleExists)
                            {
                                if(err)
                                    throw err;
                                if(roleExists)
                                {
                                    client.hget("Player:" + json.mafia[inc].PlayerId, "Username", function(err, name)
                                    {
                                        roleArrayName[inc] = name;
                                    });
                                }
                                else
                                {
                                    return (-1);
                                }
                            });
                        }
                        break;
                    case "Dead":
                        for(inc = 0; inc < parseInt(json.dead.length); inc++)
                        {
                            roleArraySock[inc] = json.dead[inc].PlayerId;
                            client.hexists("Player:" + json.dead[inc].PlayerId, "Username", function(err, roleExists)
                            {
                                if(err)
                                    throw err;
                                if(roleExists)
                                {
                                    client.hget("Player:" + json.dead[inc].PlayerId, "Username", function(err, name)
                                    {
                                        roleArrayName[inc] = name;
                                    });
                                }
                                else
                                {
                                    return (-1);
                                }
                            });
                        }
                        break;
                    case "TownsFolk":
                        for(inc = 0; inc < parseInt(json.townsFolk.length); inc++)
                        {
                            roleArraySock[inc] = json.townsFolk[inc].PlayerId;
                            client.hexists("Player:" + json.townsFolk[inc].PlayerId, "Username", function(err, roleExists)
                            {
                                if(err)
                                    throw err;
                                if(roleExists)
                                {
                                    client.hget("Player:" + json.townsFolk[inc].PlayerId, "Username", function(err, name)
                                    {
                                        roleArrayName[inc] = name;
                                    });
                                }
                                else
                                {
                                    return (-1);
                                }
                            });
                        }
                        break;
                    case "Police":
                        for(inc = 0; inc < parseInt(json.police.length); inc++)
                        {
                            roleArraySock[inc] = json.police[inc].PlayerId;
                            client.hexists("Player:" + json.police[inc].PlayerId, "Username", function(err, roleExists)
                            {
                                if(err)
                                    throw err;
                                if(roleExists)
                                {
                                    client.hget("Player:" + json.police[inc].PlayerId, "Username", function(err, name)
                                    {
                                        roleArrayName[inc] = name;
                                    });
                                }
                                else
                                {
                                    return (-1);
                                }
                            });
                        }
                        break;
                }
            });
            if(arrayType == "socket")
            {
                return roleArraySock;
            }
            if(arrayType == "username")
            {
                return roleArrayName;
            }
        }
        else
        {
            return (-1);
        }
    });
};