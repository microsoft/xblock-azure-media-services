function AzureMediaServicesBlock(runtime, element) {
    var myOptions = {
        autoplay: false,
        controls: true,
        width: "640",
        height: "400",
        poster: ""
    };

    var myPlayer = amp("${player_dom_id}", myOptions, function () {
        //'this' refers to the player instance in the ready function
    });

    myPlayer.src([
        {
            src: "${video_url}",
            type: "application/vnd.ms-sstr+xml",
% if protection_type:
            protectionInfo: [{
                type: "${protection_type}",
                authenticationToken: "Bearer ${auth_token}"
            }]
% endif
        },
    ]);

    // Add event handlers

    var eventPostUrl = runtime.handlerUrl(element, 'publish_event');

    myPlayer.addEventListener(amp.eventName.pause,
        function(evt){
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.paused',
                {}
            );
        }
    );


    myPlayer.addEventListener(amp.eventName.play,
        function(evt) {
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.played',
                {}
            );
        }
    );

    myPlayer.addEventListener(amp.eventName.loadeddata,
        function(evt) {
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.loaded',
                {}
            );
        }
    );

    myPlayer.addEventListener(amp.eventName.seeked,
        function(evt) {
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.position.changed',
                {}
            );
        }
    );

    myPlayer.addEventListener(amp.eventName.ended,
        function(evt) {
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.stopped',
                {}
            );
        }
    );

}

function _sendPlayerEvent(eventPostUrl, name, data) {
    data['event_type'] = name;

    console.log('Event: ' + name)
    console.log(data)

    $.ajax({
        type: "POST",
        url: eventPostUrl,
        data: JSON.stringify(data)
    });
}
