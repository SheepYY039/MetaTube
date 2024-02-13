import logging

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials, SpotifyOauthError

from metatube import logger, sockets


class SpotifyMetadata:
    """
    The SpotifyMetadata class represents a Spotify object that interacts with the Spotify API to retrieve metadata and perform search operations.

    Attributes:
    - client_id (str): The client ID for Spotify API authentication.
    - client_secret (str): The client secret for Spotify API authentication.
    """

    def __init__(self, client_id, client_secret) -> None:
        """
        Initializes a SpotifyMetadata object with the provided client ID and client secret.

        Parameters:
        - client_id (str): The client ID for Spotify API authentication.
        - client_secret (str): The client secret for Spotify API authentication.
        """
        try:
            self.spotify = spotipy.Spotify(
                auth_manager=SpotifyClientCredentials(
                    client_id=client_id, client_secret=client_secret
                )
            )
        except SpotifyOauthError as e:
            logger.error("Spotify authentication has failed. Error: %s", str(e))

    def search(self, data) -> bool:
        """
        Searches for a track on Spotify based on the given data.

        Args:
            data (dict): A dictionary containing the track title and maximum number of results.

        Returns:
            bool: True if the search was successful, False otherwise.
        """
        search_results = self.spotify.search(f"track:{data['title']}", data["max"])
        # If no results are found return False
        if search_results is None or search_results["tracks"]["total"] == 0:
            logging.info("No results found for %s", data["title"])
            return False
        search_results["query"] = data["title"]
        sockets.spotify_search(search_results)
        logger.info("Searched Spotify for track '%s' ", data["title"])
        return True

    def sockets_track(self, track_id: str) -> None:
        """
        Retrieves a Spotify track using the provided track ID and passes it to the `found_spotify_track` method of the `sockets` module.

        Args:
            track_id (str): The ID of the Spotify track.

        Returns:
            None
        """
        sockets.found_spotify_track(self.spotify.track(track_id))

    def fetch_track(self, track_id):
        """
        Fetches a track from Spotify based on the given track ID.

        Args:
            track_id (str): The ID of the track to fetch.

        Returns:
            dict: A dictionary containing the track information.
        """
        return self.spotify.track(track_id)

    @staticmethod
    def search_spotify(query: str, credentials: tuple) -> None:
        """
        Search for a query on Spotify using the provided credentials.

        Args:
            query (str): The search query.
            credentials: A tuple containing the client ID and client secret.

        Returns:
            None
        """

        client_id: str = credentials[0]
        client_secret: str = credentials[1]
        spotify = SpotifyMetadata(client_id, client_secret)
        spotify.search(query)
