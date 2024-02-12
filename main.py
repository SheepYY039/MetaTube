#!/usr/bin/env python

# coding: utf-8
import os

from flask import Flask
from gevent import get_hub
from str2bool import str2bool

from metatube import create_app, socketio

if __name__ == "__main__":
    app: Flask = create_app()
    port: str | int = os.environ.get("PORT", 35000)
    host: str = os.environ.get("HOST", "127.0.0.1")
    debug: str | bool = os.environ.get("DEBUG", True)
    log_output: str | bool = os.environ.get("LOG", False)
    get_hub().NOT_ERROR += (KeyboardInterrupt,)
    try:
        print(f"Starting the webserver on http://{host}:{port}...")
        socketio.run(app, str(host), int(port), log_output=str2bool(str(log_output)))  # type: ignore
    except KeyboardInterrupt:
        print("Stopped server because of KeyboardInterrupt")
