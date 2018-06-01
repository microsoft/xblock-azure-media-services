# Copyright (c) Microsoft Corporation. All Rights Reserved.
# Licensed under the MIT license. See LICENSE file on the project webpage for details.

"""
Runtime will load the XBlock class from here.
"""
import django
from django.conf import settings
import mock

if not settings.configured:

    import sys

    sys.modules['azure_video_pipeline'] = mock.MagicMock()
    sys.modules['azure_video_pipeline.media_service'] = mock.MagicMock()
    sys.modules['azure_video_pipeline.utils'] = mock.MagicMock()

    sys.modules['edxval'] = mock.MagicMock()
    sys.modules['edxval.models'] = mock.MagicMock()

    sys.modules['util'] = mock.MagicMock()
    sys.modules['util.views'] = mock.MagicMock()

    sys.modules['opaque_keys'] = mock.MagicMock()
    sys.modules['opaque_keys.edx'] = mock.MagicMock()
    sys.modules['opaque_keys.edx.keys'] = mock.MagicMock()

    sys.modules['xmodule'] = mock.MagicMock()
    sys.modules['xmodule.modulestore'] = mock.MagicMock()
    sys.modules['xmodule.modulestore.django'] = mock.MagicMock()

    settings.configure(
        LMS_ROOT_URL='http://lms.com'
    )
    django.setup()

from .ams import AMSXBlock  # noqa: F401
