import deezer

from metatube import sockets


class Deezer:

    @staticmethod
    def socket_search(data):
        client = deezer.Client()
        search_results = client.search(data["title"], artist=data["artist"])
        result_list = []
        for item in search_results:
            result_list.append(item.as_dict())
        max_list = result_list[0 : int(data["max"])]
        max_list.append(data["title"])
        sockets.deezer_search(max_list)

    def search_id(self, _id):
        client = deezer.Client()
        return client.get_track(_id).as_dict()

    def sockets_track(self, track_id) -> None:
        client = deezer.Client()
        sockets.deezer_track(client.get_track(track_id).as_dict())
