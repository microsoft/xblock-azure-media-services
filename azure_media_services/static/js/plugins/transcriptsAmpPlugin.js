// Copyright (c) Microsoft Corporation. All Rights Reserved.
// Licensed under the MIT license. See LICENSE file on the project webpage for details.

/* global _ amp gettext */

(function() {
    'use strict';

    var transcriptCues = null;

    var Component = amp.getComponent('Component');
    var MenuItem = amp.getComponent('MenuItem');
    var MenuButton = amp.getComponent('MenuButton');

    var TranscriptsMenuItem = amp.extend(MenuItem, {
        constructor: function() {
            var player = arguments[0];  // eslint-disable-line no-unused-vars
            var options = arguments[1];
            this.track = options.track;
            this.cues = [];
            options.label = options.label || this.track.label || 'Unknown';
            MenuItem.apply(this, arguments);
        },
        handleClick: function(evt) {  // eslint-disable-line no-unused-vars
            var player = this.player();
            var $wrapper = $('div.tc-wrapper');
            var $transcriptContainer = $('div.tc-container');

            this.options_.parent.items.forEach(function(item) {  // eslint-disable-line no-underscore-dangle
                item.selected(false);
            });
            this.selected(true);

            if (this.options_.identity === 'off') {  // eslint-disable-line no-underscore-dangle
                $wrapper.addClass('closed');
            } else {
                transcriptCues = initTranscript(  // eslint-disable-line no-use-before-define
                    player, $transcriptContainer, this.track
                );
                $wrapper.removeClass('closed');
            }
        }
    });

    var TranscriptsMenuButton = amp.extend(MenuButton, {
        constructor: function() {
            MenuButton.apply(this, arguments);
            this.addClass('vjs-transcripts-button');
            this.addClass('fa');
            this.addClass('fa-quote-left');
        },
        createItems: function() {
            var player = this.player();
            var items = [];
            var menuButton = this;
            var tracks = player.textTracks();
            if (!tracks) {
                return items;
            }
            items.push(new TranscriptsMenuItem(player, {
                identity: 'off',
                label: 'Off',
                parent: menuButton,
                selectable: true,
                selected: true
            }));
            items = items.concat(tracks.tracks_.map(function(track) {  // eslint-disable-line no-underscore-dangle
                return new TranscriptsMenuItem(player, {
                    identity: 'item',
                    parent: menuButton,
                    selectable: true,
                    track: track
                });
            }));
            return items;
        }
    });

    var MainContainer = amp.extend(Component, {
        constructor: function() {
            Component.apply(this, arguments);
            this.addClass('tc-wrapper');
            this.addClass('video');
            this.addClass('closed');
        }
    });

    var TranscriptContainer = amp.extend(Component, {
        constructor: function() {
            Component.apply(this, arguments);
        },
        createEl: function() {
            return $('<div class="tc-container"><ul class="subtitles-menu"></ul></div>').get(0);
        }
    });

    var CueItem = amp.extend(MenuItem, {
        constructor: function() {
            var player = arguments[0];  // eslint-disable-line no-unused-vars
            var options = arguments[1];
            this.text = options.text;
            this.startTime = options.startTime;
            this.endTime = options.endTime;
            MenuItem.apply(this, arguments);
        },
        createEl: function() {
            return Component.prototype.createEl(
                'li',
                {
                    tabIndex: -1,
                    role: 'link',
                    className: 'transcript-cue',
                    innerHTML: $('<span>').text(this.options_.text).html()  // eslint-disable-line no-underscore-dangle
                },
                {
                    'data-cue-start': this.options_.startTime  // eslint-disable-line no-underscore-dangle
                }
            );
        }
    });

    amp.registerComponent('TranscriptsMenuButton', TranscriptsMenuButton);
    amp.plugin('transcriptsAmpPlugin', function() {
        var player = this;
        var timeHandler = null;
        var $vidParent = $(player.el()).parent().parent();
        var tcButton = new TranscriptsMenuButton(player, {title: 'TRANSCRIPTS'});
        var mainContainer = new MainContainer(player, {});
        var transcriptContainer = new TranscriptContainer(player, {});
        var $transcriptContainerEl = $(transcriptContainer.el());

        this.addEventListener('loadeddata', function() {
            $vidParent.wrap(mainContainer.el());
            $vidParent.parent().append(transcriptContainer.el());

            player
                .getChild('controlBar')
                .getChild('controlBarIconsRight')
                .addChild(tcButton);
        });
        this.addEventListener(amp.eventName.play, function(evt) {  // eslint-disable-line no-unused-vars
            timeHandler = setInterval(function() {
                syncTimer(player, transcriptCues, $transcriptContainerEl);  // eslint-disable-line no-use-before-define
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

     /**
     * This is called regularly while the video plays
     * so that we can correctly highlight the transcript elements
     * based on the current position of the video playback
     * @param player
     * @param trackCues
     * @param $transcriptElement
     * @private
     */
    function syncTimer(player, trackCues, $transcriptElement) {
        // Gather each transcript phrase (each pseudo-hyperlink in transcript).
        var cue;
        var isActive;
        var $targetElement;
        var scrollUpSize;
        var $transcriptItems = $transcriptElement.find('.transcript-cue');
        var currentTime = player.currentTime();

        if (trackCues === null || !$transcriptElement.length) {
            return;
        }

        // Simple linear search.
        for (var i = 0; i < trackCues.length; i++) {  // eslint-disable-line vars-on-top
            cue = trackCues[i];

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
     * @param $transcriptElement
     * @param track
     * @returns {Array}
     */
    function initTranscript(player, $transcriptElement, track) {
        var cue;
        var cueComponent;
        var startTime;
        var $transcriptItems;
        var cues = track.cues;
        var $html = $('<ul class="subtitles-menu"></ul>');

        for (var i = 0; i < cues.length; i++) { // eslint-disable-line vars-on-top
            cue = cues[i];
            cueComponent = new CueItem(player, {
                text: cue.text,
                startTime: cue.startTime,
                endTime: cue.endTime
            });
            $html.append(cueComponent.el());
        }
        $transcriptElement.html($html);

        // Gather each transcript phrase (each pseudo-hyperlink in transcript).
        $transcriptItems = $transcriptElement.find('.transcript-cue');

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
            startTime = parseFloat($(evt.target).data('cue-start'));
            player.currentTime(startTime);
        });

        return cues;
    }
}).call(this);
