# -*- coding: utf-8 -*-
"""
Copyright (c) Microsoft Corporation. All Rights Reserved.

Licensed under the MIT license. See LICENSE file on the project webpage for details.

XBlock to allow for video playback from Azure Media Services
Built using documentation from: http://amp.azure.net/libs/amp/latest/docs/index.html
"""
import logging

from django.core.exceptions import ImproperlyConfigured
from edxval.models import Video
import requests
from xblock.core import List, Scope, String, XBlock
from xblock.fields import Boolean
from xblock.fragment import Fragment
from xblockutils.resources import ResourceLoader
from xblockutils.studio_editable import StudioEditableXBlockMixin

from .utils import _

APP_AZURE_VIDEO_PIPELINE = True

try:
    from azure_video_pipeline.media_service import LocatorTypes
    from azure_video_pipeline.utils import (
        get_azure_config, get_media_service_client, get_captions_info, get_video_info
    )
except ImportError:
    APP_AZURE_VIDEO_PIPELINE = False


log = logging.getLogger(__name__)
loader = ResourceLoader(__name__)

# According to edx-platform vertical xblocks
CLASS_PRIORITY = ['video']


@XBlock.needs('i18n')
class AMSXBlock(StudioEditableXBlockMixin, XBlock):
    """
    The xBlock to play videos from Azure Media Services.
    """

    RESOURCE = 'https://rest.media.azure.net'

    display_name = String(
        display_name=_("Display Name"),
        help=_(
            "Enter the name that students see for this component. "
            "Analytics reports may also use the display name to identify this component."
        ),
        scope=Scope.settings,
        default=_("Azure Media Services Video Player"),
    )
    video_url = String(
        display_name=_("Video Url"),
        help=_(
            "Enter the URL to your published video on Azure Media Services"
        ),
        default="",
        scope=Scope.settings
    )
    edx_video_id = String(
        default="",
        scope=Scope.settings
    )
    # Ultimately this should come via some secure means, but this is OK for a PoC
    verification_key = String(
        display_name=_("Verification Key"),
        help=_(
            "Enter the Base64 encoded Verification Key from your Azure Management Portal"
        ),
        default="",
        scope=Scope.settings
    )
    protection_type = String(
        display_name=_("Protection Type"),
        help=_(
            "This can be either blank (meaning unprotected), 'AES', or 'PlayReady'"
        ),
        default="",
        scope=Scope.settings
    )
    token_issuer = String(
        display_name=_("Token Issuer"),
        help=_(
            "This value must match what is in the 'Content Protection' area of the Azure Media Services portal"
        ),
        default="http://openedx.microsoft.com/",
        scope=Scope.settings
    )
    token_scope = String(
        display_name=_("Token Scope"),
        help=_(
            "This value must match what is in the 'Content Protection' area of the Azure Media Services portal"
        ),
        default="urn:xblock-azure-media-services",
        scope=Scope.settings
    )
    captions = List(
        display_name=_("Captions"),
        help=_("A list of caption definitions"),
        scope=Scope.settings
    )
    caption_ids = List(
        default=[],
        scope=Scope.settings
    )
    transcripts_enabled = Boolean(
        display_name=_("Transcripts enabled"),
        help=_("Transcripts switch"),
        default=True,
        scope=Scope.settings
    )
    download_url = String(
        display_name=_("Video Download URL"),
        help=_("A download URL"),
        scope=Scope.settings
    )

    # These are what become visible in the Mixin editor
    editable_fields = (
        'display_name', 'video_url', 'verification_key', 'protection_type',
        'token_issuer', 'token_scope', 'captions', 'transcripts_enabled', 'download_url',
        'edx_video_id', 'caption_ids'
    )

    def studio_view(self, context):
        """
        Render a form for editing this XBlock.
        """
        try:
            azure_config = get_azure_config(self.location.org) if APP_AZURE_VIDEO_PIPELINE else {}
        except ImproperlyConfigured:
            azure_config = {}
        list_stream_videos = []

        if azure_config:
            list_stream_videos = self.get_list_stream_videos()
        context = {
            'fields': [],
            'has_azure_config': len(azure_config) != 0,
            'list_stream_videos': list_stream_videos,
            'edx_video_id': self.edx_video_id,
            'caption_ids': self.caption_ids
        }
        fragment = Fragment()
        # Build a list of all the fields that can be edited:
        for field_name in self.editable_fields:
            field = self.fields[field_name]
            assert field.scope in (Scope.content, Scope.settings), (
                "Only Scope.content or Scope.settings fields can be used with "
                "StudioEditableXBlockMixin. Other scopes are for user-specific data and are "
                "not generally created/configured by content authors in Studio."
            )
            field_info = self._make_field_info(field_name, field)
            if field_info is not None:
                context["fields"].append(field_info)
        fragment.content = loader.render_django_template('templates/studio_edit.html', context)
        fragment.add_css(loader.load_unicode('public/css/studio.css'))
        fragment.add_javascript(loader.load_unicode('static/js/studio_edit.js'))
        fragment.initialize_js('StudioEditableXBlockMixin')
        return fragment

    def _get_context_for_template(self):
        """
        Add parameters for the student view.
        """
        context = {
            "video_url": self.video_url,
            "protection_type": self.protection_type,
            "captions": self.captions,
            "transcripts_enabled": bool(self.transcripts_enabled and self.captions),
            "download_url": self.download_url,
        }

        if self.protection_type:
            context.update({
                "auth_token": self.verification_key,
            })

        return context

    def student_view(self, context):
        """
        Student view of this component.

        Arguments: context (dict): XBlock context
        Returns: xblock.fragment.Fragment: XBlock HTML fragment
        """
        fragment = Fragment()
        context.update(self._get_context_for_template())
        fragment.add_content(loader.render_django_template('/templates/player.html', context))

        '''
        Note: DO NOT USE the "latest" folder in production, but specify a version
                from https://aka.ms/ampchangelog . This allows us to run a test
                pass prior to ingesting later versions.
        '''
        fragment.add_javascript(loader.load_unicode('node_modules/videojs-vtt.js/lib/vttcue.js'))

        fragment.add_css_url('//amp.azure.net/libs/amp/2.1.5/skins/amp-default/azuremediaplayer.min.css')
        fragment.add_javascript_url('//amp.azure.net/libs/amp/2.1.5/azuremediaplayer.min.js')

        fragment.add_javascript(loader.load_unicode('static/js/plugins/transcriptsAmpPlugin.js'))
        fragment.add_javascript(loader.load_unicode('static/js/player.js'))

        fragment.add_css(loader.load_unicode('public/css/player.css'))

        # NOTE: The Azure Media Player JS file includes the VTT JavaScript library, so we don't
        # actually need to include our local copy of public/js/vendor/vtt.js. In fact, if we do
        # the overlay subtitles stop working

        # @TODO: Make sure all fields are well structured/formatted, if it is not correct, then
        # print out an error msg in view rather than just silently failing

        fragment.initialize_js(
            'AzureMediaServicesBlock',
            json_args={
                'transcripts_enabled': context['transcripts_enabled'],
                'transcripts': self.captions
            }
        )
        return fragment

    # xblock runtime navigation tab video image
    def get_icon_class(self):
        """
        Return the highest priority icon class.
        """
        child_classes = set(child.get_icon_class() for child in self.get_children())
        new_class = 'video'
        for higher_class in CLASS_PRIORITY:
            if higher_class in child_classes:
                new_class = higher_class
        return new_class

    def get_list_stream_videos(self):
        return Video.objects.filter(
            courses__course_id=self.location.course_key,
            courses__is_hidden=False,
            status__in=["file_complete", "file_encrypted"]
        ).order_by('-created', 'edx_video_id')

    def drop_http_or_https(self, url):
        """
        In order to avoid mixing HTTP/HTTPS which can cause some warnings to appear in some browsers.
        """
        return url.replace("https:", "").replace("http:", "")

    # Xblock handlers:
    @XBlock.json_handler
    def get_captions_and_video_info(self, data, suffix=''):
        edx_video_id = data.get('edx_video_id')

        try:
            video = Video.objects.get(edx_video_id=edx_video_id)
        except Video.DoesNotExist:
            asset = None
        else:
            media_service = get_media_service_client(self.location.org)
            asset = media_service.get_input_asset_by_video_id(edx_video_id, 'ENCODED')

        error_message = _("Target Video is no longer available on Azure or is corrupted in some way.")
        captions = []
        video_info = {}
        asset_files = None

        if asset:
            locator_on_demand = media_service.get_asset_locators(asset['Id'], LocatorTypes.OnDemandOrigin)
            locator_sas = media_service.get_asset_locators(asset['Id'], LocatorTypes.SAS)

            if locator_on_demand:
                error_message = ''
                path_locator_on_demand = self.drop_http_or_https(locator_on_demand.get('Path'))
                path_locator_sas = None

                if locator_sas:
                    path_locator_sas = self.drop_http_or_https(locator_sas.get('Path'))
                    captions = get_captions_info(video, path_locator_sas)
                    asset_files = media_service.get_asset_files(asset['Id'])
                else:
                    error_message = _("To be able to use captions/transcripts auto-fetching, "
                                      "AMS Asset should be published properly "
                                      "(in addition to 'streaming' locator a 'progressive' "
                                      "locator must be created as well).")

                video_info = get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

        return {'error_message': error_message,
                'video_info': video_info,
                'captions': captions}

    @XBlock.json_handler
    def publish_event(self, data, suffix=''):
        try:
            event_type = data.pop('event_type')
        except KeyError:
            return {'result': 'error', 'message': _('Missing event_type in JSON data')}

        data['video_url'] = self.video_url
        data['user_id'] = self.scope_ids.user_id

        self.runtime.publish(self, event_type, data)
        return {'result': 'success'}

    @XBlock.json_handler
    def fetch_transcript(self, data, _suffix=''):
        """
        Xblock handler to perform actual transcript content fetching.

        :param data: transcript language code and transcript URL
        :param _suffix: not using
        :return: transcript's text content
        """
        handler_response = {'result': 'error', 'message': _('Missing required transcript data: `src` and `srcLang`')}

        try:
            transcript_url = data.pop('srcUrl')
            transcript_lang = data.pop('srcLang')
        except KeyError:
            return handler_response

        failure_message = "Transcript fetching failure: language [{}]".format(transcript_lang)
        try:
            response = requests.get(transcript_url)
            return {
                'result': 'success',
                'content': response.content
            }
        except IOError:
            log.exception(failure_message)
            handler_response['message'] = _(failure_message)
            return handler_response
        except (ValueError, KeyError, TypeError, AttributeError):
            log.exception("Can't get content of the fetched transcript: language [{}]".format(transcript_lang))
            handler_response['message'] = _(failure_message)
            return handler_response
