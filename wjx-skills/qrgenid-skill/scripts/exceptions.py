class QrgenidError(Exception):
    """Base class for expected application errors."""

    error_code = "error"


class ParameterError(QrgenidError):
    error_code = "parameter_error"


class InputFileError(QrgenidError):
    error_code = "input_file_error"


class OutputError(QrgenidError):
    error_code = "output_error"


class FontUnavailableError(QrgenidError):
    error_code = "font_unavailable"

