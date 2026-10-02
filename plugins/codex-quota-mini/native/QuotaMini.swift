import AppKit
import WebKit

struct DetailPlacement {
    let frame: NSRect
    let side: String
}

func placeDetails(anchor: NSRect, size: NSSize, screen: NSRect) -> DetailPlacement {
    let width = min(size.width, screen.width)
    let height = min(size.height, screen.height)
    let gap: CGFloat = 0
    let space: [String: CGFloat] = ["below": anchor.minY - screen.minY,
                                    "above": screen.maxY - anchor.maxY,
                                    "left": anchor.minX - screen.minX,
                                    "right": screen.maxX - anchor.maxX]
    let vertical = anchor.midY >= screen.midY ? ["below", "above"] : ["above", "below"]
    let horizontal = anchor.midX >= screen.midX ? ["left", "right"] : ["right", "left"]
    let order = vertical + horizontal
    let side = order.first { space[$0, default: 0] >= (($0 == "above" || $0 == "below") ? height : width) + gap }
        ?? order.max { space[$0, default: 0] < space[$1, default: 0] }!
    var x = anchor.midX - width / 2
    var y = anchor.midY - height / 2
    switch side {
    case "above": y = anchor.maxY + gap
    case "below": y = anchor.minY - gap - height
    case "left": x = anchor.minX - gap - width
    default: x = anchor.maxX + gap
    }
    x = max(screen.minX, min(x, screen.maxX - width))
    y = max(screen.minY, min(y, screen.maxY - height))
    return DetailPlacement(frame: NSRect(x: x, y: y, width: width, height: height), side: side)
}

func shouldDisplayOrb(enabled: Bool, globalDisplay: Bool, codexFocused: Bool) -> Bool {
    enabled && (globalDisplay || codexFocused)
}

func codexFocus(frontmostBundleID: String?, wasFocused: Bool) -> Bool {
    // Interacting with the nonactivating helper keeps the preceding app's scope.
    if frontmostBundleID == "local.codex.quota-mini" { return wasFocused }
    return frontmostBundleID == "com.openai.codex"
}

struct OrbVisibility {
    private var focused = false
    private var windowOnScreen = false
    private var awaitingActivation = false

    mutating func activated(bundleID: String?) {
        guard bundleID != "local.codex.quota-mini" else { return }
        focused = bundleID == "com.openai.codex"
        awaitingActivation = !focused
    }
    mutating func deactivated(bundleID: String?) {
        guard bundleID == "com.openai.codex" else { return }
        focused = false
        awaitingActivation = true
    }
    mutating func sample(frontmostBundleID: String?, windowOnScreen: Bool) {
        self.windowOnScreen = windowOnScreen
        // The foreground accessor can still report the old app during a Space
        // transition. Only a new activation may undo its deactivation event.
        if !awaitingActivation {
            focused = codexFocus(frontmostBundleID: frontmostBundleID, wasFocused: focused)
        }
    }
    func shouldDisplay(enabled: Bool, globalDisplay: Bool) -> Bool {
        shouldDisplayOrb(enabled: enabled, globalDisplay: globalDisplay, codexFocused: focused && windowOnScreen)
    }
}

func orbCollectionBehavior(globalDisplay: Bool) -> NSWindow.CollectionBehavior {
    [globalDisplay ? .canJoinAllSpaces : .moveToActiveSpace, .stationary, .fullScreenAuxiliary, .ignoresCycle]
}

final class FloatingWebView: WKWebView {
    var surface = "orb"
    var onHover: ((Bool) -> Void)?
    var onDragStarted: (() -> Void)?
    var onMoved: (() -> Void)?
    var onDebug: (() -> Void)?
    private var hoverTracking: NSTrackingArea?
    override var isOpaque: Bool { false }
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking = hoverTracking { removeTrackingArea(tracking) }
        let tracking = NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self, userInfo: nil)
        addTrackingArea(tracking)
        hoverTracking = tracking
    }
    override func mouseEntered(with event: NSEvent) { onHover?(true) }
    override func mouseExited(with event: NSEvent) { onHover?(false) }
    override func mouseDown(with event: NSEvent) {
        guard surface == "orb", let panel = window else { super.mouseDown(with: event); return }
        let before = panel.frame.origin
        let start = panel.convertPoint(toScreen: event.locationInWindow)
        var moved = false
        while let next = NSApp.nextEvent(matching: [.leftMouseDragged, .leftMouseUp],
                                         until: .distantFuture, inMode: .eventTracking, dequeue: true) {
            let current = panel.convertPoint(toScreen: next.locationInWindow)
            let delta = NSPoint(x: current.x - start.x, y: current.y - start.y)
            if !moved && hypot(delta.x, delta.y) >= 3 { moved = true; onDragStarted?() }
            if moved { panel.setFrameOrigin(NSPoint(x: before.x + delta.x, y: before.y + delta.y)) }
            if next.type == .leftMouseUp { break }
        }
        if moved { onMoved?() }
    }
    override func rightMouseDown(with event: NSEvent) {
        let menu = NSMenu()
        if surface == "orb" {
            let item = menu.addItem(withTitle: "调试落沙…", action: #selector(openDebug), keyEquivalent: "")
            item.target = self
            menu.addItem(.separator())
        }
        menu.addItem(withTitle: "退出 Codex Quota Mini", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        NSMenu.popUpContextMenu(menu, with: event, for: self)
    }
    @objc func openDebug() { onDebug?() }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    var panel: NSPanel!
    var detailsPanel: NSPanel!
    var web: FloatingWebView!
    var detailsWeb: FloatingWebView!
    var helper: Process?
    var timer: Timer?
    var ready = false
    var detailsReady = false
    var lastFileSnapshot: Data?
    var lastSnapshot: Data?
    var dataPath: URL!
    var helperLog: FileHandle?
    var controlPath: URL!
    var visible = true
    var globalDisplay = true
    var scope = OrbVisibility()
    var displayed = false
    var workspaceObservers: [NSObjectProtocol] = []
    var spaceWork: DispatchWorkItem?
    var spaceSettling = false
    var detailsHeight: CGFloat = 210
    var wantsDetails = false
    var showingDetails = false
    var dragging = false
    var closeWork: DispatchWorkItem?
    var debugPath: URL?
    var appearancePath: URL?
    var appearanceTheme = "system"
    var lastAppearance: Data?
    var lastDebug: Data?
    var debugEnabled = false
    var debugFlow = 1.0
    var debugSparkle = 1.0
    let sparkleStyles = ["soft", "crystal", "star", "trail", "color", "fine"]
    var debugStyle = "soft"
    var stylePicker: NSPopUpButton?
    var debugPanel: NSPanel?
    var debugToggle: NSButton?
    var flowSlider: NSSlider?
    var sparkleSlider: NSSlider?
    var flowValue: NSTextField?
    var sparkleValue: NSTextField?
    var flowTitle: NSTextField?
    var sparkleTitle: NSTextField?

    func sendAppearance(to view: WKWebView) {
        // Values are validated before insertion and contain no user-provided text.
        view.evaluateJavaScript("window.quotaMini?.setAppearance('\(appearanceTheme)')", completionHandler: nil)
    }
    func refreshAppearance() {
        guard let path = appearancePath, let data = try? Data(contentsOf: path), data != lastAppearance,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let theme = object["theme"] as? String, ["light", "dark", "system"].contains(theme) else { return }
        lastAppearance = data
        guard theme != appearanceTheme else { return }
        appearanceTheme = theme
        NSApp.appearance = theme == "system" ? nil : NSAppearance(named: theme == "dark" ? .darkAqua : .aqua)
        if ready { sendAppearance(to: web) }
        if detailsReady { sendAppearance(to: detailsWeb) }
    }

    func refreshDebug() {
        guard let path = debugPath else { return }
        let data = (try? Data(contentsOf: path)) ?? Data("{}".utf8)
        guard data != lastDebug else { return }
        let object = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        let wasEnabled = debugEnabled
        debugEnabled = object["enabled"] as? Bool ?? false
        let flow = object["flow"] as? Double ?? 1
        let sparkle = object["sparkle"] as? Double ?? 1
        debugFlow = flow.isFinite && (0...4).contains(flow) ? flow : 1
        debugSparkle = sparkle.isFinite && (0...2).contains(sparkle) ? sparkle : 1
        let style = object["style"] as? String ?? "soft"
        debugStyle = sparkleStyles.contains(style) ? style : "soft"
        lastDebug = data
        updateDebugControls()
        if ready { sendDebug() }
        if debugEnabled && !wasEnabled { showDebugPanel() }
    }
    func writeDebug(_ changes: [String: Any]) {
        guard let path = debugPath else { return }
        var settings = (try? Data(contentsOf: path)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        for (key, value) in changes { settings[key] = value }
        if settings["flow"] == nil { settings["flow"] = 1.0 }
        if settings["sparkle"] == nil { settings["sparkle"] = 1.0 }
        if settings["style"] == nil { settings["style"] = "soft" }
        guard let data = try? JSONSerialization.data(withJSONObject: settings) else { return }
        do {
            try data.write(to: path, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path.path)
            refreshDebug()
        } catch { NSLog("Could not save sand debug settings") }
    }
    func sendDebug() {
        let settings: [String: Any] = ["enabled":debugEnabled,"flow":debugFlow,"sparkle":debugSparkle,"style":debugStyle]
        guard let data = try? JSONSerialization.data(withJSONObject: settings), let json = String(data:data,encoding:.utf8) else { return }
        web?.evaluateJavaScript("window.quotaMini?.setDebug(\(json))", completionHandler:nil)
    }
    func updateDebugControls() {
        debugToggle?.state = debugEnabled ? .on : .off
        flowSlider?.doubleValue = debugFlow
        sparkleSlider?.doubleValue = debugSparkle
        let fine = debugStyle == "fine"
        flowTitle?.stringValue = fine ? "落沙流量" : "落沙流速"
        sparkleTitle?.stringValue = fine ? "透光程度" : "闪耀程度"
        flowSlider?.setAccessibilityLabel(fine ? "落沙流量，0 到 4 倍，最低逐粒落下" : "落沙流速，0 到 4 倍")
        sparkleSlider?.setAccessibilityLabel(fine ? "透光程度，0 到 2 倍，仅灰度亮度" : "闪耀程度，0 到 2 倍")
        flowValue?.stringValue = debugFlow == 0 ? "暂停" : fine && debugFlow <= 0.12 ? "逐粒" : String(format:"%.2f 倍",debugFlow)
        sparkleValue?.stringValue = debugSparkle == 0 ? "关闭" : String(format:"%.2f 倍",debugSparkle)
        flowSlider?.isEnabled = debugEnabled
        sparkleSlider?.isEnabled = debugEnabled
        stylePicker?.selectItem(at:sparkleStyles.firstIndex(of:debugStyle) ?? 0)
        stylePicker?.isEnabled = debugEnabled
    }
    func openDebug() {
        dismissDetails(immediate:true)
        writeDebug(["enabled":true])
        showDebugPanel()
    }
    func showDebugPanel() {
        if debugPanel == nil {
            let window = NSPanel(contentRect:NSRect(x:0,y:0,width:320,height:310),styleMask:[.titled,.closable,.utilityWindow,.nonactivatingPanel],backing:.buffered,defer:false)
            window.title = "落沙调试"
            window.level = .floating
            window.hidesOnDeactivate = false
            window.isReleasedWhenClosed = false
            window.delegate = self
            let content = NSView(frame:NSRect(x:0,y:0,width:320,height:310))
            window.contentView = content
            func label(_ text: String, _ x: CGFloat, _ y: CGFloat, _ width: CGFloat) -> NSTextField {
                let field = NSTextField(labelWithString:text)
                field.frame = NSRect(x:x,y:y,width:width,height:22)
                content.addSubview(field)
                return field
            }
            debugToggle = NSButton(checkboxWithTitle:"开启调试预览",target:self,action:#selector(toggleDebug(_:)))
            debugToggle!.frame = NSRect(x:20,y:269,width:280,height:24)
            content.addSubview(debugToggle!)
            let note = label("仅预览动效 · 不改变真实额度",20,242,280)
            note.textColor = .secondaryLabelColor
            flowTitle = label("落沙流速",20,207,170)
            flowValue = label("",220,207,80)
            flowValue!.alignment = .right
            flowSlider = NSSlider(value:1,minValue:0,maxValue:4,target:self,action:#selector(changeFlow(_:)))
            flowSlider!.frame = NSRect(x:20,y:176,width:280,height:24)
            flowSlider!.isContinuous = true
            flowSlider!.setAccessibilityLabel("落沙流速，0 到 4 倍")
            content.addSubview(flowSlider!)
            sparkleTitle = label("闪耀程度",20,142,170)
            sparkleValue = label("",220,142,80)
            sparkleValue!.alignment = .right
            sparkleSlider = NSSlider(value:1,minValue:0,maxValue:2,target:self,action:#selector(changeSparkle(_:)))
            sparkleSlider!.frame = NSRect(x:20,y:111,width:280,height:24)
            sparkleSlider!.isContinuous = true
            sparkleSlider!.setAccessibilityLabel("闪耀程度，0 到 2 倍")
            content.addSubview(sparkleSlider!)
            _ = label("落沙方案",20,77,280)
            stylePicker = NSPopUpButton(frame:NSRect(x:20,y:44,width:280,height:26),pullsDown:false)
            stylePicker!.addItems(withTitles:["原有柔光 · 细微反光", "晶点 · 较大的彩色亮点", "星芒 · 四角闪光", "流光 · 短短的彩色尾迹", "彩砂 · 持续可见的色彩", "细砂 · 灰度纹理与流量"])
            stylePicker!.target = self
            stylePicker!.action = #selector(changeStyle(_:))
            stylePicker!.setAccessibilityLabel("落沙方案")
            content.addSubview(stylePicker!)
            let reset = NSButton(title:"恢复默认",target:self,action:#selector(resetDebug))
            reset.bezelStyle = .rounded
            reset.frame = NSRect(x:209,y:9,width:91,height:28)
            content.addSubview(reset)
            window.center()
            debugPanel = window
        }
        updateDebugControls()
        debugPanel?.makeKeyAndOrderFront(nil)
    }
    @objc func toggleDebug(_ sender: NSButton) { writeDebug(["enabled":sender.state == .on]) }
    @objc func changeFlow(_ sender: NSSlider) { writeDebug(["flow":(sender.doubleValue*100).rounded()/100]) }
    @objc func changeSparkle(_ sender: NSSlider) { writeDebug(["sparkle":(sender.doubleValue*100).rounded()/100]) }
    @objc func changeStyle(_ sender: NSPopUpButton) {
        guard sparkleStyles.indices.contains(sender.indexOfSelectedItem) else { return }
        writeDebug(["style":sparkleStyles[sender.indexOfSelectedItem]])
    }
    @objc func resetDebug() { writeDebug(["flow":1.0,"sparkle":1.0,"style":"soft"]) }
    func windowWillClose(_ notification: Notification) {
        if notification.object as? NSWindow === debugPanel { writeDebug(["enabled":false]) }
    }

    func writeVisibility(_ value: Bool) {
        var settings = (try? Data(contentsOf: controlPath)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        settings["visible"] = value
        settings["globalDisplay"] = settings["globalDisplay"] as? Bool ?? true
        guard let data = try? JSONSerialization.data(withJSONObject: settings) else { return }
        try? data.write(to: controlPath, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: controlPath.path)
    }
    func applyVisibility() {
        if let data = try? Data(contentsOf: controlPath),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            visible = object["visible"] as? Bool ?? false
            globalDisplay = object["globalDisplay"] as? Bool ?? true
        }
        guard panel != nil else { return }
        let behavior = orbCollectionBehavior(globalDisplay: globalDisplay)
        for window in [panel, detailsPanel].compactMap({ $0 }) {
            if window.collectionBehavior != behavior { window.collectionBehavior = behavior }
        }
        if !globalDisplay {
            scope.sample(frontmostBundleID: NSWorkspace.shared.frontmostApplication?.bundleIdentifier,
                         windowOnScreen: codexWindowOnCurrentSpace())
        }
        let next = scope.shouldDisplay(enabled: visible, globalDisplay: globalDisplay) && (globalDisplay || !spaceSettling)
        setDisplayed(next)
    }
    func codexWindowOnCurrentSpace() -> Bool {
        guard let application = NSRunningApplication.runningApplications(withBundleIdentifier: "com.openai.codex").first,
              !application.isHidden,
              let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return false }
        // Only ownership/geometry metadata; no window titles or screen capture.
        return windows.contains { window in
            guard (window[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value == application.processIdentifier,
                  let layer = window[kCGWindowLayer as String] as? NSNumber,
                  layer.intValue >= 0, layer.intValue < NSWindow.Level.statusBar.rawValue,
                  let bounds = window[kCGWindowBounds as String] as? NSDictionary,
                  let rect = CGRect(dictionaryRepresentation: bounds), rect.width >= 20, rect.height >= 20 else { return false }
            return (window[kCGWindowAlpha as String] as? NSNumber)?.doubleValue ?? 1 > 0
        }
    }
    func setDisplayed(_ next: Bool) {
        guard next != displayed else { return }
        displayed = next
        if next { panel.orderFrontRegardless() } else { dismissDetails(immediate: true); panel.orderOut(nil) }
    }
    func spaceChanged() {
        spaceWork?.cancel()
        dismissDetails(immediate: true)
        guard !globalDisplay else { spaceSettling = false; return }
        // Scoped windows remain on their old Space during the transition. Hide
        // immediately; allow only reappearance to wait for new-Space metadata.
        spaceSettling = true
        setDisplayed(false)
        let work = DispatchWorkItem { [weak self] in
            self?.spaceSettling = false
            self?.applyVisibility()
        }
        spaceWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: work)
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        writeVisibility(true)
        applyVisibility()
        return true
    }
    func makePanel(_ frame: NSRect, title: String) -> NSPanel {
        let result = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        result.title = title
        result.isOpaque = false
        result.backgroundColor = .clear
        result.hasShadow = false
        result.level = .floating
        result.hidesOnDeactivate = false
        result.acceptsMouseMovedEvents = true
        result.collectionBehavior = orbCollectionBehavior(globalDisplay: globalDisplay)
        result.animationBehavior = .none
        result.isReleasedWhenClosed = false
        return result
    }
    func makeWeb(_ surface: String, panel: NSPanel, resources: URL) -> FloatingWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "quota")
        configuration.userContentController.addUserScript(WKUserScript(source: "window.quotaSurface='\(surface)'", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let result = FloatingWebView(frame: NSRect(origin: .zero, size: panel.frame.size), configuration: configuration)
        result.surface = surface
        result.autoresizingMask = [.width, .height]
        result.navigationDelegate = self
        result.underPageBackgroundColor = .clear
        result.setValue(false, forKey: "drawsBackground")
        result.onHover = { [weak self] inside in self?.hoverChanged(inside) }
        panel.contentView = result
        result.loadFileURL(resources.appendingPathComponent("ui/index.html"), allowingReadAccessTo: resources)
        return result
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        if let identifier = Bundle.main.bundleIdentifier {
            let others = NSRunningApplication.runningApplications(withBundleIdentifier: identifier)
                .filter { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }
            if !others.isEmpty { NSApp.terminate(nil); return }
        }
        guard let resources = Bundle.main.resourceURL else { NSApp.terminate(nil); return }
        let support = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Codex Quota Mini", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true,
                                               attributes: [.posixPermissions: 0o700])
        dataPath = support.appendingPathComponent("state.json")
        controlPath = support.appendingPathComponent("control.json")
        debugPath = support.appendingPathComponent("debug.json")
        appearancePath = support.appendingPathComponent("appearance.json")
        refreshAppearance()
        writeVisibility(true)
        let logPath = support.appendingPathComponent("runtime.log")
        FileManager.default.createFile(atPath: logPath.path, contents: nil, attributes: [.posixPermissions: 0o600])
        helperLog = try? FileHandle(forWritingTo: logPath)
        let child = Process()
        child.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        child.arguments = [resources.appendingPathComponent("runtime/bridge.py").path]
        child.standardOutput = helperLog
        child.standardError = helperLog
        child.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                for view in [self.web, self.detailsWeb].compactMap({ $0 }) {
                    view.evaluateJavaScript("window.quotaMini?.update({...window.quotaMini.state,activeSessions:null,activeThreads:null,activityUpdatedAt:null,status:'stale'})", completionHandler: nil)
                }
            }
        }
        do { try child.run(); helper = child } catch { NSLog("Quota helper could not start") }
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let position = UserDefaults.standard.array(forKey: "position") as? [Double]
        let left = min(max(CGFloat(position?.first ?? Double(screen.maxX - 76)), screen.minX), screen.maxX - 52)
        let top = min(max(CGFloat(position?.last ?? Double(screen.maxY - 28)), screen.minY + 52), screen.maxY)
        panel = makePanel(NSRect(x: left, y: top - 52, width: 52, height: 52), title: "Codex Quota Mini")
        detailsPanel = makePanel(NSRect(x: left, y: top - 262, width: 236, height: 210), title: "Codex Quota Mini 详情")
        detailsPanel.orderOut(nil)
        web = makeWeb("orb", panel: panel, resources: resources)
        web.onDebug = { [weak self] in self?.openDebug() }
        detailsWeb = makeWeb("details", panel: detailsPanel, resources: resources)
        web.onDragStarted = { [weak self] in self?.dragging = true; self?.dismissDetails(immediate: true) }
        web.onMoved = { [weak self] in
            guard let self = self else { return }
            self.dragging = false
            UserDefaults.standard.set([Double(self.panel.frame.minX), Double(self.panel.frame.maxY)], forKey: "position")
            if self.panel.frame.contains(NSEvent.mouseLocation) { self.hoverChanged(true) }
        }
        let center = NSWorkspace.shared.notificationCenter
        workspaceObservers.append(center.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] notification in
            let application = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            self?.scope.activated(bundleID: application?.bundleIdentifier)
            self?.applyVisibility()
        })
        workspaceObservers.append(center.addObserver(forName: NSWorkspace.didDeactivateApplicationNotification, object: nil, queue: .main) { [weak self] notification in
            let application = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
            self?.scope.deactivated(bundleID: application?.bundleIdentifier)
            self?.applyVisibility()
        })
        workspaceObservers.append(center.addObserver(forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.spaceChanged() })
        applyVisibility()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.refresh() }
    }
    func hoverChanged(_ inside: Bool) {
        guard displayed, !dragging else { return }
        closeWork?.cancel()
        if inside { showDetails(); return }
        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            let pointer = NSEvent.mouseLocation
            if self.panel.frame.contains(pointer) || (self.showingDetails && self.detailsPanel.frame.contains(pointer)) { return }
            self.dismissDetails()
        }
        closeWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.17, execute: work)
    }
    func positionDetails() {
        guard let panel = panel, let detailsPanel = detailsPanel else { return }
        let screen = panel.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let placement = placeDetails(anchor: panel.frame, size: NSSize(width: 236, height: detailsHeight), screen: screen)
        detailsWeb?.evaluateJavaScript("window.quotaMini?.setPlacement('\(placement.side)')", completionHandler: nil)
        if detailsPanel.frame != placement.frame {
            if showingDetails && !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
                NSAnimationContext.runAnimationGroup { context in
                    context.duration = 0.18
                    detailsPanel.animator().setFrame(placement.frame, display: true)
                }
            } else { detailsPanel.setFrame(placement.frame, display: true) }
        }
    }
    func showDetails() {
        wantsDetails = true
        web?.evaluateJavaScript("window.quotaMini?.setHoverResponse(true)", completionHandler: nil)
        guard detailsReady, displayed, !showingDetails else { return }
        positionDetails()
        showingDetails = true
        detailsPanel.orderFrontRegardless()
        detailsWeb.evaluateJavaScript("window.quotaMini.setExpanded(true)", completionHandler: nil)
    }
    func dismissDetails(immediate: Bool = false) {
        closeWork?.cancel()
        wantsDetails = false
        showingDetails = false
        web?.evaluateJavaScript("window.quotaMini?.setHoverResponse(false)", completionHandler: nil)
        detailsWeb?.evaluateJavaScript("window.quotaMini?.setExpanded(false)", completionHandler: nil)
        if immediate { detailsPanel?.orderOut(nil) }
    }
    func sendSnapshot(to view: WKWebView) {
        guard let data = lastSnapshot, let json = String(data: data, encoding: .utf8) else { return }
        view.evaluateJavaScript("window.quotaMini?.update(\(json))", completionHandler: nil)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView === web { ready = true } else { detailsReady = true }
        refresh()
        sendSnapshot(to: webView)
        sendAppearance(to: webView)
        if webView === web { sendDebug() }
        if wantsDetails && detailsReady { showDetails() }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }
    func refresh() {
        refreshAppearance()
        applyVisibility()
        refreshDebug()
        guard let data = try? Data(contentsOf: dataPath), data != lastFileSnapshot,
              let dictionary = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let serialized = try? JSONSerialization.data(withJSONObject: dictionary) else { return }
        lastFileSnapshot = data
        lastSnapshot = serialized
        if ready { sendSnapshot(to: web) }
        if detailsReady { sendSnapshot(to: detailsWeb) }
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let value = message.body as? [String: Any], let type = value["type"] as? String else { return }
        if type == "hover", let inside = value["inside"] as? Bool { hoverChanged(inside) }
        if type == "closeDetails" { dismissDetails() }
        if type == "detailsHidden", !wantsDetails { detailsPanel.orderOut(nil) }
        if type == "detailsSize", message.webView === detailsWeb, let height = value["height"] as? Double {
            detailsHeight = max(52, CGFloat(height))
            positionDetails()
        }
        if type == "openThread", message.webView === detailsWeb, let id = value["threadId"] as? String,
           UUID(uuidString: id) != nil, let data = lastSnapshot,
           let snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let updatedAt = snapshot["activityUpdatedAt"] as? Double,
           abs(Date().timeIntervalSince1970 - updatedAt) <= 10,
           let threads = snapshot["activeThreads"] as? [[String: Any]],
           threads.contains(where: { ($0["threadId"] as? String) == id }),
           let url = URL(string: "codex://threads/\(id)?hostId=local") {
            NSWorkspace.shared.open(url)
            dismissDetails()
        }
    }
    func applicationWillTerminate(_ notification: Notification) {
        writeDebug(["enabled":false])
        if controlPath != nil { writeVisibility(false) }
        closeWork?.cancel()
        spaceWork?.cancel()
        for observer in workspaceObservers { NSWorkspace.shared.notificationCenter.removeObserver(observer) }
        timer?.invalidate()
        if helper?.isRunning == true { helper?.terminate() }
        try? helperLog?.close()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
