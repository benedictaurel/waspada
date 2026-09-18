export type Driver = {
  driver_id: string;
  name: string;
  mobile_number: string;
  emergency_contact: string;
  plate_number: string;
  raspi_unique_id: string;
  created_at: string;
};

export type DriverLog = {
  raspiUniqueId: string;
  latitude: number;
  longitude: number;
  drowsy: boolean;
  timestamp: string;
  receivedAt: string;
};
