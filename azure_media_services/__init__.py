# Copyright (c) Microsoft Corporation. All Rights Reserved.
# Licensed under the MIT license. See LICENSE file on the project webpage for details.

"""
Runtime will load the XBlock class from here.
"""
import django
from django.conf import settings

if not settings.configured:
    settings.configure(
        INSTALLED_APPS=(
            'organizations',
            'azure_media_services',
        ),
        FEATURES={}
    )
    django.setup()

from .ams import AMSXBlock  # noqa: F401
