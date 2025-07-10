import json
from itertools import combinations

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

    with open(f"user_ids.json", "w", encoding="utf-8") as file:
        json.dump({"user_ids": reviewers}, file, indent=4, ensure_ascii=False)


def get_users_games():
    with open("user_ids.json", "r", encoding="utf-8") as file:
        data = json.load(file)
    user_ids = data.get("user_ids", [])
    user_games_by_user_id = {user_id: [] for user_id in user_ids}
    for user_id in user_ids:
        USER_GAMES_URL = (
            f"https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
        )
        params = {
            "key": STEAM_API_KEY,
            "steamid": user_id,
            "include_appinfo": "true",
            "include_played_free_games": "true",
            "format": "json",
        }
        response = requests.get(USER_GAMES_URL, params=params)
        response.raise_for_status()
        data = response.json()
        games = data.get("response", {}).get("games", [])
        user_games_by_user_id[user_id] = [
            {
                "appid": game.get("appid"),
                "name": game.get("name"),
                "playtime_forever": (game.get("playtime_forever", 0)),
            }
            for game in games
            if game.get("playtime_forever") > 60
        ]
    with open("user_games.json", "w", encoding="utf-8") as file:
        json.dump(user_games_by_user_id, file, indent=4, ensure_ascii=False)


def get_graph_data():
    with open("user_games.json", "r", encoding="utf-8") as file:
        games_by_user_ids = json.load(file)
    graph_data = {"nodes": [], "links": []}
    game_ids_by_user_ids = {user_id: [] for user_id in games_by_user_ids.keys()}
    for user_id, games in games_by_user_ids.items():
        for game in games:
            game_ids_by_user_ids[user_id].append(game["appid"])
            parsed_game = {
                "id": game["appid"],
                "name": game["name"],
            }
            if parsed_game not in graph_data["nodes"]:
                graph_data["nodes"].append(parsed_game)

    game_links = {}
    for user_id, game_ids in game_ids_by_user_ids.items():
        for other_user_id, other_game_ids in game_ids_by_user_ids.items():
            if user_id != other_user_id:
                common_games = set(game_ids) & set(other_game_ids)
                if common_games:
                    for game1, game2 in combinations(common_games, 2):
                        if game1 != game2:
                            link = frozenset([game1, game2])
                            if link not in game_links:
                                game_links[link] = 0
                            game_links[link] += 1

    for (game1, game2), count in game_links.items():
        graph_data["links"].append({"source": game1, "target": game2, "value": count})
    with open("games.json", "w", encoding="utf-8") as file:
        json.dump(graph_data, file, indent=4, ensure_ascii=False)


# get_games_reviews([1903340, 1245620])
get_users_games()
get_graph_data()
