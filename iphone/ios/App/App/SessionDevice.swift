import UIKit
import Capacitor
import EventKit
import EventKitUI
import UserNotifications

class PerformanceViewController: CAPBridgeViewController {
    private var loadingCover: UIView?
    override func viewDidLoad() {
        super.viewDidLoad()
        let cover = UIView(); cover.backgroundColor = UIColor(red:23/255,green:61/255,blue:43/255,alpha:1)
        cover.frame = view.bounds; cover.autoresizingMask = [.flexibleWidth,.flexibleHeight]
        let logo = UIImageView(image: UIImage(named:"LaunchLogo")?.withRenderingMode(.alwaysTemplate)); logo.contentMode = .scaleAspectFit; logo.tintColor = .white
        logo.translatesAutoresizingMaskIntoConstraints = false; cover.addSubview(logo)
        NSLayoutConstraint.activate([logo.centerXAnchor.constraint(equalTo:cover.centerXAnchor),logo.centerYAnchor.constraint(equalTo:cover.centerYAnchor),logo.widthAnchor.constraint(equalToConstant:128),logo.heightAnchor.constraint(equalToConstant:125)])
        view.addSubview(cover); loadingCover = cover
        // Avoid trapping users behind a loading screen if account services are unavailable.
        DispatchQueue.main.asyncAfter(deadline:.now()+15) { [weak self] in self?.finishLoading() }
    }
    func finishLoading() { loadingCover?.removeFromSuperview(); loadingCover=nil }
    override func capacitorDidLoad() { bridge?.registerPluginInstance(SessionDevice()) }
}

@objc(SessionDevice)
public class SessionDevice: CAPPlugin, CAPBridgedPlugin, EKEventEditViewDelegate, UNUserNotificationCenterDelegate {
    public let identifier = "SessionDevice"
    public let jsName = "SessionDevice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addToCalendar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOwner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncReminders", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remoteStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "registerRemote", returnType: CAPPluginReturnPromise)
    ]
    private var calendarCall: CAPPluginCall?
    private let eventStore = EKEventStore()
    private var remoteCall: CAPPluginCall?
    private var observers: [NSObjectProtocol] = []
    private var revision = 0
    private let prefix = "pp-session-"
    private var owner: String { get { UserDefaults.standard.string(forKey: "pp-reminder-owner") ?? "" } set { UserDefaults.standard.set(newValue, forKey: "pp-reminder-owner") } }
    private var remoteEnabled: Bool { Bundle.main.object(forInfoDictionaryKey: "PPRemoteNotificationsEnabled") as? Bool == true }
    public override func load() {
        UNUserNotificationCenter.current().delegate = self
        observers.append(NotificationCenter.default.addObserver(forName: Notification.Name("PPPushToken"), object: nil, queue: .main) { [weak self] note in
            guard let self = self, let data = note.object as? Data else { return }
            let token = data.map { String(format: "%02x", $0) }.joined()
            #if DEBUG
            let environment = "sandbox"
            #else
            let environment = "production"
            #endif
            self.remoteCall?.resolve(["token": token, "environment": environment]); self.remoteCall = nil
        })
        observers.append(NotificationCenter.default.addObserver(forName: Notification.Name("PPPushError"), object: nil, queue: .main) { [weak self] _ in
            self?.remoteCall?.reject("Push registration is unavailable in this build."); self?.remoteCall = nil
        })
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
    @objc func ready(_ call: CAPPluginCall) { DispatchQueue.main.async { (self.bridge?.viewController as? PerformanceViewController)?.finishLoading(); call.resolve() } }
    @objc func remoteStatus(_ call: CAPPluginCall) { call.resolve(["enabled": remoteEnabled]) }
    @objc func registerRemote(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.remoteEnabled else { call.reject("Remote notifications are not activated."); return }
            guard self.remoteCall == nil else {call.reject("Registration is already in progress.");return}
            self.remoteCall = call; UIApplication.shared.registerForRemoteNotifications()
            DispatchQueue.main.asyncAfter(deadline: .now()+20) { [weak self] in
                guard let self = self, self.remoteCall === call else { return }
                call.reject("Push registration timed out."); self.remoteCall = nil
            }
        }
    }
    @objc func requestPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert,.sound,.badge]) { granted,error in
            if let error = error {call.reject("Notification permission could not be checked.", nil, error)} else {call.resolve(["granted":granted])}
        }
    }
    private func clearReminders(completion: @escaping () -> Void) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { requests in
            center.removePendingNotificationRequests(withIdentifiers: requests.filter{$0.identifier.hasPrefix(self.prefix)}.map{$0.identifier})
            center.removeAllDeliveredNotifications()
            completion()
        }
    }
    @objc func setOwner(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let next = call.getString("owner") ?? ""
            guard self.owner != next else { call.resolve(); return }
            self.revision += 1; self.owner = next
            UIApplication.shared.unregisterForRemoteNotifications()
            self.clearReminders { call.resolve() }
        }
    }
    @objc func disable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.revision += 1
            UIApplication.shared.unregisterForRemoteNotifications()
            self.clearReminders {call.resolve()}
        }
    }
    @objc func syncReminders(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let owner = call.getString("owner"), !owner.isEmpty, owner == self.owner else {call.reject("Account changed.");return}
            self.revision += 1; let revision = self.revision
            let rows = call.getArray("reminders", JSObject.self) ?? []
            let center = UNUserNotificationCenter.current()
            center.getNotificationSettings { settings in
                DispatchQueue.main.async {
                    guard revision == self.revision, owner == self.owner else {call.resolve();return}
                    guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {call.reject("Notifications are not allowed.");return}
                    self.clearReminders {
                        DispatchQueue.main.async {
                            guard revision == self.revision, owner == self.owner else {call.resolve();return}
                            let group = DispatchGroup(); var failed = false
                            for row in rows.prefix(60) {
                                guard let id = row["id"] as? String, let millis = row["at"] as? Double else {continue}
                                let date = Date(timeIntervalSince1970: millis/1000)
                                guard date > Date() else {continue}
                                let content = UNMutableNotificationContent()
                                content.title = "Training in 1 hour"; content.body = "Your Pacific Performance training session starts in one hour."
                                content.sound = .default; content.userInfo = ["sessionId": id]
                                var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!
                                let components = calendar.dateComponents([.year,.month,.day,.hour,.minute,.second,.timeZone], from: date)
                                group.enter()
                                center.add(UNNotificationRequest(identifier: self.prefix+id,content: content,trigger: UNCalendarNotificationTrigger(dateMatching: components,repeats: false))) {error in
                                    DispatchQueue.main.async { if error != nil {failed=true}; group.leave() }
                                }
                            }
                            group.notify(queue:.main) { if failed {call.reject("Some reminders could not be scheduled.")} else {call.resolve()} }
                        }
                    }
                }
            }
        }
    }
    @objc func addToCalendar(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard #available(iOS 17.0, *) else {call.reject("Adding to Calendar requires iOS 17 or later.");return}
            let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime,.withFractionalSeconds]
            func date(_ value:String) -> Date? { if let result=formatter.date(from:value){return result};return ISO8601DateFormatter().date(from:value) }
            guard let a=call.getString("start"),let b=call.getString("end"),let start=date(a),let end=date(b),end>start,
                  let controller=self.bridge?.viewController, self.calendarCall == nil, controller.presentedViewController == nil else {call.reject("Calendar is unavailable or the session dates are invalid.");return}
            self.calendarCall=call
            let event=EKEvent(eventStore:self.eventStore);event.title=call.getString("title") ?? "Pacific Performance training"
            event.addAlarm(EKAlarm(relativeOffset: -3600))
            event.startDate=start;event.endDate=end;event.location=call.getString("location");event.notes=call.getString("notes")
            let editor=EKEventEditViewController();editor.eventStore=self.eventStore;editor.event=event;editor.editViewDelegate=self
            editor.isModalInPresentation=true
            controller.present(editor,animated:true)
        }
    }
    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        controller.dismiss(animated:true)
        calendarCall?.resolve(["saved":action == .saved]);calendarCall=nil
    }
    public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner,.sound])
        notifyListeners("sessionNotification",data:[:])
    }
    public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        notifyListeners("sessionNotification",data:[:],retainUntilConsumed:true);completionHandler()
    }
}
