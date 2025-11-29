from dataclasses import dataclass

SURFACES = [
    "article_home", "article_page", "tv_home", "tv_guide",
    "news_live", "sports_hub"
]

PLATFORMS = ["web", "app", "tv_app"]

CONTENT_SCOPE = [
    "news", "sport", "live_news", "live_sport",
    "vod_movies", "vod_series"
]

EXPERIMENT_TYPES = [
    "layout_change", "recommendation_algo_change", "copy_test",
    "notification_timing", "content_order", "personalisation"
]

AGE_BANDS = ["16_25", "26_35", "36_45", "46_55", "56_65"]
REGIONS = ["uk", "scotland", "wales", "ni"]
DEVICES = ["mobile", "desktop", "tablet", "tv"]

METRICS = [
    "minutes_watched", "articles_viewed",
    "live_news_18_consumption", "engagement_score"
]
