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
    );
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
                            console.log("current: " + obj);
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
                            //console.log(jsonTemp);

                           //update new list of players
                           client.hset("room:" + hostSockId, "ListAll", jsonString, function(err, newList)
                           {
                               if(err)
                                    throw err;
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
    client.del("room:" + hostSockId);
};

exports.deletePlayerDB = function(userSockId)
{
    client.del("Player:" + userSockId);
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
                console.log(playerArray);
                return playerArray;
            });
        }
    });
};

exports.giveUserRole = function(hostSockId, userSockId, role)
{
    client.hexists("room:" + hostSockId, role, function(err, exist)
    {
        if(err)
            throw err;
        if(exist)
        {
            console.log("hello");
            client.hget("room:" + hostSockId, role, function(err, roleList)
            {
                var jsonParse = JSON.parse(roleList);
                var check;
                if(err)
                    throw err;
                console.log(roleList);

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
                    });
                    console.log(output);
                }
            });
        }
    });
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
    });
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
            });
        }
    });
};

exports.removeUserFromRoom = function(hostSockId, userSockId)
{
    if(hostSockId == userSockId)
    {
        client.del("room:" + hostSockId);
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
                    console.log(jsonParse);
                    jsonString = JSON.stringify(jsonParse);
                    client.hset("room:" + hostSockId, "ListAll", jsonString, function(err, newList)
                    {
                        if(err)
                            throw err;
                    });
                    if(doesUserExist)
                    {
                        client.hincrby("room:" + hostSockId, "Current", (-1), function(err, newCurr)
                        {
                            if(err)
                                throw err;
                        });
                    }
                });
            }
        });
    }
};

