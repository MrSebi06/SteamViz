import json

import requests

STEAM_API_KEY = "694E41E2DD3E371E968CCBBB0882B945"
STEAM_API_URL = "https://api.steampowered.com/"


def get_games_reviews(app_ids):
    reviewers = []
    for app_id in app_ids:
        GAME_REVIEWS_URL = "https://store.steampowered.com/appreviews/" + str(app_id)
        params = {"json": 1}

        response = requests.get(GAME_REVIEWS_URL, params=params)
        response.raise_for_status()
        data = response.json()
        reviewers.extend(
            [
                review.get("author", {}).get("steamid", "Unknown")
                for review in data.get("reviews", [])
            ]
        )

    with open(f"reviews.json", "w", encoding="utf-8") as file:
        json.dump({"user_ids": reviewers}, file, indent=4, ensure_ascii=False)


print(get_games_reviews([1903340, 1245620]))
