from lyricsgenius import Genius as genius_obj

from metatube import logger, sockets


class Genius:
    def __init__(self, client_id):
        try:
            self.genius = genius_obj(client_id)
        except TypeError as e:
            logger.error("Genius API failed: %s", str(e))

    def search(self, data):
        search = self.genius.search_songs(data["title"], data["max"])
        sockets.genius_search(search)
        logger.info("Searched Genius for track '%s' ", data["title"])

    @staticmethod
    def search_song(data, token):
        genius = Genius(token)
        genius.search(data)

    def fetch_song(self, _id):
        return self.genius.song(_id)

    def fetch_lyrics(self, url):
        return self.genius.lyrics(url)

    def fetch_album(self, _id):
        sockets.found_genius_album(self.genius.album_tracks(_id))
