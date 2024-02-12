#!/usr/bin/env python

# coding: utf-8
import os

from gevent import get_hub
from str2bool import str2bool

from metatube import create_app, socketio

if __name__ == "__main__":
    app = create_app()
    port = os.environ.get("PORT", 35000)
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("DEBUG", False)
    log_output = os.environ.get("LOG", False)
    get_hub().NOT_ERROR += (KeyboardInterrupt,)
    try:
        print(f"Starting the webserver on http://{host}:{port}...")
        socketio.run(app, str(host), int(port), log_output=str2bool(str(log_output)))  # type: ignore
    except KeyboardInterrupt:
        print("Stopped server because of KeyboardInterrupt")
