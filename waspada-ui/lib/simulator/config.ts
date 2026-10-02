/** Edit the scene here. Changes apply after a reload (rebuild for production). */
export const simulatorConfig = {
  timeOfDay: "daylight" as "daylight" | "dusk",
  traffic: true,
  trafficCount: 12,
  citySeed: 41,
  fieldOfView: 66,
  eyeHeight: 1.65,
  speedLimitKmh: 40, // Dashboard sign; does not restrict the vehicle speed.
  creditsImage: "/simulator/credits-placeholder.svg", // Files live in public/.
  spawn: { x: 4, z: 64, heading: 0 }, // Metres / radians; heading 0 faces -Z.
};
