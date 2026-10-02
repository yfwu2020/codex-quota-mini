"""Exercise production visibility policy through workspace notification races."""
from pathlib import Path
import subprocess, tempfile
source = (Path(__file__).resolve().parents[1] / 'native/QuotaMini.swift').read_text()
prefix = source.split('final class FloatingWebView:')[0]
checks = r'''
var scope = OrbVisibility()
scope.sample(frontmostBundleID: "com.openai.codex", windowOnScreen: true)
assert(scope.shouldDisplay(enabled: true, globalDisplay: false))
scope.deactivated(bundleID: "com.openai.codex")
assert(!scope.shouldDisplay(enabled: true, globalDisplay: false), "Deactivation hides synchronously")
scope.sample(frontmostBundleID: "com.openai.codex", windowOnScreen: true)
assert(!scope.shouldDisplay(enabled: true, globalDisplay: false), "Stale foreground samples must not undo deactivation")
scope.activated(bundleID: "com.apple.finder")
assert(!scope.shouldDisplay(enabled: true, globalDisplay: false))
scope.activated(bundleID: "com.openai.codex")
scope.sample(frontmostBundleID: "com.openai.codex", windowOnScreen: false)
assert(!scope.shouldDisplay(enabled: true, globalDisplay: false), "Codex on another desktop is not eligible")
scope.sample(frontmostBundleID: "com.openai.codex", windowOnScreen: true)
assert(scope.shouldDisplay(enabled: true, globalDisplay: false), "Returning to a visible Codex window restores the orb")
scope.sample(frontmostBundleID: "local.codex.quota-mini", windowOnScreen: true)
assert(scope.shouldDisplay(enabled: true, globalDisplay: false), "Nonactivating helper interaction preserves scope")
for app in ["com.apple.finder", "com.openai.codex", "com.apple.Safari"] {
 scope.deactivated(bundleID: "com.openai.codex")
 scope.sample(frontmostBundleID: app, windowOnScreen: false)
 assert(scope.shouldDisplay(enabled: true, globalDisplay: true), "Global visibility survives all foreground/Space changes")
 assert(!scope.shouldDisplay(enabled: false, globalDisplay: true), "Master switch remains authoritative")
}
let global = orbCollectionBehavior(globalDisplay: true)
let scoped = orbCollectionBehavior(globalDisplay: false)
assert(global.contains(.stationary) && global.contains(.canJoinAllSpaces))
assert(scoped.contains(.stationary) && scoped.contains(.moveToActiveSpace))
assert(!global.contains(.transient) && !scoped.contains(.canJoinAllSpaces))
print("Desktop visibility: immediate hide, stale sample guard, current-Space gate and global continuity PASS")
'''
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / 'visibility.swift'
    path.write_text(prefix + checks)
    binary = Path(directory) / 'check'
    subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', str(path), '-o', str(binary), '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
    subprocess.run([str(binary)], check=True)
