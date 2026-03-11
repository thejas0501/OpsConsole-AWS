"use client";
import { createContext, useContext, useState, ReactNode } from "react";

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-south-2", label: "Asia Pacific (Hyderabad)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-west-3", label: "Europe (Paris)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "eu-north-1", label: "Europe (Stockholm)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "me-south-1", label: "Middle East (Bahrain)" },
  { value: "af-south-1", label: "Africa (Cape Town)" },
];

interface RegionCtx {
  region: string;
  setRegion: (r: string) => void;
  regions: typeof AWS_REGIONS;
  regionLabel: string;
}

const RegionContext = createContext<RegionCtx>({
  region: "ap-south-1",
  setRegion: () => {},
  regions: AWS_REGIONS,
  regionLabel: "Asia Pacific (Mumbai)",
});

export function RegionProvider({ children, defaultRegion }: { children: ReactNode; defaultRegion?: string }) {
  const [region, setRegion] = useState(defaultRegion || process.env.NEXT_PUBLIC_AWS_DEFAULT_REGION || "ap-south-1");
  const regionLabel = AWS_REGIONS.find(r => r.value === region)?.label || region;

  return (
    <RegionContext.Provider value={{ region, setRegion, regions: AWS_REGIONS, regionLabel }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
