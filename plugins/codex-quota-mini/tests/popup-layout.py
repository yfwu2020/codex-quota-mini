"""Compile the production placement function and check every edge and display origin."""
from pathlib import Path
import subprocess,tempfile
source=(Path(__file__).resolve().parents[1]/'native/QuotaMini.swift').read_text()
prefix=source.split('final class FloatingWebView:')[0]
assert 'func placeDetails(' in prefix, 'Adaptive popup layout must be defined separately from window mutation'
checks=r'''
let screens = [NSRect(x:0,y:0,width:1440,height:900),NSRect(x:-1440,y:80,width:1440,height:900)]
for screen in screens {
 for x in [screen.minX,screen.minX+400,screen.maxX-52] {
  for y in [screen.minY,screen.minY+400,screen.maxY-52] {
   let orb = NSRect(x:x,y:y,width:52,height:52)
   let popup = placeDetails(anchor:orb,size:NSSize(width:248,height:300),screen:screen)
   assert(screen.contains(popup.frame), "Popup must remain fully visible")
   assert(!popup.frame.intersects(orb), "Popup must not cover or move the orb")
  }
 }
}
let screen = NSRect(x:0,y:0,width:1440,height:900)
assert(placeDetails(anchor:NSRect(x:1388,y:848,width:52,height:52),size:NSSize(width:248,height:300),screen:screen).side == "below")
assert(placeDetails(anchor:NSRect(x:0,y:0,width:52,height:52),size:NSSize(width:248,height:300),screen:screen).side == "above")
let nearOrb = NSRect(x:700,y:700,width:52,height:52)
let nearPopup = placeDetails(anchor:nearOrb,size:NSSize(width:236,height:200),screen:screen)
let visibleGap = (nearOrb.minY + 4) - (nearPopup.frame.maxY - 6)
assert(visibleGap >= 6 && visibleGap <= 12, "Visible card stays close to the circle")
assert(!shouldDisplayOrb(enabled:false,globalDisplay:true,codexFocused:true))
assert(shouldDisplayOrb(enabled:true,globalDisplay:true,codexFocused:false))
assert(shouldDisplayOrb(enabled:true,globalDisplay:false,codexFocused:true))
assert(!shouldDisplayOrb(enabled:true,globalDisplay:false,codexFocused:false))
assert(codexFocus(frontmostBundleID:"com.openai.codex",wasFocused:false))
assert(!codexFocus(frontmostBundleID:"com.apple.finder",wasFocused:true))
assert(codexFocus(frontmostBundleID:"local.codex.quota-mini",wasFocused:true))
assert(!codexFocus(frontmostBundleID:"local.codex.quota-mini",wasFocused:false))
let narrow = NSRect(x:0,y:0,width:1000,height:320)
let fallback = placeDetails(anchor:NSRect(x:474,y:134,width:52,height:52),size:NSSize(width:248,height:260),screen:narrow)
assert(["left","right"].contains(fallback.side), "Use horizontal placement when vertical space is limited")
print("Popup corners, edges, second display and horizontal fallback PASS")
'''
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'layout.swift';p.write_text(prefix+checks)
 binary=Path(d)/'check'
 subprocess.run(['xcrun','swiftc','-swift-version','5',str(p),'-o',str(binary),'-framework','AppKit','-framework','WebKit'],check=True)
 subprocess.run([str(binary)],check=True)
