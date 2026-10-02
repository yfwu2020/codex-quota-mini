"""Check actual native panel configuration and ordering without displaying windows."""
from pathlib import Path
import subprocess, tempfile
source = (Path(__file__).resolve().parents[1] / 'native/QuotaMini.swift').read_text()
source = source.rsplit('let app = NSApplication.shared', 1)[0]
checks = r'''
final class RecordingPanel: NSPanel {
 var shows = 0
 var hides = 0
 override func orderFrontRegardless() { shows += 1 }
 override func orderOut(_ sender: Any?) { hides += 1 }
}
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
let support = URL(fileURLWithPath: CommandLine.arguments[1])
delegate.controlPath = support.appendingPathComponent("control.json")
func settings(_ enabled: Bool, _ global: Bool) {
 let data = try! JSONSerialization.data(withJSONObject: ["visible":enabled,"globalDisplay":global])
 try! data.write(to: delegate.controlPath, options: .atomic)
}
let frame = NSRect(x:20,y:20,width:52,height:52)
let configured = delegate.makePanel(frame, title:"Test")
assert(configured.animationBehavior == .none, "Native ordering must not add its own fades")
assert(configured.collectionBehavior.contains(.stationary))
let orb = RecordingPanel(contentRect:frame,styleMask:.borderless,backing:.buffered,defer:false)
let details = RecordingPanel(contentRect:frame,styleMask:.borderless,backing:.buffered,defer:false)
delegate.panel = orb
delegate.detailsPanel = details
settings(true, true)
delegate.applyVisibility()
assert(orb.shows == 1 && orb.hides == 0)
for _ in 0..<10 {
 delegate.scope.deactivated(bundleID:"com.openai.codex")
 delegate.spaceChanged()
 delegate.applyVisibility()
}
assert(orb.shows == 1 && orb.hides == 0, "Global Spaces changes must never reorder the orb")
settings(false, true)
delegate.applyVisibility()
delegate.applyVisibility()
assert(orb.hides == 1, "Disable orders out exactly once")
settings(true, false)
delegate.scope.activated(bundleID:"com.openai.codex")
delegate.scope.sample(frontmostBundleID:"com.openai.codex",windowOnScreen:true)
delegate.setDisplayed(true)
let before = orb.hides
delegate.scope.deactivated(bundleID:"com.openai.codex")
delegate.applyVisibility()
assert(orb.hides == before + 1 && !delegate.displayed, "Deactivation hides before returning, without a polling delay")
assert(!orb.collectionBehavior.contains(.canJoinAllSpaces))
delegate.setDisplayed(true)
delegate.spaceChanged()
assert(!delegate.displayed && delegate.spaceSettling, "Scoped Space changes hide immediately; only showing is deferred")
delegate.spaceWork?.cancel()
print("Native panels: no automatic fades, no global reorder, synchronous scoped hide PASS")
'''
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / 'native-check.swift'
    path.write_text(source + checks)
    binary = Path(directory) / 'check'
    subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', str(path), '-o', str(binary), '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
    subprocess.run([str(binary), directory], check=True)
