"""Mirror only Codex's desktop appearance setting; never modify its config."""
import json
import os

try:
    import tomllib
except ImportError:
    from vendor import tomli as tomllib


class AppearanceMonitor:
    def __init__(self, config, output):
        self.config = config
        self.output = output
        self.signature = object()
        self.theme = None

    def refresh(self):
        try:
            stat = self.config.stat()
            signature = (stat.st_ino, stat.st_size, stat.st_mtime_ns)
        except FileNotFoundError:
            signature = None
        except OSError:
            return
        if signature == self.signature:
            return
        try:
            if signature is None:
                theme = 'system'
            else:
                with self.config.open('rb') as stream:
                    desktop = tomllib.load(stream).get('desktop', {})
                theme = desktop.get('appearanceTheme', 'system') if isinstance(desktop, dict) else 'system'
                if theme not in ('light', 'dark', 'system'):
                    theme = 'system'
            if theme != self.theme:
                self.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                temporary = self.output.with_suffix('.pending')
                with temporary.open('w') as stream:
                    os.chmod(temporary, 0o600)
                    json.dump({'theme': theme}, stream)
                os.replace(temporary, self.output)
                self.theme = theme
            self.signature = signature
        except (OSError, ValueError):
            # A partial or unreadable config must not cause a brief theme reversal.
            return
