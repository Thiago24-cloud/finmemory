import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import App from "./App.tsx";

async function initPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    alert("Push só funciona no app nativo (Android/iOS), não no navegador.");
    return;
  }

  // Captura o token quando registrar
  PushNotifications.addListener("registration", (token) => {
    alert("TOKEN FCM:\n" + token.value);
  });

  // Captura erro se falhar
  PushNotifications.addListener("registrationError", (err) => {
    alert("ERRO REGISTRO PUSH: " + JSON.stringify(err));
  });

  const result = await PushNotifications.requestPermissions();
  alert("Permissão de push: " + result.receive);

  if (result.receive === "granted") {
    await PushNotifications.register();
  } else {
    alert("Permissão de notificação negada. Ative nas configurações do app.");
  }
}

void initPushNotifications();

createRoot(document.getElementById("root")!).render(<App />);
