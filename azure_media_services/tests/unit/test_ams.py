import unittest

from azure_media_services import AMSXBlock
from azure_media_services.media_services_management_client import MediaServicesManagementClient

import mock

from xblock.field_data import DictFieldData


class AMSXBlockTests(unittest.TestCase):

    def make_one(self, **kw):
        """
        Create a XBlock AMS for testing purpose.
        """
        field_data = DictFieldData(kw)
        block = AMSXBlock(mock.Mock(), field_data, mock.Mock())
        block.location = mock.Mock(org='name_org')
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
        self.assertEqual(block.transcript_url, None)
        self.assertEqual(block.download_url, None)

    @mock.patch('azure_media_services.AMSXBlock.get_media_services')
    @mock.patch('azure_media_services.AMSXBlock.get_settings_azure', return_value=None)
    @mock.patch('azure_media_services.ams.loader.load_unicode', side_effect=('public/css/studio.css',
                                                                             'static/js/studio_edit.js'))
    @mock.patch('azure_media_services.ams.loader.render_django_template')
    @mock.patch('azure_media_services.ams.Fragment')
    def test_studio_view(self, fragment, render_django_template, load_unicode, get_settings_azure, get_media_services):
        """
        Test studio view is displayed correctly.
        """
        block = self.make_one()
        frag = block.studio_view({})

        get_media_services.assert_not_called()
        render_django_template.assert_called_once()

        template_arg = render_django_template.call_args[0][0]
        self.assertEqual(template_arg, 'templates/studio_edit.html')

        context = render_django_template.call_args[0][1]
        self.assertEqual(context['is_settings_azure'], False)
        self.assertEqual(context['list_locators'], [])
        self.assertEqual(len(context['fields']), 9)

        frag.add_javascript.assert_called_once_with('static/js/studio_edit.js')
        frag.add_css.assert_called_once_with("public/css/studio.css")
        frag.initialize_js.assert_called_once_with("StudioEditableXBlockMixin")

    def test_get_settings_azure_for_organization(self):
        with mock.patch('azure_media_services.models.SettingsAzureOrganization.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(
                            return_value=mock.Mock(organization='name_org',
                                                   client_id='client_id',
                                                   client_secret='client_secret',
                                                   tenant='tenant',
                                                   rest_api_endpoint='rest_api_endpoint')))):
            block = self.make_one()
            parameters = block.get_settings_azure()

            expected_parameters = {
                'client_id': 'client_id',
                'secret': 'client_secret',
                'tenant': 'tenant',
                'resource': 'https://rest.media.azure.net',
                'rest_api_endpoint': 'rest_api_endpoint'
            }
            self.assertEqual(parameters, expected_parameters)

    def test_get_settings_azure_for_platform(self):
        with mock.patch('azure_media_services.models.SettingsAzureOrganization.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(return_value=None))):
            with mock.patch.dict('azure_media_services.ams.settings.FEATURES', {
                'AZURE_CLIENT_ID': 'client_id',
                'AZURE_CLIENT_SECRET': 'client_secret',
                'AZURE_TENANT': 'tenant',
                'AZURE_REST_API_ENDPOINT': 'rest_api_endpoint'
            }):
                block = self.make_one()
                parameters = block.get_settings_azure()

                expected_parameters = {
                    'client_id': 'client_id',
                    'secret': 'client_secret',
                    'tenant': 'tenant',
                    'resource': 'https://rest.media.azure.net',
                    'rest_api_endpoint': 'rest_api_endpoint'
                }
                self.assertEqual(parameters, expected_parameters)

    def test_when_not_set_settings_azure(self):
        with mock.patch('azure_media_services.models.SettingsAzureOrganization.objects.filter',
                        return_value=mock.Mock(first=mock.Mock(return_value=None))):
            with mock.patch.dict('azure_media_services.ams.settings.FEATURES', {}):
                block = self.make_one()
                parameters = block.get_settings_azure()
                self.assertEqual(parameters, None)

    @mock.patch('azure_media_services.ams.MediaServicesManagementClient')
    def test_get_media_services(self, media_services_management_client):
        block = self.make_one()
        media_services = block.get_media_services({})
        media_services_management_client.assert_called_once()
        self.assertEqual(media_services, media_services_management_client())


class MediaServicesManagementClientTests(unittest.TestCase):

    @mock.patch('azure_media_services.media_services_management_client.ServicePrincipalCredentials')
    def make_one(self, service_principal_credentials):
        parameters = {
            'client_id': 'client_id',
            'secret': 'client_secret',
            'tenant': 'tenant',
            'resource': 'https://rest.media.azure.net',
            'rest_api_endpoint': 'https://rest_api_endpoint/api/'
        }
        media_services = MediaServicesManagementClient(parameters)
        media_services.credentials = mock.Mock(token={'token_type': 'token_type', 'access_token': 'access_token'})
        return media_services

    @mock.patch('azure_media_services.media_services_management_client.MediaServicesManagementClient.get_headers',
                return_value={})
    @mock.patch('azure_media_services.media_services_management_client.requests.get',
                return_value=mock.Mock(status_code=200,
                                       json=mock.Mock(return_value={'value': ['locator1', 'locator2']})))
    def test_get_list_locators(self, requests_get, headers):
        media_services = self.make_one()
        locators = media_services.get_list_locators()
        requests_get.assert_called_once_with('https://rest_api_endpoint/api/Locators', headers={})
        self.assertEqual(locators, ['locator1', 'locator2'])

    def test_get_headers(self):
        media_services = self.make_one()
        headers = media_services.get_headers()
        expected_headers = {
            'Content-Type': 'application/json',
            'DataServiceVersion': '1.0',
            'MaxDataServiceVersion': '3.0',
            'Accept': 'application/json',
            'Accept-Charset': 'UTF-8',
            'x-ms-version': '2.15',
            'Host': 'rest_api_endpoint',
            'Authorization': 'token_type access_token'
        }
        self.assertEqual(headers, expected_headers)
