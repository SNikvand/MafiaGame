/*
 * GET home page.
 */

var files = require('fs').readdirSync('public/images/avatars');

exports.index = function (req, res) {

    res.render('index', {files: files});
};