"""Verify the actual AppKit -> WebKit theme bridge without changing Codex settings."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = (root / 'native/QuotaMini.swift').read_text().rsplit('let app = NSApplication.shared', 1)[0]
checks = r'''
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
let directory = URL(fileURLWithPath:CommandLine.arguments[1])
let resources = URL(fileURLWithPath:CommandLine.arguments[2])
delegate.appearancePath = directory.appendingPathComponent("appearance.json")
delegate.controlPath = directory.appendingPathComponent("control.json")
delegate.dataPath = directory.appendingPathComponent("state.json")
delegate.debugPath = directory.appendingPathComponent("debug.json")
try! Data("{\"visible\":false,\"globalDisplay\":true}".utf8).write(to:delegate.controlPath)
func pump(_ until: () -> Bool) {
    let deadline = Date().addingTimeInterval(12)
    while !until() && Date() < deadline { RunLoop.current.run(until:Date().addingTimeInterval(0.02)) }
    assert(until(), "WebKit did not complete in time")
}
func js(_ view: WKWebView, _ code: String) -> Any? {
    var done = false
    var result: Any?
    view.evaluateJavaScript(code) { value, error in
        assert(error == nil, "JavaScript failed: \(String(describing:error))")
        result = value
        done = true
    }
    pump { done }
    return result
}
func theme(_ value: String) {
    try! Data("{\"theme\":\"\(value)\"}".utf8).write(to:delegate.appearancePath!, options:.atomic)
    delegate.refreshAppearance()
    RunLoop.current.run(until:Date().addingTimeInterval(1))
}
theme("dark") // Initial application appearance before any windows exist.
delegate.panel = delegate.makePanel(NSRect(x:0,y:0,width:52,height:52),title:"Theme test")
delegate.detailsPanel = delegate.makePanel(NSRect(x:0,y:0,width:236,height:210),title:"Details test")
delegate.web = delegate.makeWeb("orb",panel:delegate.panel,resources:resources)
delegate.detailsWeb = delegate.makeWeb("details",panel:delegate.detailsPanel,resources:resources)
pump { delegate.ready && delegate.detailsReady }
delegate.showDebugPanel()
delegate.debugPanel!.orderOut(nil)
// Hidden WKWebViews pause transition clocks; inspect palette values directly.
_ = js(delegate.web,"document.querySelector('.orb').style.transition='none'")
for value in ["light", "dark", "light", "dark"] {
    theme(value)
    assert(delegate.appearanceTheme == value)
    let expected = value == "dark" ? "rgb(37, 37, 37)" : "rgb(255, 255, 255)"
    let orbColor = js(delegate.web,"getComputedStyle(document.querySelector('.orb')).backgroundColor") as? String
    assert(orbColor == expected, "Theme \(value): expected \(expected), got \(String(describing:orbColor)); scheme \(String(describing:js(delegate.web,"document.documentElement.style.colorScheme")))")
    assert(js(delegate.detailsWeb,"getComputedStyle(document.querySelector('.details')).backgroundColor") as? String == expected)
    let name = delegate.debugPanel!.contentView!.effectiveAppearance.bestMatch(from:[.aqua,.darkAqua])
    assert(name == (value == "dark" ? .darkAqua : .aqua))
}
delegate.ready = false
delegate.web.reload()
pump { delegate.ready }
assert(js(delegate.web,"document.documentElement.style.colorScheme") as? String == "dark", "Reload must retain Codex theme")
theme("invalid")
assert(delegate.appearanceTheme == "dark")
theme("system")
assert(NSApp.appearance == nil)
assert(js(delegate.web,"document.documentElement.style.colorScheme") as? String == "")
assert(js(delegate.detailsWeb,"document.documentElement.style.colorScheme") as? String == "")
let systemDark = app.effectiveAppearance.bestMatch(from:[.aqua,.darkAqua]) == .darkAqua
assert(js(delegate.web,"matchMedia('(prefers-color-scheme: dark)').matches") as? Bool == systemDark)
print("Native orb, details and debug follow Codex light/dark; reload, invalid theme and system fallback PASS")
'''
with tempfile.TemporaryDirectory() as directory:
    script = Path(directory) / 'check.swift'
    script.write_text(source + checks)
    binary = Path(directory) / 'check'
    subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', str(script), '-o', str(binary),
                    '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
    subprocess.run([str(binary), directory, str(root)], check=True, timeout=60)
