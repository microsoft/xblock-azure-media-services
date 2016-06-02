function AzureMediaServicesBlock(runtime, element) {
    var myOptions = {
        autoplay: false,
        controls: true,
        width: "550",
        height: "343",
        poster: ""
    };

    var myPlayer = amp("${player_dom_id}", myOptions, function () {
        //'this' refers to the player instance in the ready function
    });

    // This will get filled in by the transcript processor
    var transcript_cues = null;

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
    ]
% if captions:
    ,[
    % for caption in captions:
        {
            src: "${caption['src']}",
            srclang: "${caption['srclang']}",
            kind: "subtitles",
            label: "${caption['label']}"
        }
        % if loop.index < len(captions) - 1:
        ,
        % endif
    % endfor
    ]
% endif
    );

    // Add event handlers

    var eventPostUrl = runtime.handlerUrl(element, 'publish_event');

    var timeHandler = null;

    myPlayer.addEventListener(amp.eventName.pause,
        function(evt){
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.paused',
                {}
            );
            if (timeHandler !== null) {
                clearInterval(timeHandler);
            }
        }
    );


    myPlayer.addEventListener(amp.eventName.play,
        function(evt) {
            _sendPlayerEvent(
                eventPostUrl,
                'edx.video.played',
                {}
            );
            timeHandler = setInterval(
                function() {
                    _syncTimer(myPlayer, transcript_cues);
                },
                100
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
            if (timeHandler !== null) {
                clearInterval(timeHandler);
            }
        }
    );


% if transcript_url:
    transcriptPaneEl = $('#transcript-${player_dom_id}');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '${transcript_url}');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        transcript_cues = initTranscript(myPlayer, xhr.responseText, transcriptPaneEl);
      }
    };
    xhr.send();
% endif
}

function initTranscript(player, transcript, transcriptPaneEl) {
  var parser = new WebVTT.Parser(window, WebVTT.StringDecoder());

  var cues = [];
  var regions = [];

  parser.oncue = function(cue) {
    cues.push(cue);
  };
  parser.onregion = function(region) {
    regions.push(region);
  }
  parser.onparsingerror = function(error) {
    console.log(error);
  }

  parser.parse(transcript);
  parser.flush();

  var html = '<ul>';
  for(var i=0;i<cues.length;i++) {
    var cue = cues[i];
    html += '<li><span class="azure-media-xblock-transcript-element" data-transcript-element-id=' +
        cue.id + ' data-transcript-element-start-time="' + cue.startTime + '" >' +
        cue.text + '</span></li>';
  }
  html += '</ul>';
  transcriptPaneEl.append(html);

  // handle events when user clicks on transcripts
  $('.azure-media-xblock-transcript-element').click(function(evt){
    var start_time = parseFloat($(evt.target).data('transcript-element-start-time'));

    // set the player to match the transcript time
    player.currentTime(start_time);
  })

  return cues;
}


function _syncTimer(myPlayer, transcript_cues) {
    var currentTime = myPlayer.currentTime();

    if (transcript_cues === null) {
        return;
    }

    // see if there is a match
    for (var i=0;i<transcript_cues.length; i++) {
        cue = transcript_cues[i];
        if (currentTime >= cue.startTime && currentTime < cue.endTime) {
            var targetEl = $('span[data-transcript-element-id='+cue.id+']');
            var isActive = targetEl.hasClass('active');

            if (!isActive) {
                // highlight the correct one
                $('.azure-media-xblock-transcript-element').removeClass('active');
                targetEl.addClass('active');
            }
            return;
        }
    }

    // clear all
    $('.azure-media-xblock-transcript-element').removeClass('active');

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
