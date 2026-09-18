export const IMAGES = {
  logo: require("../assets/icon.png"),
  roleCustomer: require("../assets/brand/role-customer.png"),
  roleWorker: require("../assets/brand/role-worker.png"),
  roleBusiness: require("../assets/brand/role-business.png"),
  aiRobot: require("../assets/brand/ai-robot.png"),
};

export function roleImage(role?: string | null) {
  if (role === "worker") return IMAGES.roleWorker;
  if (role === "business" || role === "provider") return IMAGES.roleBusiness;
  return IMAGES.roleCustomer;
}
