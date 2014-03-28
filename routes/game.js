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

    var validName = new RegExp(/^[a-z0-9]+$/i);
    var isValid = validName.test(username);
    console.log(isValid);
    if(!isValid) {
        return -1;
    }

    return 0;
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