import json
import os
import sys

from flask import Blueprint, render_template

from metatube import Config as env
from metatube import socketio, sockets
from metatube.database import Config, Templates
from metatube.ffmpeg import ffmpeg

bp = Blueprint(
    "settings",
    __name__,
    static_folder="../static",
    template_folder="../templates/",
    url_prefix=env.URL_SUBPATH,
)


@bp.route("/settings", methods=["GET", "POST"])
def settings() -> str:
    db_config = Config().query.get(1)
    if db_config is None:
        return render_template("errors.html", e="No configuration found")
    ffmpeg_path: str = db_config.ffmpeg_directory
    amount = db_config.amount
    hw_transcoding = db_config.hardware_transcoding
    metadata_sources = db_config.metadata_sources.split(";")
    spotify = (
        db_config.spotify_api.split(";")
        if db_config.spotify_api is not None
        else ["", ""]
    )
    genius = db_config.genius_api if db_config.genius_api is not None else ""
    templates = Templates.query.all()

    return render_template(
        "settings.html",
        ffmpeg=ffmpeg_path,
        amount=amount,
        current_page="settings",
        templates=templates,
        hw_transcoding=hw_transcoding,
        metadata_sources=metadata_sources,
        spotify=spotify,
        genius=genius,
    )


proxy_json = {
    "status": False,
    "type": "",
    "address": "",
    "port": "",
    "username": "",
    "password": "",
}


@socketio.on("update_template")
def template(
    name,
    output_folder,
    output_ext,
    output_name,
    _id,
    goal,
    bitrate="best",
    width="best",
    height="best",
    proxy_json=proxy_json,
):
    data = {
        "name": name,
        "output_folder": output_folder,
        "ext": output_ext,
        "output_name": output_name,
        "bitrate": str(bitrate),
        "width": width,
        "height": height,
        "resolution": str(width) + ";" + str(height),
    }
    proxy = json.loads(proxy_json)
    data["proxy"] = {
        "status": str(proxy["status"]) == "true",
        "type": proxy["type"],
        "address": proxy["address"],
        "port": proxy["port"],
        "username": proxy["username"],
        "password": proxy["password"],
    }
    print(data["proxy"]["status"])
    if (
        len(data["name"]) < 1
        or len(data["output_folder"]) < 1
        or len(data["ext"]) < 1
        or len(goal) < 1
        or len(_id) < 1
        or len(data["output_name"]) < 1
    ):
        sockets.change_template("Enter all fields!")
    elif data["proxy"]["status"] is True and (
        len(data["proxy"]["address"]) < 1
        or len(data["proxy"]["type"]) < 1
        or len(data["proxy"]["port"]) < 1
    ):
        sockets.change_template("Enter all proxy fields!")
    else:
        # check if output folder is absolute or relative
        if data["output_folder"].startswith("/") or (
            data["output_folder"][0].isalpha()
            and data["output_folder"][1].startswith(":\\")
        ):
            # check if output folder actually exists and if it's a directory
            if (
                os.path.exists(data["output_folder"]) is False
                or os.path.isdir(data["output_folder"]) is False
            ):
                sockets.change_template("Output directory doesn't exist")
        else:
            data["output_folder"] = os.path.join(env.BASE_DIR, data["output_folder"])
            if (
                os.path.exists(data["output_folder"]) is False
                or os.path.isdir(data["output_folder"]) is False
            ):
                sockets.change_template("Output directory doesn't exist")

        if data["ext"] not in [
            "mp4",
            "flv",
            "webm",
            "ogg",
            "mkv",
            "avi",
            "aac",
            "flac",
            "mp3",
            "m4a_audio",
            "m4a_video",
            "opus",
            "vorbis",
            "wav",
        ]:
            sockets.change_template("Incorrect extension")

        if data["ext"] in ["aac", "flac", "mp3", "m4a_audio", "opus", "vorbis", "wav"]:
            data["type"] = "Audio"

        elif data["ext"] in ["mp4", "m4a_video", "flv", "webm", "ogg", "mkv", "avi"]:
            data["type"] = "Video"

        if goal == "add":
            if Templates.check_existing(data["name"]):
                sockets.change_template("Name is already in use")
                return False
            data["id"] = Templates.add(data)
            sockets.template_settings(
                {
                    "status": "new_template",
                    "msg": "Template successfully added",
                    "data": data,
                }
            )

        elif goal == "edit":
            editing_template = Templates.fetch_template(_id)
            if editing_template is None:
                sockets.change_template("Template doesn't exist")
                return False
            editing_template.edit(data)
            sockets.template_settings(
                {
                    "status": "changed_template",
                    "msg": "Template successfully changed",
                    "data": data,
                }
            )


@socketio.on("delete_template")
def del_template(_id) -> bool:
    if len(_id) < 1:
        sockets.template_settings({"status": "error", "msg": "Select a valid template"})
        return False
    if Templates.count_templates() < 2:
        sockets.template_settings(
            {"status": "error", "msg": "You must have one existing template!"}
        )
        return False
    template_to_delete = Templates.fetch_template(input_id=_id)
    if template_to_delete is None:
        sockets.template_settings({"status": "error", "msg": "Template doesn't exist!"})
        return False
    if template_to_delete.default is True:
        sockets.template_settings(
            {"status": "error", "msg": "You can't  delete the default template!"}
        )
        return False
    template_to_delete.delete()
    sockets.template_settings(
        {"status": "delete", "msg": "Template successfully removed", "template_id": _id}
    )
    return True


@socketio.on("set_default_template")
def default_template(_id) -> bool:
    if len(_id) < 1:
        sockets.template_settings({"status": "error", "msg": "Select a valid template"})
        return False
    new_default_template = Templates.fetch_template(input_id=_id)
    if new_default_template is None:
        sockets.template_settings({"status": "error", "msg": "Template doesn't exist!"})
        return False
    default = Templates.search_default()
    new_default_template.set_default(default)
    return True


@socketio.on("update_settings")
def update_settings(
    ffmpeg_path, amount, hardware_transcoding, metadata_sources, extra_data
):
    db_config = Config.query.get(1)
    if db_config is None:
        return
    response = ""

    if db_config.ffmpeg_directory != ffmpeg_path:
        ffmpeg_path = os.path.join(env.BASE_DIR, ffmpeg_path)
        if os.path.exists(ffmpeg_path):
            if os.path.isfile(ffmpeg_path):
                ffmpeg_path = os.path.dirname(ffmpeg_path)
            if db_config.ffmpeg_directory != ffmpeg_path:
                db_config.ffmpeg(ffmpeg_path)
                ffmpeg_instance = ffmpeg()
                if ffmpeg_instance.test():
                    response += (
                        "FFmpeg path has successfully been updated and found! <br />"
                    )
                else:
                    response += "FFmpeg path has successfully been updated, but the application hasn't been found <br />"
        else:
            response += "FFmpeg path doesn't exist <br/>"

    if str(db_config.amount) != str(amount):
        db_config.set_amount(amount)
        response += "Max amount has successfully been updated <br />"

    if str(db_config.hardware_transcoding) != str(hardware_transcoding):
        if "vaapi" in hardware_transcoding:
            if len(hardware_transcoding.split(";")[1]) < 1:
                response += "Enter a VAAPI device path! <br />"
                sys.exit()
        db_config.set_hw_transcoding(hardware_transcoding)
        response += "Hardware Transcoding setting has successfully been updated! <br />"

    if ";".join(sorted(metadata_sources)) != ";".join(
        sorted(db_config.metadata_sources.split(";"))
    ):
        if (len(metadata_sources) == 1 and "genius" not in metadata_sources) or (
            len(metadata_sources) > 1
        ):
            db_config.set_metadata(";".join(sorted(metadata_sources)))
            response += "Metadata setting has successfully been updated! <br />"
        else:
            response += (
                "At least one metadata source excluding Genius must be selected! <br />"
            )

    if "spotify" in metadata_sources and "spotify_api" in extra_data:
        spotify_data = (
            extra_data["spotify_api"]["secret"] + ";" + extra_data["spotify_api"]["id"]
        )
        if str(db_config.spotify_api) != spotify_data:
            db_config.set_spotify(spotify_data)
            response += "Spotify API settings have successfully been updated! <br />"

    if "genius" in metadata_sources and "genius_api" in extra_data:
        genius_data = extra_data["genius_api"]["token"]
        if str(db_config.genius_api) != genius_data:
            db_config.set_genius(genius_data)
            response += "Genius API settings have successfully been updated! <br/>"

    sockets.download_settings(response)
