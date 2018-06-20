from ams import embed_player
from django.conf import settings
from django.conf.urls import patterns, url


urlpatterns = patterns(
    "",

    url(
        r'^{usage_key_string}$'.format(usage_key_string=settings.USAGE_KEY_PATTERN),
        embed_player,
        name="embed_player"
    ),
)
