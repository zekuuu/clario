import re


def normalize_text(value: object, case_insensitive: bool = False) -> str:
    if value is None:
        return ""
    text = re.sub(r"\s+", " ", str(value).replace("\r", " ").replace("\n", " ")).strip()
    return text.casefold() if case_insensitive else text


def similar_text_key(value: object) -> str:
    """Compare key that ignores case, whitespace, and punctuation ("500 g," == "500g")."""
    return re.sub(r"[\W_]+", "", normalize_text(value, True))
