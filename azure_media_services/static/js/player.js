// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

function AzureMediaServicesBlock(runtime, container) {
  //
  // IMPORTANT: We pass the <video> DOM element instead of its class or id. This mitigates
  //  a bug when switching units. Changing units triggers a "partial navigation" which
  //  entirely removes the xblock markup from the DOM.
  //
  var player = amp($(container).find('video')[0], null, function() {
    // Preserve
    var self = this;

    // Fyi, container contains all of player.html so it is an ancestor of $vidAndTranscript
    //      $vidAndTranscript is an ancestor of BOTH $vidParent AND $transcriptElement
    //      $vidParent is the direct parent of <video> tag
    var $vidAndTranscript = $(container).find('.video').first();
    var $vidParent = $(self.el_);
    var $transcriptElement = $vidAndTranscript.find('.subtitles').first();

    // This will get filled in by the transcript processor
    var transcript_cues = null;

    // Clear fixed width to support responsive UX.
    $vidParent.css('width', '');

    // Add event handlers
    var eventPostUrl = runtime.handlerUrl(container, 'publish_event');

    // This will be updated as the video plays.
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
            _syncTimer(self, transcript_cues, $transcriptElement);
          },
          100
        );
      }
    );

    this.addEventListener(amp.eventName.loadeddata,
      function(evt) {
        if ($transcriptElement.length) {
          // Find and re-position button markup. This must be done
          // after AMP initializes built-in player controls.
          var $transcriptButton = $transcriptElement.find('.toggleTranscript').first();
          $vidParent.find('.amp-controlbaricons-right').first().append($transcriptButton);

          // Enable button action.
          $transcriptButton.on('click keydown', (function(evt) {
            var keycode = (evt.type === 'keydown' && evt.keycode ? evt.keyCode : evt.which) 
            if (evt.type !== 'click' && (keycode !== 32 && keycode !== 13)) {
              return;
            }
            if (keycode === 32) {
              evt.preventDefault();
            }

            // Toggle transcript view.
            var event_type = ''
            if ($vidAndTranscript.hasClass('closed')) {
              event_type = 'edx.video.transcript.show';
              $vidAndTranscript.removeClass('closed')
            } else {
              event_type = 'edx.video.transcript.hidden';
              $vidAndTranscript.addClass('closed')
            }

            // Log toggle transcript event.
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

    // Ajax request for transcript file.
    if ($transcriptElement.length) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', $transcriptElement.data('transcript-url'));
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          // Parse transcript.
          transcript_cues = initTranscript(self, xhr.responseText, $transcriptElement);
        }
      };
      xhr.send();
    }

    // Log when closed captions (subtitles) are toggled.
    // NOTE we use classes from Azure Media Player which may change.
    var subtitle_els = $(container).find('.vjs-subtitles-button .vjs-menu-item');

    subtitle_els.mousedown(function(evt) {
      // TODO: we should attach to a different event. For example, this can also be toggled via keyboard.
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

function initTranscript(player, transcript, $transcriptElement) {
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
  catch (error) {
    // TODO: remove when vtt bug is fixed.
    $transcriptElement.append('<span><p>It appears there was a problem loading the transcript. Please see the support link located at the bottom of this page for additional help and information about browser compatibility. We apologize for the inconvenience.</p></span>');
  }
  parser.flush();

  // Creates transcript markup.
  // TODO: use Backbone's client-side templating view (underscore)
  var html = '<ol class="subtitles-menu" style="list-style:none; padding:5em 0;">';
  for (var i = 0; i < cues.length; i++) {
    var cue = cues[i];

    html += '<li role="link" tabindex="0"'
      + 'data-transcript-element-start-time="' + _.escape(cue.startTime)
      + '" class="azure-media-xblock-transcript-element" >'
      + _.escape(cue.text) + '</li>';
  }
  html += '</ol>';
  $transcriptElement.append(html);

  // Gather each transcript phrase (each pseudo-hyperlink in transcript).
  var $transcriptItems = $transcriptElement.find('.azure-media-xblock-transcript-element');

  // Handle events when user clicks on transcripts
  $transcriptItems.on('click keypress',function(evt) {
    var KeyCode = (evt.type === 'keydown' && evt.keyCode ? evt.keyCode : evt.which)
    if (evt.type !== 'click' && (KeyCode !== 32 && KeyCode !== 13)) {
      return;
    }
    if (KeyCode === 32) {
      evt.preventDefault();
    }

    // Clear all active
    $transcriptItems.removeClass('current');

    // Highlight the one the user clicked.
    $(evt.target).addClass('current');

    // Set the player to match the transcript time
    var start_time = parseFloat($(evt.target).data('transcript-element-start-time'));
    player.currentTime(start_time);
  })

  return cues;
}

function _syncTimer(player, transcript_cues, $transcriptElement) {
  // This is called regularly while the video plays
  // so that we can correctly highlight the transcript elements
  // based on the current position of the video playback

  if (transcript_cues === null || !$transcriptElement.length) {
    // no transcript - quick exit
    return;
  }

  // Gather each transcript phrase (each pseudo-hyperlink in transcript).
  var $transcriptItems = $transcriptElement.find('.azure-media-xblock-transcript-element');

  var currentTime = player.currentTime();

  // Simple linear search.
  for (var i = 0; i < transcript_cues.length; i++) {
    cue = transcript_cues[i];

    if (currentTime >= cue.startTime && currentTime < cue.endTime) {
      var $targetElement = $transcriptItems.eq(i);

      var isActive = $targetElement.hasClass('current');
      if (!isActive) {
        // Highlight the correct one
        $transcriptItems.removeClass('current');
        $targetElement.addClass('current');

        // Autoscroll.
        // TODO: this formula is brittle. It uses "magic numbers." It should instead use
        //    information from the layout like: $transcriptElement's height,
        //    $transcriptElement's scroll-position, $targetElement's location, etc.
        $transcriptElement.scrollTo((i + 1) * 29.5, 1000);
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
