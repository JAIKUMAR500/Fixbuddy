import React from "react";
import { View } from "../../types";
import MessagesInbox from "../shared/MessagesInbox";
import { useApp } from "../../api/AppContext";

export default function BusinessMessages({ navigate }: { navigate: (v: View) => void }) {
  const { user } = useApp();
  return <MessagesInbox navigate={navigate} mine={user?.role === "worker" ? "provider" : "customer"} />;
}
