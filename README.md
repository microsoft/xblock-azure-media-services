Azure Media Services xBlock
===========================

This xBlock allows for the inclusion of videos that are hosted on Azure Media Services inside of Open edX courses. The primary features of this xBlock are:

* (optionally) protected videos that only students enrolled in a course can watch the video. This contrasts with the standard Open edX video player which does not offer any protection from non-enrolled students to watch the video

* subtitles/captions via WebVTT standards

* interactive transcripts

Installation
------------

To install the Azure Media Services XBlock within your edX Python environment, run the following command (for fullstack):

```bash
$ sudo -u edxapp bash
$ source /edx/app/edxapp/edxapp_env
$ pip install /path/to/xblock-officevideo/
```

or for devstack:

```bash
$ sudo su edxapp
$ pip install /path/to/xblock-officevideo/
```


