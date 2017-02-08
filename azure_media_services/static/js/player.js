// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

function AzureMediaServicesBlock (runtime, element) {
  //
  // IMPORTANT: We need to send in the media player DOM element
  // ID because that causes problems. For example, the player
  // doesn't get re-initialized when the student changes focus
  // (to and from player). The result is a player that doesn't
  // respond to user action. My hunch is that the underlying
  // Azure Media Player JS library thinks it already
  // initialized the DOM element with that ID.
  //
  // However, sending in the DOM element itself seems to work
  // when switching between verticals.
  //
  var player = amp($(element).find('.azuremediaplayer')[0], null, function () {
    // This will get filled in by the transcript processor
    var self = this
    var transcript_cues = null;

    // Add event handlers
    var eventPostUrl = runtime.handlerUrl(element, 'publish_event');

    var timeHandler = null;

    this.addEventListener(amp.eventName.pause,
      function (evt) {
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
      function (evt) {
        _sendPlayerEvent(
          eventPostUrl,
          'edx.video.played',
          {}
        );
        timeHandler = setInterval(
          function () {
            _syncTimer(self, transcript_cues, element);
          },
          100
        );
      }
    );

    this.addEventListener(amp.eventName.loadeddata,
      function (evt) {
          if ($('.azure-media-player-transcript-pane').length) {
          var divContainer = $("<div class='azure-media-player-toggle-button-style fa fa-quote-left' id='toggleTranscript' role='button' aria-live='polite' tabindex='0'><div class='vjs-control-content'><span class='vjs-control-text'>Toggle</span></div></div>");
          $(".amp-controlbaricons-right").append(divContainer);
          $('.azure-media-player-transcript-pane').hide();
          $('.amp-big-play-centered').addClass('azure-media-player-max-screen-width');
          $('.xblock-render').addClass('azure-media-player-panel-height');
          $('.vjs-has-started').addClass('azure-media-player-max-screen-width');

          $('#toggleTranscript').click(function () {
            $('.azure-media-player-transcript-pane').toggle();
            var transcriptContainerVisibility = $('.azure-media-player-transcript-pane')[0].style.display;
            var event_type = ''

            if (transcriptContainerVisibility === "none") {
              event_type = 'edx.video.transcript.hidden';
              $('.xblock-render').addClass('azure-media-player-panel-height');
              $('.vjs-has-started').removeClass('azure-media-player-min-screen-width');
              $('.vjs-has-started').addClass('azure-media-player-max-screen-width');
            } else if (transcriptContainerVisibility === "block") {
              event_type = 'edx.video.transcript.show';
              $('.xblock-render').removeClass('azure-media-player-panel-height');
              $('.vjs-has-started').removeClass('azure-media-player-max-screen-width');
              $('.vjs-has-started').addClass('azure-media-player-min-screen-width');
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
      function (evt) {
        _sendPlayerEvent(
          eventPostUrl,
          'edx.video.position.changed',
          {}
        );
      }
    );

    this.addEventListener(amp.eventName.ended,
      function (evt) {
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
      xhr.onreadystatechange = function () {
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

    subtitle_els.mousedown(function (evt) {
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

    //
    // Some experimental code here, that we'll disable, but keep around for future reference
    //
    if (false) {
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

  parser.oncue = function (cue) {
    cues.push(cue);
  };
  parser.onregion = function (region) {
    regions.push(region);
  }
  parser.onparsingerror = function (error) {
    console.log(error);
  }

  parser.parse(transcript);
  parser.flush();

  // todo: bug _ this is the worst possible way to do this.
  // Markup should either be fully separated from
  // script OR fully integrated (like react). We
  // should therefore either:
  //
  // a) switch to a client-side templating solution for this
  //      (like handlebars, mustache, underscore, etc). The
  //      most sensible approach is to use Backbone's views
  //      since edx already uses backbone.
  //
  //  OR
  //
  // b) continue following the django MVC solution by loading
  //      the transcript as part of our server-side model.
  //      This would mean a service-to-servie call, but would
  //      allow for some servers-side caching too.
  var html = '<ul class="azure-media-xblock-transcript-cues">';
  for (var i = 0; i < cues.length; i++) {
    var cue = cues[i];
    html += '<li class="azure-media-xblock-transcript-cue"><span class="azure-media-xblock-transcript-element" data-transcript-element-id=' +
      cue.id + ' data-transcript-element-start-time="' + cue.startTime + '" >' +
      cue.text + '</span></li>';
  }
  html += '</ul>';
  transcriptPaneEl.append(html);

  // handle events when user clicks on transcripts
  $('.azure-media-xblock-transcript-element').click(function (evt) {
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
      var targetEl = $('span[data-transcript-element-id=' + cue.id + ']');
      var isActive = targetEl.hasClass('active');

      if (!isActive) {
        // highlight the correct one
        $('.azure-media-xblock-transcript-element').removeClass('active');
        targetEl.addClass('active');
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
