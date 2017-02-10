// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

function AzureMediaServicesBlock(runtime, element) {
  var player = amp('azure-media-services-xblock-video', null, function() {
    // This will get filled in by the transcript processor
    var self = this
    var transcript_cues = null;

    // Add event handlers
    var eventPostUrl = runtime.handlerUrl(element, 'publish_event');

    var timeHandler = null;

    this.addEventListener(amp.eventName.pause,
      function(evt) {
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
        $('#azure-media-services-xblock-video').css('width', '');

        if ($('.subtitles').length) {
          var divContainer = $("<div class='azure-media-player-toggle-button-style fa fa-quote-left' id='toggleTranscript' role='button' aria-live='polite' tabindex='0'><div class='vjs-control-content'><span class='vjs-control-text'>Toggle</span></div></div>");
          $(".amp-controlbaricons-right").append(divContainer);

          $('#toggleTranscript').click(function() {
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

            _sendPlayerEvent(
              eventPostUrl,
              event_type,
              {}
            );
          });
        }

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

    transcriptPaneEl = $(element).find('.subtitles');

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

    // Sink events when the user clicks to show a subtitle.
    // NOTE that we are sinking events from the Azure Media Player, so
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

      _sendPlayerEvent(
        eventPostUrl,
        event_type,
        {
          language_name: language_name
        }
      )
    });
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

  try {
    parser.parse(transcript);
  }
  catch (e) {
    //todo:remove when firefox bug is fixed.
    transcriptPaneEl.append('<span><p>Known firefox bug. We have notified azure media player team.</p></span><br/>');
    transcriptPaneEl.append('<span><p>error From File: ' + e.fileName + '</p></span><br/>');
    transcriptPaneEl.append('<span><p>errorMessage: ' + e.message + '</p></span><br/>');
  }
  parser.flush();

  // In general, markup that's driven by a data model should either be fully separated
  // from script OR fully integrated (like react). We should therefore either:
  //
  // a) switch to a client-side templating solution for this (like handlebars,
  //      mustache, underscore, etc). The most sensible approach is to
  //      TODO: use Backbone's views since edx uses backbone.
  //
  //  OR
  //
  // b) continue following the django MVC solution by loading the
  //      transcript as part of our server-side model. This would
  //      mean a service-to-servie call, but would allow for some
  //      servers-side caching too.
  var html = '<ol class="subtitles-menu">';
  for (var i = 0; i < cues.length; i++) {
    var cue = cues[i];
    html += '<li data-transcript-element-id="' + cue.id
          + '" data-transcript-element-start-time="' + cue.startTime
          + '" class="azure-media-xblock-transcript-element" >'
          + cue.text + '</li>';
  }
  html += '</ol>';
  transcriptPaneEl.append(html);

  // handle events when user clicks on transcripts
  $('.azure-media-xblock-transcript-element').click(function(evt) {
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
  for (var i = 0; i < transcript_cues.length; i++) {
    cue = transcript_cues[i];
    if (currentTime >= cue.startTime && currentTime < cue.endTime) {
      var targetEl = $('li[data-transcript-element-id=' + cue.id + ']');
      var isActive = targetEl.hasClass('current');

      if (!isActive) {
        // highlight the correct one
        $('.azure-media-xblock-transcript-element').removeClass('current');
        targetEl.addClass('current');
        // after getting highlighted one, below one wil autoscroll.
        var topPositionOfActiveElement = targetEl.position().top;
        var transcriptPanelVisibleAreaHeight = transcriptPaneEl[0].clientHeight;
        var halfOfTranscriptPanelContainer = transcriptPanelVisibleAreaHeight / 2;
        if (topPositionOfActiveElement !== 0 &&
          topPositionOfActiveElement > halfOfTranscriptPanelContainer &&
          topPositionOfActiveElement > transcriptPanelVisibleAreaHeight) {
          var newScrollTopPosition = Math.ceil(transcriptPanelVisibleAreaHeight / 6);
          $('.azure-media-player-transcript-pane')[0].scrollTop += newScrollTopPosition;
        }
      }
      return;
    }
  }

  // clear all - video is not currently at a point which has a current
  // translation
  $('.azure-media-xblock-transcript-element').removeClass('current');
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
