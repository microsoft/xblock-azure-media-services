import json
import unittest

import mock
import requests
from xblock.field_data import DictFieldData

from azure_media_services import AMSXBlock


class AMSXBlockTests(unittest.TestCase):

    def make_one(self, **kw):
        """
        Create a XBlock AMS for testing purpose.
        """
        field_data = DictFieldData(kw)
        block = AMSXBlock(mock.Mock(), field_data, mock.Mock())
        block.location = mock.Mock(org='org_name', course_key='course_key')
        return block

    def test_default_fields_xblock(self):
        block = self.make_one()
        self.assertEqual(block.display_name, "Azure Media Services Video Player")
        self.assertEqual(block.video_url, '')
        self.assertEqual(block.verification_key, '')
        self.assertEqual(block.protection_type, '')
        self.assertEqual(block.token_issuer, 'http://openedx.microsoft.com/')
        self.assertEqual(block.token_scope, 'urn:xblock-azure-media-services')
        self.assertEqual(block.captions, [])
        self.assertEqual(block.transcripts_enabled, False)
        self.assertEqual(block.download_url, None)

    @mock.patch('azure_media_services.ams.get_azure_config', return_value={})
    @mock.patch('azure_media_services.ams.loader.load_unicode', side_effect=('public/css/studio.css',
                                                                             'static/js/studio_edit.js'))
    @mock.patch('azure_media_services.ams.loader.render_django_template')
    @mock.patch('azure_media_services.ams.Fragment')
    def test_studio_view(self, fragment, render_django_template, load_unicode, get_azure_config):
        """
        Test studio view is displayed correctly.
        """
        block = self.make_one()
        frag = block.studio_view({})

        get_azure_config.assert_called_once_with('org_name')
        render_django_template.assert_called_once()

        template_arg = render_django_template.call_args[0][0]
        self.assertEqual(template_arg, 'templates/studio_edit.html')

        context = render_django_template.call_args[0][1]
        self.assertEqual(context['has_azure_config'], False)
        self.assertEqual(context['list_stream_videos'], [])
        self.assertEqual(len(context['fields']), 9)

        frag.add_javascript.assert_called_once_with('static/js/studio_edit.js')
        frag.add_css.assert_called_once_with("public/css/studio.css")
        frag.initialize_js.assert_called_once_with("StudioEditableXBlockMixin")

    @mock.patch('azure_media_services.ams.Video.objects.filter', return_value=mock.Mock(order_by=mock.Mock(
        return_value=['video1', 'video2'])))
    def test_get_list_stream_videos(self, video_filter):

        block = self.make_one()
        list_stream_videos = block.get_list_stream_videos()
        video_filter.assert_called_once_with(
            courses__course_id='course_key',
            courses__is_hidden=False,
            status__in=['file_complete', 'file_encrypted']
        )
        video_filter().order_by.assert_called_once_with('-created', 'edx_video_id')
        self.assertEqual(list_stream_videos, ['video1', 'video2'])

    def test_get_video_info(self):
        block = self.make_one()

        video = mock.Mock(client_video_id='video_name.mp4')
        path_locator_on_demand = '//ma.streaming.mediaservices.windows.net/locator_id/'
        path_locator_sas = '//sa.blob.core.windows.net/asset-locator_id?sv=2012-02-12&sr=c'
        asset_files = [
            {
                "Name": "fileNameIsm.ism",
                "MimeType": "application/octet-stream",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_1.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_2.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 20
            }
        ]

        video_info = block.get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

        expected_video_info = {
            'smooth_streaming_url': '//ma.streaming.mediaservices.windows.net/locator_id/video_name.ism/manifest',
            'download_video_url': '//sa.blob.core.windows.net/asset-locator_id/fileName_2.mp4?sv=2012-02-12&sr=c'
        }

        self.assertEqual(video_info, expected_video_info)

    def test_get_video_info_if_path_locator_on_demand_is_not_defined(self):
        block = self.make_one()
        video = mock.Mock(client_video_id='video_name.mp4')
        path_locator_on_demand = ''
        path_locator_sas = '//sa.blob.core.windows.net/asset-locator_id?sv=2012-02-12&sr=c'
        asset_files = [
            {
                "Name": "fileNameIsm.ism",
                "MimeType": "application/octet-stream",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_1.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_2.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 20
            }
        ]

        video_info = block.get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

        expected_video_info = {
            'smooth_streaming_url': '',
            'download_video_url': '//sa.blob.core.windows.net/asset-locator_id/fileName_2.mp4?sv=2012-02-12&sr=c'
        }

        self.assertEqual(video_info, expected_video_info)

    def test_get_video_info_if_path_locator_sas_is_not_defined(self):
        block = self.make_one()

        video = mock.Mock(client_video_id='video_name.mp4')
        path_locator_on_demand = '//ma.streaming.mediaservices.windows.net/locator_id/'
        path_locator_sas = ''
        asset_files = [
            {
                "Name": "fileNameIsm.ism",
                "MimeType": "application/octet-stream",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_1.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 10
            },
            {
                "Name": "fileName_2.mp4",
                "MimeType": "video/mp4",
                "ContentFileSize": 20
            }
        ]

        video_info = block.get_video_info(video, path_locator_on_demand, path_locator_sas, asset_files)

        expected_video_info = {
            'smooth_streaming_url': '//ma.streaming.mediaservices.windows.net/locator_id/video_name.ism/manifest',
            'download_video_url': ''
        }

        self.assertEqual(video_info, expected_video_info)

    @mock.patch('azure_media_services.ams.all_languages', return_value=(('en', 'English'), ('fr', 'French')))
    def test_get_captions_info(self, all_languages):
        block = self.make_one()
        path_locator_sas = '//sa.blob.core.windows.net/asset-locator_id?sv=2012-02-12&sr=c'
        video = mock.Mock(subtitles=mock.Mock(all=mock.Mock(
            return_value=[
                mock.Mock(content='file_name_en.mp4', language='en'),
                mock.Mock(content='file_name_fr.mp4', language='fr')
            ]
        )))

        captions_info = block.get_captions_info(video, path_locator_sas)

        expected_data = [
            {
                'download_url': '//sa.blob.core.windows.net/asset-locator_id/file_name_en.mp4?sv=2012-02-12&sr=c',
                'file_name': 'file_name_en.mp4',
                'language': 'en',
                'language_title': 'English'
            },
            {
                'download_url': '//sa.blob.core.windows.net/asset-locator_id/file_name_fr.mp4?sv=2012-02-12&sr=c',
                'file_name': 'file_name_fr.mp4',
                'language': 'fr',
                'language_title': 'French'
            }
        ]
        self.assertEqual(captions_info, expected_data)

    def test_drop_http_or_https(self):
        block = self.make_one()

        url = block.drop_http_or_https('http://ma.streaming.mediaservices.windows.net/locator_id/')
        self.assertEqual(url, '//ma.streaming.mediaservices.windows.net/locator_id/')

        url = block.drop_http_or_https('https://ma.streaming.mediaservices.windows.net/locator_id/')
        self.assertEqual(url, '//ma.streaming.mediaservices.windows.net/locator_id/')

    @mock.patch('azure_media_services.ams.LocatorTypes')
    @mock.patch('azure_media_services.ams.AMSXBlock.get_video_info', return_value={
        'smooth_streaming_url': 'smooth_streaming_url',
        'download_video_url': 'download_video_url'
    })
    @mock.patch('azure_media_services.ams.AMSXBlock.get_captions_info', return_value=[
        {
            'download_url': 'download_url',
            'file_name': 'file_name_en.mp4',
            'language': 'en',
            'language_title': 'English'
        }
    ])
    @mock.patch('azure_media_services.ams.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value={'Id': 'asset_id'}),
        get_asset_locators=mock.Mock(side_effect=({'Path': 'path_locator_on_demand'}, {'Path': 'path_locator_sas'})),
        get_asset_files=mock.Mock(return_value=['asset_file_1', 'asset_file_2'])
    ))
    @mock.patch('azure_media_services.ams.Video.objects.get', return_value='video_object')
    def test_get_captions_and_video_info(self, video_get, get_media_service_client, get_captions_info,
                                         get_video_info, locator_types):
        locator_types.OnDemandOrigin = 'OnDemandOrigin'
        locator_types.SAS = 'SAS'
        block = self.make_one()

        captions_and_video_info = block.get_captions_and_video_info(
            mock.Mock(method="POST", body=json.dumps({'edx_video_id': 'edx_video_id'}))
        )

        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        get_media_service_client.assert_called_once_with('org_name')

        media_service_client = get_media_service_client()
        media_service_client.get_input_asset_by_video_id.assert_called_once_with('edx_video_id', 'ENCODED')
        self.assertEqual(
            media_service_client.get_asset_locators.call_args_list,
            [mock.call('asset_id', 'OnDemandOrigin'), mock.call('asset_id', 'SAS')]
        )
        get_captions_info.assert_called_once_with('video_object', 'path_locator_sas')
        media_service_client.get_asset_files.assert_called_once_with('asset_id')
        get_video_info.assert_called_once_with(
            'video_object',
            'path_locator_on_demand',
            'path_locator_sas',
            ['asset_file_1', 'asset_file_2']
        )

        expected_data = {
            'error_message': '',
            'video_info': {
                'smooth_streaming_url': 'smooth_streaming_url',
                'download_video_url': 'download_video_url'
            },
            'captions': [
                {
                    'download_url': 'download_url',
                    'file_name': 'file_name_en.mp4',
                    'language': 'en',
                    'language_title': 'English'
                }
            ]
        }

        self.assertEqual(captions_and_video_info.json, expected_data)

    @mock.patch('azure_media_services.ams.get_media_service_client', return_value=mock.Mock(
        get_input_asset_by_video_id=mock.Mock(return_value=[]),
    ))
    @mock.patch('azure_media_services.ams.Video.objects.get', return_value='video_object')
    def test_get_captions_and_video_info_if_is_no_asset(self, video_get, get_media_service_client):
        block = self.make_one()

        captions_and_video_info = block.get_captions_and_video_info(
            mock.Mock(method="POST", body=json.dumps({'edx_video_id': 'edx_video_id'}))
        )

        video_get.assert_called_once_with(edx_video_id='edx_video_id')
        get_media_service_client.assert_called_once_with('org_name')

        media_service_client = get_media_service_client()
        media_service_client.get_input_asset_by_video_id.assert_called_once_with('edx_video_id', 'ENCODED')

        expected_data = {
            'error_message': 'Target Video is no longer available on Azure or is corrupted in some way.',
            'video_info': {},
            'captions': []
        }

        self.assertEqual(captions_and_video_info.json, expected_data)

    @mock.patch('azure_media_services.ams.requests.get', return_value=mock.Mock(
        status_code=200, content='test_transcript_content'
    ))
    def test_fetch_transcript_success(self, request_get_mock):
        block = self.make_one()
        test_data = {'srcUrl': 'test_transcript_url', 'srcLang': 'testTranscriptLangCode'}
        handler_request_mock = mock.Mock(method="POST", body=json.dumps(test_data))

        handler_response = block.fetch_transcript(handler_request_mock)

        request_get_mock.assert_called_once_with(test_data['srcUrl'])
        self.assertEqual(handler_response.json, {'result': 'success', 'content': 'test_transcript_content'})

    @mock.patch('azure_media_services.ams.log.exception')
    @mock.patch(
        'azure_media_services.ams.requests.get', return_value=mock.Mock(status_code=400),
        side_effect=requests.RequestException()
    )
    def test_fetch_transcript_ioerror(self, request_get_mock, logger_mock):
        block = self.make_one()
        test_data = {'srcUrl': 'test_transcript_url', 'srcLang': 'testTranscriptLangCode'}
        handler_request_mock = mock.Mock(method="POST", body=json.dumps(test_data))
        test_failure_message = "Transcript fetching failure: language [{}]".format('testTranscriptLangCode')

        handler_response = block.fetch_transcript(handler_request_mock)

        request_get_mock.assert_called_once_with(test_data['srcUrl'])
        logger_mock.assert_called_once_with(test_failure_message)
        self.assertEqual(handler_response.json, {'result': 'error', 'message': test_failure_message})

    @mock.patch('azure_media_services.ams.log.exception')
    @mock.patch(
        'azure_media_services.ams.requests.get', return_value=mock.Mock(status_code=200), side_effect=ValueError()
    )
    def test_fetch_transcript_other_parse_error(self, request_get_mock, logger_mock):
        block = self.make_one()
        test_data = {'srcUrl': 'test_transcript_url', 'srcLang': 'testTranscriptLangCode'}
        handler_request_mock = mock.Mock(method="POST", body=json.dumps(test_data))
        test_failure_message = "Transcript fetching failure: language [{}]".format('testTranscriptLangCode')
        test_log_message = "Can't get content of the fetched transcript: language [{}]".format(
            'testTranscriptLangCode'
        )

        handler_response = block.fetch_transcript(handler_request_mock)

        request_get_mock.assert_called_once_with(test_data['srcUrl'])
        logger_mock.assert_called_once_with(test_log_message)
        self.assertEqual(handler_response.json, {'result': 'error', 'message': test_failure_message})
