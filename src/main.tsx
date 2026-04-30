import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import App from "./App.tsx";

async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  PushNotifications.addListener("registration", (token) => {
    console.log("[FCM] Token:", token.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[FCM] Erro no registro:", JSON.stringify(err));
  });

  const result = await PushNotifications.requestPermissions();
  console.log("[FCM] Permissão:", result.receive);

  if (result.receive === "granted") {
    await PushNotifications.register();
  } else {
    console.warn("[FCM] Permissão de notificação negada.");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
void initPushNotifications();
