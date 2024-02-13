from metatube import socketio


def download_settings(message) -> None:
    socketio.emit("download_settings", message)


def change_template(message) -> None:
    socketio.emit("change_template", message)


def template_settings(message) -> None:
    socketio.emit("template_settings", message)


def search_video(message) -> None:
    socketio.emit("search_video", message)


def overview(message) -> None:
    socketio.emit("overview", message)


def musicbrainz_results(data) -> None:
    socketio.emit("mbp_response", data)


def youtube_results(data, download_form, metadata_form) -> None:
    socketio.emit("ytdl_response", (data, download_form, metadata_form))


def filename_template(data) -> None:
    socketio.emit("ytdl_template", data)


def edit_metadata(data) -> None:
    socketio.emit("edit_metadata", data)


def edit_file(data) -> None:
    socketio.emit("edit_file", data)


def metadata_log(msg) -> None:
    socketio.emit("metadata_log", msg)


def search_item(data) -> None:
    socketio.emit("search_item", data)


def youtube_search(data) -> None:
    socketio.emit("youtube_search", data)


def spotify_search(data) -> None:
    socketio.emit("spotify_response", data)


def genius_search(data) -> None:
    socketio.emit("genius_response", data)


def found_genius_song(data) -> None:
    socketio.emit("genius_song", data)


def found_genius_album(data) -> None:
    socketio.emit("genius_album", data)


def found_spotify_track(data) -> None:
    socketio.emit("spotify_track", data)


def deezer_search(data) -> None:
    socketio.emit("deezer_response", data)


def deezer_track(data) -> None:
    socketio.emit("deezer_track", data)


def download_progress(downloaded_bytes, total_bytes) -> None:
    socketio.emit(
        "download_progress",
        {
            "status": "downloading",
            "downloaded_bytes": downloaded_bytes,
            "total_bytes": total_bytes,
        },
    )


def postprocessing(postprocessor) -> None:
    """
    Emit a socketio event for postprocessing.

    Args:
        postprocessor: The postprocessor to be sent in the event payload.
    """
    socketio.emit("postprocessing", {"postprocessor": postprocessor})


def finished_postprocessor(postprocessor, filepath) -> None:
    socketio.emit(
        "finished_postprocessor",
        {"postprocessor": postprocessor, "filepath": filepath},
    )


def finished_download() -> None:
    socketio.emit("finished_download")


def finished_metadata(response) -> None:
    socketio.emit(
        "finished_metadata", {"status": "finished_metadata", "data": response}
    )


def metadata_error(error) -> None:
    socketio.emit("download_error", {"status": "error", "message": error})


def download_errors(message) -> None:
    socketio.emit("download_error", message)
