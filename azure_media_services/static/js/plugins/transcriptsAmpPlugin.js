// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

/* global _ amp gettext */

(function() {
    'use strict';

    var transcriptCues = null;

    var MenuItem = amp.getComponent('MenuItem');
    var TranscriptsMenuItem = amp.extend(MenuItem, {
        constructor: function() {
            var player = arguments[0];
            var options = arguments[1];
            this.track = options.track;
            options.label = options.label || this.track.label || 'Unknown';
            MenuItem.apply(this, arguments);
        },
        handleClick: function(evt) {
            var $transcriptButtonMenu = $(this.el()).closest('.vjs-transcripts-button');
            var $target = $(evt.target);
            var player = this.player();
            var $wrapper = $('div.tc-wrapper');
            var $transcriptElement = $('div.tc-container');

            $transcriptButtonMenu
                .find('.vjs-menu-item')
                .removeClass('vjs-selected')
                .attr('aria-selected', false);
            $target
                .addClass('vjs-selected')
                .attr('aria-selected', true);

            if ($.trim($target.text()) === 'Off, selected') {
                $wrapper.addClass('closed');
            } else {
                transcriptCues = initTranscript(player, $transcriptElement, this.track);
                $wrapper.removeClass('closed');
            }
        }
    });

    var MenuButton = amp.getComponent('MenuButton');
    var TranscriptsMenuButton = amp.extend(MenuButton, {
        constructor: function() {
            MenuButton.apply(this, arguments);
            this.addClass('vjs-transcripts-button');
            this.addClass('fa');
            this.addClass('fa-quote-left');
            if (arguments && arguments[1].identity === 'off') {
                this.el().classList.add('off');
            }
        },
        createItems: function() {
            var player = this.player();
            var items = [];
            var tracks = player.textTracks();
            if (!tracks) {
                return items;
            }
            items.push(new TranscriptsMenuItem(player, {
                selectable: true,
                selected: true,
                label: 'Off',
                identity: 'off'
            }));
            items = items.concat(tracks.tracks_.map(function(track) {
                return new TranscriptsMenuItem(player, {
                    selectable: true,
                    track: track
                });
            }));
            return items;
        }
    });
    amp.registerComponent('TranscriptsMenuButton', TranscriptsMenuButton);


    /**
     * This is called regularly while the video plays
     * so that we can correctly highlight the transcript elements
     * based on the current position of the video playback
     * @param player
     * @param transcriptCues
     * @param $transcriptElement
     * @private
     */
    function syncTimer(player, transcriptCues, $transcriptElement) {
        // Gather each transcript phrase (each pseudo-hyperlink in transcript).
        var cue;
        var isActive;
        var $targetElement;
        var scrollUpSize;
        var $transcriptItems = $transcriptElement.find('.azure-media-xblock-transcript-element');
        var currentTime = player.currentTime();

        if (transcriptCues === null || !$transcriptElement.length) {
            return;
        }

        // Simple linear search.
        for (var i = 0; i < transcriptCues.length; i++) {  // eslint-disable-line vars-on-top
            cue = transcriptCues[i];

            if (currentTime >= cue.startTime && currentTime < cue.endTime) {
                $targetElement = $transcriptItems.eq(i);

                isActive = $targetElement.hasClass('current');
                if (!isActive) {
                    // Highlight the correct one
                    $transcriptItems.removeClass('current');
                    $targetElement.addClass('current');

                    // Autoscroll.
                    scrollUpSize = Math.abs(
                        $transcriptElement.offset().top - $transcriptItems.first().offset().top
                    ) + (
                        $targetElement.offset().top - $transcriptElement.offset().top
                    );
                    $transcriptElement.scrollTo(scrollUpSize, 1000);
                }
                return;
            }
        }
    }


    /**
     * Transcripts creating.
     * @param player
     * @param transcript
     * @param $transcriptElement
     * @returns {Array}
     */
    function initTranscript(player, $transcriptElement, track) {
        var cue;
        var html;
        var startTime;
        var $transcriptItems;
        var cues = track.cues;

        // Creates transcript markup.
        // TODO: use Backbone's client-side templating view (underscore)
        html = '<ol class="subtitles-menu" style="list-style:none;">';
        for (var i = 0; i < cues.length; i++) { // eslint-disable-line vars-on-top
            cue = cues[i];

            html += '<li role="link" tabindex="0"'
                + 'data-transcript-element-start-time="' + _.escape(cue.startTime)
                + '" class="azure-media-xblock-transcript-element" >'
                + _.escape(cue.text) + '</li>';
        }
        html += '</ol>';
        $transcriptElement.html(html);

        // Gather each transcript phrase (each pseudo-hyperlink in transcript).
        $transcriptItems = $transcriptElement.find('.azure-media-xblock-transcript-element');

        // Handle events when user clicks on transcripts
        $transcriptItems.on('click keypress', function(evt) {
            var KeyCode = (evt.type === 'keydown' && evt.keyCode ? evt.keyCode : evt.which);
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
            startTime = parseFloat($(evt.target).data('transcript-element-start-time'));
            player.currentTime(startTime);
        });

        return cues;
    }

    amp.plugin('transcriptsAmpPlugin', function() {
        var player = this;
        var timeHandler = null;
        var $vidParent = $(player.el()).parent();
        var $transcriptElement = null;

        this.addEventListener('loadeddata', function() {
            var $vidAndTranscript = $(
                '<div class="tc-wrapper video closed"><div class="azuremediaplayer"></div></div>'
            );
            $transcriptElement = $('<div class="tc-container"></div>');
            $vidParent.wrap($vidAndTranscript);
            $transcriptElement.appendTo($('.tc-wrapper'));

            player
                .getChild('controlBar')
                .getChild('controlBarIconsRight')
                .addChild('TranscriptsMenuButton', {title: 'TRANSCRIPTS'});

        });
        this.addEventListener(amp.eventName.play, function(evt) {  // eslint-disable-line no-unused-vars
            timeHandler = setInterval(function() {
                syncTimer(player, transcriptCues, $transcriptElement);
            },
            100
            );
        });
        this.addEventListener(amp.eventName.pause, function(evt) {  // eslint-disable-line no-unused-vars
            if (timeHandler !== null) {
                clearInterval(timeHandler);
            }
        });
        this.addEventListener(amp.eventName.ended, function(evt) {  // eslint-disable-line no-unused-vars
            if (timeHandler !== null) {
                clearInterval(timeHandler);
            }
        });
    });
}).call(this);
