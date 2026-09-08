import React from "react";
import { View } from "../../types";
import MessagesInbox from "../shared/MessagesInbox";

export default function CustomerMessages({ navigate }: { navigate: (v: View) => void }) {
  return <MessagesInbox navigate={navigate} mine="customer" />;
}
