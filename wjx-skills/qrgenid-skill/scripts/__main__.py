from __future__ import annotations

import sys


def _hide_frozen_console() -> None:
    if not getattr(sys, "frozen", False) or sys.platform != "win32":
        return
    try:
        import ctypes

        window = ctypes.windll.kernel32.GetConsoleWindow()
        if window:
            ctypes.windll.user32.ShowWindow(window, 0)
    except OSError:
        pass


def main() -> int:
    if len(sys.argv) == 1:
        _hide_frozen_console()
        from .gui import main as gui_main

        return gui_main()
    from .cli import main as cli_main

    return cli_main()


if __name__ == "__main__":
    raise SystemExit(main())