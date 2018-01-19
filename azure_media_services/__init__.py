# Copyright (c) Microsoft Corporation. All Rights Reserved.
# Licensed under the MIT license. See LICENSE file on the project webpage for details.

"""
Runtime will load the XBlock class from here.
"""
from django.conf import settings
import mock

if not settings.configured:

    import sys

    sys.modules['azure_video_pipeline'] = mock.MagicMock()
    sys.modules['azure_video_pipeline.media_service'] = mock.MagicMock()
    sys.modules['azure_video_pipeline.utils'] = mock.MagicMock()

    sys.modules['edxval'] = mock.MagicMock()
    sys.modules['edxval.models'] = mock.MagicMock()

    sys.modules['openedx'] = mock.MagicMock()
    sys.modules['openedx.core'] = mock.MagicMock()
    sys.modules['openedx.core.djangoapps'] = mock.MagicMock()
    sys.modules['openedx.core.djangoapps.lang_pref'] = mock.MagicMock()
    sys.modules['openedx.core.djangoapps.lang_pref.api'] = mock.MagicMock()


from .ams import AMSXBlock  # noqa: F401
