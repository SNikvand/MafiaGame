/*--------------------------------------------------------------------------------
 purpose: simply validate the username. this item will return a -1 on failure.

 created by: AJ, Sabrina, Emanual, Shahin
 date/modified: Web March 26th 2014

 version: 1.0

 peer reviewed by: Shahin
 -------------------------------------------------------------------------------*/
function validateName(username) {
    if (username.length < 3 || username.length > 15) {
        return -1;
    }

    for (var i = 0; i < username.length; i++) {
        var char1 = username.charAt(i);
        var cc = char1.charCodeAt(0);
        if (!((cc > 47 && cc < 58) || (cc > 64 && cc < 91) || (cc > 96 && cc < 123))) {
            return -1;
        }
    }
}

exports.index = function(req, res) {
    var avatarNum = req.body.avatar;
    var Username = req.body.username;

    if(validateName(Username) == -1) {
        res.redirect('#');
    }

    var output = {
        name: Username,
        avatar: avatarNum
    }
    res.render('game', {result: output});
};