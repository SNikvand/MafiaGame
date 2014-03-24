/**
 * Created by shahin on 20/03/14.
 */

exports.index = function(req, res) {
    var avatarNum = req.body.avatar;
    var Username = req.body.username;
    var output = {
        name: Username,
        avatar: avatarNum
    }
    res.render('game', {result: output});
};