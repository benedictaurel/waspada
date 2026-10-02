import type { Metadata } from "next";
import { DrivingSimulator } from "@/components/simulator/driving-simulator";
import "./simulator.css";

export const metadata: Metadata = { title: "Waspada | Driving simulator", description: "A fullscreen city driving simulator with keyboard and racing wheel controls." };
export default function SimulatorPage() { return <DrivingSimulator />; }
