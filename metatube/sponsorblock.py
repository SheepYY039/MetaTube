from json import JSONDecodeError
from typing import List

import sponsorblock
from sponsorblock.errors import InvalidJSONException, NotFoundException
from sponsorblock.models import Segment

from metatube import logger


def segments(url) -> list[Segment]:
    # return "404"
    client = sponsorblock.Client()
    logger.info("Fetching sponsorblock segments for %s", url)
    response = []

    try:
        sp_segments: List[Segment] = client.get_skip_segments(url)

        for segment in sp_segments:
            response.append(segment.data)
    except JSONDecodeError:
        logger.warning("JSONDecodeError for %s", str(url))
    except InvalidJSONException:
        logger.warning("Invalid JSON for %s", str(url))

    except NotFoundException:

        logger.warning("No segments found for %s", str(url))

    except Exception as e:
        logger.error("Error in metatube/sponsorblock.py: %s", str(e))

    return response
