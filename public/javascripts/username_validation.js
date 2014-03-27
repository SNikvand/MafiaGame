
/*--------------------------------------------------------------------------------
 Purpose: Using JQuery we can actively tell if the user is inputting invalid
 characters for their username using a tooltip.

 Return Data: If it doesn't validate, it will show a tooltip, otherwise no tooltip

 Created by: Shahin Nikvand
 Data / Modified: March 26th 2014

 Version: 1

 Peer Reviewed By: Shahin
 -------------------------------------------------------------------------------*/
var toolTip = 0;
$('#username').keyup(
    function() {
        var text = $(this).val();
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

        if($(this).attr("data-content") != message) {
            toolTip = 0;
        }

        $(this).attr("data-content", message);

        if(isValid == 0) {

            if (toolTip == 0) {
                $('#username').popover('show');
            }
            toolTip = 1;
        } else {
            $('#username').popover('hide');
            toolTip = 0;
        }
    }
);