// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

function AzureMediaServicesBlock(runtime, element) {
  //
  // IMPORTANT: We pass the element itself instead of the class or id. There is a bug when switching units (away from and back to xblock).
  //
  var player = amp($(element).find('.amp-big-play-centered')[0], null, function() {
    // This will get filled in by the transcript processor
    var self = this
    var transcript_cues = null;

    $('.amp-big-play-centered').css('width', '');

    // Add event handlers
    var eventPostUrl = runtime.handlerUrl(element, 'publish_event');

    var timeHandler = null;

    this.addEventListener(amp.eventName.pause,
      function(evt) {
        _sendPlayerEvent(eventPostUrl, 'edx.video.paused', {});

        if (timeHandler !== null) {
          clearInterval(timeHandler);
        }
      }
    );

    this.addEventListener(amp.eventName.play,
      function(evt) {
        _sendPlayerEvent(eventPostUrl, 'edx.video.played', {});

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
	   	    if ($('.subtitles').length) {
			var divContainer = $("<div class='azure-media-player-toggle-button-style fa fa-quote-left' id='toggleTranscript' role='button' aria-live='polite' tabindex='0'><div class='vjs-control-content'><span class='vjs-control-text'>Toggle</span></div></div>");
			$(".amp-controlbaricons-right").append(divContainer);
			$('#toggleTranscript').on('click keydown',(function(evt) {
			var keycode = (evt.type === 'keydown' && evt.keycode ? evt.keyCode : evt.which) 
			if (evt.type !== 'click' && (keycode !== 32 && keycode !== 13)) {
			  return;
			}
			if (keycode === 32) {
			  evt.preventDefault();
			}
            $('.subtitles').toggle();
            var transcriptContainerVisibility = $('.subtitles')[0].style.display;
            var event_type = ''

            if (transcriptContainerVisibility === "none") {
              event_type = 'edx.video.transcript.hidden';
              $('.video').addClass('closed')
            } else {
              event_type = 'edx.video.transcript.show';
              $('.video').removeClass('closed')
            }

            _sendPlayerEvent(eventPostUrl, event_type, {});
          }));
        }

        _sendPlayerEvent(eventPostUrl, 'edx.video.loaded', {});
      }
    );

    this.addEventListener(amp.eventName.seeked,
      function(evt) {
        _sendPlayerEvent(eventPostUrl, 'edx.video.position.changed', {});
      }
    );

    this.addEventListener(amp.eventName.ended,
      function(evt) {
        _sendPlayerEvent(eventPostUrl, 'edx.video.stopped', {});

        if (timeHandler !== null) {
          clearInterval(timeHandler);
        }
      }
    );

    transcriptElement = $(element).find('.subtitles');

    if (transcriptElement.length) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', transcriptElement.data('transcript-url'));
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          transcript_cues = initTranscript(self, xhr.responseText, transcriptElement);
        }
      };
      xhr.send();
    }

    // Sync events when closed captions (subtitles) are available.
    // NOTE that we are syncing events from the Azure Media Player, so
    // this could change over time (i.e. class names changing)
    var subtitle_els = $(element).find('.vjs-subtitles-button .vjs-menu-item');

    subtitle_els.mousedown(function(evt) {
      var target = $(evt.target);
      var language_name = target.html();
      var event_type = 'edx.video.closed_captions.shown';
      if (language_name == 'Off') {
        event_type = 'edx.video.closed_captions.hidden';
        language_name = '';
      }

      _sendPlayerEvent(eventPostUrl, event_type, { language_name: language_name });
    });
  });
}

function initTranscript(player, transcript, transcriptElement) {
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

  try {
    parser.parse(transcript);
  }
  catch (e) {
    //todo:remove when firefox bug is fixed.
    transcriptElement.append('<span><p>Known firefox bug. We have notified azure media player team.</p></span><br/>');
    transcriptElement.append('<span><p>error From File: ' + e.fileName + '</p></span><br/>');
    transcriptElement.append('<span><p>errorMessage: ' + e.message + '</p></span><br/>');
  }
  parser.flush();

  // TODO: use Backbone's client-side templating view (underscore)
  var html = '<ol class="subtitles-menu" style="list-style:none; padding:5em 0;">';
  for (var i = 0; i < cues.length; i++) {
    var cue = cues[i];
    html += '<li data-transcript-element-id="' + cue.id
      + '" data-transcript-element-start-time="' + cue.startTime
      + '" class="azure-media-xblock-transcript-element" >'
      + cue.text + '</li>';
  }
  html += '</ol>';
  transcriptElement.append(html);

  // handle events when user clicks on transcripts
  $('.azure-media-xblock-transcript-element').on('click keypress',function(evt) {
	var KeyCode = (evt.type === 'keydown' && evt.keyCode ? evt.keyCode : evt.which)
    if (evt.type !== 'click' && (KeyCode !== 32 && KeyCode !== 13)) {
    return;
    }
    if (KeyCode === 32) {
    evt.preventDefault();
    }

    // Clear all active
    $('.azure-media-xblock-transcript-element').removeClass('current');

    // Highlight the one the user clicked.
    $(evt.target).addClass('current');

    // Set the player to match the transcript time
    var start_time = parseFloat($(evt.target).data('transcript-element-start-time'));
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
  for (var i = 0; i < transcript_cues.length; i++) {
    cue = transcript_cues[i];

    if (currentTime >= cue.startTime && currentTime < cue.endTime) {
      var targetElement = $('li[data-transcript-element-id=' + cue.id + ']');
      var isActive = targetElement.hasClass('current');

      if (!isActive) {
        // Highlight the correct one
        $('.azure-media-xblock-transcript-element').removeClass('current');
        targetElement.addClass('current');

        // Autoscroll
        var iNdex = targetElement.data('transcript-element-id');
        if (iNdex && iNdex !== '') {
          $('.subtitles').scrollTo(iNdex * 29.5, 1000);
        }
      }

      return;
    }
  }
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
