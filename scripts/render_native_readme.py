"""Render the existing native debug panel and export its placement examples.

Uses an isolated temporary directory, never the installed app's settings.
"""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/images'
OUTPUT.mkdir(parents=True, exist_ok=True)
source = (ROOT / 'plugins/codex-quota-mini/native/QuotaMini.swift').read_text()
source = source.rsplit('let app = NSApplication.shared', 1)[0]
capture = r'''
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
app.appearance = NSAppearance(named:.aqua)
let delegate = AppDelegate()
delegate.debugPath = URL(fileURLWithPath:CommandLine.arguments[1]).appendingPathComponent("debug.json")
delegate.writeDebug(["enabled":true,"flow":1.0,"sparkle":1.0,"style":"fine"])
delegate.showDebugPanel()
delegate.debugPanel!.orderOut(nil)
delegate.debugPanel!.appearance = NSAppearance(named:.aqua)
let view = delegate.debugPanel!.contentView!
view.wantsLayer = true
view.layer!.backgroundColor = NSColor(calibratedWhite:0.96,alpha:1).cgColor
view.layoutSubtreeIfNeeded()
let bitmap = view.bitmapImageRepForCachingDisplay(in:view.bounds)!
view.cacheDisplay(in:view.bounds,to:bitmap)
try! bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[2]))
let detailHeight = Double(CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "114")!
let horizontalHeight = detailHeight + 40
let examples: [(String,NSRect,NSRect)] = [
 ("below",NSRect(x:176,y:300,width:52,height:52),NSRect(x:0,y:0,width:404,height:370)),
 ("above",NSRect(x:176,y:18,width:52,height:52),NSRect(x:0,y:0,width:404,height:370)),
 ("right",NSRect(x:12,y:horizontalHeight/2-26,width:52,height:52),NSRect(x:0,y:0,width:404,height:horizontalHeight)),
 ("left",NSRect(x:340,y:horizontalHeight/2-26,width:52,height:52),NSRect(x:0,y:0,width:404,height:horizontalHeight))
]
var result: [[String:Any]] = []
for (name,anchor,screen) in examples {
 let placed = placeDetails(anchor:anchor,size:NSSize(width:236,height:detailHeight),screen:screen)
 assert(placed.side == name)
 result.append(["side":placed.side,"screen":[screen.width,screen.height],
 "anchor":[anchor.minX,screen.height-anchor.maxY,anchor.width,anchor.height],
 "details":[placed.frame.minX,screen.height-placed.frame.maxY,placed.frame.width,placed.frame.height]])
}
let data = try! JSONSerialization.data(withJSONObject:result,options:[.sortedKeys])
print(String(data:data,encoding:.utf8)!)
'''
with tempfile.TemporaryDirectory(prefix='quota-readme-') as directory:
    temporary = Path(directory)
    swift = temporary / 'capture.swift'
    swift.write_text(source + capture)
    binary = temporary / 'capture'
    subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', str(swift), '-o', str(binary),
                    '-framework', 'AppKit', '-framework', 'WebKit'], check=True)
    import sys
    height = sys.argv[1] if len(sys.argv) > 1 else '114'
    subprocess.run([str(binary), directory, str(OUTPUT / 'debug-panel-native.png'), height], check=True)
