# Copyright (c) Microsoft Corporation. All Rights Reserved.
# Licensed under the MIT license. See LICENSE file on the project webpage for details.

# -*- coding: utf-8 -*-
"""
Make '_' a no-op so we can scrape strings
"""


def _(text):
    """
    :return text
    """
    return text
