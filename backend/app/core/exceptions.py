class AppError(Exception):
    """Expected application error safe to translate into a public response."""

    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


class UnsupportedFileError(AppError):
    def __init__(self, message: str = "The selected file type is not supported.") -> None:
        super().__init__(message, "UNSUPPORTED_FILE", 415)

