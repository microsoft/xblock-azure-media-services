// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

/* global _ amp gettext runtime */


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
    var downloadMediaList = [];
    var langSource;
    var player = amp($(container).find('video')[0], null, function() { // eslint-disable-line no-unused-vars
        var subtitleEls;
        var languageName;
        var eventPostUrl = runtime.handlerUrl(container, 'publish_event');

        // Add event handlers:
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
        player.transcriptsAmpPlugin();
    }

    // Do not perform further media download processing if disabled:
    if (!jsonArgs.assets_download) return;

    // xBlock's Studio editor has switch control for transcripts download button:
    if (jsonArgs.transcripts_enabled) {
        for (var i = 0; i < jsonArgs.transcripts.length; i++) { // eslint-disable-line vars-on-top
            downloadMediaList.push({
                lang: jsonArgs.transcripts[i].srclang,
                type: amp.downloadableMediaType.transcript,
                uri: jsonArgs.transcripts[i].src
            });
        }
    }

    langSource = downloadMediaList.length
        ? downloadMediaList.slice()
        : [{lang: player.language()}];

    // Here we take care video download is available for all presented locales:
    langSource.forEach(function(media) {
        downloadMediaList.push({
            lang: media.lang,
            type: amp.downloadableMediaType.video,
            uri: jsonArgs.video_download_uri
        });
    });

    player.downloadableMedia(downloadMediaList);
}
