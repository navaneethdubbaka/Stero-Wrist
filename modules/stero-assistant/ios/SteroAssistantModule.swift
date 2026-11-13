import ExpoModulesCore

public class SteroAssistantModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SteroAssistant")

    Events("assistantActivate")

    AsyncFunction("isDefaultAssistant") { () -> Bool in
      false
    }

    AsyncFunction("openAssistantSettings") { () in
      // No iOS default-assistant role equivalent for third-party apps.
    }

    AsyncFunction("startInputRoute") { (_ preferWatch: Bool) -> [String: Any] in
      [
        "label": "Phone mic",
        "kind": "phone",
        "scoOn": false,
        "hfpAvailable": false,
      ]
    }

    AsyncFunction("stopInputRoute") { () in }

    AsyncFunction("getActiveInputInfo") { () -> [String: Any] in
      [
        "label": "Phone mic",
        "kind": "phone",
        "scoOn": false,
        "hfpAvailable": false,
      ]
    }

    AsyncFunction("consumePendingActivation") { () -> [String: Any]? in
      nil
    }

    AsyncFunction("startMicForegroundService") { () in }

    AsyncFunction("stopMicForegroundService") { () in }
  }
}
