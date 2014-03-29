client.on("error", function(err)
{
    console.log("error " + err);
});

//Creates database per room
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

//{"mafia":[{"name":"shahin","socket":"89sd7f98sd"},{"name":"chris","socket":"sd8f7sdf"}]}
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

//Creates database per player.
exports.createUserDatabase = function(username, userSock, avatar)
{
    client.hmset
    (
            "Player:" + userSock    , "Username"        , username
        , "Avatar"          , avatar
        , "Current Room"    , ""
    );
};

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

exports.getRoleList = function(hostSockId, role)
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
            return roleArraySock;
            // or return roleArrayName;
        }
        else
        {
            return (-1);
        }
    });
};