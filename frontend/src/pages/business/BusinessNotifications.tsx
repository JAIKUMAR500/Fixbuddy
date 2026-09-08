import React from "react";
import { View } from "../../types";
import CustomerNotifications from "../customer/CustomerNotifications";

export default function BusinessNotifications({ navigate }: { navigate: (v: View) => void }) {
  return (
    <div className="lg:pt-2">
      <CustomerNotifications navigate={navigate} />
    </div>
  );
}
