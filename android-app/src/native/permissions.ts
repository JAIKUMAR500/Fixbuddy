export const ANDROID_PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
] as const;

export const PERMISSION_USES = {
  location: ["customer/request-status", "shared/active-job", "worker/jobs"],
  camera: ["shared/account"],
  microphone: ["shared/messages"],
} as const;
