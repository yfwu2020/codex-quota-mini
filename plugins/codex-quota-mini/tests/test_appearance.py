import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'runtime'))
from appearance import AppearanceMonitor


class AppearanceTests(unittest.TestCase):
    def test_desktop_setting_and_toml_variations(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            config, output = root / 'config.toml', root / 'appearance.json'
            monitor = AppearanceMonitor(config, output)
            for text, expected in [
                ('[desktop]\nappearanceTheme = "dark"', 'dark'),
                ('desktop.appearanceTheme = "light"', 'light'),
                ('["desktop"]\n"appearanceTheme" = \'system\'', 'system'),
                ('[unrelated]\nappearanceTheme = "dark"', 'system'),
                ('[desktop]\nappearanceTheme = "invalid"', 'system'),
                ('[desktop]\nappearanceTheme = 3', 'system'),
            ]:
                config.write_text(text)
                monitor.refresh()
                self.assertEqual(output.read_text(), '{"theme": "' + expected + '"}')
                self.assertEqual(config.read_text(), text)

    def test_missing_default_and_invalid_write_retains_last_theme(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            config, output = root / 'config.toml', root / 'appearance.json'
            monitor = AppearanceMonitor(config, output)
            monitor.refresh()
            self.assertEqual(output.read_text(), '{"theme": "system"}')
            config.write_text('[desktop]\nappearanceTheme="dark"')
            monitor.refresh()
            dark_stamp = output.stat().st_mtime_ns
            config.write_text('[desktop]\nappearanceTheme="')
            monitor.refresh()
            self.assertEqual(output.read_text(), '{"theme": "dark"}')
            self.assertEqual(output.stat().st_mtime_ns, dark_stamp)
            config.unlink()
            monitor.refresh()
            self.assertEqual(output.read_text(), '{"theme": "system"}')

    def test_no_rewrites_for_same_theme_and_atomic_config_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            config, output = root / 'config.toml', root / 'appearance.json'
            config.write_text('desktop.appearanceTheme="light"')
            monitor = AppearanceMonitor(config, output)
            monitor.refresh()
            stamp = output.stat().st_mtime_ns
            monitor.refresh()
            config.write_text('desktop.appearanceTheme="light"\nmodel="other"')
            monitor.refresh()
            self.assertEqual(output.stat().st_mtime_ns, stamp)
            replacement = root / 'new.toml'
            replacement.write_text('desktop.appearanceTheme="dark"')
            replacement.replace(config)
            monitor.refresh()
            self.assertEqual(output.read_text(), '{"theme": "dark"}')
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertFalse(list(root.glob('*.pending')))


if __name__ == '__main__':
    unittest.main()
