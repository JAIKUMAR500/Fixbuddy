import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN = "fb_token";
const ONBOARD = "fb_onboarded";

async function read(key: string) {
  try {
    if (Platform.OS !== "web") {
      const value = await SecureStore.getItemAsync(key);
      if (value) return value;
    }
  } catch {
    /* web / missing secure store */
  }
  try {
    return (await AsyncStorage.getItem(key)) || "";
  } catch {
    return "";
  }
}

async function write(key: string, value: string) {
  if (!value) {
    try {
      if (Platform.OS !== "web") await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    if (Platform.OS !== "web") await SecureStore.setItemAsync(key, value);
  } catch {
    /* ignore */
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export async function getToken() {
  return read(TOKEN);
}

export async function setToken(token: string) {
  await write(TOKEN, token);
}

export async function getOnboarded() {
  return (await read(ONBOARD)) === "1";
}

export async function setOnboarded() {
  await write(ONBOARD, "1");
}
