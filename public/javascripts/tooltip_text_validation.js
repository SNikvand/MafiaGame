
/*--------------------------------------------------------------------------------
 Purpose: Using JQuery we can actively tell if the user is inputting invalid
 characters for their username using a tooltip.

 Return Data: If it doesn't validate, it will show a tooltip, otherwise no tooltip

 Created by: Shahin Nikvand
 Data / Modified: March 26th 2014

 Version: 1

 Peer Reviewed By: Shahin
 -------------------------------------------------------------------------------*/

$('#username').keyup(
    function() {
        validationTooltip($(this));
    }
);

$('#create-room-name').keyup(
    function() {
        validationTooltip($(this));
    }
);

var toolTip = 0;
 /*--------------------------------------------------------------------------------
 Purpose: Ensures your name is more than 3 characters and less than 15.
 Only characters allowed, aA-zZ and 0-9.
 If error in name displays a tooltip.

 Created by:
 Data / Modified: March 28th 2014

 Version: 1

 Peer Reviewed By: Shahin
 -------------------------------------------------------------------------------*/
function validationTooltip(item) {
    var text = item.val();
    var message = '';
    var isValid = 1;

    if(text.length < 3 || text.length > 15) {
        message += '- Username must be between 3 and 15 characters.\n';
        isValid = 0;
    }

    var regex = new RegExp("^[a-zA-Z0-9]+$");
    if(!regex.test(text)) {
        message += '- Username must only contain letters from A - Z and numbers.';
        isValid = 0;
    }

    if(item.attr("data-content") != message) {
        toolTip = 0;
    }

    item.attr("data-content", message);

    if(isValid == 0) {

        if (toolTip == 0) {
            item.popover('show');
        }
        toolTip = 1;
    } else {
        item.popover('hide');
        toolTip = 0;
    }
}
