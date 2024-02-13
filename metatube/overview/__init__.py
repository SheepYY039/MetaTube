import json
import os
import random
import shutil
import string
from datetime import datetime
from shutil import move
from tempfile import mkdtemp
from zipfile import ZipFile

import requests
from dateutil import parser
from flask import Blueprint, render_template
from magic import Magic
from str2bool import str2bool

import metatube.musicbrainz as musicbrainz
import metatube.sponsorblock as sb
from metatube import Config as env
from metatube import socketio, sockets
from metatube.database import Config, Database, Templates
from metatube.deezer import Deezer
from metatube.genius import Genius
from metatube.metadata import MetaData
from metatube.spotify import SpotifyMetadata as Spotify
from metatube.youtube import YouTube as yt

bp = Blueprint(
    "overview",
    __name__,
    static_folder="../static",
    template_folder="../templates/",
    url_prefix=env.URL_SUBPATH,
)


@bp.route("/")
def index() -> str:
    """
    Renders the overview page with the necessary data.

    Returns:
        str: The rendered HTML template for the overview page.
    """
    ffmpeg_path: bool = len(Config.query.get(1).ffmpeg_directory) > 0
    records = Database.get_records()
    metadata_sources = Config.get_metadata_sources()
    metadata_form = render_template(
        "metadata_form.html", metadata_sources=metadata_sources
    )
    genius: bool = "genius" in Config.get_metadata_sources().split(";")
    return render_template(
        "overview.html",
        current_page="overview",
        ffmpeg_path=ffmpeg_path,
        records=records,
        metadata_view=metadata_form,
        genius=genius,
    )


@socketio.on("search_item")
def search_item(query) -> None:
    items = Database.search_records(query)
    list = []
    for item_data in items:
        item = {
            "name": item_data.name,
            "artist": item_data.artist,
            "album": item_data.album,
            "date": item_data.date,
            "filepath": item_data.filepath,
            "ytid": item_data.youtube_id,
            "id": item_data.id,
            "image": item_data.cover,
        }
        list.append(item)
    sockets.search_item(list)


@socketio.on("fetch_all_items")
def search_item():
    items = Database.get_records()
    list = []
    for item_data in items:
        item = {
            "name": item_data.name,
            "artist": item_data.artist,
            "album": item_data.album,
            "date": item_data.date,
            "filepath": item_data.filepath,
            "ytid": item_data.youtube_id,
            "id": item_data.id,
            "image": item_data.cover,
        }
        list.append(item)
    sockets.search_item(list)


@socketio.on("ytdl_search")
def search(query):
    """
    Searches for a video based on the given query.

    Args:
        query (str): The search query.

    Returns:
        None
    """
    if query is not None and len(query) > 1:
        if yt.is_supported(query):
            verbose = str2bool(str(env.LOGGER))
            video = yt.fetch_url(query, verbose)

            if Database.check_yt(video["id"]) is None:
                templates = Templates.fetch_all_templates()
                default_template = Templates.search_default()
                metadata_sources = Config.get_metadata_sources()
                socketio.start_background_task(
                    yt.fetch_video, video, templates, metadata_sources, default_template
                )
            else:
                sockets.search_video("This video has already been downloaded!")
        else:
            socketio.start_background_task(yt.search, query)
    else:
        sockets.search_video("Enter an URL!")


@socketio.on("ytdl_template")
def filename(data):
    """
    Generate a filename based on the provided data.

    Args:
        data (dict): A dictionary containing the necessary data for generating the filename.

    Returns:
        str: The generated filename.

    """
    info_dict = json.loads(data["info_dict"])
    filename = yt.verify_template(data["template"], info_dict, False)
    sockets.filename_template(filename)


@socketio.on("search_metadata")
def search_metadata(data):
    """
    Search metadata from various sources based on the given data.

    Args:
        data (dict): The data containing search parameters.

    Returns:
        None
    """
    sources = Config.get_metadata_sources()
    data["max"] = Config.get_max()
    if "musicbrainz" in sources:
        socketio.start_background_task(musicbrainz.webui, data)
    if "spotify" in sources:
        credentials = Config.get_spotify().split(";")
        socketio.start_background_task(Spotify.search_spotify, data, credentials)
    if "deezer" in sources:
        socketio.start_background_task(Deezer.socket_search, data)
    if "genius" in sources and data["type"] == "lyrics":
        token = Config.get_genius()
        socketio.start_background_task(Genius.search_song, data, token)


@socketio.on("ytdl_download")
def download(fileData):
    """
    Downloads a file from the specified URL using the provided options.

    Args:
        fileData (dict): A dictionary containing the following keys:
            - "url" (str): The URL of the file to download.
            - "ext" (str, optional): The file extension. Defaults to "mp3".
            - "output_folder" (str, optional): The folder to save the downloaded file. Defaults to "/downloads".
            - "type" (str, optional): The type of the output file. Defaults to "Audio".
            - "output_format" (str, optional): The output file format. Defaults to "%(title)s.%(ext)s".
            - "bitrate" (str, optional): The bitrate of the output file. Defaults to "192".
            - "skip_fragments" (dict, optional): Fragments to skip during download. Defaults to {}.
            - "proxy_data" (dict, optional): Proxy data for the download. Defaults to {"proxy_type": "None"}.
            - "width" (int, optional): The width of the output file. Defaults to 1920.
            - "height" (int, optional): The height of the output file. Defaults to 1080.

    Returns:
        str: The status of the download process. Returns "OK" if the download was started successfully.
    """
    url = fileData["url"]
    ext = fileData["ext"] or "mp3"
    output_folder = fileData["output_folder"] or "/downloads"
    output_type = fileData["type"] or "Audio"
    output_format = fileData["output_format"] or "%(title)s.%(ext)s"
    bitrate = fileData["bitrate"] or "192"
    skip_fragments = fileData["skip_fragments"] or {}
    proxy_data = fileData["proxy_data"] or {"proxy_type": "None"}

    width = fileData["width"] or 1920
    height = fileData["height"] or 1080
    ffmpeg = Config.get_ffmpeg()
    hw_transcoding = Config.get_hwt()
    vaapi_device = hw_transcoding.split(";")[1] if "vaapi" in hw_transcoding else ""
    verbose = str2bool(str(env.LOGGER))
    logger.info("Request to download %s", fileData["url"])
    ytdl_options = yt.get_options(
        ext,
        output_folder,
        output_type,
        output_format,
        bitrate,
        skip_fragments,
        proxy_data,
        ffmpeg,
        hw_transcoding,
        vaapi_device,
        width,
        height,
        verbose,
    )
    if ytdl_options is not False:
        socketio.start_background_task(yt.start_download, url, ytdl_options)
        # socketio.start_background_task(yt.download, url, ytdl_options)
    return "OK"


@socketio.on("fetch_mbp_release")
def fetch_mbp_release(release_id):
    logger.info("Request for musicbrainz release with id %s", release_id)
    mbp = musicbrainz.search_id_release(release_id)
    socketio.emit("found_mbp_release", json.dumps(mbp))


@socketio.on("fetch_mbp_album")
def fetch_mbp_album(album_id):
    logger.info("Request for musicbrainz release group with id %s", album_id)
    mbp = musicbrainz.search_id_release_group(album_id)
    if not isinstance(mbp, str):
        socketio.emit("found_mbp_album", json.dumps(mbp))
    else:
        sockets.metadata_log("Release group not found!")


@socketio.on("fetch_spotify_album")
def fetch_spotify_album(input_id):
    logger.info("Request for Spotify album with id %s", input_id)


@socketio.on("fetch_spotify_track")
def fetch_spotify_track(input_id):
    logger.info("Request for Spotify track with id %s", input_id)
    cred = Config.get_spotify().split(";")
    spotify = Spotify(cred[1], cred[0])
    spotify.sockets_track(input_id)


@socketio.on("fetch_deezer_track")
def fetch_deezer_track(input_id):
    logger.info("Request for Deezer track with id %s", input_id)
    Deezer.sockets_track(input_id)


@socketio.on("fetch_genius_song")
def fetch_genius_song(input_id):
    logger.info("Request for Genius song with id %s", input_id)
    token = Config.get_genius()
    genius = Genius(token)
    song = genius.fetch_song(input_id)
    sockets.found_genius_song(song)


@socketio.on("fetch_genius_album")
def fetch_genius_album(input_id):
    logger.info("Request for Genius album with id %s", input_id)
    token = Config.get_genius()
    genius = Genius(token)
    genius.fetch_album(input_id)


@socketio.on("merge_data")
def merge_data(metadata, filepath):
    release_id = metadata["release_id"]
    cover = metadata["cover"]
    source = metadata["metadata_source"]

    if (
        Database.check_trackid(release_id) is None
        and Database.check_trackid(metadata.get("trackid", "")) is None
    ):

        metadata_user = metadata
        cover_source = (
            cover
            if cover != "/static/images/empty_cover.png"
            else os.path.join(env.BASE_DIR, "metatube", cover)
        )
        extension = filepath.split(".")[len(filepath.split(".")) - 1].upper()
        if extension in env.META_EXTENSIONS:
            if source == "Spotify":
                cred = Config.get_spotify().split(";")
                spotify = Spotify(cred[1], cred[0])
                metadata_source = spotify.fetch_track(release_id)
                data = MetaData.get_spotify_data(
                    filepath, metadata_user, metadata_source
                )
            elif source == "Musicbrainz":
                metadata_source = musicbrainz.search_id_release(release_id)
                data = MetaData.get_musicbrainz_data(
                    filepath, metadata_user, metadata_source, cover_source
                )
            elif source == "Deezer":
                metadata_source = Deezer.search_id(release_id)
                data = MetaData.get_deezer_data(
                    filepath, metadata_user, metadata_source
                )
            elif source == "Genius":
                token = Config.get_genius()
                genius = Genius(token)
                metadata_source = genius.fetch_song(release_id)
                lyrics = genius.fetch_lyrics(metadata_source["song"]["url"])
                data = MetaData.get_genius_data(
                    filepath, metadata_user, metadata_source, lyrics
                )
            elif source == "Unavailable":
                data = MetaData.only_userdata(filepath, metadata_user)
            else:
                return
            if data is not False:
                data["goal"] = "add"
                data["extension"] = extension
                data["source"] = source
                if extension in ["MP3", "OPUS", "FLAC", "OGG"]:
                    MetaData.merge_audio_data(data)
                elif extension in ["MP4", "M4A"]:
                    MetaData.merge_video_data(data)
                elif extension in ["WAV"]:
                    MetaData.merge_id3_data(data)
        else:
            # The name will be the filename of the downloaded file without the extension
            filename = os.path.split(filepath)[1]
            name = filename[
                0 : len(filename)
                - len(filename.split(".")[len(filename.split(".")) - 1])
                - 1
            ]
            data = {
                "filepath": filepath,
                "name": name,
                "artist": metadata_user.get("artists", "Unknown"),
                "album": "Unknown",
                "date": datetime.now().strftime("%d-%m-%Y"),
                "length": "Unknown",
                "image": cover_source,
                "track_id": release_id,
            }
            sockets.metadata_error(data)
            logger.debug("Metadata unavailable for file %s", data["filepath"])
    else:
        sockets.search_video(f"{source} item has already been downloaded!")
        try:
            os.unlink(filepath)
        except Exception:
            pass


@socketio.on("insert_item")
def insert_item(data):
    id = Database.insert(data)
    data["id"] = id
    sockets.overview({"msg": "inserted_song", "data": data})


@socketio.on("update_item")
def update_item(data):
    id = data["item_id"]
    head, tail = os.path.split(data["filepath"])
    if tail.startswith("tmp_"):
        data["filepath"] = os.path.join(head, tail[4 : len(tail)])
    try:
        data["date"] = parser.parse(data["date"])
    except Exception:
        data["date"] = datetime.now().date()
    item = Database.fetch_item(id)
    data["youtube_id"] = item.youtube_id
    item.update(data)


@socketio.on("download_items")
def download_items(items):
    try:
        output_string = "".join(
            random.SystemRandom().choice(string.ascii_letters + string.digits)
            for _ in range(5)
        )
        tmpdir = mkdtemp()
        zip_filename = "items_" + output_string + ".zip"
        zip_filepath = os.path.join(tmpdir, zip_filename)
        zipfile = ZipFile(zip_filepath, "w")
        for item in items:
            filepath = Database.fetch_item(item).filepath
            filename = os.path.split(filepath)[1]
            if os.path.exists(filepath) and os.path.isfile(filepath):
                zipfile.write(filepath, filename)
        zipfile.close()
        file = open(zip_filepath, "rb")
        content = file.read()
        file.close()
        magic = Magic(mime=True)
        mime = magic.from_file(zip_filepath)
        sockets.overview(
            {
                "msg": "download_file",
                "data": content,
                "filename": zip_filename,
                "mimetype": mime,
            }
        )
    finally:
        try:
            shutil.rmtree(tmpdir)
        except OSError as e:
            logger.error(
                "An error occurred whilst deleting the temporary file: %s", str(e)
            )


@socketio.on("delete_item")
def delete_item(items):
    items = json.loads(items)
    for id in items:
        item = Database.fetch_item(id)
        try:
            os.unlink(item.filepath)
        except Exception:
            pass
        item.delete()
    socket_data = (
        {"msg": "Item succesfully deleted!"}
        if len(items) > 1
        else {"msg": "delete_items"}
    )
    sockets.overview(socket_data)
    return "OK"


@socketio.on("download_item")
def download_item(input):
    item = Database.fetch_item(input)
    if item is None:
        item = Database.check_file(input)
        if item is None:
            sockets.overview({"msg": "Filepath invalid"})
            return False
    path = item.filepath
    if os.path.exists(path) and os.path.isfile(path):
        if Database.check_file(path) is not None:
            extension = path.split(".")[len(path.split(".")) - 1]
            filename = str(item.name) + "." + str(extension)
            magic = Magic(mime=True)
            mimetype = magic.from_file(path)
            with open(path, "rb") as file:
                content = file.read()
            sockets.overview(
                {
                    "msg": "download_file",
                    "data": content,
                    "filename": filename,
                    "mimetype": mimetype,
                }
            )
        else:
            sockets.overview({"msg": "Filepath invalid"})
    else:
        sockets.overview({"msg": "Filepath invalid"})


@socketio.on("play_item")
def play_item(input):
    item = Database.fetch_item(input)
    if item is None:
        item = Database.check_file(input)
        if item is None:
            sockets.overview({"msg": "Filepath invalid"})
            return False
    path = item.filepath
    if os.path.exists(path) and os.path.isfile(path):
        if Database.check_file(path) is not None:
            magic = Magic(mime=True)
            mimetype = magic.from_file(path)
            with open(path, "rb") as file:
                content = file.read()
            sockets.overview(
                {
                    "msg": "play_file",
                    "data": content,
                    "item_data": Database.item_to_dict(item),
                    "mimetype": mimetype,
                }
            )
        else:
            sockets.overview({"msg": "Filepath invalid"})
    else:
        sockets.overview({"msg": "Filepath invalid"})


@socketio.on("show_file_browser")
def show_file_browser(visible, id, target_folder=None):
    default = Templates.search_default()
    if "parent" in visible and target_folder is not None:
        folder = os.path.abspath(os.path.join(target_folder, os.pardir))
    elif (
        target_folder is not None
        and os.path.isdir(target_folder)
        and os.path.exists(target_folder)
    ):
        folder = target_folder
    else:
        folder = default.output_folder
    contents = [x for x in os.listdir(folder) if os.path.isdir(os.path.join(folder, x))]
    contents.extend(
        [x for x in os.listdir(folder) if not os.path.isdir(os.path.join(folder, x))]
    )
    files = []
    for file in contents:
        path = os.path.join(folder, file)
        if os.path.isfile(path):
            extension = path.split(".")[len(path.split(".")) - 1].upper()
            if (
                extension not in env.AUDIO_EXTENSIONS
                and extension not in env.VIDEO_EXTENSIONS
            ):
                continue
            if Database.check_file(path) is not None:
                continue
            if "files" not in visible:
                continue
        last_modified = os.stat(path).st_mtime
        filesize = os.path.getsize(path)
        path_type = "file" if os.path.isfile(path) else "directory"
        item = {
            "filepath": path,
            "filename": file,
            "last_modified": last_modified,
            "filesize": filesize,
            "path_type": path_type,
        }
        files.append(item)
    sockets.overview(
        {
            "msg": "show_file_browser",
            "files": files,
            "visible": visible,
            "directory": folder,
            "id": id,
        }
    )


@socketio.on("update_file")
def update_file(filepath, id):
    item = Database.fetch_item(id)
    item.update_file_path(filepath)


@socketio.on("move_file")
def update_file(directory, filename, id, overwrite=False):
    item = Database.fetch_item(id)
    old_filepath = item.filepath
    if os.path.exists(directory):
        extension = old_filepath.split(".")[len(old_filepath.split(".")) - 1].lower()
        if (
            len(filename.split(".")) > 1
            and filename.split(".")[len(filename.split(".")) - 1] == extension
        ):
            new_filepath = os.path.join(directory, filename.strip())
        else:
            new_filepath = os.path.join(directory, filename.strip() + "." + extension)
        if os.path.exists(new_filepath) and overwrite is False:
            return "File already exists"
        else:
            shutil.move(old_filepath, new_filepath)
            item.update_file_path(new_filepath)


@socketio.on("create_directory")
def create_directory(current_directory, directory_name):
    if os.path.exists(current_directory):
        path = os.path.join(current_directory, directory_name)
        if os.path.exists(path) and os.path.isdir(path):
            response = {"msg": "This directory already exists!", "status": 500}
            return response
        else:
            os.mkdir(path)
            response = {
                "msg": f"Created directory {path}",
                "filepath": path,
                "status": 200,
            }
            logger.info("Created directory %s", path)
            return response


@socketio.on("remove_directory")
def remove_directory(directory):
    if os.path.exists(directory):
        shutil.rmtree(directory)
        name = os.path.basename(directory)
        response = {"msg": "Removed directory", "directory": name, "status": 200}
        logger.info("Removed directory %s", directory)
        return response
    else:
        response = {"msg": "Directory does not exist!", "status": 500}
        return response


@socketio.on("edit_metadata")
def edit_metadata(id):
    item = Database.fetch_item(id)
    extension = item.filepath.split(".")[len(item.filepath.split(".")) - 1].upper()
    if extension in ["MP3", "OPUS", "FLAC", "OGG"]:
        metadata = MetaData.read_audio_metadata(item.filepath)
    elif extension in ["M4A", "MP4"]:
        metadata = MetaData.read_video_metadata(item.filepath)
    else:
        return False
    metadata["audio_id"] = item.audio_id
    metadata["item_id"] = item.id
    metadata["cover"] = item.cover
    metadata_sources = Config.get_metadata_sources()
    metadata_form = render_template(
        "metadata_form.html", metadata_sources=metadata_sources
    )
    sockets.edit_metadata({"metadata": metadata, "metadata_view": metadata_form})


@socketio.on("edit_file")
def edit_file(id):
    item = Database.fetch_item(id)
    item_data = {
        "filepath": item.filepath,
        "name": item.name,
        "album": item.album,
        "date": item.date,
        "length": item.length,
        "audio_id": item.audio_id,
        "youtube_id": item.youtube_id,
        "item_id": item.id,
    }
    templates = Templates.fetch_all_templates()
    default_template = Templates.search_default()
    segment_results = sb.segments(item_data["youtube_id"])
    segments = segment_results if type(segment_results) == list else "error"
    download_form = render_template(
        "download_form.html",
        templates=templates,
        segments=segments,
        default=default_template,
    )
    sockets.edit_file({"file_data": item_data, "download_view": download_form})


@socketio.on("edit_file_request")
def edit_file_request(filepath, id):
    item = Database.fetch_item(id)
    if item is not None:
        extension = item.filepath.split(".")[len(item.filepath.split(".")) - 1].upper()
        new_extension = filepath.split(".")[len(item.filepath.split(".")) - 1].upper()
        if item.cover != os.path.join(
            env.BASE_DIR, "metatube/static/images/empty_cover.png"
        ):
            try:
                response = requests.get(item.cover)
                image = response.content
                magic = Magic(mime=True)
                mime_type = magic.from_buffer(image)
            except Exception:
                sockets.download_progress(
                    {"status": "error", "message": "Cover URL is invalid!"}
                )
                return False
        else:
            file = open(item.cover, "rb")
            image = file.read()
            mime_type = "image/png"
        if extension in ["MP3", "OPUS", "FLAC", "OGG"]:
            metadata_item = MetaData.read_audio_metadata(item.filepath)

        elif extension in ["MP4", "M4A"]:
            metadata_item = MetaData.read_video_metadata(item.filepath)
            metadata_item["barcode"] = ""
            metadata_item["language"] = ""

        metadata_item["track_id"] = item.audio_id
        metadata_item["cover_path"] = item.cover
        metadata_item["cover_mime_type"] = mime_type
        metadata_item["image"] = image
        metadata_item["item_id"] = item.id
        metadata_item["goal"] = "edit"
        metadata_item["extension"] = new_extension
        metadata_item["filename"] = filepath

        if new_extension in ["MP3", "OPUS", "FLAC", "OGG"]:
            MetaData.merge_audio_data(metadata_item)
        elif new_extension in ["MP4", "M4A"]:
            MetaData.merge_video_data(metadata_item)
        head, tail = os.path.split(filepath)
        move(filepath, os.path.join(head, tail[4 : len(tail)]))
        try:
            os.unlink(item.filepath)
        except Exception:
            pass
        logger.info("Edited file %s", tail)
    else:
        logger.info("File not in database")


@socketio.on("edit_metadata_request")
def edit_metadata_request(metadata_user, filepath, id):
    extension = filepath.split(".")[len(filepath.split(".")) - 1].upper()
    data = MetaData.only_userdata(filepath, metadata_user)
    if data is not False:
        data["goal"] = "edit"
        data["item_id"] = id
        data["extension"] = extension
        data["source"] = metadata_user["source"]
        if extension in ["MP3", "OPUS", "FLAC", "OGG"]:
            MetaData.merge_audio_data(data)
        elif extension in ["MP4", "M4A"]:
            MetaData.merge_video_data(data)
        elif extension in ["WAV"]:
            MetaData.merge_id3_data(data)
        else:
            return False


@bp.context_processor
def utility_processor():
    def path_exists(path):
        return os.path.exists(path)

    def get_ext(filepath):
        return filepath.split(".")[len(filepath.split(".")) - 1].upper()

    def check_metadata(filepath):
        return filepath.split(".")[len(filepath.split(".")) - 1].upper() in [
            "MP3",
            "OPUS",
            "FLAC",
            "OGG",
            "MP4",
            "M4A",
        ]

    return dict(path_exists=path_exists, get_ext=get_ext, check_metadata=check_metadata)
