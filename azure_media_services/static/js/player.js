function AzureMediaServicesBlock(runtime, element) {
  //
  // IMPORTANT: We need to send in the DOM element which is the
  // media player. DO NOT SEND IN THE ID because then there is a problem
  // when we switch between verticals - the player seems to not get re-initialized
  // after the student clicks out and then clicks back. The result is that the play just
  // sits and does nothing. My hunch is that the underlying Azure Media Player JS library
  // thinks that it already initialized DOM element ID 123456....
  //
  // However, sending in the DOM element seems to work in this situation when switching between
  // verticals
  //
  var player = amp($(element).find('.azuremediaplayer')[0], null, function() {
   // This will get filled in by the transcript processor
    var self = this
    var transcript_cues = null;

    // Add event handlers
    var eventPostUrl = runtime.handlerUrl(element, 'publish_event');

    var timeHandler = null;

    this.addEventListener(amp.eventName.pause,
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

    this.addEventListener(amp.eventName.play,
      function(evt) {
        _sendPlayerEvent(
          eventPostUrl,
          'edx.video.played',
          {}
        );
        timeHandler = setInterval(
          function() {
            _syncTimer(self, transcript_cues, element);
          },
          100
        );
      }
    );

    this.addEventListener(amp.eventName.loadeddata,
      function(evt) {
        _sendPlayerEvent(
          eventPostUrl,
          'edx.video.loaded',
          {}
        );
      }
    );

    this.addEventListener(amp.eventName.seeked,
      function(evt) {
        _sendPlayerEvent(
          eventPostUrl,
          'edx.video.position.changed',
          {}
        );
      }
    );

    this.addEventListener(amp.eventName.ended,
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

    transcriptPaneEl = $(element).find('.azure-media-player-transcript-pane');

    if (transcriptPaneEl.length) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', transcriptPaneEl.data('transcript-url'));
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          transcript_cues = initTranscript(self, xhr.responseText, transcriptPaneEl);
        }
      };
      xhr.send();
    }


    //
    // Some experimental code here, that we'll disable, but keep around for future reference
    //
    if (false) {

      // Sink events when the user clicks to show a subtitle.
      // NOTE that we are sinking events from the Azure Media Player, so
      // this could change over time (i.e. class names changing)
      var subtitle_els = $(element).find('.vjs-subtitles-button .vjs-menu-item');

      // Unfortunately we can't seem to get the 'click' event to register here.
      // I'm wondering if something is handling the event ahead of us and not passing downstream
      subtitle_els.mousedown(function(evt) {
        var target = $(evt.target);
        var language_name = target.html()
        _sendPlayerEvent(
          eventPostUrl,
          'edx.video.closed_captions.shown',
          {
            language_name: language_name
          }
        )
      });

      $(".vjs-subtitles-button").after(
  '<div aria-pressed="false" aria-label="Subtitles Menu" aria-haspopup="true" tabindex="0" aria-live="polite" role="button" class="vjs-subtitles-button vjs-menu-button vjs-control  amp-subtitles-control"><div class="vjs-control-content"><span class="vjs-control-text">Subtitles</span><div style="display: none;" class="vjs-menu"><ul class="vjs-menu-content"><li aria-selected="true" tabindex="0" aria-live="polite" role="button" class="vjs-menu-item vjs-selected">Off</li><li aria-selected="false" tabindex="0" aria-live="polite" role="button" class="vjs-menu-item">english</li><li aria-selected="false" tabindex="0" aria-live="polite" role="button" class="vjs-menu-item">spanish</li><li aria-selected="false" tabindex="0" aria-live="polite" role="button" class="vjs-menu-item">french</li><li aria-selected="false" tabindex="0" aria-live="polite" role="button" class="vjs-menu-item">italian</li><li class="amp-menu-header">Subtitles</li></ul></div></div></div>'
      );
    }

  });
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

  var html = '<ul class="azure-media-xblock-transcript-cues">';
  for(var i=0;i<cues.length;i++) {
    var cue = cues[i];
    html += '<li class="azure-media-xblock-transcript-cue"><span class="azure-media-xblock-transcript-element" data-transcript-element-id=' +
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


function _syncTimer(player, transcript_cues, element) {
  // This is called regularly while the video plays
  // so that we can correctly highlight the transcript elements
  // based on the current position of the video playback

  if (transcript_cues === null) {
    // no transcript - quick exit
    return;
  }

  var currentTime = player.currentTime();

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

  // clear all - video is not currently at a point which has a current
  // translation
  $('.azure-media-xblock-transcript-element').removeClass('active');
}

function _sendPlayerEvent(eventPostUrl, name, data) {
  data['event_type'] = name;

  // @TODO: Remove this debugging stuff
  console.log('Event: ' + name)
  console.log(data)

  // send events back to server-side xBlock
  $.ajax({
    type: "POST",
    url: eventPostUrl,
    data: JSON.stringify(data)
  });
}