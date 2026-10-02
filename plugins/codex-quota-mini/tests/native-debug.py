from pathlib import Path
import subprocess,tempfile
source=(Path(__file__).resolve().parents[1]/'native/QuotaMini.swift').read_text().rsplit('let app = NSApplication.shared',1)[0]
checks=r'''
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
delegate.debugPath = URL(fileURLWithPath:CommandLine.arguments[1]).appendingPathComponent("debug.json")
delegate.writeDebug(["enabled":false,"flow":1.0,"sparkle":1.0])
delegate.showDebugPanel()
delegate.debugPanel!.orderOut(nil)
assert(delegate.flowSlider!.minValue == 0 && delegate.flowSlider!.maxValue == 4)
assert(delegate.sparkleSlider!.minValue == 0 && delegate.sparkleSlider!.maxValue == 2)
assert(!delegate.flowSlider!.isEnabled)
delegate.debugToggle!.state = .on
delegate.toggleDebug(delegate.debugToggle!)
delegate.debugPanel!.orderOut(nil)
assert(delegate.debugEnabled && delegate.flowSlider!.isEnabled)
delegate.flowSlider!.doubleValue = 0
delegate.changeFlow(delegate.flowSlider!)
assert(delegate.debugFlow == 0 && delegate.flowValue!.stringValue == "暂停")
delegate.sparkleSlider!.doubleValue = 2
delegate.changeSparkle(delegate.sparkleSlider!)
assert(delegate.debugSparkle == 2 && delegate.debugFlow == 0)
let data = try! Data(contentsOf:delegate.debugPath!)
let settings = try! JSONSerialization.jsonObject(with:data) as! [String:Any]
assert(settings["enabled"] as! Bool && settings["flow"] as! Double == 0)
assert(delegate.stylePicker!.numberOfItems == 6)
delegate.stylePicker!.selectItem(at:2)
delegate.changeStyle(delegate.stylePicker!)
assert(delegate.debugStyle == "star")
delegate.stylePicker!.selectItem(at:5)
delegate.changeStyle(delegate.stylePicker!)
assert(delegate.debugStyle == "fine" && delegate.flowTitle!.stringValue == "落沙流量" && delegate.sparkleTitle!.stringValue == "透光程度")
delegate.flowSlider!.doubleValue = 0.1
delegate.changeFlow(delegate.flowSlider!)
assert(delegate.flowValue!.stringValue == "逐粒")
assert(delegate.debugStyle == "fine")
delegate.resetDebug()
assert(delegate.debugFlow == 1 && delegate.debugSparkle == 1 && delegate.debugStyle == "soft")
delegate.windowWillClose(Notification(name:NSWindow.willCloseNotification,object:delegate.debugPanel!))
assert(!delegate.debugEnabled && !delegate.flowSlider!.isEnabled)
if let view=delegate.debugPanel!.contentView, let bitmap=view.bitmapImageRepForCachingDisplay(in:view.bounds) {
 view.cacheDisplay(in:view.bounds,to:bitmap)
 try! bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"/tmp/quota-native-debug.png"))
}
print("Native debug panel, sliders, persistence, reset and close-to-auto PASS")
'''
with tempfile.TemporaryDirectory() as directory:
 p=Path(directory)/'check.swift';p.write_text(source+checks);binary=Path(directory)/'check'
 subprocess.run(['xcrun','swiftc','-swift-version','5',str(p),'-o',str(binary),'-framework','AppKit','-framework','WebKit'],check=True)
 subprocess.run([str(binary),directory],check=True)
