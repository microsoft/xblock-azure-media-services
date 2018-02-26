// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

/* global WebVTT _ amp gettext runtime */


var events = {
    PLAYED: 'edx.video.played',
    PAUSED: 'edx.video.paused',
    STOPPED: 'edx.video.stopped',
    POSITION_CHANGED: 'edx.video.position.changed',
    TRANSCRIPT_SHOWN: 'edx.video.transcript.show',
    TRANSCRIPTS_HIDDEN: 'edx.video.transcript.hidden',
    VIDEO_LOADED: 'edx.video.loaded',
    CAPTIONS_SHOWN: 'edx.video.closed_captions.shown',
    CAPTIONS_HIDDEN: 'edx.video.closed_captions.hidden'
};


/**
 * Send events back to server-side xBlock
 * @param eventPostUrl
 * @param name
 * @param data
 */
function sendPlayerEvent(eventPostUrl, name, data) {
    'use strict';
    data.event_type = name;  // eslint-disable-line no-param-reassign
    $.ajax({
        type: 'POST',
        url: eventPostUrl,
        data: JSON.stringify(data)
    });
}


/**
 * Main xBlock initializer which interface is defined by xBlock API.
 * @param runtime
 * @param container
 * @constructor
 */
function AzureMediaServicesBlock(runtime, container, jsonArgs) {
    'use strict';
    // IMPORTANT: We pass the <video> DOM element instead of its class or id. This mitigates
    //  a bug when switching units. Changing units triggers a "partial navigation" which
    //  entirely removes the xblock markup from the DOM.
    var transcripts = [];
    var player = amp($(container).find('video')[0], null, function() { // eslint-disable-line no-unused-vars
        // Preserve
        var self = this;

        var subtitleEls;
        var languageName;
        var eventPostUrl;
        var fetchTranscriptUrl;

        // Add event handlers
        eventPostUrl = runtime.handlerUrl(container, 'publish_event');
        fetchTranscriptUrl = runtime.handlerUrl(container, 'fetch_transcript');

        this.addEventListener(amp.eventName.pause,
            function() {
                sendPlayerEvent(eventPostUrl, events.PAUSED, {});
            }
        );

        this.addEventListener(amp.eventName.play,
            function() {
                sendPlayerEvent(eventPostUrl, events.PLAYED, {});
            }
        );

        this.addEventListener(amp.eventName.loadeddata,
            function() {
                sendPlayerEvent(eventPostUrl, events.VIDEO_LOADED, {});
            }
        );

        this.addEventListener(amp.eventName.seeked,
            function() {
                sendPlayerEvent(eventPostUrl, events.POSITION_CHANGED, {});
            }
        );

        this.addEventListener(amp.eventName.ended,
            function() {
                sendPlayerEvent(eventPostUrl, events.STOPPED, {});
            }
        );

        // Log when closed captions (subtitles) are toggled.
        // NOTE we use classes from Azure Media Player which may change.
        subtitleEls = $(container).find('.vjs-subtitles-button .vjs-menu-item');

        subtitleEls.mousedown(function(evt) {
            var reportEvent = events.CAPTIONS_SHOWN;
            // TODO: we should attach to a different event.
            // For example, this can also be toggled via keyboard.
            languageName = $(evt.target).html();
            if (languageName === 'Off') {
                reportEvent = events.CAPTIONS_HIDDEN;
                languageName = '';
            }

            sendPlayerEvent(eventPostUrl, reportEvent, {language_name: languageName});
        });
    });

    if (jsonArgs.transcripts_enabled) {
        for (var i = 0; i < jsonArgs.transcripts.length; i++) { // eslint-disable-line vars-on-top
            transcripts.push(
                {
                    lang: jsonArgs.transcripts[i].srclang,
                    type: 'transcript',
                    uri: jsonArgs.transcripts[i].src
                }
            );
        }
        player.downloadableMedia(transcripts);
        player.transcriptsAmpPlugin({container: container});
    }
}
